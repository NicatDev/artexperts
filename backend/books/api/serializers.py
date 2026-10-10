from rest_framework import serializers
import json
from books.models import Book, BookTranslation, BookContributor, BookContributorLink, BookAccess, BookCategory, AvailabilityMode
from users.models import User


class BookContributorSerializer(serializers.ModelSerializer):
    role = serializers.CharField(read_only=True)
    full_name = serializers.CharField(source='contributor.full_name', read_only=True)
    bio = serializers.CharField(source='contributor.bio', read_only=True)
    linked_username = serializers.CharField(source='contributor.linked_user.artist_profile.username', read_only=True, default=None)

    class Meta:
        model = BookContributorLink
        fields = ['id', 'full_name', 'role', 'bio', 'linked_username', 'order']


class BookTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookTranslation
        fields = ['id', 'language', 'title', 'slug', 'short_description', 'full_description', 'table_of_contents']


class BookCategorySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = BookCategory
        fields = ['id', 'slug', 'name_az', 'name_en', 'name_ru', 'name']

    def get_name(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return getattr(obj, f'name_{lang}', obj.name_az)


class BookListSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    slug = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    contributors = serializers.SerializerMethodField()
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            'id', 'title', 'slug', 'short_description', 'cover_image',
            'contributors', 'availability_mode', 'price', 'currency',
            'publication_year', 'publisher', 'page_count',
            'is_featured', 'is_founder_book', 'category_slug', 'category_name', 'views_count', 'created_at'
        ]

    def _get_translation(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        translations = getattr(obj, 'prefetched_translations', None)
        if translations is not None:
            for t in translations:
                if t.language == lang:
                    return t
            return translations[0] if translations else None
        return obj.translations.filter(language=lang).first() or obj.translations.first()

    def get_title(self, obj):
        t = self._get_translation(obj)
        return t.title if t else "Untitled Book"

    def get_slug(self, obj):
        t = self._get_translation(obj)
        return t.slug if t else str(obj.id)

    def get_short_description(self, obj):
        t = self._get_translation(obj)
        return t.short_description if t else ""

    def get_category_name(self, obj):
        if not obj.category:
            return None
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return getattr(obj.category, f'name_{lang}', obj.category.name_az)

    def get_contributors(self, obj):
        links = obj.contributor_links.select_related('contributor').all()
        return [
            {
                "name": link.contributor.full_name,
                "role": link.role
            } for link in links
        ]


class BookDetailSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    slug = serializers.SerializerMethodField()
    short_description = serializers.SerializerMethodField()
    full_description = serializers.SerializerMethodField()
    table_of_contents = serializers.SerializerMethodField()
    translations = BookTranslationSerializer(many=True, read_only=True)
    contributors = BookContributorSerializer(source='contributor_links', many=True, read_only=True)

    has_digital_file = serializers.SerializerMethodField()
    has_download_access = serializers.SerializerMethodField()
    can_manage_access = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = [
            'id', 'title', 'slug', 'short_description', 'full_description',
            'table_of_contents', 'cover_image', 'contributors', 'availability_mode',
            'price', 'currency', 'publication_year', 'isbn', 'publisher',
            'languages', 'page_count', 'is_featured', 'is_founder_book',
            'views_count', 'downloads_count', 'moderation_status', 'rejection_reason',
            'has_digital_file', 'has_download_access', 'can_manage_access',
            'category', 'translations', 'created_at'
        ]

    def _get_translation(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return obj.translations.filter(language=lang).first() or obj.translations.first()

    def get_title(self, obj):
        t = self._get_translation(obj)
        return t.title if t else ""

    def get_slug(self, obj):
        t = self._get_translation(obj)
        return t.slug if t else str(obj.id)

    def get_short_description(self, obj):
        t = self._get_translation(obj)
        return t.short_description if t else ""

    def get_full_description(self, obj):
        t = self._get_translation(obj)
        return t.full_description if t else ""

    def get_table_of_contents(self, obj):
        t = self._get_translation(obj)
        return t.table_of_contents if t else ""

    def get_has_digital_file(self, obj):
        return bool(obj.digital_file)

    def get_has_download_access(self, obj):
        request = self.context.get('request')
        if not obj.digital_file:
            return False
        if obj.availability_mode == AvailabilityMode.FREE:
            return True
        if not request or not request.user or not request.user.is_authenticated:
            return False
        if request.user == obj.owner or request.user.is_staff:
            return True
        # Check active BookAccess grant
        grant = BookAccess.objects.filter(book=obj, user=request.user, revoked_at__isnull=True).first()
        return bool(grant and grant.is_active)

    def get_can_manage_access(self, obj):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return False
        return request.user == obj.owner or request.user.is_staff


class GrantBookAccessSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    expires_in_days = serializers.IntegerField(required=False, default=None, min_value=1)

    def validate_email(self, value):
        value = value.lower().strip()
        user = User.objects.filter(email=value, is_active=True).first()
        if not user:
            raise serializers.ValidationError("No registered user found with this email.")
        return value


class BookAccessRecordSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    granted_by_email = serializers.EmailField(source='granted_by.email', read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = BookAccess
        fields = ['id', 'user_email', 'user_name', 'granted_by_email', 'granted_at', 'expires_at', 'revoked_at', 'is_active']

    def get_user_name(self, obj):
        profile = getattr(obj.user, 'artist_profile', None)
        return profile.full_name if profile else obj.user.email


class BookCreateUpdateSerializer(serializers.ModelSerializer):
    rights_confirmed = serializers.BooleanField(write_only=True, required=False)
    remove_digital_file = serializers.BooleanField(write_only=True, required=False)
    title_az = serializers.CharField(write_only=True, required=True, max_length=250)
    short_description_az = serializers.CharField(write_only=True, required=True)
    full_description_az = serializers.CharField(write_only=True, required=True)
    table_of_contents_az = serializers.CharField(write_only=True, required=False, allow_blank=True)

    title_en = serializers.CharField(write_only=True, required=False, allow_blank=True)
    short_description_en = serializers.CharField(write_only=True, required=False, allow_blank=True)
    full_description_en = serializers.CharField(write_only=True, required=False, allow_blank=True)
    table_of_contents_en = serializers.CharField(write_only=True, required=False, allow_blank=True)

    title_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)
    short_description_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)
    full_description_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)
    table_of_contents_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)

    # Optional list of contributors: [{"name": "...", "role": "AUTHOR"}]
    authors = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Book
        fields = [
            'id', 'cover_image', 'digital_file', 'availability_mode', 'category', 'price',
            'currency', 'publication_year', 'isbn', 'publisher', 'languages',
            'page_count', 'authors', 'rights_confirmed', 'remove_digital_file',
            'title_az', 'short_description_az', 'full_description_az', 'table_of_contents_az',
            'title_en', 'short_description_en', 'full_description_en', 'table_of_contents_en',
            'title_ru', 'short_description_ru', 'full_description_ru', 'table_of_contents_ru'
        ]
        read_only_fields = ['id']

    def validate_authors(self, value):
        try:
            authors = json.loads(value) if value else []
        except (ValueError, TypeError):
            raise serializers.ValidationError('Invalid contributors list.')
        if not isinstance(authors, list) or len(authors) > 30:
            raise serializers.ValidationError('Provide up to 30 contributors.')
        seen = set()
        for author in authors:
            if not isinstance(author, dict) or not isinstance(author.get('name'), str) or not author['name'].strip() or len(author['name']) > 200:
                raise serializers.ValidationError('Every contributor needs a name of up to 200 characters.')
            author['name'] = author['name'].strip()
            author['role'] = author.get('role', 'AUTHOR')
            if author['role'] not in {'AUTHOR', 'CO_AUTHOR', 'EDITOR', 'TRANSLATOR'} or not isinstance(author.get('bio', ''), str):
                raise serializers.ValidationError('Invalid contributor role or biography.')
            key = (author['name'], author['role'])
            if key in seen:
                raise serializers.ValidationError('Duplicate contributor and role.')
            seen.add(key)
        return authors

    def validate(self, attrs):
        mode = attrs.get('availability_mode', getattr(self.instance, 'availability_mode', 'PRIVATE_ACCESS'))
        price = attrs.get('price', getattr(self.instance, 'price', None))
        if price is not None and price < 0:
            raise serializers.ValidationError({'price': 'Price cannot be negative.'})
        if mode == 'FUTURE_PAID' and not price:
            raise serializers.ValidationError({'price': 'Specify a positive price for a paid publication.'})
        return attrs

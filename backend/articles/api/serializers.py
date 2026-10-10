from rest_framework import serializers
from articles.models import Article, ArticleTranslation, ArticleCategory
from users.api.serializers import ArtistProfileSerializer


class ArticleCategorySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = ArticleCategory
        fields = ['id', 'slug', 'name_az', 'name_en', 'name_ru', 'name']

    def get_name(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return getattr(obj, f'name_{lang}', obj.name_az)


class ArticleTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleTranslation
        fields = ['id', 'language', 'title', 'slug', 'excerpt', 'content']


class ArticleListSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    slug = serializers.SerializerMethodField()
    excerpt = serializers.SerializerMethodField()
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    category_name = serializers.SerializerMethodField()
    author_name = serializers.CharField(source='author.artist_profile.full_name', read_only=True)
    author_username = serializers.CharField(source='author.artist_profile.username', read_only=True)
    author_avatar = serializers.CharField(source='author.artist_profile.avatar_thumbnail.url', read_only=True, default='')

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'excerpt', 'category_slug', 'category_name',
            'author_name', 'author_username', 'author_avatar', 'cover_thumbnail',
            'reading_time_minutes', 'is_featured', 'is_founder_article', 'views_count', 'created_at'
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
        return t.title if t else "Untitled"

    def get_slug(self, obj):
        t = self._get_translation(obj)
        return t.slug if t else str(obj.id)

    def get_excerpt(self, obj):
        t = self._get_translation(obj)
        return t.excerpt if t else ""

    def get_category_name(self, obj):
        if not obj.category:
            return None
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return getattr(obj.category, f'name_{lang}', obj.category.name_az)


class ArticleDetailSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    slug = serializers.SerializerMethodField()
    excerpt = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    translations = ArticleTranslationSerializer(many=True, read_only=True)
    category = ArticleCategorySerializer(read_only=True)
    author_profile = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            'id', 'title', 'slug', 'excerpt', 'content', 'author_profile',
            'category', 'cover_image', 'cover_thumbnail', 'reading_time_minutes',
            'views_count', 'is_featured', 'is_founder_article', 'moderation_status',
            'rejection_reason', 'translations', 'created_at'
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

    def get_excerpt(self, obj):
        t = self._get_translation(obj)
        return t.excerpt if t else ""

    def get_content(self, obj):
        t = self._get_translation(obj)
        return t.content if t else ""

    def get_author_profile(self, obj):
        if hasattr(obj.author, 'artist_profile'):
            return ArtistProfileSerializer(obj.author.artist_profile, context=self.context).data
        return None


class ArticleCreateUpdateSerializer(serializers.ModelSerializer):
    rights_confirmed = serializers.BooleanField(write_only=True, required=False)
    title_az = serializers.CharField(write_only=True, required=True, max_length=250)
    excerpt_az = serializers.CharField(write_only=True, required=True)
    content_az = serializers.CharField(write_only=True, required=True)

    title_en = serializers.CharField(write_only=True, required=False, allow_blank=True)
    excerpt_en = serializers.CharField(write_only=True, required=False, allow_blank=True)
    content_en = serializers.CharField(write_only=True, required=False, allow_blank=True)

    title_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)
    excerpt_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)
    content_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Article
        fields = [
            'id', 'category', 'cover_image', 'rights_confirmed',
            'title_az', 'excerpt_az', 'content_az',
            'title_en', 'excerpt_en', 'content_en',
            'title_ru', 'excerpt_ru', 'content_ru'
        ]
        read_only_fields = ['id']

from rest_framework import serializers
from artworks.models import Artwork, ArtworkTranslation, ArtworkCategory, ModerationStatus
from users.api.serializers import ArtistProfileSerializer


class ArtworkCategorySerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = ArtworkCategory
        fields = ['id', 'slug', 'name_az', 'name_en', 'name_ru', 'name']

    def get_name(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return getattr(obj, f'name_{lang}', obj.name_az)


class ArtworkTranslationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArtworkTranslation
        fields = ['id', 'language', 'title', 'description']


class ArtworkListSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    category_name = serializers.SerializerMethodField()
    artist_username = serializers.CharField(source='owner.artist_profile.username', read_only=True)

    class Meta:
        model = Artwork
        fields = [
            'id', 'title', 'description', 'artist_attribution', 'artist_username',
            'category_slug', 'category_name', 'creation_year', 'medium', 'dimensions',
            'thumbnail_image', 'detail_image', 'allow_download', 'is_featured',
            'is_founder_piece', 'views_count', 'created_at'
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
        t = obj.translations.filter(language=lang).first()
        return t or obj.translations.first()

    def get_title(self, obj):
        t = self._get_translation(obj)
        return t.title if t else "Untitled"

    def get_description(self, obj):
        t = self._get_translation(obj)
        return t.description if t else ""

    def get_category_name(self, obj):
        if not obj.category:
            return None
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return getattr(obj.category, f'name_{lang}', obj.category.name_az)


class ArtworkDetailSerializer(serializers.ModelSerializer):
    translations = ArtworkTranslationSerializer(many=True, read_only=True)
    category = ArtworkCategorySerializer(read_only=True)
    artist_profile = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    description = serializers.SerializerMethodField()

    class Meta:
        model = Artwork
        fields = [
            'id', 'title', 'description', 'artist_attribution', 'artist_profile',
            'category', 'moderation_status', 'rejection_reason', 'creation_year',
            'medium', 'dimensions', 'allow_download', 'is_watermarked',
            'detail_image', 'thumbnail_image', 'views_count', 'is_featured',
            'is_founder_piece', 'translations', 'created_at'
        ]

    def get_artist_profile(self, obj):
        if hasattr(obj.owner, 'artist_profile'):
            return ArtistProfileSerializer(obj.owner.artist_profile, context=self.context).data
        return None

    def get_title(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        t = obj.translations.filter(language=lang).first() or obj.translations.first()
        return t.title if t else ""

    def get_description(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        t = obj.translations.filter(language=lang).first() or obj.translations.first()
        return t.description if t else ""


class ArtworkCreateUpdateSerializer(serializers.ModelSerializer):
    title_az = serializers.CharField(write_only=True, required=True, max_length=250)
    description_az = serializers.CharField(write_only=True, required=False, allow_blank=True)
    title_en = serializers.CharField(write_only=True, required=False, allow_blank=True)
    description_en = serializers.CharField(write_only=True, required=False, allow_blank=True)
    title_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)
    description_ru = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Artwork
        fields = [
            'id', 'category', 'artist_attribution', 'creation_year', 'medium',
            'dimensions', 'allow_download', 'is_watermarked', 'original_master',
            'rights_confirmed', 'title_az', 'description_az', 'title_en',
            'description_en', 'title_ru', 'description_ru'
        ]
        read_only_fields = ['id']

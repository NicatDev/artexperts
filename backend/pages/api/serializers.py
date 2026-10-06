from rest_framework import serializers
from pages.models import HeroBanner, HeroBannerTranslation, AboutPageContent, AboutPageTranslation, SiteSettings


class HeroBannerSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    subtitle = serializers.SerializerMethodField()
    cta_text = serializers.SerializerMethodField()

    class Meta:
        model = HeroBanner
        fields = ['id', 'image', 'cta_url', 'title', 'subtitle', 'cta_text']

    def _get_translation(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return obj.translations.filter(language=lang).first() or obj.translations.first()

    def get_title(self, obj):
        t = self._get_translation(obj)
        return t.title if t else "İlqar Məmmədov Sənət Qalereyası"

    def get_subtitle(self, obj):
        t = self._get_translation(obj)
        return t.subtitle if t else ""

    def get_cta_text(self, obj):
        t = self._get_translation(obj)
        return t.cta_text if t else "Kəşf et"


class AboutPageSerializer(serializers.ModelSerializer):
    biography_title = serializers.SerializerMethodField()
    biography_text = serializers.SerializerMethodField()
    founder_story_title = serializers.SerializerMethodField()
    founder_story_text = serializers.SerializerMethodField()
    mission_title = serializers.SerializerMethodField()
    mission_text = serializers.SerializerMethodField()
    vision_title = serializers.SerializerMethodField()
    vision_text = serializers.SerializerMethodField()

    class Meta:
        model = AboutPageContent
        fields = [
            'id', 'founder_image', 'studio_image',
            'biography_title', 'biography_text',
            'founder_story_title', 'founder_story_text',
            'mission_title', 'mission_text',
            'vision_title', 'vision_text'
        ]

    def _get_translation(self, obj):
        request = self.context.get('request')
        lang = request.query_params.get('lang', 'az') if request else 'az'
        return obj.translations.filter(language=lang).first() or obj.translations.first()

    def get_biography_title(self, obj):
        t = self._get_translation(obj)
        return t.biography_title if t else "İlqar Məmmədov"

    def get_biography_text(self, obj):
        t = self._get_translation(obj)
        return t.biography_text if t else ""

    def get_founder_story_title(self, obj):
        t = self._get_translation(obj)
        return t.founder_story_title if t else "Yaradıcılıq Yolu"

    def get_founder_story_text(self, obj):
        t = self._get_translation(obj)
        return t.founder_story_text if t else ""

    def get_mission_title(self, obj):
        t = self._get_translation(obj)
        return t.mission_title if t else "Missiyamız"

    def get_mission_text(self, obj):
        t = self._get_translation(obj)
        return t.mission_text if t else ""

    def get_vision_title(self, obj):
        t = self._get_translation(obj)
        return t.vision_title if t else "Vizyonumuz"

    def get_vision_text(self, obj):
        t = self._get_translation(obj)
        return t.vision_text if t else ""


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ['site_title', 'contact_email', 'phone', 'address', 'instagram_url', 'facebook_url']

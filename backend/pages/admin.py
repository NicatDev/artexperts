from django.contrib import admin
from pages.models import HeroBanner, HeroBannerTranslation, AboutPageContent, AboutPageTranslation, SiteSettings


class HeroBannerTranslationInline(admin.StackedInline):
    model = HeroBannerTranslation
    extra = 1


@admin.register(HeroBanner)
class HeroBannerAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'is_active', 'cta_url')
    inlines = [HeroBannerTranslationInline]


class AboutPageTranslationInline(admin.StackedInline):
    model = AboutPageTranslation
    extra = 1


@admin.register(AboutPageContent)
class AboutPageContentAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'is_active')
    inlines = [AboutPageTranslationInline]


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ('site_title', 'contact_email', 'phone')

from django.contrib import admin
from artworks.models import Artwork, ArtworkCategory, ArtworkTranslation, ArtworkView, ModerationStatus


class ArtworkTranslationInline(admin.StackedInline):
    model = ArtworkTranslation
    extra = 1


@admin.register(ArtworkCategory)
class ArtworkCategoryAdmin(admin.ModelAdmin):
    list_display = ('name_az', 'name_en', 'name_ru', 'slug', 'get_artworks_count')
    search_fields = ('slug', 'name_az', 'name_en', 'name_ru')
    prepopulated_fields = {'slug': ('name_az',)}

    def get_artworks_count(self, obj):
        return obj.artworks.filter(deleted_at__isnull=True).count()
    get_artworks_count.short_description = 'Əsər Sayı'


@admin.register(ArtworkView)
class ArtworkViewAdmin(admin.ModelAdmin):
    list_display = ('artwork', 'visitor_id', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('visitor_id', 'artwork__artist_attribution')


@admin.register(Artwork)
class ArtworkAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'owner', 'category', 'moderation_status', 'is_featured', 'is_founder_piece', 'views_count', 'created_at')
    list_filter = ('moderation_status', 'is_featured', 'is_founder_piece', 'category')
    search_fields = ('artist_attribution', 'translations__title')
    inlines = [ArtworkTranslationInline]
    actions = ['approve_artworks', 'reject_artworks', 'feature_artworks', 'toggle_founder_piece']

    @admin.action(description="Approve selected artworks (PUBLISH)")
    def approve_artworks(self, request, queryset):
        queryset.update(moderation_status=ModerationStatus.PUBLISHED)

    @admin.action(description="Reject selected artworks")
    def reject_artworks(self, request, queryset):
        queryset.update(moderation_status=ModerationStatus.REJECTED)

    @admin.action(description="Toggle Featured status")
    def feature_artworks(self, request, queryset):
        for item in queryset:
            item.is_featured = not item.is_featured
            item.save(update_fields=['is_featured'])

    @admin.action(description="Toggle Founder Masterpiece status")
    def toggle_founder_piece(self, request, queryset):
        for item in queryset:
            item.is_founder_piece = not item.is_founder_piece
            item.save(update_fields=['is_founder_piece'])

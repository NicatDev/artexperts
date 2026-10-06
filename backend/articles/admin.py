from django.contrib import admin
from articles.models import Article, ArticleCategory, ArticleTranslation, ArticleView
from artworks.models import ModerationStatus


class ArticleTranslationInline(admin.StackedInline):
    model = ArticleTranslation
    extra = 1


@admin.register(ArticleCategory)
class ArticleCategoryAdmin(admin.ModelAdmin):
    list_display = ('name_az', 'name_en', 'name_ru', 'slug', 'get_articles_count')
    search_fields = ('name_az', 'name_en', 'name_ru', 'slug')
    prepopulated_fields = {'slug': ('name_az',)}

    def get_articles_count(self, obj):
        return obj.articles.filter(deleted_at__isnull=True).count()
    get_articles_count.short_description = 'Məqalə Sayı'


@admin.register(ArticleView)
class ArticleViewAdmin(admin.ModelAdmin):
    list_display = ('article', 'visitor_id', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('visitor_id',)


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'author', 'category', 'moderation_status', 'reading_time_minutes', 'is_featured', 'is_founder_article', 'created_at')
    list_filter = ('moderation_status', 'is_featured', 'is_founder_article', 'category')
    search_fields = ('translations__title', 'author__email')
    inlines = [ArticleTranslationInline]
    actions = ['approve_articles', 'reject_articles', 'feature_articles']

    @admin.action(description="Approve selected articles (PUBLISH)")
    def approve_articles(self, request, queryset):
        queryset.update(moderation_status=ModerationStatus.PUBLISHED)

    @admin.action(description="Reject selected articles")
    def reject_articles(self, request, queryset):
        queryset.update(moderation_status=ModerationStatus.REJECTED)

    @admin.action(description="Toggle Featured status")
    def feature_articles(self, request, queryset):
        for item in queryset:
            item.is_featured = not item.is_featured
            item.save(update_fields=['is_featured'])

from django.contrib import admin
from books.models import Book, BookTranslation, BookContributor, BookContributorLink, BookAccess, BookCategory, BookView


@admin.register(BookCategory)
class BookCategoryAdmin(admin.ModelAdmin):
    list_display = ('name_az', 'slug')
    search_fields = ('name_az', 'name_en', 'name_ru', 'slug')
    prepopulated_fields = {'slug': ('name_az',)}


@admin.register(BookView)
class BookViewAdmin(admin.ModelAdmin):
    list_display = ('book', 'visitor_id', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('visitor_id',)
from artworks.models import ModerationStatus


class BookTranslationInline(admin.StackedInline):
    model = BookTranslation
    extra = 1


class BookContributorLinkInline(admin.TabularInline):
    model = BookContributorLink
    extra = 1


class BookAccessInline(admin.TabularInline):
    model = BookAccess
    extra = 0
    readonly_fields = ('granted_at',)


@admin.register(BookContributor)
class BookContributorAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'linked_user')
    search_fields = ('full_name',)


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'owner', 'category', 'availability_mode', 'moderation_status', 'is_featured', 'is_founder_book', 'views_count', 'downloads_count', 'created_at')
    list_filter = ('moderation_status', 'availability_mode', 'is_featured', 'is_founder_book', 'category')
    search_fields = ('translations__title', 'isbn', 'publisher')
    inlines = [BookContributorLinkInline, BookTranslationInline, BookAccessInline]
    actions = ['approve_books', 'reject_books', 'feature_books']

    @admin.action(description="Approve selected books (PUBLISH)")
    def approve_books(self, request, queryset):
        queryset.update(moderation_status=ModerationStatus.PUBLISHED)

    @admin.action(description="Reject selected books")
    def reject_books(self, request, queryset):
        queryset.update(moderation_status=ModerationStatus.REJECTED)

    @admin.action(description="Toggle Featured status")
    def feature_books(self, request, queryset):
        for item in queryset:
            item.is_featured = not item.is_featured
            item.save(update_fields=['is_featured'])


@admin.register(BookAccess)
class BookAccessAdmin(admin.ModelAdmin):
    list_display = ('book', 'user', 'granted_by', 'is_active', 'granted_at', 'expires_at', 'revoked_at')
    list_filter = ('revoked_at',)
    search_fields = ('book__translations__title', 'user__email', 'granted_by__email')

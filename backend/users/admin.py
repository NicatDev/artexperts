from django.contrib import admin
from users.models import User, ArtistProfile, EmailVerificationToken


class ArtistProfileInline(admin.StackedInline):
    model = ArtistProfile
    can_delete = False
    verbose_name_plural = 'Artist Profile'


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_artist', 'is_verified', 'is_staff', 'created_at')
    search_fields = ('email',)
    list_filter = ('is_artist', 'is_verified', 'is_staff', 'is_active')
    inlines = [ArtistProfileInline]


@admin.register(ArtistProfile)
class ArtistProfileAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'username', 'specialties', 'location', 'is_featured', 'is_founder')
    search_fields = ('full_name', 'username', 'specialties')
    list_filter = ('is_featured', 'is_founder')


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ('email', 'code', 'token_type', 'is_used', 'expires_at', 'attempts')
    search_fields = ('email', 'code')
    list_filter = ('token_type', 'is_used')

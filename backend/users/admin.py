from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.translation import gettext_lazy as _
from users.forms import AdminUserChangeForm, AdminUserCreationForm
from users.models import User, ArtistProfile, EmailVerificationToken


class ArtistProfileInline(admin.StackedInline):
    model = ArtistProfile
    can_delete = False
    verbose_name_plural = 'Artist Profile'


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = AdminUserChangeForm
    add_form = AdminUserCreationForm
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Permissions'), {'fields': (
            'is_artist', 'is_verified', 'is_active', 'is_staff',
            'is_superuser', 'groups', 'user_permissions',
        )}),
        (_('Important dates'), {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'password1', 'password2')}),
    )
    readonly_fields = ('last_login', 'created_at', 'updated_at')
    ordering = ('email',)
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

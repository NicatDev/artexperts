import uuid
from datetime import timedelta
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils import timezone
from core.models import SoftDeletableModel, TimestampedModel


class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_artist', True)
        extra_fields.setdefault('is_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)

    def all_with_deleted(self):
        return super().get_queryset()


class User(AbstractBaseUser, PermissionsMixin, SoftDeletableModel):
    """
    Custom user model where email is the unique identifier.
    """
    email = models.EmailField(unique=True, db_index=True)
    is_artist = models.BooleanField(default=True, help_text="Designates whether the user can publish artwork/books.")
    is_verified = models.BooleanField(default=False, help_text="Designates whether the user's email has been verified.")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email


class ArtistProfile(TimestampedModel):
    """
    Extended artist details, public statement, and portfolio settings.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='artist_profile')
    full_name = models.CharField(max_length=200, db_index=True)
    username = models.SlugField(max_length=100, unique=True, db_index=True)
    avatar = models.ImageField(upload_to='avatars/originals/', null=True, blank=True)
    avatar_thumbnail = models.ImageField(upload_to='avatars/thumbnails/', null=True, blank=True)
    short_bio = models.TextField(blank=True, default='')
    artist_statement = models.TextField(blank=True, default='')
    website = models.URLField(max_length=300, blank=True, default='')
    social_links = models.JSONField(default=dict, blank=True)
    location = models.CharField(max_length=150, blank=True, default='')
    specialties = models.CharField(max_length=250, blank=True, default='', help_text="e.g., Oil painting, Canvas, Graphic Art")
    is_featured = models.BooleanField(default=False, db_index=True)
    is_founder = models.BooleanField(default=False, help_text="True for Ilqar Mammadov, the site creator.")

    class Meta:
        verbose_name = 'Artist Profile'
        verbose_name_plural = 'Artist Profiles'

    def __str__(self):
        return f"{self.full_name} (@{self.username})"


class EmailVerificationToken(TimestampedModel):
    """
    Secure 6-digit verification code with expiration and attempt limiting.
    """
    TOKEN_TYPES = (
        ('REGISTER', 'Registration Verification'),
        ('PASSWORD_RESET', 'Password Reset'),
    )

    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=6)
    token_type = models.CharField(max_length=20, choices=TOKEN_TYPES, default='REGISTER')
    expires_at = models.DateTimeField(db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    is_used = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['email', 'code', 'is_used']),
        ]

    def is_valid(self) -> bool:
        return (not self.is_used) and (self.attempts < 5) and (timezone.now() < self.expires_at)

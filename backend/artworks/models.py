from django.db import models
from django.conf import settings
from core.models import SoftDeletableModel, TimestampedModel


class ModerationStatus(models.TextChoices):
    DRAFT = 'DRAFT', 'Draft'
    PENDING_REVIEW = 'PENDING_REVIEW', 'Pending Review'
    PUBLISHED = 'PUBLISHED', 'Published'
    REJECTED = 'REJECTED', 'Rejected'
    ARCHIVED = 'ARCHIVED', 'Archived'


class ArtworkCategory(TimestampedModel):
    slug = models.SlugField(unique=True, max_length=100)
    name_az = models.CharField(max_length=150)
    name_en = models.CharField(max_length=150)
    name_ru = models.CharField(max_length=150)

    class Meta:
        verbose_name = 'Artwork Category'
        verbose_name_plural = 'Artwork Categories'

    def __str__(self):
        return self.name_az


class Artwork(SoftDeletableModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='artworks')
    artist_attribution = models.CharField(max_length=200, blank=True, help_text="Displayed artist name")
    category = models.ForeignKey(ArtworkCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='artworks')

    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING_REVIEW,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True, default='')

    is_featured = models.BooleanField(default=False, db_index=True)
    is_founder_piece = models.BooleanField(default=False, db_index=True, help_text="Masterpiece by Ilqar Mammadov")

    creation_year = models.PositiveIntegerField(null=True, blank=True)
    medium = models.CharField(max_length=150, blank=True, default='', help_text="e.g. Oil on Canvas")
    dimensions = models.CharField(max_length=100, blank=True, default='', help_text="e.g. 100 x 80 cm")

    allow_download = models.BooleanField(default=False, help_text="Allows public visitors to download high-res detail")
    is_watermarked = models.BooleanField(default=False)

    # Master original remains private; only derivatives are served publicly
    original_master = models.ImageField(upload_to='private/artworks/masters/')
    detail_image = models.ImageField(upload_to='artworks/details/', blank=True)
    thumbnail_image = models.ImageField(upload_to='artworks/thumbnails/', blank=True)

    views_count = models.PositiveIntegerField(default=0)
    rights_confirmed = models.BooleanField(default=True, help_text="Uploader confirms ownership or publishing rights")

    class Meta:
        verbose_name = 'Artwork'
        verbose_name_plural = 'Artworks'
        ordering = ['-is_featured', '-created_at']

    def __str__(self):
        primary_trans = self.translations.filter(language='az').first() or self.translations.first()
        title = primary_trans.title if primary_trans else "Untitled Artwork"
        return f"{title} ({self.moderation_status})"


class ArtworkView(TimestampedModel):
    """Unique artwork views by account or first-party anonymous browser id."""
    artwork = models.ForeignKey(Artwork, on_delete=models.CASCADE, related_name='unique_views')
    visitor_id = models.CharField(max_length=64, db_index=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['artwork', 'visitor_id'], name='unique_artwork_visitor_view')]


class ArtworkTranslation(TimestampedModel):
    LANGUAGES = (
        ('az', 'Azerbaijani'),
        ('en', 'English'),
        ('ru', 'Russian'),
    )

    artwork = models.ForeignKey(Artwork, on_delete=models.CASCADE, related_name='translations')
    language = models.CharField(max_length=5, choices=LANGUAGES, db_index=True)
    title = models.CharField(max_length=250)
    description = models.TextField(blank=True, default='')

    class Meta:
        unique_together = ('artwork', 'language')

    def __str__(self):
        return f"{self.artwork_id} [{self.language}]: {self.title}"

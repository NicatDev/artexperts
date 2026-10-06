from django.db import models
from django.conf import settings
from core.models import SoftDeletableModel, TimestampedModel
from artworks.models import ModerationStatus


class ArticleCategory(TimestampedModel):
    slug = models.SlugField(unique=True, max_length=100)
    name_az = models.CharField(max_length=150)
    name_en = models.CharField(max_length=150)
    name_ru = models.CharField(max_length=150)

    class Meta:
        verbose_name = 'Article Category'
        verbose_name_plural = 'Article Categories'

    def __str__(self):
        return self.name_az


class Article(SoftDeletableModel):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='articles')
    category = models.ForeignKey(ArticleCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='articles')

    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING_REVIEW,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True, default='')

    is_featured = models.BooleanField(default=False, db_index=True)
    is_founder_article = models.BooleanField(default=False, db_index=True, help_text="Written by Ilqar Mammadov")

    # Cover images: full high-res detail and compressed thumbnail for card grid
    cover_image = models.ImageField(upload_to='articles/covers/')
    cover_thumbnail = models.ImageField(upload_to='articles/thumbnails/', blank=True)

    reading_time_minutes = models.PositiveIntegerField(default=3)
    views_count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Article'
        verbose_name_plural = 'Articles'
        ordering = ['-is_featured', '-created_at']

    def __str__(self):
        t = self.translations.filter(language='az').first() or self.translations.first()
        return f"{t.title if t else 'Untitled'} ({self.moderation_status})"


class ArticleView(TimestampedModel):
    """Unique article views by account or first-party anonymous browser id."""
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='unique_views')
    visitor_id = models.CharField(max_length=64, db_index=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['article', 'visitor_id'], name='unique_article_visitor_view')]


class ArticleTranslation(TimestampedModel):
    LANGUAGES = (
        ('az', 'Azerbaijani'),
        ('en', 'English'),
        ('ru', 'Russian'),
    )

    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name='translations')
    language = models.CharField(max_length=5, choices=LANGUAGES, db_index=True)
    title = models.CharField(max_length=250)
    slug = models.SlugField(max_length=250)
    excerpt = models.TextField(help_text="Short summary for listing cards")
    content = models.TextField(help_text="Sanitized editorial article body")

    class Meta:
        unique_together = [('article', 'language'), ('language', 'slug')]

    def __str__(self):
        return f"{self.title} [{self.language}]"

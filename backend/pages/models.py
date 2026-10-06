from django.db import models
from core.models import TimestampedModel


class HeroBanner(TimestampedModel):
    image = models.ImageField(upload_to='banners/', null=True, blank=True)
    cta_url = models.CharField(max_length=200, default='/artworks')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        t = self.translations.filter(language='az').first() or self.translations.first()
        return t.title if t else f"Banner #{self.id}"


class HeroBannerTranslation(TimestampedModel):
    LANGUAGES = (
        ('az', 'Azerbaijani'),
        ('en', 'English'),
        ('ru', 'Russian'),
    )

    banner = models.ForeignKey(HeroBanner, on_delete=models.CASCADE, related_name='translations')
    language = models.CharField(max_length=5, choices=LANGUAGES, db_index=True)
    title = models.CharField(max_length=250)
    subtitle = models.TextField(blank=True, default='')
    cta_text = models.CharField(max_length=100, default='Kəşf et')

    class Meta:
        unique_together = ('banner', 'language')

    def __str__(self):
        return f"{self.title} [{self.language}]"


class AboutPageContent(TimestampedModel):
    """
    Multilingual About page sections including Ilqar Mammadov biography,
    founder story, mission, vision, and platform manifesto.
    """
    founder_image = models.ImageField(upload_to='founder/', null=True, blank=True)
    studio_image = models.ImageField(upload_to='founder/', null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"About Page Content (Active: {self.is_active})"


class AboutPageTranslation(TimestampedModel):
    LANGUAGES = (
        ('az', 'Azerbaijani'),
        ('en', 'English'),
        ('ru', 'Russian'),
    )

    about_page = models.ForeignKey(AboutPageContent, on_delete=models.CASCADE, related_name='translations')
    language = models.CharField(max_length=5, choices=LANGUAGES, db_index=True)

    # Master Artist Biography
    biography_title = models.CharField(max_length=250, default='İlqar Məmmədov')
    biography_text = models.TextField()

    # Founder Narrative & Purpose
    founder_story_title = models.CharField(max_length=250, default='Yaradıcılıq Yolu')
    founder_story_text = models.TextField()

    # Mission Statement
    mission_title = models.CharField(max_length=250, default='Missiyamız')
    mission_text = models.TextField(help_text="Supporting artists and creators embarking on the art path")

    # Vision Statement
    vision_title = models.CharField(max_length=250, default='Vizyonumuz')
    vision_text = models.TextField()

    class Meta:
        unique_together = ('about_page', 'language')

    def __str__(self):
        return f"About Section [{self.language}]"


class SiteSettings(TimestampedModel):
    site_title = models.CharField(max_length=200, default='İlqar Məmmədov — Rəssamlıq Platforması')
    contact_email = models.EmailField(default='art@expertvisits.com')
    phone = models.CharField(max_length=50, blank=True, default='+994 50 000 00 00')
    address = models.CharField(max_length=250, blank=True, default='Bakı, Azərbaycan')
    instagram_url = models.URLField(blank=True, default='https://instagram.com')
    facebook_url = models.URLField(blank=True, default='https://facebook.com')

    class Meta:
        verbose_name = 'Site Settings'
        verbose_name_plural = 'Site Settings'

    def __str__(self):
        return self.site_title

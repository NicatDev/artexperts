from django.db import models
from django.conf import settings
from django.utils import timezone
from core.models import SoftDeletableModel, TimestampedModel
from artworks.models import ModerationStatus
from core.validators import validate_pdf_file
from core.services.media import validate_new_image
from core.content_access import AvailabilityMode, ContactMode as BookContactMode, clean_contact


class ContributorRole(models.TextChoices):
    AUTHOR = 'AUTHOR', 'Author'
    CO_AUTHOR = 'CO_AUTHOR', 'Co-Author'
    EDITOR = 'EDITOR', 'Editor'
    TRANSLATOR = 'TRANSLATOR', 'Translator'


class BookCategory(TimestampedModel):
    slug = models.SlugField(unique=True, max_length=100)
    name_az = models.CharField(max_length=150)
    name_en = models.CharField(max_length=150)
    name_ru = models.CharField(max_length=150)

    class Meta:
        verbose_name = 'Book Category'
        verbose_name_plural = 'Book Categories'

    def __str__(self):
        return self.name_az


class BookContributor(TimestampedModel):
    """
    Represents an author/editor/contributor.
    Does NOT require a registered platform user, but can optionally link to one.
    """
    full_name = models.CharField(max_length=200)
    linked_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='contributor_profiles')
    bio = models.TextField(blank=True, default='')

    def __str__(self):
        return self.full_name


class Book(SoftDeletableModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='books')
    category = models.ForeignKey(BookCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='books')

    cover_image = models.ImageField(upload_to='books/covers/')
    # Digital files are strictly stored in private storage
    digital_file = models.FileField(upload_to='private/books/files/', null=True, blank=True, validators=[validate_pdf_file])
    digital_filename = models.CharField(max_length=250, blank=True, default='')
    allow_online_reading = models.BooleanField(
        default=False, verbose_name='Saytda oxumağa icazə',
        help_text='Standart olaraq bağlıdır. Səhifələr qorunan oxuyucuda göstərilir. Kopyalama və yükləməni məhdudlaşdıran tədbirlər görülür, lakin tam qorunmaya zəmanət verilmir.',
    )

    availability_mode = models.CharField(
        max_length=25,
        choices=AvailabilityMode.choices,
        default=AvailabilityMode.PRIVATE_ACCESS,
        db_index=True
    )
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='AZN')

    contact_mode = models.CharField(max_length=10, choices=BookContactMode.choices, default=BookContactMode.NONE)
    contact_phone = models.CharField(max_length=25, blank=True, default='')
    contact_email = models.EmailField(blank=True, default='')

    publication_year = models.PositiveIntegerField(null=True, blank=True)
    isbn = models.CharField(max_length=50, blank=True, default='')
    publisher = models.CharField(max_length=150, blank=True, default='')
    languages = models.CharField(max_length=100, default='AZ', help_text="e.g. AZ, EN, RU")
    page_count = models.PositiveIntegerField(null=True, blank=True)

    moderation_status = models.CharField(
        max_length=20,
        choices=ModerationStatus.choices,
        default=ModerationStatus.PENDING_REVIEW,
        db_index=True
    )
    rejection_reason = models.TextField(blank=True, default='')

    is_featured = models.BooleanField(default=False, db_index=True)
    is_founder_book = models.BooleanField(default=False, db_index=True, help_text="Book authored/curated by Ilqar Mammadov")

    views_count = models.PositiveIntegerField(default=0)
    downloads_count = models.PositiveIntegerField(default=0)

    def clean(self):
        super().clean()
        validate_new_image(self, 'cover_image')
        clean_contact(self)
        if self.allow_online_reading and not self.digital_file:
            from django.core.exceptions import ValidationError
            raise ValidationError({'allow_online_reading': 'Saytda oxumağı açmaq üçün PDF faylı əlavə edin.'})

    class Meta:
        verbose_name = 'Book'
        verbose_name_plural = 'Books'
        ordering = ['-is_featured', '-created_at']

    def __str__(self):
        t = self.translations.filter(language='az').first() or self.translations.first()
        return f"{t.title if t else 'Untitled Book'} ({self.moderation_status})"


class BookView(TimestampedModel):
    """Unique book views by account or first-party anonymous browser id."""
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='unique_views')
    visitor_id = models.CharField(max_length=64, db_index=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['book', 'visitor_id'], name='unique_book_visitor_view')]


class BookUploadSession(TimestampedModel):
    uploader = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='book_uploads')
    target_book = models.ForeignKey(Book, on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_uploads')
    consumed_book = models.ForeignKey(Book, on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_uploads')
    filename = models.CharField(max_length=250)
    expected_size = models.PositiveBigIntegerField()
    uploaded_bytes = models.PositiveBigIntegerField(default=0)
    chunk_hashes = models.JSONField(default=list)
    state = models.CharField(max_length=12, choices=[('UPLOADING', 'Uploading'), ('READY', 'Ready'), ('CONSUMED', 'Consumed')], default='UPLOADING')
    expires_at = models.DateTimeField(db_index=True)


class BookContributorLink(TimestampedModel):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='contributor_links')
    contributor = models.ForeignKey(BookContributor, on_delete=models.CASCADE, related_name='book_links')
    role = models.CharField(max_length=25, choices=ContributorRole.choices, default=ContributorRole.AUTHOR)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'created_at']
        unique_together = ('book', 'contributor', 'role')

    def __str__(self):
        return f"{self.contributor.full_name} ({self.role}) on {self.book_id}"


class BookTranslation(TimestampedModel):
    LANGUAGES = (
        ('az', 'Azerbaijani'),
        ('en', 'English'),
        ('ru', 'Russian'),
    )

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='translations')
    language = models.CharField(max_length=5, choices=LANGUAGES, db_index=True)
    title = models.CharField(max_length=250)
    slug = models.SlugField(max_length=250)
    short_description = models.TextField(help_text="Short description for book card")
    full_description = models.TextField(help_text="Detailed book presentation")
    table_of_contents = models.TextField(blank=True, default='', help_text="Book index / contents")

    class Meta:
        unique_together = [('book', 'language'), ('language', 'slug')]

    def __str__(self):
        return f"{self.title} [{self.language}]"


class BookAccess(TimestampedModel):
    """
    Legacy grant retained for audit/revocation. It cannot override availability_mode.
    """
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='access_grants')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='book_accesses')
    granted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='granted_book_accesses')
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('book', 'user')

    @property
    def is_active(self) -> bool:
        if self.revoked_at is not None:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True

    def __str__(self):
        return f"Access for {self.user.email} on Book {self.book_id} (Active: {self.is_active})"

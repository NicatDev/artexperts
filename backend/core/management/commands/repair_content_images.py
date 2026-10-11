from django.core.management.base import BaseCommand, CommandError
from articles.models import Article
from artworks.models import Artwork
from books.models import Book
from core.services.media import refresh_image_derivatives


class Command(BaseCommand):
    help = 'Rebuild missing public derivatives from existing article covers and private artwork masters.'

    def add_arguments(self, parser):
        parser.add_argument('--regenerate', action='store_true', help='Also replace existing derivatives (e.g. stale admin images).')

    def handle(self, *args, **options):
        repaired = failed = 0
        for model, source, targets in (
            (Artwork, 'original_master', ('detail_image', 'thumbnail_image')),
            (Article, 'cover_image', (None, 'cover_thumbnail')),
        ):
            for item in model.objects.all().iterator(chunk_size=100):
                fields = [name for name in targets if name]
                if not options['regenerate'] and all(
                    getattr(item, name) and getattr(item, name).storage.exists(getattr(item, name).name)
                    for name in fields
                ):
                    continue
                try:
                    refresh_image_derivatives(item, source, targets, force=True)
                    if not getattr(item, source):
                        raise ValueError('Source image is missing; re-upload it.')
                    item.save(update_fields=fields + ['updated_at'])
                    repaired += 1
                except Exception as exc:
                    failed += 1
                    self.stderr.write(f'{model.__name__} {item.pk}: {exc}')
        for book in Book.objects.all().only('id', 'cover_image').iterator(chunk_size=100):
            if not book.cover_image or not book.cover_image.storage.exists(book.cover_image.name):
                failed += 1
                self.stderr.write(f'Book {book.pk}: Cover file is missing; restore it or re-upload it.')
        self.stdout.write(f'Repaired: {repaired}; failed: {failed}')
        if failed:
            raise CommandError('Some source images could not be read. Re-upload the affected images.')

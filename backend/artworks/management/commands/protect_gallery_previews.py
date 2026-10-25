from django.core.management.base import BaseCommand
from django.core.exceptions import ValidationError
from django.db.models import Q
from artworks.models import Artwork


class Command(BaseCommand):
    help = 'Rebuild existing gallery previews with server-side watermarks, preserving private originals.'

    def handle(self, *args, **options):
        count = 0
        failed = 0
        for artwork in Artwork.objects.filter(Q(allow_download=False) | Q(is_watermarked=True)).iterator(chunk_size=50):
            try:
                artwork.save(refresh_previews=True, update_fields=['detail_image', 'thumbnail_image'])
                count += 1
            except (OSError, ValueError, ValidationError) as exc:
                failed += 1
                self.stderr.write(f'{artwork.pk}: {type(exc).__name__}')
        self.stdout.write(f'Updated previews: {count}; failed: {failed}.')

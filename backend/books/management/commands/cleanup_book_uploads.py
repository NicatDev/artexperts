from django.core.management.base import BaseCommand
from books.uploads import cleanup_expired_uploads
from core.models import ContentSaveOperation
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Delete expired, unattached PDF uploads; preserve PDFs attached to books.'

    def handle(self, *args, **options):
        self.stdout.write(f'Removed expired sessions: {cleanup_expired_uploads(limit=10000)}')
        count, _ = ContentSaveOperation.objects.filter(created_at__lt=timezone.now() - timedelta(days=7)).delete()
        self.stdout.write(f'Removed old save operations: {count}')

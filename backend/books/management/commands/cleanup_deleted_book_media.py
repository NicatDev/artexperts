from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from books.models import Book, BookMediaCleanup
from books.media_cleanup import enqueue_book_media, process_cleanup


class Command(BaseCommand):
    help = 'Retry queued book file cleanup; optionally remove media from previously soft-deleted books.'

    def add_arguments(self, parser):
        parser.add_argument('--include-existing', action='store_true', help='Also clean media still attached to old soft-deleted book records.')
        parser.add_argument('--apply', action='store_true', help='Actually delete files. Without this flag only report counts.')

    def handle(self, *args, **options):
        old = Book.all_objects.filter(deleted_at__isnull=False).exclude(digital_file='').exclude(digital_file__isnull=True)
        old_ids = set(old.values_list('pk', flat=True))
        old_ids.update(Book.all_objects.filter(deleted_at__isnull=False).exclude(cover_image='').values_list('pk', flat=True))
        self.stdout.write(f'Queued cleanup jobs: {BookMediaCleanup.objects.count()}; old deleted books with media: {len(old_ids)}')
        if not options['apply']:
            self.stdout.write('Dry run. No files deleted. Use --apply to process the queue; add --include-existing to clean old deleted books too.')
            return
        if options['include_existing']:
            for pk in old_ids:
                with transaction.atomic():
                    book = Book.all_objects.select_for_update().filter(pk=pk, deleted_at__isnull=False).first()
                    if book:
                        enqueue_book_media(book)
                        Book.all_objects.filter(pk=pk).update(digital_file='', cover_image='', digital_filename='', allow_online_reading=False)
        for pk in list(BookMediaCleanup.objects.values_list('pk', flat=True)):
            process_cleanup(pk)
        remaining = BookMediaCleanup.objects.count()
        if remaining:
            raise CommandError(f'{remaining} cleanup job(s) remain. Check backend logs and media directory permissions.')
        self.stdout.write(self.style.SUCCESS('Book media cleanup completed.'))

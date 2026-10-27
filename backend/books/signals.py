from django.db.models.signals import pre_delete
from django.dispatch import receiver

from books.models import Book
from books.media_cleanup import enqueue_book_media


@receiver(pre_delete, sender=Book, dispatch_uid='books.queue_deleted_media')
def queue_deleted_book_media(sender, instance, using, **kwargs):
    # Also covers hard_delete(), queryset hard deletion and owner cascades.
    enqueue_book_media(instance, using=using)

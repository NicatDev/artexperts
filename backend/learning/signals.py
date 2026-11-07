from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import Asset
@receiver(post_delete,sender=Asset)
def delete_media(sender,instance,**kwargs):
    from .views import part_path
    asset_id = instance.pk
    temporary_file = part_path(instance)

    def clean():
        for field in [instance.file,instance.poster]:
            if field: field.storage.delete(field.name)
        temporary_file.unlink(missing_ok=True)
        if instance.role == 'pdf':
            from books.media_cleanup import remove_reader_cache
            remove_reader_cache(asset_id, '')
    transaction.on_commit(clean)

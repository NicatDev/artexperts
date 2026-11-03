from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import Asset
@receiver(post_delete,sender=Asset)
def delete_media(sender,instance,**kwargs):
    from .views import part_path
    def clean():
        for field in [instance.file,instance.poster]:
            if field: field.storage.delete(field.name)
        part_path(instance).unlink(missing_ok=True)
    transaction.on_commit(clean)

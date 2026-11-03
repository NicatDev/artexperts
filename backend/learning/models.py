from django.db import models
from django.conf import settings
from core.models import TimestampedModel

class Entry(TimestampedModel):
    kind = models.CharField(max_length=12, choices=[('lessons','Lessons'),('facts','Facts')], db_index=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=250)
    summary = models.TextField(blank=True)
    content = models.TextField(blank=True)
    class Meta:
        ordering = ['-created_at', '-id']

class Asset(TimestampedModel):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    entry = models.ForeignKey(Entry, on_delete=models.CASCADE, null=True, related_name='assets')
    role = models.CharField(max_length=10)
    filename = models.CharField(max_length=250)
    size = models.PositiveBigIntegerField()
    uploaded = models.PositiveBigIntegerField(default=0)
    hashes = models.JSONField(default=list)
    file = models.FileField(blank=True)
    poster = models.ImageField(blank=True)
    ready = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    class Meta:
        ordering = ['order', 'created_at']

"""Durable, commit-only cleanup of files belonging to deleted books."""
import hashlib
import logging
from pathlib import Path, PurePosixPath
import re

from django.apps import apps
from django.conf import settings
from django.db import models, transaction

from books.models import Book, BookMediaCleanup, BookUploadSession

logger = logging.getLogger(__name__)
PREFIXES = ('books/covers/', 'private/books/files/')


def legacy_revision(book):
    if not book.digital_file:
        return ''
    try:
        stat = checked_file(book.digital_file.name).stat()
    except (OSError, ValueError, NotImplementedError):
        return ''
    return hashlib.sha256(f'{book.pk}:{book.digital_file.name}:{stat.st_size}:{stat.st_mtime_ns}:{book.updated_at.isoformat()}'.encode()).hexdigest()


def enqueue_book_media(book, using='default'):
    files = [field.name for field in (book.digital_file, book.cover_image) if field]
    # Include previous PDFs replaced through the resumable upload service.
    files.extend(f'private/books/files/{pk}.pdf' for pk in
                 BookUploadSession.objects.using(using).filter(consumed_book_id=book.pk).values_list('pk', flat=True))
    job = BookMediaCleanup.objects.using(using).create(
        book_id=book.pk, files=list(dict.fromkeys(files)), legacy_revision=legacy_revision(book),
    )
    transaction.on_commit(lambda: process_cleanup(job.pk, using), using=using, robust=True)
    return job


def still_referenced(name, using):
    # A manually shared cover/PDF must survive while another record uses it.
    for model in apps.get_models():
        fields = [field.name for field in model._meta.concrete_fields if isinstance(field, models.FileField)]
        if not fields:
            continue
        query = models.Q()
        for field in fields:
            query |= models.Q(**{field: name})
        manager = model.objects if model is Book else model._base_manager
        if manager.using(using).filter(query).exists():
            return True
    return False


def checked_file(name):
    # Never permit a malformed database path or symlink to escape MEDIA_ROOT.
    path = PurePosixPath(name)
    if '\\' in name or path.is_absolute() or '..' in path.parts or not name.startswith(PREFIXES):
        raise ValueError('Unsupported book media path')
    root = Path(settings.MEDIA_ROOT).resolve()
    target = (root / name).resolve()
    target.relative_to(root)
    if target == root:
        raise ValueError('Invalid book media target')
    return target


def remove_reader_cache(book_id, revision):
    root = Path(settings.MEDIA_ROOT).resolve()
    directory = root / 'private' / 'book-reader-cache'
    directory.resolve().relative_to(root)
    if not directory.is_dir():
        return
    prefixes = [book_id.hex + '-']
    if re.fullmatch(r'[0-9a-f]{64}', revision):
        prefixes.append(revision)
    for prefix in prefixes:
        for path in directory.glob(prefix + '*'):
            if path.suffix in ('.json', '.webp'):
                path.resolve().relative_to(root)
                path.unlink(missing_ok=True)


def process_cleanup(job_id, using='default'):
    try:
        with transaction.atomic(using=using):
            job = BookMediaCleanup.objects.using(using).select_for_update().filter(pk=job_id).first()
            if job is None:
                return True
            for name in job.files:
                target = checked_file(name)
                if not still_referenced(name, using):
                    target.unlink(missing_ok=True)
            remove_reader_cache(job.book_id, job.legacy_revision)
            job.delete()
        return True
    except (OSError, ValueError) as exc:
        BookMediaCleanup.objects.using(using).filter(pk=job_id).update(
            attempts=models.F('attempts') + 1, last_error=f'{type(exc).__name__}: {exc}'[:1000],
        )
        logger.warning('Book media cleanup %s deferred: %s', job_id, type(exc).__name__)
        return False

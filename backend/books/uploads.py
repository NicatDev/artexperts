"""Resumable PDF uploads, kept private and bound to the authenticated uploader."""
import hashlib
import errno
import os
from pathlib import Path
import re
import shutil
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, views
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from books.models import Book, BookUploadSession
from core.validators import MAX_PDF_SIZE_BYTES
from users.models import User

CHUNK_BYTES = 8 * 1024 * 1024


class UploadConflict(APIException):
    status_code = 409
    default_detail = 'Yükləmənin vəziyyəti dəyişib. Yenidən davam edin.'


class StorageFull(APIException):
    status_code = 507
    default_detail = 'Serverdə faylı qəbul etmək üçün kifayət qədər boş yer yoxdur. Bir qədər sonra yenidən cəhd edin.'


def session_path(session):
    base = Path(settings.MEDIA_ROOT) / 'private' / 'books'
    final = base / 'files' / f'{session.pk}.pdf'
    return final if final.exists() else base / 'uploads' / f'{session.pk}.part'


def cleanup_expired_uploads(limit=100):
    expired = BookUploadSession.objects.filter(expires_at__lt=timezone.now()).order_by('expires_at').values_list('pk', flat=True)[:limit]
    removed = 0
    for pk in list(expired):
        with transaction.atomic():
            session = BookUploadSession.objects.select_for_update().filter(pk=pk, expires_at__lt=timezone.now()).first()
            if not session:
                continue
            if session.state != 'CONSUMED':
                try:
                    session_path(session).unlink(missing_ok=True)
                except OSError:
                    continue
            session.delete()
            removed += 1
    return removed


def upload_status(session):
    return {'id': str(session.pk), 'size': session.expected_size, 'uploaded': session.uploaded_bytes,
            'chunk_size': CHUNK_BYTES, 'state': session.state, 'expires_at': session.expires_at.isoformat(),
            'book_id': str(session.consumed_book_id) if session.consumed_book_id else None}


class UploadStartSerializer(serializers.Serializer):
    filename = serializers.CharField(max_length=250)
    size = serializers.IntegerField(min_value=5, max_value=MAX_PDF_SIZE_BYTES)
    hashes = serializers.ListField(child=serializers.RegexField(r'^[0-9a-f]{64}$'), min_length=1, max_length=38)
    book_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        if not attrs['filename'].lower().endswith('.pdf'):
            raise serializers.ValidationError({'filename': 'PDF faylı seçin.'})
        if len(attrs['hashes']) != (attrs['size'] + CHUNK_BYTES - 1) // CHUNK_BYTES:
            raise serializers.ValidationError({'hashes': 'Fayl hissələri uyğun deyil.'})
        return attrs


class UploadStartThrottle(UserRateThrottle):
    rate = '12/minute'
    scope = 'book_upload_start'


class UploadChunkThrottle(UserRateThrottle):
    rate = '180/minute'
    scope = 'book_upload_chunk'


class PrivateUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def handle_exception(self, exc):
        if isinstance(exc, OSError) and exc.errno == errno.ENOSPC:
            exc = StorageFull()
        return super().handle_exception(exc)

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class BookUploadStartView(PrivateUploadView):
    throttle_classes = [UploadStartThrottle]

    def delete(self, request):
        removed = 0
        with transaction.atomic():
            sessions = BookUploadSession.objects.select_for_update().filter(uploader=request.user, consumed_book__isnull=True).exclude(state='CONSUMED')
            for session in sessions:
                session_path(session).unlink(missing_ok=True)
                session.delete()
                removed += 1
        return Response({'removed': removed})

    def post(self, request):
        serializer = UploadStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        book = None
        if data.get('book_id'):
            books = Book.objects.all()
            if not request.user.is_staff:
                books = books.filter(owner=request.user)
            book = get_object_or_404(books, pk=data['book_id'])
        cleanup_expired_uploads()
        directory = Path(settings.MEDIA_ROOT) / 'private' / 'books' / 'uploads'
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        if shutil.disk_usage(directory).free < data['size'] + 512 * 1024 * 1024:
            raise StorageFull()
        with transaction.atomic():
            User.objects.select_for_update().get(pk=request.user.pk)
            active = BookUploadSession.objects.filter(uploader=request.user, expires_at__gt=timezone.now()).exclude(state='CONSUMED')
            if active.count() >= 3:
                raise ValidationError({'upload': 'Eyni vaxtda ən çox 3 PDF yükləmək olar. Əvvəlki yükləməni tamamlayın və ya silin.'})
            reserved = BookUploadSession.objects.filter(expires_at__gt=timezone.now()).exclude(state='CONSUMED').aggregate(total=Sum('expected_size'))['total'] or 0
            if reserved + data['size'] > 4 * 1024 * 1024 * 1024:
                raise StorageFull()
            session = BookUploadSession.objects.create(uploader=request.user, target_book=book,
                filename=re.sub(r'[\x00-\x1f\x7f]', '', data['filename'].replace('\\', '/').split('/')[-1]), expected_size=data['size'], chunk_hashes=data['hashes'],
                expires_at=timezone.now() + timedelta(hours=24))
        return Response(upload_status(session), status=201)


class BookUploadStatusView(PrivateUploadView):
    def get(self, request, id):
        with transaction.atomic():
            session = get_object_or_404(BookUploadSession.objects.select_for_update(), pk=id, uploader=request.user, expires_at__gt=timezone.now())
            if session.state != 'CONSUMED':
                path = session_path(session)
                actual = path.stat().st_size if path.is_file() else 0
                if actual < session.uploaded_bytes:
                    session.uploaded_bytes = actual // CHUNK_BYTES * CHUNK_BYTES
                    session.state = 'UPLOADING'
                    session.save(update_fields=['uploaded_bytes', 'state', 'updated_at'])
        return Response(upload_status(session))

    def delete(self, request, id):
        with transaction.atomic():
            session = get_object_or_404(BookUploadSession.objects.select_for_update(), pk=id, uploader=request.user)
            if session.state == 'CONSUMED':
                raise UploadConflict()
            session_path(session).unlink(missing_ok=True)
            session.delete()
        return Response(status=204)


class BookUploadChunkView(PrivateUploadView):
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [UploadChunkThrottle]

    def post(self, request, id):
        chunk = request.FILES.get('chunk')
        try:
            offset = int(request.data.get('offset', -1))
        except (ValueError, TypeError):
            raise ValidationError({'offset': 'Yanlış mövqe.'})
        if not chunk or not 0 < chunk.size <= CHUNK_BYTES or offset < 0 or offset % CHUNK_BYTES:
            raise ValidationError({'chunk': 'Yanlış fayl hissəsi.'})
        with transaction.atomic():
            session = get_object_or_404(BookUploadSession.objects.select_for_update(), pk=id, uploader=request.user, expires_at__gt=timezone.now())
            if session.state == 'CONSUMED':
                return Response(upload_status(session))
            index = offset // CHUNK_BYTES
            expected = min(CHUNK_BYTES, session.expected_size - offset)
            digest = hashlib.sha256()
            for block in chunk.chunks():
                digest.update(block)
            if index >= len(session.chunk_hashes) or chunk.size != expected or digest.hexdigest() != session.chunk_hashes[index]:
                raise ValidationError({'chunk': 'Fayl hissəsi yoxlamadan keçmədi. Yenidən göndərin.'})
            if offset < session.uploaded_bytes and offset + chunk.size <= session.uploaded_bytes:
                return Response(upload_status(session))  # Lost acknowledgement: do not append twice.
            if offset != session.uploaded_bytes or session.state != 'UPLOADING':
                raise UploadConflict()
            chunk.seek(0)
            if offset == 0 and chunk.read(5) != b'%PDF-':
                raise ValidationError({'chunk': 'Fayl düzgün PDF deyil.'})
            path = session_path(session)
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            if shutil.disk_usage(path.parent).free < chunk.size + 128 * 1024 * 1024:
                raise StorageFull()
            chunk.seek(0)
            with open(path, 'r+b' if path.exists() else 'w+b') as output:
                os.chmod(path, 0o600)
                if output.seek(0, os.SEEK_END) < offset:
                    raise UploadConflict()
                output.truncate(offset)  # Recover an uncommitted write after a worker restart.
                output.seek(offset)
                for block in chunk.chunks():
                    output.write(block)
                output.flush()
                os.fsync(output.fileno())
            session.uploaded_bytes += chunk.size
            if session.uploaded_bytes == session.expected_size:
                with open(path, 'rb') as source:
                    if source.read(5) != b'%PDF-':
                        raise ValidationError({'chunk': 'Fayl düzgün PDF deyil.'})
                session.state = 'READY'
            session.expires_at = timezone.now() + timedelta(hours=24)
            session.save(update_fields=['uploaded_bytes', 'state', 'expires_at', 'updated_at'])
        return Response(upload_status(session))

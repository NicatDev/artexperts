"""Permission-checked image previews. Original PDFs never leave this module."""
import hashlib
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
from contextlib import contextmanager

from django.conf import settings
from django.core import signing
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from PIL import Image, ImageDraw, ImageFont
from rest_framework import permissions, views
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from artworks.models import ModerationStatus
from books.models import Book

TOKEN_TTL = 15 * 60
TOKEN_SALT = 'books.reader.v1'
CACHE_LIMIT = 192


class ReaderUnavailable(APIException):
    status_code = 503
    default_detail = 'Oxuyucu hazırda məşğuldur və ya PDF-i aça bilmir. Bir qədər sonra yenidən cəhd edin.'


def reader_book(request, book_id):
    book = get_object_or_404(Book.objects, pk=book_id)
    manager = request.user.is_authenticated and (request.user.pk == book.owner_id or request.user.is_staff)
    if not book.allow_online_reading or not book.digital_file:
        raise PermissionDenied('Müəllif bu kitabı saytda oxumağa icazə verməyib.')
    if book.moderation_status != ModerationStatus.PUBLISHED and not manager:
        raise Http404
    return book


def reader_identity(request, create=False):
    if request.user.is_authenticated:
        return f'user:{request.user.pk}'
    key = request.session.get('book_reader_key')
    if not key and create:
        key = secrets.token_urlsafe(32)
        request.session['book_reader_key'] = key
    if not key:
        raise PermissionDenied('Oxuyucunu yenidən açın.')
    return f'visitor:{key}'


def private_source(book):
    try:
        source = Path(book.digital_file.path).resolve()
        source.relative_to(Path(settings.MEDIA_ROOT).resolve() / 'private')
        stat = source.stat()
    except (OSError, ValueError, NotImplementedError):
        raise Http404('PDF tapılmadı.')
    revision = book.pk.hex + '-' + hashlib.sha256(f'{book.pk}:{book.digital_file.name}:{stat.st_size}:{stat.st_mtime_ns}:{book.updated_at.isoformat()}'.encode()).hexdigest()
    return source, revision


def cache_directory():
    directory = Path(settings.MEDIA_ROOT) / 'private' / 'book-reader-cache'
    try:
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    except OSError:
        raise ReaderUnavailable()
    return directory


@contextmanager
def render_slot(directory):
    # Two native renderers at most across all Gunicorn workers in a container.
    handle = None
    for slot in range(2):
        try:
            candidate = open(directory / f'render-{slot}.lock', 'a+b')
        except OSError:
            raise ReaderUnavailable()
        try:
            if os.name == 'nt':
                import msvcrt
                if candidate.tell() == 0:
                    candidate.write(b'0')
                    candidate.flush()
                candidate.seek(0)
                msvcrt.locking(candidate.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(candidate, fcntl.LOCK_EX | fcntl.LOCK_NB)
            handle = candidate
            break
        except OSError:
            candidate.close()
    if handle is None:
        raise ReaderUnavailable()
    try:
        yield
    finally:
        if os.name == 'nt':
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            fcntl.flock(handle, fcntl.LOCK_UN)
        handle.close()


def prune_cache(directory):
    files = list(directory.glob('*.webp')) + list(directory.glob('*.json'))
    def info(path):
        try:
            stat = path.stat()
            return stat.st_mtime, stat.st_size
        except OSError:
            return 0, 0
    entries = sorted(((*info(path), path) for path in files), key=lambda item: item[0])
    size = sum(item[1] for item in entries)
    if len(entries) < CACHE_LIMIT and size < 112 * 1024 * 1024:
        return
    count = len(entries)
    for _, length, path in entries:
        if count < CACHE_LIMIT - 16 and size < 96 * 1024 * 1024:
            break
        try:
            path.unlink(missing_ok=True)
            count -= 1
            size -= length
        except OSError:
            pass


def preview_asset(source, revision, page=None):
    book_id = revision.split('-', 1)[0]
    if not Book.objects.filter(pk=book_id).exists():
        raise Http404
    directory = cache_directory()
    target = directory / (f'{revision}-{page}.webp' if page is not None else f'{revision}.json')
    try:
        data = target.read_bytes()
        if page is not None:
            return data
        count = int(json.loads(data)['pages'])
        if not 1 <= count <= 5000:
            raise ValueError
        return count
    except (OSError, ValueError, KeyError, TypeError):
        pass
    with render_slot(directory):
        fd, temporary = tempfile.mkstemp(prefix='reader-', suffix='.tmp', dir=directory)
        os.close(fd)
        try:
            command = [sys.executable, '-m', 'books.preview_worker', 'page' if page is not None else 'info', str(source)]
            if page is not None:
                command.extend([str(page), temporary])
            # The native parser does not need application credentials or API keys.
            worker_env = {key: os.environ[key] for key in ('PATH', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL') if key in os.environ}
            worker_env['PYTHONIOENCODING'] = 'utf-8'
            result = subprocess.run(command, cwd=settings.BASE_DIR,
                                    stdout=subprocess.PIPE if page is None else subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL, timeout=18, check=True, env=worker_env)
            if page is None:
                count = int(json.loads(result.stdout)['pages'])
                if not 1 <= count <= 5000:
                    raise ValueError
                Path(temporary).write_text(json.dumps({'pages': count}), encoding='utf-8')
            prune_cache(directory)
            if not Book.objects.filter(pk=book_id).exists():
                raise Http404
            os.replace(temporary, target)
        except (OSError, subprocess.SubprocessError, ValueError, KeyError):
            raise ReaderUnavailable()
        finally:
            Path(temporary).unlink(missing_ok=True)
    try:
        data = target.read_bytes()
    except OSError:
        raise ReaderUnavailable()
    return data if page is not None else count


class ReaderSessionThrottle(UserRateThrottle):
    scope = 'book_reader_session'
    rate = '12/minute'

    def get_cache_key(self, request, view):
        identity = str(request.user.pk) if request.user.is_authenticated else request.session.get('book_reader_key') or self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': hashlib.sha256(identity.encode()).hexdigest()}


class ReaderPageThrottle(ReaderSessionThrottle):
    scope = 'book_reader_page'
    rate = '90/minute'


class ReaderResponseMixin:
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store, max-age=0'
        response['Pragma'] = 'no-cache'
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Robots-Tag'] = 'noindex, noimageindex'
        response['Referrer-Policy'] = 'no-referrer'
        response['Cross-Origin-Resource-Policy'] = 'same-site'
        return response


class BookReaderSessionView(ReaderResponseMixin, views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ReaderSessionThrottle]

    def post(self, request, id):
        book = reader_book(request, id)
        identity = reader_identity(request, create=True)
        source, revision = private_source(book)
        pages = preview_asset(source, revision)
        token = signing.dumps({'book': str(book.pk), 'identity': identity, 'revision': revision}, salt=TOKEN_SALT, compress=True)
        return Response({'token': token, 'pages': pages, 'expires_in': TOKEN_TTL})


class BookReaderPageView(ReaderResponseMixin, views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ReaderPageThrottle]

    def get(self, request, id, page):
        book = reader_book(request, id)
        source, revision = private_source(book)
        try:
            payload = signing.loads(request.query_params.get('token', ''), salt=TOKEN_SALT, max_age=TOKEN_TTL)
        except signing.BadSignature:
            raise PermissionDenied('Oxuma sessiyasının vaxtı bitib. Oxuyucunu yenidən açın.')
        if payload != {'book': str(book.pk), 'identity': reader_identity(request), 'revision': revision}:
            raise PermissionDenied('Oxuma icazəsi etibarlı deyil. Oxuyucunu yenidən açın.')
        count = preview_asset(source, revision)
        if not 1 <= page <= count:
            raise Http404
        data = preview_asset(source, revision, page)
        # Session-specific mark remains even if a visitor extracts a rendered page.
        with Image.open(io.BytesIO(data)) as original:
            marked = Image.new('RGB', (original.width, original.height + 32), 'white')
            marked.paste(original, (0, 0))
        code = hashlib.sha256(payload['identity'].encode()).hexdigest()[:8].upper()
        draw = ImageDraw.Draw(marked)
        draw.text((12, marked.height - 24), f'ART EXPERTS | {code} | {page}/{count}', font=ImageFont.load_default(size=14), fill='#8a7350')
        output = io.BytesIO()
        marked.save(output, 'WEBP', quality=84, method=2)
        response = HttpResponse(output.getvalue(), content_type='image/webp')
        response['Content-Disposition'] = 'inline'
        return response

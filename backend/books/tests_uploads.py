import hashlib
import io
from pathlib import Path
import tempfile
from datetime import timedelta
import uuid
from unittest.mock import patch

from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from books.models import Book, BookUploadSession
from books.uploads import CHUNK_BYTES, cleanup_expired_uploads, session_path
from core.models import ContentSaveOperation
from users.models import User, ArtistProfile


class ResumablePdfUploadTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(email='upload-owner@example.com', password='UploadTesting42!', is_verified=True)
        cls.other = User.objects.create_user(email='upload-other@example.com', password='UploadTesting42!', is_verified=True)
        ArtistProfile.objects.create(user=cls.owner, username='upload-owner', full_name='Upload Owner')

    def setUp(self):
        cache.clear()
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        override = override_settings(MEDIA_ROOT=self.directory.name, ALLOWED_HOSTS=['testserver', 'localhost'])
        override.enable()
        self.addCleanup(override.disable)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def start(self, chunks, book=None):
        response = self.client.post('/api/v1/books/uploads/', {'filename': 'Müəllif kitabı.pdf', 'size': sum(map(len, chunks)),
            'hashes': [hashlib.sha256(part).hexdigest() for part in chunks], 'book_id': str(book.pk) if book else None}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['id']

    def part(self, id, offset, data):
        return self.client.post(f'/api/v1/books/uploads/{id}/chunks/', {'offset': str(offset),
            'chunk': SimpleUploadedFile('chunk.bin', data)}, format='multipart')

    def ready(self, book=None):
        content = b'%PDF-1.7\n% upload fixture\n%%EOF\n'
        id = self.start([content], book)
        response = self.part(id, 0, content)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['state'], 'READY')
        return id, content

    def cover(self):
        output = io.BytesIO()
        Image.new('RGB', (20, 30), 'gold').save(output, 'PNG')
        return SimpleUploadedFile('cover.png', output.getvalue(), content_type='image/png')

    def publish(self, id, submission=None, **extra):
        return self.client.post('/api/v1/books/publish/', {'title_az': 'Resumable book', 'short_description_az': 'Short',
            'full_description_az': 'Full', 'rights_confirmed': 'true', 'cover_image': self.cover(),
            'pdf_upload_id': id, 'submission_id': str(submission or uuid.uuid4()), **extra}, format='multipart')

    def test_anonymous_and_other_user_cannot_access_upload(self):
        id, _ = self.ready()
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f'/api/v1/books/uploads/{id}/').status_code, 403)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f'/api/v1/books/uploads/{id}/').status_code, 404)
        self.assertEqual(self.client.delete(f'/api/v1/books/uploads/{id}/').status_code, 404)
        result = self.publish(id)
        self.assertEqual(result.status_code, 400)
        self.assertFalse(Book.objects.exists())

    def test_manifest_size_and_extension_validation(self):
        for data in [
            {'filename': 'bad.txt', 'size': 8, 'hashes': ['0' * 64]},
            {'filename': 'book.pdf', 'size': 301 * 1024 * 1024, 'hashes': ['0' * 64]},
            {'filename': 'book.pdf', 'size': 10, 'hashes': ['0' * 64, '1' * 64]},
        ]:
            self.assertEqual(self.client.post('/api/v1/books/uploads/', data, format='json').status_code, 400)

    def test_checksum_invalid_chunk_and_out_of_order_rejected(self):
        first = b'%PDF-' + b'1' * (CHUNK_BYTES - 5)
        last = b'end'
        id = self.start([first, last])
        self.assertEqual(self.part(id, CHUNK_BYTES, last).status_code, 409)
        self.assertEqual(self.part(id, 1, first).status_code, 400)
        self.assertEqual(self.part(id, 0, b'bad').status_code, 400)
        wrong = b'%PDF-' + b'2' * (CHUNK_BYTES - 5)
        self.assertEqual(self.part(id, 0, wrong).status_code, 400)
        self.assertEqual(BookUploadSession.objects.get(pk=id).uploaded_bytes, 0)

    def test_resume_duplicate_ack_and_uncommitted_disk_tail(self):
        first = b'%PDF-' + b'1' * (CHUNK_BYTES - 5)
        last = b'last page bytes'
        id = self.start([first, last])
        self.assertEqual(self.part(id, 0, first).status_code, 200)
        # Simulate a lost response: sending the same chunk must not append it twice.
        self.assertEqual(self.part(id, 0, first).data['uploaded'], CHUNK_BYTES)
        session = BookUploadSession.objects.get(pk=id)
        with session_path(session).open('ab') as file:
            file.write(b'uncommitted bytes')
        self.assertEqual(self.client.get(f'/api/v1/books/uploads/{id}/').data['uploaded'], CHUNK_BYTES)
        self.assertEqual(self.part(id, CHUNK_BYTES, last).data['state'], 'READY')
        self.assertEqual(session_path(session).read_bytes(), first + last)

    def test_missing_disk_data_rolls_back_resume_offset(self):
        first = b'%PDF-' + b'1' * (CHUNK_BYTES - 5)
        id = self.start([first, b'last'])
        self.part(id, 0, first)
        session_path(BookUploadSession.objects.get(pk=id)).unlink()
        status = self.client.get(f'/api/v1/books/uploads/{id}/')
        self.assertEqual(status.data['uploaded'], 0)
        self.assertEqual(self.part(id, 0, first).status_code, 200)

    def test_incomplete_and_wrong_target_cannot_be_attached(self):
        id = self.start([b'%PDF-example'])
        self.assertEqual(self.publish(id).status_code, 400)
        book = Book.objects.create(owner=self.owner, cover_image='cover.png')
        id, _ = self.ready(book)
        self.assertEqual(self.publish(id).status_code, 400)
        self.assertEqual(Book.objects.count(), 1)

    def test_attach_preserves_file_and_retries_do_not_duplicate_book(self):
        id, data = self.ready()
        key = uuid.uuid4()
        first = self.publish(id, key, allow_online_reading='true')
        self.assertEqual(first.status_code, 201, first.data)
        book = Book.objects.get(pk=first.data['id'])
        self.assertTrue(book.allow_online_reading)
        self.assertEqual(book.moderation_status, 'PENDING_REVIEW')
        with book.digital_file.open('rb') as file:
            self.assertEqual(file.read(), data)
        self.assertEqual(first.data['current_pdf']['name'], 'Müəllif kitabı.pdf')
        self.assertEqual(self.publish(id, key).data['id'], first.data['id'])
        self.assertEqual(self.publish(id).data['id'], first.data['id'])
        self.assertEqual(Book.objects.count(), 1)
        self.assertEqual(ContentSaveOperation.objects.filter(result_id=book.pk).count(), 2)
        self.assertEqual(self.client.delete(f'/api/v1/books/uploads/{id}/').status_code, 409)
        self.assertEqual(self.client.get('/media/' + book.digital_file.name).status_code, 404)

    def test_edit_keeps_published_status_and_does_not_copy_pdf_again(self):
        book = Book.objects.create(owner=self.owner, cover_image='cover.png', moderation_status='PUBLISHED')
        id, data = self.ready(book)
        response = self.client.patch(f'/api/v1/books/{book.pk}/manage/', {'pdf_upload_id': id, 'allow_online_reading': True,
            'submission_id': str(uuid.uuid4())}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        book.refresh_from_db()
        self.assertEqual(book.moderation_status, 'PUBLISHED')
        with book.digital_file.open('rb') as file:
            self.assertEqual(file.read(), data)

    def test_expiry_cleanup_and_clear_never_delete_attached_files(self):
        used, _ = self.ready()
        book = Book.objects.get(pk=self.publish(used).data['id'])
        pending, _ = self.ready()
        path = session_path(BookUploadSession.objects.get(pk=pending))
        self.assertEqual(self.client.delete('/api/v1/books/uploads/').data['removed'], 1)
        self.assertFalse(path.exists())
        self.assertTrue(Path(book.digital_file.path).exists())
        pending, _ = self.ready()
        BookUploadSession.objects.filter(pk__in=[pending, used]).update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.client.get(f'/api/v1/books/uploads/{pending}/').status_code, 404)
        self.assertEqual(cleanup_expired_uploads(), 2)
        self.assertTrue(Path(book.digital_file.path).exists())

    def test_quota_and_disk_space_fail_gracefully(self):
        for _ in range(3):
            self.start([b'%PDF-abc'])
        self.assertEqual(self.client.post('/api/v1/books/uploads/', {'filename': 'book.pdf', 'size': 8,
            'hashes': [hashlib.sha256(b'%PDF-abc').hexdigest()]}, format='json').status_code, 400)
        self.client.delete('/api/v1/books/uploads/')
        with patch('books.uploads.shutil.disk_usage') as disk:
            disk.return_value.free = 0
            self.assertEqual(self.client.post('/api/v1/books/uploads/', {'filename': 'book.pdf', 'size': 8,
                'hashes': [hashlib.sha256(b'%PDF-abc').hexdigest()]}, format='json').status_code, 507)

    def test_136_mib_upload_is_byte_identical_after_resume(self):
        size = 136 * 1024 * 1024 + 25
        source = Path(self.directory.name) / 'large-source.pdf'
        with source.open('wb') as file:
            file.write(b'%PDF-1.7\n')
            file.seek(size - 7)
            file.write(b'%%EOF\n\n')
        hashes = []
        expected = hashlib.sha256()
        with source.open('rb') as file:
            while block := file.read(CHUNK_BYTES):
                hashes.append(hashlib.sha256(block).hexdigest())
                expected.update(block)
        response = self.client.post('/api/v1/books/uploads/', {'filename': '136mb.pdf', 'size': size, 'hashes': hashes}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        id = response.data['id']
        with source.open('rb') as file:
            offset = 0
            while block := file.read(CHUNK_BYTES):
                result = self.part(id, offset, block)
                self.assertEqual(result.status_code, 200, result.data)
                offset += len(block)
                if offset == CHUNK_BYTES * 3:
                    self.client = APIClient()  # New connection/browser request, same account.
                    self.client.force_authenticate(self.owner)
                    self.assertEqual(self.client.get(f'/api/v1/books/uploads/{id}/').data['uploaded'], offset)
        result = self.publish(id)
        self.assertEqual(result.status_code, 201, result.data)
        book = Book.objects.get(pk=result.data['id'])
        actual = hashlib.sha256()
        with book.digital_file.open('rb') as file:
            while block := file.read(CHUNK_BYTES):
                actual.update(block)
        self.assertEqual(actual.hexdigest(), expected.hexdigest())
        self.assertEqual(book.digital_file.size, size)

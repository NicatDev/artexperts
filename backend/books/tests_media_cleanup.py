import io
from pathlib import Path
import tempfile
from unittest.mock import patch
from datetime import timedelta

from django.core.management import call_command
from django.db import transaction
from django.http import Http404
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from articles.models import Article
from books.models import Book, BookMediaCleanup, BookUploadSession
from books.media_cleanup import legacy_revision, process_cleanup
from books.reader import private_source, preview_asset
from users.models import User


class BookMediaCleanupTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_superuser(email='cleanup@example.com', password='LocalCleanup42!')

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / 'media'
        self.root.mkdir()
        override = override_settings(MEDIA_ROOT=self.root, ALLOWED_HOSTS=['testserver', 'localhost'])
        override.enable()
        self.addCleanup(override.disable)

    def put(self, name, data=b'fixture'):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return path

    def book(self):
        book = Book.objects.create(owner=self.owner)
        pdf = f'private/books/files/{book.pk}.pdf'
        cover = f'books/covers/{book.pk}.jpg'
        Book.objects.filter(pk=book.pk).update(digital_file=pdf, cover_image=cover, allow_online_reading=True)
        book.refresh_from_db()
        return book, self.put(pdf, b'%PDF-1.7 fixture'), self.put(cover)

    def test_admin_single_delete_waits_for_commit_and_removes_files(self):
        book, pdf, cover = self.book()
        self.client.force_login(self.owner)
        url = reverse('admin:books_book_delete', args=[book.pk])
        self.assertContains(self.client.get(url), 'serverdən silinəcək')
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.post(url, {'post': 'yes'}).status_code, 302)
            self.assertTrue(pdf.exists())
            self.assertTrue(cover.exists())
        self.assertFalse(pdf.exists())
        self.assertFalse(cover.exists())
        book.refresh_from_db()
        self.assertIsNotNone(book.deleted_at)
        self.assertFalse(book.digital_file)
        self.assertFalse(book.cover_image)
        self.assertFalse(book.allow_online_reading)
        self.assertFalse(BookMediaCleanup.objects.exists())

    def test_admin_bulk_delete_cleans_every_book_and_keeps_other_book(self):
        first, pdf1, cover1 = self.book()
        second, pdf2, cover2 = self.book()
        keep, pdf3, cover3 = self.book()
        self.client.force_login(self.owner)
        url = reverse('admin:books_book_changelist')
        payload = {'action': 'delete_selected', '_selected_action': [str(first.pk), str(second.pk)]}
        self.assertContains(self.client.post(url, payload), 'serverdən silinəcək')
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(url, {**payload, 'post': 'yes'})
            self.assertEqual(response.status_code, 302)
        self.assertTrue(all(not path.exists() for path in (pdf1, cover1, pdf2, cover2)))
        self.assertTrue(pdf3.exists() and cover3.exists())
        self.assertTrue(Book.objects.filter(pk=keep.pk).exists())

    def test_profile_delete_uses_the_same_cleanup(self):
        book, pdf, cover = self.book()
        api = APIClient()
        api.force_authenticate(self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(api.delete(f'/api/v1/books/{book.pk}/manage/').status_code, 204)
        self.assertFalse(pdf.exists() or cover.exists())

    def test_rollback_preserves_book_and_files_and_cancels_cleanup(self):
        book, pdf, cover = self.book()
        with self.captureOnCommitCallbacks(execute=True):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    book.delete()
                    raise RuntimeError('rollback')
        self.assertTrue(Book.objects.filter(pk=book.pk).exists())
        self.assertTrue(pdf.exists() and cover.exists())
        self.assertFalse(BookMediaCleanup.objects.exists())

    def test_hard_delete_and_owner_cascade_also_cleanup(self):
        for cascade in (False, True):
            owner = User.objects.create_user(email=f'cascade-{cascade}@example.com')
            book, pdf, cover = self.book()
            Book.objects.filter(pk=book.pk).update(owner=owner)
            with self.captureOnCommitCallbacks(execute=True):
                owner.hard_delete() if cascade else book.hard_delete()
            self.assertFalse(pdf.exists() or cover.exists())

    def test_shared_pdf_and_cross_model_cover_are_preserved(self):
        first, pdf, cover = self.book()
        second = Book.objects.create(owner=self.owner, digital_file=first.digital_file.name)
        article = Article.objects.create(author=self.owner)
        Article.objects.filter(pk=article.pk).update(cover_image=first.cover_image.name)
        with self.captureOnCommitCallbacks(execute=True):
            first.delete()
        self.assertTrue(pdf.exists() and cover.exists())
        with self.captureOnCommitCallbacks(execute=True):
            second.delete()
        self.assertFalse(pdf.exists())
        self.assertTrue(cover.exists())

    def test_reader_cache_and_previous_consumed_pdfs_are_removed(self):
        book, pdf, cover = self.book()
        old = BookUploadSession.objects.create(uploader=self.owner, consumed_book=book, filename='old.pdf',
            expected_size=10, uploaded_bytes=10, state='CONSUMED', expires_at=timezone.now() + timedelta(days=1))
        old_pdf = self.put(f'private/books/files/{old.pk}.pdf')
        _, revision = private_source(book)
        old_revision = legacy_revision(book)
        paths = [self.put(f'private/book-reader-cache/{key}{suffix}') for key in
                 (revision, old_revision, book.pk.hex + '-' + '1' * 64) for suffix in ('.json', '-1.webp')]
        unrelated = self.put('private/book-reader-cache/' + '2' * 64 + '-1.webp')
        lock = self.put('private/book-reader-cache/render-0.lock')
        with self.captureOnCommitCallbacks(execute=True):
            book.delete()
        self.assertTrue(all(not path.exists() for path in (*paths, old_pdf, pdf, cover)))
        self.assertTrue(unrelated.exists() and lock.exists())
        with self.assertRaises(Http404):
            preview_asset(pdf, revision)

    def test_disk_permission_failure_is_queued_and_can_be_retried(self):
        book, pdf, cover = self.book()
        with patch('books.media_cleanup.Path.unlink', side_effect=PermissionError('locked')):
            with self.captureOnCommitCallbacks(execute=True):
                book.delete()
        job = BookMediaCleanup.objects.get()
        self.assertEqual(job.attempts, 1)
        self.assertTrue(pdf.exists() and cover.exists())
        self.assertTrue(process_cleanup(job.pk))
        self.assertFalse(pdf.exists() or cover.exists())
        self.assertFalse(BookMediaCleanup.objects.exists())

    def test_cleanup_command_is_dry_run_and_existing_books_require_opt_in(self):
        book, pdf, cover = self.book()
        Book.objects.filter(pk=book.pk).update(deleted_at=timezone.now())
        output = io.StringIO()
        call_command('cleanup_deleted_book_media', '--include-existing', stdout=output)
        self.assertIn('Dry run', output.getvalue())
        self.assertTrue(pdf.exists() and cover.exists())
        call_command('cleanup_deleted_book_media', '--apply', stdout=output)
        self.assertTrue(pdf.exists() and cover.exists())
        with self.captureOnCommitCallbacks(execute=True):
            call_command('cleanup_deleted_book_media', '--include-existing', '--apply', stdout=output)
        self.assertFalse(pdf.exists() or cover.exists())

    def test_database_path_cannot_escape_media_directory(self):
        book, pdf, cover = self.book()
        outside = self.root.parent / 'outside.txt'
        outside.write_bytes(b'preserve')
        Book.objects.filter(pk=book.pk).update(digital_file='private/books/files/../../../../outside.txt')
        with self.captureOnCommitCallbacks(execute=True):
            book.delete()
        self.assertEqual(outside.read_bytes(), b'preserve')
        self.assertEqual(BookMediaCleanup.objects.get().attempts, 1)

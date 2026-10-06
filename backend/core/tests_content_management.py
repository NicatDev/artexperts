import io
import json
import tempfile

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from artworks.models import Artwork
from articles.models import Article
from books.models import Book
from users.models import User, ArtistProfile


class ContentManagementTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media.name, ALLOWED_HOSTS=['testserver', 'localhost'])
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.owner = User.objects.create_user(email='owner@example.com', password='testingPassword42', is_verified=True)
        ArtistProfile.objects.create(user=self.owner, username='owner', full_name='Owner')
        self.other = User.objects.create_user(email='other@example.com', password='testingPassword42', is_verified=True)
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def image(self):
        buffer = io.BytesIO()
        Image.new('RGB', (20, 20), 'red').save(buffer, format='PNG')
        return SimpleUploadedFile('image.png', buffer.getvalue(), content_type='image/png')

    def create(self, kind):
        data = {'title_az': 'Same title', 'rights_confirmed': 'true'}
        if kind == 'artworks':
            data.update(original_master=self.image(), description_az='Description')
        elif kind == 'articles':
            data.update(cover_image=self.image(), excerpt_az='Excerpt', content_az='Body')
        else:
            data.update(cover_image=self.image(), short_description_az='Short', full_description_az='Full', authors=json.dumps([{'name': 'Owner', 'role': 'AUTHOR'}]))
        result = self.client.post(f'/api/v1/{kind}/publish/', data, format='multipart')
        self.assertEqual(result.status_code, 201, result.data)
        return result.data

    def test_owner_crud_and_other_user_cannot_manage(self):
        for kind, model in [('artworks', Artwork), ('articles', Article), ('books', Book)]:
            with self.subTest(kind=kind):
                item = self.create(kind)
                url = f'/api/v1/{kind}/{item["id"]}/manage/'
                self.client.force_authenticate(self.other)
                self.assertEqual(self.client.get(url).status_code, 404)
                self.assertEqual(self.client.patch(url, {'title_az': 'Unauthorized'}).status_code, 404)
                self.assertEqual(self.client.delete(url).status_code, 404)
                self.client.force_authenticate(self.owner)
                self.assertEqual(self.client.get(url).status_code, 200)
                model.objects.filter(pk=item['id']).update(moderation_status='PUBLISHED')
                result = self.client.patch(url, {'title_az': 'Edited title'}, format='multipart')
                self.assertEqual(result.status_code, 200, result.data)
                self.assertEqual(result.data['title'], 'Edited title')
                self.assertEqual(result.data['moderation_status'], 'PENDING_REVIEW')
                self.assertTrue(result.data['translations'])
                own = self.client.get(f'/api/v1/{kind}/my/')
                self.assertEqual(own.data['results'][0]['moderation_status'], 'PENDING_REVIEW')
                self.assertEqual(self.client.delete(url).status_code, 204)
                self.assertFalse(model.objects.filter(pk=item['id']).exists())
                self.assertIsNotNone(model.all_objects.get(pk=item['id']).deleted_at)

    def test_book_updates_metadata_contributors_pdf_and_keeps_url(self):
        item = self.create('books')
        url = f'/api/v1/books/{item["id"]}/manage/'
        response = self.client.patch(url, {
            'title_az': 'New title', 'publisher': 'New publisher', 'isbn': '9781234567890',
            'publication_year': '2026', 'page_count': '120', 'languages': 'AZ, EN',
            'availability_mode': 'FREE', 'price': '2.50', 'currency': 'AZN',
            'table_of_contents_az': 'Chapter 1',
            'authors': json.dumps([{'name': 'New author', 'role': 'CO_AUTHOR', 'bio': 'Biography'}]),
            'digital_file': SimpleUploadedFile('book.pdf', b'%PDF-1.7\nexample', content_type='application/pdf'),
        }, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['slug'], item['slug'])
        self.assertEqual(response.data['contributors'][0]['full_name'], 'New author')
        self.assertEqual(response.data['page_count'], 120)
        self.assertTrue(response.data['has_digital_file'])
        self.assertEqual(self.client.patch(url, {'remove_digital_file': True}).status_code, 200)
        self.assertFalse(Book.objects.get(pk=item['id']).digital_file)

    def test_duplicate_titles_create_distinct_slugs(self):
        for kind in ['books', 'articles']:
            first = self.create(kind)
            second = self.create(kind)
            self.assertNotEqual(first['slug'], second['slug'])

    def test_profile_avatar_social_links_and_read_only_flags(self):
        response = self.client.patch('/api/v1/auth/me/', {
            'full_name': 'Updated', 'username': 'updated', 'avatar': self.image(),
            'social_links': json.dumps({'instagram': 'https://instagram.com/example'}),
            'is_founder': 'true', 'is_featured': 'true',
        }, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        profile = self.owner.artist_profile
        profile.refresh_from_db()
        self.assertEqual(profile.username, 'updated')
        self.assertTrue(profile.avatar_thumbnail)
        self.assertFalse(profile.is_founder)
        self.assertFalse(profile.is_featured)
        self.assertEqual(self.client.patch('/api/v1/auth/me/', {'remove_avatar': True}).status_code, 200)
        profile.refresh_from_db()
        self.assertFalse(profile.avatar)

    def test_invalid_pdf_rejected_without_publishing(self):
        item = self.create('books')
        result = self.client.patch(f'/api/v1/books/{item["id"]}/manage/', {
            'digital_file': SimpleUploadedFile('bad.pdf', b'not a pdf', content_type='application/pdf'),
        }, format='multipart')
        self.assertEqual(result.status_code, 400)
        self.assertFalse(Book.objects.get(pk=item['id']).digital_file)

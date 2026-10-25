import io
import json
import tempfile

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from artworks.models import Artwork
from articles.models import Article
from books.models import Book, BookAccess
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

    def image(self, color='red'):
        buffer = io.BytesIO()
        Image.new('RGB', (20, 20), color).save(buffer, format='PNG')
        return SimpleUploadedFile('image.png', buffer.getvalue(), content_type='image/png')

    def create(self, kind, **extra):
        data = {'title_az': 'Same title', 'rights_confirmed': 'true'}
        if kind == 'artworks':
            data.update(original_master=self.image(), description_az='Description')
        elif kind == 'articles':
            data.update(cover_image=self.image(), excerpt_az='Excerpt', content_az='Body')
        else:
            data.update(cover_image=self.image(), short_description_az='Short', full_description_az='Full', authors=json.dumps([{'name': 'Owner', 'role': 'AUTHOR'}]))
        data.update(extra)
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
                self.assertEqual(result.data['moderation_status'], 'PUBLISHED')
                self.assertTrue(result.data['translations'])
                own = self.client.get(f'/api/v1/{kind}/my/')
                self.assertEqual(own.data['results'][0]['moderation_status'], 'PUBLISHED')
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

    def test_all_types_require_rights_only_on_create_and_edit_without_reupload(self):
        for kind, model in [('artworks', Artwork), ('articles', Article), ('books', Book)]:
            with self.subTest(kind=kind):
                invalid = self.client.post(f'/api/v1/{kind}/publish/', {}, format='multipart')
                self.assertEqual(invalid.status_code, 400)
                item = self.create(kind)
                obj = model.objects.get(pk=item['id'])
                source = 'original_master' if kind == 'artworks' else 'cover_image'
                old_image = getattr(obj, source).name
                if kind == 'artworks':
                    model.objects.filter(pk=obj.pk).update(rights_confirmed=False)
                data = {'title_az': 'Edited without rights checkbox', 'category': ''}
                if kind == 'artworks':
                    data.update(creation_year='', availability_mode='FREE', allow_download='true', is_watermarked='true')
                elif kind == 'books':
                    data.update(publication_year='', page_count='', price='', availability_mode='FREE')
                result = self.client.patch(f'/api/v1/{kind}/{obj.pk}/manage/', data, format='multipart')
                self.assertEqual(result.status_code, 200, result.data)
                obj.refresh_from_db()
                self.assertEqual(getattr(obj, source).name, old_image)
                self.assertIsNone(obj.category)
                if kind == 'artworks':
                    self.assertTrue(obj.allow_download)
                    self.assertTrue(obj.is_watermarked)
                    self.assertFalse(obj.rights_confirmed)
                elif kind == 'books':
                    self.assertEqual(obj.availability_mode, 'FREE')
                    self.assertIsNone(obj.price)

    def test_all_types_image_replacement_updates_actual_images(self):
        for kind, model in [('artworks', Artwork), ('articles', Article), ('books', Book)]:
            item = self.create(kind)
            obj = model.objects.get(pk=item['id'])
            source = 'original_master' if kind == 'artworks' else 'cover_image'
            old_image = getattr(obj, source).name
            result = self.client.patch(f'/api/v1/{kind}/{obj.pk}/manage/', {source: self.image('blue')}, format='multipart')
            self.assertEqual(result.status_code, 200, result.data)
            obj.refresh_from_db()
            self.assertNotEqual(getattr(obj, source).name, old_image)
            public = obj.thumbnail_image if kind == 'artworks' else obj.cover_thumbnail if kind == 'articles' else obj.cover_image
            with public.open('rb') as file, Image.open(file) as image:
                red, _, blue = image.convert('RGB').getpixel((0, 0))
                self.assertGreater(blue, red)

    def test_admin_model_image_replacement_regenerates_derivatives(self):
        for kind, model, source, target in [('artworks', Artwork, 'original_master', 'thumbnail_image'), ('articles', Article, 'cover_image', 'cover_thumbnail')]:
            item = self.create(kind)
            obj = model.objects.get(pk=item['id'])
            previous = getattr(obj, target).name
            setattr(obj, source, self.image('blue'))
            obj.save()
            self.assertNotEqual(getattr(obj, target).name, previous)
            with getattr(obj, target).open('rb') as file, Image.open(file) as image:
                red, _, blue = image.convert('RGB').getpixel((0, 0))
                self.assertGreater(blue, red)

    def test_profile_phone_is_normalized_private_and_clearable(self):
        response = self.client.patch('/api/v1/auth/me/', {'phone_number': '+994 (50) 123-45-67'}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['artist_profile']['phone_number'], '+994501234567')
        self.client.force_authenticate(self.other)
        public = self.client.get('/api/v1/artists/owner/')
        self.assertEqual(public.status_code, 200, public.data)
        self.assertNotIn('phone_number', public.data)
        self.client.force_authenticate(self.owner)
        bad = self.client.patch('/api/v1/auth/me/', {'phone_number': 'invalid'})
        self.assertEqual(bad.status_code, 400)
        self.assertIn('phone_number', bad.data['error']['details'])
        self.assertEqual(self.client.patch('/api/v1/auth/me/', {'phone_number': ''}).status_code, 200)
        self.owner.artist_profile.refresh_from_db()
        self.assertEqual(self.owner.artist_profile.phone_number, '')

    def test_contact_modes_are_identical_for_books_and_gallery(self):
        for kind, model in [('books', Book), ('artworks', Artwork)]:
            self.client.force_authenticate(self.owner)
            item = self.create(kind)
            url = f'/api/v1/{kind}/{item["id"]}/manage/'
            for channel, field, value in [('PHONE', 'contact_phone', '+994501234567'), ('EMAIL', 'contact_email', 'public@example.com'), ('NONE', None, None)]:
                self.client.force_authenticate(self.owner)
                result = self.client.patch(url, {'availability_mode': 'CONTACT', 'contact_mode': channel, 'contact_phone': '+994501234567', 'contact_email': 'public@example.com'})
                self.assertEqual(result.status_code, 200, result.data)
                model.objects.filter(pk=item['id']).update(moderation_status='PUBLISHED')
                self.client.force_authenticate(self.other)
                public = self.client.get(f'/api/v1/{kind}/{item["id"]}/')
                self.assertEqual(public.status_code, 200, public.data)
                self.assertEqual(public.data['contact'], {'mode': channel, 'value': value} if field else None)
                self.assertEqual(public.data['contact_phone'], '')
                self.assertEqual(public.data['contact_email'], '')
            for mode in ['FREE', 'PRIVATE_ACCESS']:
                self.client.force_authenticate(self.owner)
                result = self.client.patch(url, {'availability_mode': mode, 'contact_mode': 'EMAIL', 'contact_email': 'hidden@example.com'})
                self.assertEqual(result.status_code, 200, result.data)
                self.assertIsNone(result.data['contact'])
                self.assertEqual(result.data['contact_mode'], 'NONE')
                self.assertEqual(result.data['contact_email'], '')
                self.assertEqual(result.data['contact_phone'], '')

    def test_all_three_modes_can_be_selected_when_creating(self):
        for kind in ['books', 'artworks']:
            for mode in ['FREE', 'CONTACT', 'PRIVATE_ACCESS']:
                item = self.create(kind, availability_mode=mode, contact_mode='PHONE', contact_phone='+994 50 123 45 67')
                self.assertEqual(item['availability_mode'], mode)
                self.assertEqual(item['contact'], {'mode': 'PHONE', 'value': '+994501234567'} if mode == 'CONTACT' else None)

    def test_contact_validation_for_both_types(self):
        for kind in ['books', 'artworks']:
            item = self.create(kind)
            url = f'/api/v1/{kind}/{item["id"]}/manage/'
            for channel, field, value in [('PHONE', 'contact_phone', 'invalid'), ('EMAIL', 'contact_email', 'invalid')]:
                result = self.client.patch(url, {'availability_mode': 'CONTACT', 'contact_mode': channel, field: value})
                self.assertEqual(result.status_code, 400)
                self.assertIn(field, result.data['error']['details'])
                result = self.client.patch(url, {'availability_mode': 'CONTACT', 'contact_mode': channel, field: ''})
                self.assertEqual(result.status_code, 400)
                self.assertIn(field, result.data['error']['details'])
            result = self.client.patch(url, {'availability_mode': 'CONTACT', 'contact_mode': 'NONE'})
            self.assertEqual(result.status_code, 200, result.data)
            self.assertEqual(self.client.patch(url, {'availability_mode': 'FUTURE_PAID'}).status_code, 400)

    def test_download_policy_has_no_owner_staff_or_legacy_grant_bypass(self):
        staff = User.objects.create_user(email='staff@example.com', password='testingPassword42', is_staff=True)
        for kind, model in [('books', Book), ('artworks', Artwork)]:
            self.client.force_authenticate(self.owner)
            item = self.create(kind)
            url = f'/api/v1/{kind}/{item["id"]}/manage/'
            if kind == 'books':
                uploaded = self.client.patch(url, {'digital_file': SimpleUploadedFile('book.pdf', b'%PDF-1.7\nexample', content_type='application/pdf')}, format='multipart')
                self.assertEqual(uploaded.status_code, 200, uploaded.data)
                BookAccess.objects.create(book_id=item['id'], user=self.other, granted_by=self.owner)
            for mode in ['FREE', 'CONTACT', 'PRIVATE_ACCESS', 'FREE']:
                self.client.force_authenticate(self.owner)
                policy = {'availability_mode': mode, 'contact_mode': 'NONE'}
                if kind == 'artworks':
                    policy['allow_download'] = mode == 'FREE'
                result = self.client.patch(url, policy)
                self.assertEqual(result.status_code, 200, result.data)
                model.objects.filter(pk=item['id']).update(moderation_status='PUBLISHED')
                for viewer in [None, self.other, self.owner, staff]:
                    with self.subTest(kind=kind, mode=mode, viewer=viewer):
                        self.client.force_authenticate(viewer)
                        detail = self.client.get(f'/api/v1/{kind}/{item["id"]}/')
                        if kind == 'books':
                            self.assertEqual(detail.data['has_download_access'], mode == 'FREE')
                        else:
                            self.assertEqual(detail.data['allow_download'], mode == 'FREE')
                        response = self.client.get(f'/api/v1/{kind}/{item["id"]}/download/')
                        self.assertEqual(response.status_code, 200 if mode == 'FREE' else 403)
                        if mode == 'FREE':
                            self.assertEqual(response['Cache-Control'], 'private, no-store')
                            if kind == 'artworks':
                                self.assertIn('.png', response['Content-Disposition'])
                                self.assertTrue(b''.join(response.streaming_content).startswith(b'\x89PNG'))
                        response.close()
            self.client.force_authenticate(self.owner)
            if kind == 'books':
                result = self.client.post(f'/api/v1/books/{item["id"]}/grant-access/', {'email': self.other.email}, format='json')
                self.assertEqual(result.status_code, 400)
            else:
                # Download permission cannot override a restricted sharing mode.
                result = self.client.patch(url, {'availability_mode': 'PRIVATE_ACCESS', 'allow_download': 'true'})
                self.assertEqual(result.status_code, 400)
                self.assertIn('allow_download', result.data['error']['details'])

    def test_restricted_contacts_hidden_even_for_legacy_saved_values(self):
        for kind, model in [('books', Book), ('artworks', Artwork)]:
            self.client.force_authenticate(self.owner)
            item = self.create(kind)
            model.objects.filter(pk=item['id']).update(moderation_status='PUBLISHED', availability_mode='PRIVATE_ACCESS', contact_mode='EMAIL', contact_email='hidden@example.com')
            self.client.force_authenticate(None)
            detail = self.client.get(f'/api/v1/{kind}/{item["id"]}/')
            self.assertIsNone(detail.data['contact'])
            self.assertEqual(detail.data['contact_email'], '')
            self.assertEqual(detail.data['contact_phone'], '')

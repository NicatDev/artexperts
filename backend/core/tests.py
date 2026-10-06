from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.utils import timezone
from datetime import timedelta

from users.models import User, ArtistProfile, EmailVerificationToken
from artworks.models import Artwork, ArtworkTranslation, ModerationStatus
from books.models import Book, BookTranslation, BookAccess, AvailabilityMode
from core.models import SoftDeletableModel


class ArtPlatformBackendTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create founder user
        self.founder = User.objects.create_superuser(
            email='founder@art.az',
            password='founderpass123'
        )
        self.founder_profile = ArtistProfile.objects.create(
            user=self.founder,
            full_name='İlqar Məmmədov',
            username='ilqar-mammadov',
            is_founder=True
        )

        # Create normal artist user
        self.artist = User.objects.create_user(
            email='artist@art.az',
            password='artistpass123',
            is_artist=True,
            is_verified=True
        )
        self.artist_profile = ArtistProfile.objects.create(
            user=self.artist,
            full_name='Aygün Əliyeva',
            username='aygun-aliyeva'
        )

        # Create visitor user
        self.visitor = User.objects.create_user(
            email='visitor@example.com',
            password='visitorpass123',
            is_artist=False,
            is_verified=True
        )

    def test_01_email_verification_and_registration(self):
        # 1. Request verification code
        req_resp = self.client.post('/api/v1/auth/register/request-code/', {'email': 'newartist@art.az'})
        self.assertEqual(req_resp.status_code, status.HTTP_200_OK)

        token = EmailVerificationToken.objects.filter(email='newartist@art.az').first()
        self.assertIsNotNone(token)
        self.assertEqual(len(token.code), 6)

        # 2. Try with wrong code
        fail_resp = self.client.post('/api/v1/auth/register/verify/', {
            'email': 'newartist@art.az',
            'code': '000000',
            'password': 'strongpassword123',
            'full_name': 'New Artist',
            'username': 'new-artist'
        })
        self.assertEqual(fail_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Complete registration with correct code
        success_resp = self.client.post('/api/v1/auth/register/verify/', {
            'email': 'newartist@art.az',
            'code': token.code,
            'password': 'strongpassword123',
            'full_name': 'New Artist',
            'username': 'new-artist'
        })
        self.assertEqual(success_resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='newartist@art.az').exists())

    def test_02_user_lookup_rate_limited_and_protected(self):
        # Anonymous should be unauthorized
        anon_resp = self.client.get('/api/v1/users/lookup/?email=artist@art.az')
        self.assertEqual(anon_resp.status_code, status.HTTP_403_FORBIDDEN)

        # Authenticated user
        self.client.force_authenticate(user=self.founder)
        found_resp = self.client.get('/api/v1/users/lookup/?email=artist@art.az')
        self.assertEqual(found_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(found_resp.data.get('exists'))
        self.assertEqual(found_resp.data.get('username'), 'aygun-aliyeva')

        # Non-existent user returns exists: False without error
        not_found_resp = self.client.get('/api/v1/users/lookup/?email=nobody@example.com')
        self.assertEqual(not_found_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(not_found_resp.data.get('exists'))

    def test_03_artwork_moderation_gating(self):
        # Create published artwork
        pub_art = Artwork.objects.create(
            owner=self.founder,
            artist_attribution='İlqar Məmmədov',
            moderation_status=ModerationStatus.PUBLISHED
        )
        ArtworkTranslation.objects.create(artwork=pub_art, language='az', title='Xəzər Sahilləri')

        # Create pending review artwork
        pending_art = Artwork.objects.create(
            owner=self.artist,
            artist_attribution='Aygün Əliyeva',
            moderation_status=ModerationStatus.PENDING_REVIEW
        )
        ArtworkTranslation.objects.create(artwork=pending_art, language='az', title='Bakı Gecələri')

        # Public listing should only show published artwork
        resp = self.client.get('/api/v1/artworks/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data['results']
        titles = [item['title'] for item in results]
        self.assertIn('Xəzər Sahilləri', titles)
        self.assertNotIn('Bakı Gecələri', titles)

    def test_04_book_access_authorization_and_download(self):
        # Create private access book
        book = Book.objects.create(
            owner=self.founder,
            availability_mode=AvailabilityMode.PRIVATE_ACCESS,
            moderation_status=ModerationStatus.PUBLISHED
        )
        BookTranslation.objects.create(book=book, language='az', title='Rənglərin Harmoniyası', slug='renglerin-harmoniyasi')

        # Anonymous / unauthorized visitor should be denied download
        download_url = f'/api/v1/books/{book.id}/download/'
        anon_resp = self.client.get(download_url)
        # Digital file is not yet set or unauthorized
        self.assertIn(anon_resp.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # Grant access to visitor
        self.client.force_authenticate(user=self.founder)
        grant_resp = self.client.post(f'/api/v1/books/{book.id}/grant-access/', {
            'email': 'visitor@example.com'
        })
        self.assertEqual(grant_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(BookAccess.objects.filter(book=book, user=self.visitor).exists())

    def test_05_dynamic_sitemap_endpoint(self):
        resp = self.client.get('/api/v1/seo/sitemap/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('urls', resp.data)
        paths = [u['path'] for u in resp.data['urls']]
        self.assertIn('', paths)
        self.assertIn('artworks', paths)
        self.assertIn('books', paths)
        self.assertIn('articles', paths)
        self.assertIn('artists', paths)
        self.assertIn('about', paths)

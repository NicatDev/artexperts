from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from users.models import User, ArtistProfile
import json

@override_settings(ALLOWED_HOSTS=['testserver'])
class ProfileAndLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(email='artist@example.com', password='TestPassword42!', is_verified=True)
        self.profile = ArtistProfile.objects.create(user=self.user, username='artist', full_name='Artist')

    def test_invalid_login_has_plain_message_and_structured_details(self):
        response = self.client.post('/api/v1/auth/login/', {'email': self.user.email, 'password': 'wrong'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error']['message'], 'Invalid email or password.')
        self.assertEqual(response.data['error']['details']['non_field_errors'], ['Invalid email or password.'])

    def test_profile_social_links_survive_save_and_are_public(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch('/api/v1/auth/me/', {
            'website': 'https://example.com',
            'social_links': json.dumps({'instagram': 'https://www.instagram.com/artist/', 'youtube': 'https://youtube.com/@artist'}),
        }, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.client.force_authenticate(None)
        public = self.client.get('/api/v1/artists/artist/').data
        self.assertEqual(public['website'], 'https://example.com')
        self.assertEqual(public['social_links']['instagram'], 'https://www.instagram.com/artist/')
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.patch('/api/v1/auth/me/', {'social_links': {}}, format='json').status_code, 200)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.social_links, {})

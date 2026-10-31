from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from articles.models import Article, ArticleTranslation
from users.models import ArtistProfile, User


@override_settings(ALLOWED_HOSTS=['testserver'])
class PublicArticleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = User.objects.create_user(email='artist@example.com')
        self.profile = ArtistProfile.objects.create(
            user=self.author, username='SevinjHaji', full_name='Sevinc Hacızadə',
        )
        self.article = Article.objects.create(author=self.author, moderation_status='PUBLISHED')
        ArticleTranslation.objects.create(
            article=self.article, language='az', title='Test article', slug='test-article',
            excerpt='Summary', content='<p>Text</p>',
        )

    def test_article_without_author_avatar_or_cover_is_public(self):
        response = self.client.get('/api/v1/articles/?lang=az')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['author_avatar'], '')
        self.assertIsNone(response.data['results'][0]['cover_image'])

    def test_homepage_with_article_without_avatar(self):
        response = self.client.get('/api/v1/pages/home-overview/?lang=az')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['featured_articles'][0]['id'], str(self.article.pk))

    def test_original_avatar_used_when_thumbnail_missing(self):
        self.profile.avatar = 'avatars/originals/portrait.jpg'
        self.profile.save()
        response = self.client.get('/api/v1/articles/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['results'][0]['author_avatar'].endswith('/media/avatars/originals/portrait.jpg'))

    def test_author_without_profile_does_not_break_catalog(self):
        self.profile.delete()
        response = self.client.get('/api/v1/articles/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['author_avatar'], '')

    def test_only_published_articles_are_visible_in_public_feeds(self):
        self.article.moderation_status = 'PENDING_REVIEW'
        self.article.is_featured = True
        self.article.save()
        self.assertEqual(self.client.get('/api/v1/articles/').data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/pages/home-overview/').data['featured_articles'], [])

from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from users.models import User
from learning.models import Entry
from articles.models import Article, ArticleTranslation
from datetime import datetime, timezone

@override_settings(ALLOWED_HOSTS=['testserver'])
class SitemapTests(TestCase):
    def setUp(self):
        self.client=APIClient()
        self.owner=User.objects.create_user(email='seo@example.com')
    def sitemap(self):
        response=self.client.get('/api/v1/seo/sitemap/')
        self.assertEqual(response.status_code,200)
        return {item['path']:item for item in response.data['urls']}
    def test_lessons_and_facts_have_listing_and_detail_urls(self):
        for kind in ['lessons','facts']:
            entry=Entry.objects.create(kind=kind,owner=self.owner,title='SEO',content='<p>Text</p>')
            urls=self.sitemap()
            self.assertIn(kind,urls)
            self.assertIn(f'{kind}/{entry.pk}',urls)
            self.assertEqual(urls[f'{kind}/{entry.pk}']['lastmod'],entry.updated_at.isoformat())
        self.assertNotIn('lastmod',urls['lessons'])
    def test_deleted_entries_disappear_and_private_routes_are_excluded(self):
        entry=Entry.objects.create(kind='facts',owner=self.owner,title='Deleted')
        path=f'facts/{entry.pk}';entry.delete()
        urls=self.sitemap();self.assertNotIn(path,urls)
        self.assertFalse(any(any(part in url for part in ['profile','login','register','manage','uploads']) for url in urls))
    def test_unpublished_articles_are_excluded_and_translation_dates_are_used(self):
        article=Article.objects.create(author=self.owner,moderation_status='PENDING_REVIEW')
        translation=ArticleTranslation.objects.create(article=article,language='az',title='SEO article',slug='seo-article',excerpt='Summary',content='Text')
        self.assertNotIn('articles/seo-article',self.sitemap())
        Article.objects.filter(pk=article.pk).update(moderation_status='PUBLISHED',updated_at=datetime(2020,1,1,tzinfo=timezone.utc))
        self.assertEqual(self.sitemap()['articles/seo-article']['lastmod'],translation.updated_at.isoformat())

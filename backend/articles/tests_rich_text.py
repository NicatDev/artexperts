import io
import tempfile

from PIL import Image
from django import forms
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from articles.admin import ArticleTranslationForm
from articles.models import Article, ArticleTranslation, ArticleInlineImage
from articles.rich_text import sanitize_article_html
from users.models import User, ArtistProfile


class ArticleRichTextTests(TestCase):
    def setUp(self):
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name, ALLOWED_HOSTS=['testserver'])
        settings.enable()
        self.addCleanup(settings.disable)
        self.owner = User.objects.create_user(email='editor@example.com', password='testingPassword42', is_verified=True)
        ArtistProfile.objects.create(user=self.owner, username='editor', full_name='Editor')
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def publish(self, content):
        return self.client.post('/api/v1/articles/publish/', {
            'title_az': 'Formatted article', 'excerpt_az': 'Summary', 'content_az': content,
            'rights_confirmed': True,
        }, format='multipart')

    def test_formatted_article_without_cover_and_edit_preserves_format(self):
        html = '<h2>Heading</h2><p><strong>Bold</strong> <em>Italic</em> <u>Underline</u><span style="font-size:24px">Large</span></p><ul><li>Bullet</li></ul><ol><li>First</li></ol><table><tr><th>Header</th><td>Cell</td></tr></table>'
        response = self.publish(html)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data['cover_image'])
        for fragment in ['<h2>', '<strong>', '<em>', '<u>', 'font-size:24px', '<ul>', '<ol>', '<table>']:
            self.assertIn(fragment, response.data['content'])
        article = Article.objects.get(pk=response.data['id'])
        article.moderation_status = 'PUBLISHED'
        article.save()
        edited = self.client.patch(f'/api/v1/articles/{article.pk}/manage/', {'content_az': '<p style="text-align:right"><u>Edited</u></p>'}, format='multipart')
        self.assertEqual(edited.status_code, 200, edited.data)
        self.assertIn('text-align:right', edited.data['content'])
        self.assertEqual(edited.data['moderation_status'], 'PUBLISHED')

    def test_api_removes_scripts_events_unsafe_urls_and_styles(self):
        response = self.publish('<p style="position:fixed;font-size:24px">Body<script>alert(1)</script></p><img src="https://example.com/img.png" onerror="alert(2)"><a href="javascript:alert(3)">Link</a><iframe src="https://example.com"></iframe>')
        self.assertEqual(response.status_code, 201)
        html = response.data['content']
        for unsafe in ['script', 'onerror', 'javascript:', 'position:', 'iframe']:
            self.assertNotIn(unsafe, html)
        self.assertIn('font-size:24px', html)
        self.assertIn('https://example.com/img.png', html)

    def test_blank_html_is_field_error(self):
        for html in ['<p><br></p>', '<p> &nbsp; </p>', '<script>attack()</script>']:
            response = self.publish(html)
            self.assertEqual(response.status_code, 400)
            self.assertIn('content_az', response.data['error']['details'])

    def test_legacy_plain_text_preserves_paragraphs_and_literal_characters(self):
        self.assertEqual(sanitize_article_html('First < 3\nLine two\n\nThird & last'), '<p>First &lt; 3<br>Line two</p><p>Third &amp; last</p>')

    def test_model_and_read_serializer_sanitize_admin_and_existing_content(self):
        response = self.publish('Plain body')
        article = Article.objects.get(pk=response.data['id'])
        translation = article.translations.get(language='az')
        translation.content = '<h3>Admin</h3><script>bad()</script>'
        translation.save()
        self.assertNotIn('script', translation.content)
        ArticleTranslation.objects.filter(pk=translation.pk).update(content='<p>Old import<img src=x onerror="bad()"></p>')
        detail = self.client.get(f'/api/v1/articles/{article.pk}/manage/')
        self.assertNotIn('onerror', detail.data['content'])
        self.assertNotIn('onerror', detail.data['translations'][0]['content'])

    def test_admin_widget_loads_local_assets_and_inline_template(self):
        form = ArticleTranslationForm()
        self.assertIn('articles/article-editor.js', str(form.media))
        self.assertIn('articles/article-editor.css', str(form.media))
        field = str(form['content'])
        self.assertIn('data-article-editor="true"', field)
        self.assertIn('/api/v1/articles/images/upload/', field)
        self.assertNotIn('cdn.', str(form.media))
        self.assertIsInstance(form.fields['content'].widget, forms.Textarea)

    def test_upload_processes_image_and_requires_login(self):
        buffer = io.BytesIO()
        Image.new('RGB', (20, 20), 'red').save(buffer, format='PNG')
        response = self.client.post('/api/v1/articles/images/upload/', {'image': SimpleUploadedFile('image.png', buffer.getvalue(), content_type='image/png')}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIn('/media/articles/inline/', response.data['url'])
        image = ArticleInlineImage.objects.get()
        self.assertEqual(image.uploaded_by, self.owner)
        with image.image.open('rb') as file:
            self.assertEqual(Image.open(file).format, 'WEBP')
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post('/api/v1/articles/images/upload/', {}, format='multipart').status_code, 403)

    def test_upload_rejects_invalid_file(self):
        response = self.client.post('/api/v1/articles/images/upload/', {'image': SimpleUploadedFile('script.png', b'<script>attack()</script>', content_type='image/png')}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ArticleInlineImage.objects.count(), 0)

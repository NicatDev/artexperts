from django import forms
from django.urls import reverse_lazy
from django.utils.translation import get_language
from articles.rich_text import sanitize_article_html
from django.templatetags.static import static
from pathlib import Path
from hashlib import sha256


class ArticleRichTextWidget(forms.Textarea):
    """Self-hosted Tiptap editor; plain textarea remains if JavaScript is unavailable."""
    def __init__(self, attrs=None):
        super().__init__({
            'data-article-editor': 'true',
            'data-upload-url': reverse_lazy('api_v1:article-image-upload'),
            **(attrs or {}),
        })

    def get_context(self, name, value, attrs):
        context = super().get_context(name, sanitize_article_html(value), attrs)
        context['widget']['attrs']['data-locale'] = get_language() or 'az'
        return context

    def use_required_attribute(self, initial):
        # Django validates the source; native validation cannot focus a hidden textarea.
        return False

    @property
    def media(self):
        directory = Path(__file__).parent / 'static' / 'articles'
        version = sha256((directory / 'article-editor.css').read_bytes() +
                         (directory / 'article-editor.js').read_bytes()).hexdigest()[:12]
        return forms.Media(
            css={'all': [static('articles/article-editor.css') + f'?v={version}']},
            js=[static('articles/article-editor.js') + f'?v={version}'],
        )

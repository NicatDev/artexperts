"""One HTML policy for API submissions, admin edits and public rendering."""
import re
from html import escape, unescape

import nh3
from django.core.exceptions import ValidationError
from django.utils.html import strip_tags

TAGS = {'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b',
        'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'span', 'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th',
        'td', 'colgroup', 'col', 'div'}


def filter_attribute(tag, name, value):
    if name == 'style':
        safe = []
        for declaration in value.split(';'):
            prop, _, val = declaration.partition(':')
            prop, val = prop.strip().lower(), val.strip().lower()
            if prop == 'font-size' and re.fullmatch(r'(?:[89]|[1-6]\d|7[0-2])px', val):
                safe.append(f'font-size: {val}')
            elif prop == 'text-align' and val in {'left', 'center', 'right', 'justify'}:
                safe.append(f'text-align: {val}')
        return '; '.join(safe) or None
    if name in {'colspan', 'rowspan', 'span', 'width', 'height'}:
        return value if value.isdigit() and 0 < int(value) <= 10000 else None
    if name == 'colwidth':
        return value if re.fullmatch(r'\d{1,4}(,\d{1,4})*', value) else None
    if name == 'class':
        return 'tableWrapper' if tag == 'div' and value == 'tableWrapper' else None
    return value


def sanitize_article_html(value):
    value = value or ''
    # Existing plain-text articles retain paragraphs and line breaks on first edit.
    if not re.search(r'</?[a-zA-Z][^>]*>', value):
        value = ''.join('<p>' + escape(part).replace('\n', '<br>') + '</p>'
                        for part in value.replace('\r\n', '\n').split('\n\n') if part.strip())
    return nh3.clean(
        value, tags=TAGS,
        clean_content_tags={'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'},
        attributes={
            '*': {'style'}, 'a': {'href', 'title'}, 'img': {'src', 'alt', 'title', 'width', 'height'},
            'th': {'colspan', 'rowspan', 'colwidth'}, 'td': {'colspan', 'rowspan', 'colwidth'},
            'col': {'width', 'span'}, 'div': {'class'},
        },
        attribute_filter=filter_attribute, url_schemes={'http', 'https', 'mailto'},
        link_rel='noopener noreferrer',
        filter_style_properties={'font-size', 'text-align'},
    )


def validate_article_html(value):
    html = sanitize_article_html(value)
    if not unescape(strip_tags(html)).replace('\xa0', ' ').strip() and not re.search(r'<img\b[^>]*\bsrc=', html):
        raise ValidationError('Article content cannot be empty.')
    return html

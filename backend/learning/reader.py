from django.shortcuts import get_object_or_404

from books.reader import BookReaderPageView, BookReaderSessionView, preview_asset, private_pdf_source
from .models import Asset


def published_pdfs():
    return Asset.objects.filter(role='pdf', ready=True, entry__kind='lessons').exclude(file='')


class LessonReaderAccess:
    token_salt = 'learning.reader.v1'

    def get_document(self, request, id):
        return get_object_or_404(published_pdfs(), pk=id)

    def get_source(self, document):
        return private_pdf_source(document.file, document.pk, document.updated_at)

    def render_preview(self, source, revision, page=None):
        return preview_asset(
            source, revision, page,
            document_exists=lambda pk: published_pdfs().filter(pk=pk).exists(),
        )


class LessonReaderSessionView(LessonReaderAccess, BookReaderSessionView):
    pass


class LessonReaderPageView(LessonReaderAccess, BookReaderPageView):
    pass

from core.content_management import ContentCreateView, ContentManageView, ContentOwnerListView
from pathlib import PurePosixPath
from django.utils import timezone
from django.http import FileResponse, Http404
from django.db.models import Count, F, Q
from django.db import transaction
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from books.models import Book, BookAccess, BookCategory, AvailabilityMode
from artworks.models import ModerationStatus
from core.pagination import StandardResultsSetPagination
from books.api.serializers import BookListSerializer, BookDetailSerializer, GrantBookAccessSerializer, BookAccessRecordSerializer, BookCategorySerializer


class BookCategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = BookCategorySerializer
    queryset = BookCategory.objects.all().order_by('slug')
    pagination_class = None


class BookListView(generics.ListAPIView):
    """
    Public books catalog. Returns only approved PUBLISHED books.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = BookListSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = Book.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).select_related('owner__artist_profile').prefetch_related('translations', 'contributor_links__contributor').annotate(unique_views_count=Count('unique_views', distinct=True))

        author = self.request.query_params.get('author')
        if author:
            qs = qs.filter(contributor_links__contributor__full_name__icontains=author).distinct()

        founder_only = self.request.query_params.get('founder')
        if founder_only == 'true':
            qs = qs.filter(is_founder_book=True)

        featured = self.request.query_params.get('featured')
        if featured == 'true':
            qs = qs.filter(is_featured=True)

        mode = self.request.query_params.get('mode')
        if mode:
            qs = qs.filter(availability_mode=mode)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__slug=category)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(translations__title__icontains=search) |
                Q(translations__short_description__icontains=search) |
                Q(contributor_links__contributor__full_name__icontains=search)
            ).distinct()

        owner_artist = self.request.query_params.get('artist')
        if owner_artist:
            qs = qs.filter(owner__artist_profile__username=owner_artist)

        owner_artist = self.request.query_params.get('artist')
        if owner_artist:
            qs = qs.filter(owner__artist_profile__username=owner_artist)

        return qs.order_by('-unique_views_count', '-created_at')


class BookDetailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: BookDetailSerializer})
    def get(self, request, slug_or_id):
        qs = Book.objects.filter(deleted_at__isnull=True).select_related('owner__artist_profile').prefetch_related('translations', 'contributor_links__contributor')

        book = qs.filter(translations__slug=slug_or_id).distinct().first()
        if not book:
            book = qs.filter(id=slug_or_id).distinct().first() if len(slug_or_id) > 20 else None

        if not book:
            return Response({"error": {"message": "Book not found."}}, status=status.HTTP_404_NOT_FOUND)

        if book.moderation_status != ModerationStatus.PUBLISHED:
            if not request.user or not request.user.is_authenticated or (request.user != book.owner and not request.user.is_staff):
                return Response({"error": {"message": "Book not found or pending review."}}, status=status.HTTP_404_NOT_FOUND)

        response = Response(BookDetailSerializer(book, context={'request': request}).data)
        response['Cache-Control'] = 'private, no-store'
        return response


class BookCreateView(ContentCreateView):
    content_kind = 'book'


class BookUpdateDeleteView(ContentManageView):
    content_kind = 'book'


class GrantBookAccessView(views.APIView):
    """Legacy grants cannot override the author's selected download mode."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=GrantBookAccessSerializer, responses={400: None})
    def post(self, request, id):
        try:
            book = Book.objects.get(id=id)
        except Book.DoesNotExist:
            raise Http404("Book not found.")

        if request.user != book.owner and not request.user.is_staff:
            return Response({"error": {"message": "Only the book owner or admin can grant access."}}, status=status.HTTP_403_FORBIDDEN)

        return Response({'error': {'message': 'Yükləmə rejimini paylaşımın redaktə səhifəsində seçin. Fərdi icazələr məhdudiyyəti keçmir.'}}, status=status.HTTP_400_BAD_REQUEST)


class ListBookAccessGrantsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BookAccessRecordSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        book_id = self.kwargs.get('id')
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            raise Http404("Book not found.")

        if self.request.user != book.owner and not self.request.user.is_staff:
            return BookAccess.objects.none()

        return BookAccess.objects.filter(book=book).order_by('-granted_at')

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class RevokeBookAccessView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, id, grant_id):
        books = Book.objects.all()
        if not request.user.is_staff:
            books = books.filter(owner=request.user)
        if not books.filter(pk=id).exists():
            raise Http404('Book not found.')
        with transaction.atomic():
            grant = BookAccess.objects.select_for_update().filter(pk=grant_id, book_id=id).first()
            if not grant:
                raise Http404('Access grant not found.')
            if grant.revoked_at is None:
                grant.revoked_at = timezone.now()
                grant.save(update_fields=['revoked_at', 'updated_at'])
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response['Cache-Control'] = 'private, no-store'
        return response


class BookManagedFileDownloadView(views.APIView):
    """Download an existing PDF from the authenticated owner/admin editor."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, id):
        books = Book.objects.all()
        if not request.user.is_staff:
            books = books.filter(owner=request.user)
        book = books.filter(pk=id).first()
        if not book or not book.digital_file:
            raise Http404('PDF not found.')
        try:
            file = book.digital_file.open('rb')
        except OSError:
            raise Http404('PDF not found.')
        response = FileResponse(
            file, as_attachment=True,
            filename=PurePosixPath(book.digital_file.name).name,
            content_type='application/pdf',
        )
        response['X-Content-Type-Options'] = 'nosniff'
        return response

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class BookDownloadView(views.APIView):
    """
    Strict server-side authorized book file download.
    Never exposes direct media files statically.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, id):
        try:
            book = Book.objects.get(id=id, moderation_status=ModerationStatus.PUBLISHED)
        except Book.DoesNotExist:
            raise Http404("Book not found.")

        if not book.digital_file:
            raise Http404("Digital edition is not currently available for this book.")

        # No implicit owner/admin or legacy per-user grant bypass.
        if book.availability_mode != AvailabilityMode.FREE:
            return Response(
                {"error": {"message": "Kitabı əldə etmək üçün müəlliflə əlaqə saxlayın." if book.availability_mode == AvailabilityMode.CONTACT else "Bu kitabın paylaşılması müəllif tərəfindən məhdudlaşdırılıb."}},
                status=status.HTTP_403_FORBIDDEN
            )

        Book.objects.filter(id=book.id).update(downloads_count=F('downloads_count') + 1)

        response = FileResponse(book.digital_file.open('rb'), as_attachment=True)
        filename = f"book-{book.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Cache-Control'] = 'private, no-store'
        return response

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class UserBooksListView(ContentOwnerListView):
    content_kind = 'book'

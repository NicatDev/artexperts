from core.content_management import ContentCreateView, ContentManageView, ContentOwnerListView
from datetime import timedelta
from django.utils import timezone
from django.http import FileResponse, Http404
from django.db.models import Count, F, Q
from django.db import transaction
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from books.models import Book, BookAccess, BookView, BookCategory, AvailabilityMode
from artworks.models import ModerationStatus
from users.models import User
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

        visitor_id = request.COOKIES.get('art_experts_visitor') or request.headers.get('X-Art-Experts-Visitor')
        if not visitor_id:
            import uuid
            visitor_id = uuid.uuid4().hex
        should_count = not BookView.objects.filter(book=book, visitor_id=visitor_id).exists()
        if should_count:
            with transaction.atomic():
                _, created = BookView.objects.get_or_create(book=book, visitor_id=visitor_id)
            should_count = created
        if should_count:
            Book.objects.filter(id=book.id).update(views_count=F('views_count') + 1)
        book.refresh_from_db()
        response = Response(BookDetailSerializer(book, context={'request': request}).data)
        response.set_cookie('art_experts_visitor', visitor_id, max_age=60 * 60 * 24 * 365 * 2,
                            httponly=True, secure=request.is_secure(), samesite='Lax', path='/')
        response['X-Art-Experts-Visitor'] = visitor_id
        return response


class BookCreateView(ContentCreateView):
    content_kind = 'book'


class BookUpdateDeleteView(ContentManageView):
    content_kind = 'book'


class GrantBookAccessView(views.APIView):
    """
    Owner or Admin grants private download permission to a specific registered user.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=GrantBookAccessSerializer, responses={200: BookAccessRecordSerializer})
    def post(self, request, id):
        try:
            book = Book.objects.get(id=id)
        except Book.DoesNotExist:
            raise Http404("Book not found.")

        if request.user != book.owner and not request.user.is_staff:
            return Response({"error": {"message": "Only the book owner or admin can grant access."}}, status=status.HTTP_403_FORBIDDEN)

        serializer = GrantBookAccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        target_user = User.objects.get(email=email)

        expires_in_days = serializer.validated_data.get('expires_in_days')
        expires_at = timezone.now() + timedelta(days=expires_in_days) if expires_in_days else None

        access, created = BookAccess.objects.update_or_create(
            book=book,
            user=target_user,
            defaults={
                'granted_by': request.user,
                'expires_at': expires_at,
                'revoked_at': None
            }
        )

        return Response(BookAccessRecordSerializer(access).data, status=status.HTTP_200_OK)


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

        # Authorization checks
        has_access = False
        if book.availability_mode == AvailabilityMode.FREE:
            has_access = True
        elif request.user and request.user.is_authenticated:
            if request.user == book.owner or request.user.is_staff:
                has_access = True
            else:
                grant = BookAccess.objects.filter(book=book, user=request.user, revoked_at__isnull=True).first()
                if grant and grant.is_active:
                    has_access = True

        if not has_access:
            return Response(
                {"error": {"message": "You do not have permission to download this digital book. Please request access from the book author or platform owner."}},
                status=status.HTTP_403_FORBIDDEN
            )

        Book.objects.filter(id=book.id).update(downloads_count=F('downloads_count') + 1)

        response = FileResponse(book.digital_file.open('rb'), as_attachment=True)
        filename = f"book-{book.id}.pdf"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class UserBooksListView(ContentOwnerListView):
    content_kind = 'book'

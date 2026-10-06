from core.content_management import ContentCreateView, ContentManageView, ContentOwnerListView
from django.http import FileResponse, Http404
from django.db import models
from django.db import transaction
from django.db.models import F
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from artworks.models import Artwork, ArtworkCategory, ArtworkView, ModerationStatus
from core.pagination import StandardResultsSetPagination
from artworks.api.serializers import ArtworkListSerializer, ArtworkDetailSerializer, ArtworkCategorySerializer


class ArtworkCategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ArtworkCategorySerializer
    queryset = ArtworkCategory.objects.all().order_by('slug')
    pagination_class = None


class ArtworkListView(generics.ListAPIView):
    """
    Public artwork gallery. Shows only PUBLISHED, non-deleted artworks.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = ArtworkListSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = Artwork.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).select_related('owner__artist_profile', 'category').prefetch_related('translations').annotate(unique_views_count=models.Count('unique_views', distinct=True))

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__slug=category)

        artist = self.request.query_params.get('artist')
        if artist:
            qs = qs.filter(owner__artist_profile__username=artist)

        founder_only = self.request.query_params.get('founder')
        if founder_only == 'true':
            qs = qs.filter(is_founder_piece=True)

        featured = self.request.query_params.get('featured')
        if featured == 'true':
            qs = qs.filter(is_featured=True)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(translations__title__icontains=search).distinct()

        return qs.order_by('-unique_views_count', '-created_at')


class ArtworkDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ArtworkDetailSerializer
    lookup_field = 'id'

    def get_queryset(self):
        # Authenticated owner or staff can view even if DRAFT/PENDING
        user = self.request.user
        qs = Artwork.objects.select_related('owner__artist_profile', 'category').prefetch_related('translations')
        if user and user.is_authenticated and user.is_staff:
            return qs.filter(deleted_at__isnull=True)
        if user and user.is_authenticated:
            return qs.filter(deleted_at__isnull=True).filter(models.Q(moderation_status=ModerationStatus.PUBLISHED) | models.Q(owner=user))
        return qs.filter(moderation_status=ModerationStatus.PUBLISHED, deleted_at__isnull=True)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        # A stable first-party browser id survives SSR fetches and prevents refreshes adding views.
        visitor_id = request.COOKIES.get('art_experts_visitor') or request.headers.get('X-Art-Experts-Visitor')
        if not visitor_id:
            import uuid
            visitor_id = uuid.uuid4().hex
        should_count = not ArtworkView.objects.filter(artwork=instance, visitor_id=visitor_id).exists()
        if should_count:
            with transaction.atomic():
                _, created = ArtworkView.objects.get_or_create(artwork=instance, visitor_id=visitor_id)
            should_count = created
        if should_count:
            Artwork.objects.filter(id=instance.id).update(views_count=F('views_count') + 1)
        instance.refresh_from_db()
        serializer = self.get_serializer(instance)
        response = Response(serializer.data)
        response.set_cookie('art_experts_visitor', visitor_id, max_age=60 * 60 * 24 * 365 * 2,
                            httponly=True, secure=request.is_secure(), samesite='Lax', path='/')
        response['X-Art-Experts-Visitor'] = visitor_id
        return response


class ArtworkCreateView(ContentCreateView):
    content_kind = 'artwork'


class ArtworkUpdateDeleteView(ContentManageView):
    content_kind = 'artwork'


class ArtworkDownloadView(views.APIView):
    """
    Controlled download endpoint.
    If the artist selected allow_download=False, this returns 403 Forbidden.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, id):
        try:
            artwork = Artwork.objects.get(id=id, moderation_status=ModerationStatus.PUBLISHED)
        except Artwork.DoesNotExist:
            raise Http404("Artwork not found.")

        if not artwork.allow_download:
            return Response(
                {"error": {"message": "The artist has restricted downloads for this artwork."}},
                status=status.HTTP_403_FORBIDDEN
            )

        if not artwork.detail_image:
            raise Http404("High-resolution file not available.")

        response = FileResponse(artwork.detail_image.open('rb'), as_attachment=True)
        response['Content-Disposition'] = f'attachment; filename="artwork-{artwork.id}.webp"'
        return response


class UserArtworksListView(ContentOwnerListView):
    content_kind = 'artwork'

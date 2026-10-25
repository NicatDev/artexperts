from core.content_management import ContentCreateView, ContentManageView, ContentOwnerListView
from django.http import FileResponse, Http404
from pathlib import Path
from django.db import models
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response

from artworks.models import Artwork, ArtworkCategory, ModerationStatus
from core.pagination import StandardResultsSetPagination
from core.content_access import AvailabilityMode
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
        response = Response(self.get_serializer(instance).data)
        response['Cache-Control'] = 'private, no-store'
        return response


class ArtworkCreateView(ContentCreateView):
    content_kind = 'artwork'


class ArtworkUpdateDeleteView(ContentManageView):
    content_kind = 'artwork'


class ArtworkDownloadView(views.APIView):
    """
    Controlled download endpoint.
    Only the explicit public download mode permits downloads.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, id):
        try:
            artwork = Artwork.objects.get(id=id, moderation_status=ModerationStatus.PUBLISHED)
        except Artwork.DoesNotExist:
            raise Http404("Artwork not found.")

        if artwork.availability_mode != AvailabilityMode.FREE or not artwork.allow_download:
            return Response(
                {"error": {"message": "Əsəri əldə etmək üçün müəlliflə əlaqə saxlayın." if artwork.availability_mode == AvailabilityMode.CONTACT else "Bu əsərin paylaşılması müəllif tərəfindən məhdudlaşdırılıb."}},
                status=status.HTTP_403_FORBIDDEN
            )

        if not artwork.original_master:
            raise Http404("High-resolution file not available.")

        # Previews remain public, while the original is served only through this policy.
        filename = f'artwork-{artwork.id}{Path(artwork.original_master.name).suffix.lower()}'
        response = FileResponse(artwork.original_master.open('rb'), as_attachment=True, filename=filename)
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response


class UserArtworksListView(ContentOwnerListView):
    content_kind = 'artwork'

from rest_framework import views, permissions, status
from django.db.models import Count
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from pages.models import HeroBanner, AboutPageContent, SiteSettings
from artworks.models import Artwork, ModerationStatus
from articles.models import Article
from books.models import Book
from pages.api.serializers import HeroBannerSerializer, AboutPageSerializer, SiteSettingsSerializer
from artworks.api.serializers import ArtworkListSerializer
from articles.api.serializers import ArticleListSerializer
from books.api.serializers import BookListSerializer


class HeroBannerView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        banner = HeroBanner.objects.filter(is_active=True).first()
        if not banner:
            return Response({})
        response = Response(HeroBannerSerializer(banner, context={'request': request}).data)
        response['Cache-Control'] = 'no-store'
        return response


class AboutPageView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        about = AboutPageContent.objects.filter(is_active=True).first()
        if not about:
            return Response({})
        return Response(AboutPageSerializer(about, context={'request': request}).data)


class SiteSettingsView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        settings_obj = SiteSettings.objects.first()
        if not settings_obj:
            settings_obj = SiteSettings.objects.create()
        return Response(SiteSettingsSerializer(settings_obj).data)


class HomePageOverviewView(views.APIView):
    """
    Optimized aggregation endpoint for Homepage loading.
    Returns:
    - hero_banner
    - featured_artworks (limit 6)
    - featured_articles (limit 3)
    - featured_books (limit 4)
    - founder_intro
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        banner = HeroBanner.objects.filter(is_active=True).first()
        about = AboutPageContent.objects.filter(is_active=True).first()

        artworks = Artwork.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).select_related('owner__artist_profile', 'category').prefetch_related('translations').annotate(unique_views_count=Count('unique_views', distinct=True)).order_by('-unique_views_count', '-created_at')[:6]

        articles = Article.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).select_related('author__artist_profile', 'category').prefetch_related('translations').annotate(unique_views_count=Count('unique_views', distinct=True)).order_by('-unique_views_count', '-created_at')[:3]

        books = Book.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).select_related('owner__artist_profile').prefetch_related('translations', 'contributor_links__contributor').annotate(unique_views_count=Count('unique_views', distinct=True)).order_by('-unique_views_count', '-created_at')[:4]

        return Response({
            "banner": HeroBannerSerializer(banner, context={'request': request}).data if banner else None,
            "about_summary": AboutPageSerializer(about, context={'request': request}).data if about else None,
            "featured_artworks": ArtworkListSerializer(artworks, many=True, context={'request': request}).data,
            "featured_articles": ArticleListSerializer(articles, many=True, context={'request': request}).data,
            "featured_books": BookListSerializer(books, many=True, context={'request': request}).data,
        })

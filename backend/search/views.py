from rest_framework import views, permissions, status
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from users.models import ArtistProfile
from artworks.models import Artwork, ModerationStatus
from articles.models import Article
from books.models import Book
from users.api.serializers import ArtistProfileSerializer
from artworks.api.serializers import ArtworkListSerializer
from articles.api.serializers import ArticleListSerializer
from books.api.serializers import BookListSerializer


class UnifiedSearchView(views.APIView):
    """
    Cross-domain unified search across artists, artworks, books, and articles.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        search_type = request.query_params.get('type', 'all')  # all, artworks, books, articles, artists

        if not query or len(query) < 2:
            return Response({
                "query": query,
                "artists": [],
                "artworks": [],
                "books": [],
                "articles": []
            })

        results = {"query": query}

        # 1. Artists
        if search_type in ['all', 'artists']:
            artists = ArtistProfile.objects.filter(
                user__is_active=True,
                user__deleted_at__isnull=True
            ).filter(
                full_name__icontains=query
            )[:8]
            results["artists"] = ArtistProfileSerializer(artists, many=True, context={'request': request}).data
        else:
            results["artists"] = []

        # 2. Artworks
        if search_type in ['all', 'artworks']:
            artworks = Artwork.objects.filter(
                moderation_status=ModerationStatus.PUBLISHED,
                deleted_at__isnull=True,
                translations__title__icontains=query
            ).distinct().select_related('owner__artist_profile', 'category').prefetch_related('translations')[:8]
            results["artworks"] = ArtworkListSerializer(artworks, many=True, context={'request': request}).data
        else:
            results["artworks"] = []

        # 3. Books
        if search_type in ['all', 'books']:
            books = Book.objects.filter(
                moderation_status=ModerationStatus.PUBLISHED,
                deleted_at__isnull=True,
                translations__title__icontains=query
            ).distinct().select_related('owner__artist_profile').prefetch_related('translations', 'contributor_links__contributor')[:8]
            results["books"] = BookListSerializer(books, many=True, context={'request': request}).data
        else:
            results["books"] = []

        # 4. Articles
        if search_type in ['all', 'articles']:
            articles = Article.objects.filter(
                moderation_status=ModerationStatus.PUBLISHED,
                deleted_at__isnull=True,
                translations__title__icontains=query
            ).distinct().select_related('author__artist_profile', 'category').prefetch_related('translations')[:8]
            results["articles"] = ArticleListSerializer(articles, many=True, context={'request': request}).data
        else:
            results["articles"] = []

        return Response(results, status=status.HTTP_200_OK)

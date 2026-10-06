from rest_framework import views, permissions
from rest_framework.response import Response
from django.utils import timezone

from artworks.models import Artwork, ModerationStatus
from articles.models import Article
from books.models import Book
from users.models import ArtistProfile


class DynamicSitemapDataView(views.APIView):
    """
    Dedicated endpoint returning all public, published, non-deleted URLs
    for Next.js sitemap.xml generation.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        urls = []

        # 1. Static Core Pages
        static_pages = [
            ('', 1.0, 'daily'),
            ('artworks', 0.9, 'daily'),
            ('books', 0.9, 'daily'),
            ('articles', 0.8, 'daily'),
            ('artists', 0.8, 'weekly'),
            ('about', 0.8, 'monthly'),
        ]

        now_iso = timezone.now().isoformat()

        for path, priority, freq in static_pages:
            urls.append({
                "path": path,
                "lastmod": now_iso,
                "priority": priority,
                "changefreq": freq
            })

        # 2. Published Artworks
        artworks = Artwork.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).values('id', 'updated_at')

        for item in artworks:
            urls.append({
                "path": f"artworks/{item['id']}",
                "lastmod": item['updated_at'].isoformat(),
                "priority": 0.7,
                "changefreq": "weekly"
            })

        # 3. Published Articles
        articles = Article.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).prefetch_related('translations')

        for art in articles:
            trans = art.translations.filter(language='az').first() or art.translations.first()
            if trans and trans.slug:
                urls.append({
                    "path": f"articles/{trans.slug}",
                    "lastmod": art.updated_at.isoformat(),
                    "priority": 0.7,
                    "changefreq": "monthly"
                })

        # 4. Published Books
        books = Book.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).prefetch_related('translations')

        for bk in books:
            trans = bk.translations.filter(language='az').first() or bk.translations.first()
            if trans and trans.slug:
                urls.append({
                    "path": f"books/{trans.slug}",
                    "lastmod": bk.updated_at.isoformat(),
                    "priority": 0.7,
                    "changefreq": "monthly"
                })

        # 5. Public Artists
        artists = ArtistProfile.objects.filter(
            user__is_active=True,
            user__deleted_at__isnull=True
        ).values('username', 'updated_at')

        for ar in artists:
            urls.append({
                "path": f"artists/{ar['username']}",
                "lastmod": ar['updated_at'].isoformat(),
                "priority": 0.6,
                "changefreq": "weekly"
            })

        return Response({
            "generated_at": now_iso,
            "languages": ["az", "en", "ru"],
            "total_urls": len(urls),
            "urls": urls
        })

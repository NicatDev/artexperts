from core.content_management import ContentCreateView, ContentManageView, ContentOwnerListView
from django.db.models import Count, F, Q
from django.db import transaction
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from articles.models import Article, ArticleCategory, ArticleView, ModerationStatus
from core.pagination import StandardResultsSetPagination
from articles.api.serializers import ArticleListSerializer, ArticleDetailSerializer, ArticleCategorySerializer


class ArticleCategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = ArticleCategorySerializer
    queryset = ArticleCategory.objects.all().order_by('slug')
    pagination_class = None


class ArticleListView(generics.ListAPIView):
    """
    Public editorial list. Returns only approved PUBLISHED articles.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = ArticleListSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = Article.objects.filter(
            moderation_status=ModerationStatus.PUBLISHED,
            deleted_at__isnull=True
        ).select_related('author__artist_profile', 'category').prefetch_related('translations').annotate(unique_views_count=Count('unique_views', distinct=True))

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__slug=category)

        author = self.request.query_params.get('author')
        if author:
            qs = qs.filter(author__artist_profile__username=author)

        founder_only = self.request.query_params.get('founder')
        if founder_only == 'true':
            qs = qs.filter(is_founder_article=True)

        featured = self.request.query_params.get('featured')
        if featured == 'true':
            qs = qs.filter(is_featured=True)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(translations__title__icontains=search) |
                Q(translations__excerpt__icontains=search)
            ).distinct()

        return qs.order_by('-unique_views_count', '-created_at')


class ArticleDetailView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: ArticleDetailSerializer})
    def get(self, request, slug_or_id):
        # Allow lookup by slug across languages or by UUID id
        qs = Article.objects.filter(deleted_at__isnull=True).select_related('author__artist_profile', 'category')

        article = qs.filter(translations__slug=slug_or_id).distinct().first()
        if not article:
            article = qs.filter(id=slug_or_id).distinct().first() if len(slug_or_id) > 20 else None

        if not article:
            return Response({"error": {"message": "Article not found."}}, status=status.HTTP_404_NOT_FOUND)

        # Check permission if not published
        if article.moderation_status != ModerationStatus.PUBLISHED:
            if not request.user or not request.user.is_authenticated or (request.user != article.author and not request.user.is_staff):
                return Response({"error": {"message": "Article not found or pending review."}}, status=status.HTTP_404_NOT_FOUND)

        visitor_id = request.COOKIES.get('art_experts_visitor') or request.headers.get('X-Art-Experts-Visitor')
        if not visitor_id:
            import uuid
            visitor_id = uuid.uuid4().hex
        should_count = not ArticleView.objects.filter(article=article, visitor_id=visitor_id).exists()
        if should_count:
            with transaction.atomic():
                _, created = ArticleView.objects.get_or_create(article=article, visitor_id=visitor_id)
            should_count = created
        if should_count:
            Article.objects.filter(id=article.id).update(views_count=F('views_count') + 1)
        article.refresh_from_db()
        response = Response(ArticleDetailSerializer(article, context={'request': request}).data)
        response.set_cookie('art_experts_visitor', visitor_id, max_age=60 * 60 * 24 * 365 * 2,
                            httponly=True, secure=request.is_secure(), samesite='Lax', path='/')
        response['X-Art-Experts-Visitor'] = visitor_id
        return response


class ArticleCreateView(ContentCreateView):
    content_kind = 'article'


class ArticleUpdateDeleteView(ContentManageView):
    content_kind = 'article'


class UserArticlesListView(ContentOwnerListView):
    content_kind = 'article'

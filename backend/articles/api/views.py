from core.content_management import ContentCreateView, ContentManageView, ContentOwnerListView
from django.db.models import Count, Q
from rest_framework import generics, permissions, status, views
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.throttling import UserRateThrottle
from core.services.media import media_service

from articles.models import Article, ArticleCategory, ArticleInlineImage, ModerationStatus
from core.pagination import StandardResultsSetPagination
from articles.api.serializers import ArticleListSerializer, ArticleDetailSerializer, ArticleCategorySerializer


class ArticleImageUploadThrottle(UserRateThrottle):
    rate = '60/hour'
    scope = 'article_image_upload'


class ArticleImageUploadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ArticleImageUploadThrottle]

    def post(self, request):
        image = request.FILES.get('image')
        if not image:
            raise ValidationError({'image': 'An image is required.'})
        try:
            media_service.validate_image(image)
            detail, _ = media_service.process_artwork_derivatives(image)
        except DjangoValidationError as exc:
            raise ValidationError({'image': exc.messages})
        record = ArticleInlineImage.objects.create(uploaded_by=request.user, image=detail)
        response = Response({'url': request.build_absolute_uri(record.image.url)}, status=201)
        response['Cache-Control'] = 'private, no-store'
        return response


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

        response = Response(ArticleDetailSerializer(article, context={'request': request}).data)
        response['Cache-Control'] = 'private, no-store'
        return response


class ArticleCreateView(ContentCreateView):
    content_kind = 'article'


class ArticleUpdateDeleteView(ContentManageView):
    content_kind = 'article'


class UserArticlesListView(ContentOwnerListView):
    content_kind = 'article'

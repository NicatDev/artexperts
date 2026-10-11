from django.urls import path
from core.content_views import ContentViewRecordView
from articles.api.views import (
    ArticleListView,
    ArticleDetailView,
    ArticleCreateView,
    ArticleUpdateDeleteView,
    ArticleCategoryListView,
    ArticleImageUploadView,
    UserArticlesListView
)

urlpatterns = [
    path('articles/', ArticleListView.as_view(), name='article-list'),
    path('articles/images/upload/', ArticleImageUploadView.as_view(), name='article-image-upload'),
    path('articles/categories/', ArticleCategoryListView.as_view(), name='article-categories'),
    path('articles/publish/', ArticleCreateView.as_view(), name='article-create'),
    path('articles/my/', UserArticlesListView.as_view(), name='my-articles'),
    path('articles/<str:slug_or_id>/', ArticleDetailView.as_view(), name='article-detail'),
    path('articles/<uuid:id>/manage/', ArticleUpdateDeleteView.as_view(), name='article-manage'),
    path('articles/<uuid:id>/view/', ContentViewRecordView.as_view(content_kind='article'), name='article-record-view'),
]

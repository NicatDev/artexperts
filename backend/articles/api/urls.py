from django.urls import path
from articles.api.views import (
    ArticleListView,
    ArticleDetailView,
    ArticleCreateView,
    ArticleUpdateDeleteView,
    ArticleCategoryListView,
    UserArticlesListView
)

urlpatterns = [
    path('articles/', ArticleListView.as_view(), name='article-list'),
    path('articles/categories/', ArticleCategoryListView.as_view(), name='article-categories'),
    path('articles/publish/', ArticleCreateView.as_view(), name='article-create'),
    path('articles/my/', UserArticlesListView.as_view(), name='my-articles'),
    path('articles/<str:slug_or_id>/', ArticleDetailView.as_view(), name='article-detail'),
    path('articles/<uuid:id>/manage/', ArticleUpdateDeleteView.as_view(), name='article-manage'),
]

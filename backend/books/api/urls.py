from django.urls import path
from books.api.views import (
    BookCategoryListView,
    BookListView,
    BookDetailView,
    BookCreateView,
    BookUpdateDeleteView,
    GrantBookAccessView,
    ListBookAccessGrantsView,
    BookDownloadView,
    UserBooksListView
)

urlpatterns = [
    path('books/categories/', BookCategoryListView.as_view(), name='book-categories'),
    path('books/', BookListView.as_view(), name='book-list'),
    path('books/publish/', BookCreateView.as_view(), name='book-create'),
    path('books/my/', UserBooksListView.as_view(), name='my-books'),
    path('books/<str:slug_or_id>/', BookDetailView.as_view(), name='book-detail'),
    path('books/<uuid:id>/manage/', BookUpdateDeleteView.as_view(), name='book-manage'),
    path('books/<uuid:id>/access-grants/', ListBookAccessGrantsView.as_view(), name='book-access-grants'),
    path('books/<uuid:id>/grant-access/', GrantBookAccessView.as_view(), name='book-grant-access'),
    path('books/<uuid:id>/download/', BookDownloadView.as_view(), name='book-download'),
]

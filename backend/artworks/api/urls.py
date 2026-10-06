from django.urls import path
from artworks.api.views import (
    ArtworkListView,
    ArtworkDetailView,
    ArtworkCreateView,
    ArtworkUpdateDeleteView,
    ArtworkDownloadView,
    ArtworkCategoryListView,
    UserArtworksListView
)

urlpatterns = [
    path('artworks/', ArtworkListView.as_view(), name='artwork-list'),
    path('artworks/categories/', ArtworkCategoryListView.as_view(), name='artwork-categories'),
    path('artworks/publish/', ArtworkCreateView.as_view(), name='artwork-create'),
    path('artworks/my/', UserArtworksListView.as_view(), name='my-artworks'),
    path('artworks/<uuid:id>/', ArtworkDetailView.as_view(), name='artwork-detail'),
    path('artworks/<uuid:id>/manage/', ArtworkUpdateDeleteView.as_view(), name='artwork-manage'),
    path('artworks/<uuid:id>/download/', ArtworkDownloadView.as_view(), name='artwork-download'),
]

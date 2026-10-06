from django.urls import path
from search.views import UnifiedSearchView

urlpatterns = [
    path('search/', UnifiedSearchView.as_view(), name='unified-search'),
]

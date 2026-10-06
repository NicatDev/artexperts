from django.urls import path
from seo.views import DynamicSitemapDataView

urlpatterns = [
    path('seo/sitemap/', DynamicSitemapDataView.as_view(), name='dynamic-sitemap'),
]

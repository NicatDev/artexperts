from django.urls import path
from pages.api.views import (
    HeroBannerView,
    AboutPageView,
    SiteSettingsView,
    HomePageOverviewView
)

urlpatterns = [
    path('pages/home-overview/', HomePageOverviewView.as_view(), name='home-overview'),
    path('pages/banner/', HeroBannerView.as_view(), name='hero-banner'),
    path('pages/about/', AboutPageView.as_view(), name='about-page'),
    path('pages/settings/', SiteSettingsView.as_view(), name='site-settings'),
]

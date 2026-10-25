from django.contrib import admin
from django.urls import path, include, re_path
from django.http import Http404
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

api_v1_patterns = [
    path('', include('users.api.urls')),
    path('', include('artworks.api.urls')),
    path('', include('articles.api.urls')),
    path('', include('books.api.urls')),
    path('', include('pages.api.urls')),
    path('', include('search.urls')),
    path('', include('seo.urls')),

    # OpenAPI Schema & Documentation
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('schema/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

def private_media_denied(request):
    raise Http404


urlpatterns = [
    # Do not expose originals or reader cache even when DEBUG static serving is on.
    re_path(r'^media/private(?:/|$)', private_media_denied),
    path('admin/', admin.site.urls),
    path('api/v1/', include((api_v1_patterns, 'api_v1'))),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

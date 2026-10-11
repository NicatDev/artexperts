"""Record browser visits without counting SSR, prefetches, or repeated identities."""
import uuid

from django.db import transaction
from django.db.models import F
from django.http import Http404
from rest_framework import permissions, views
from rest_framework.response import Response

from core.models import ContentViewIdentity


def device_id_for(request):
    for raw in (request.COOKIES.get('art_experts_visitor'), request.headers.get('X-Art-Experts-Visitor')):
        if not isinstance(raw, str) or len(raw) > 64:
            continue
        try:
            return uuid.UUID(raw).hex
        except ValueError:
            continue
    return uuid.uuid4().hex


class ContentViewRecordView(views.APIView):
    permission_classes = [permissions.AllowAny]
    content_kind = None

    def post(self, request, id):
        from core.content_management import content_spec
        from artworks.models import ArtworkView
        from books.models import BookView
        from articles.models import ArticleView

        model = content_spec(self.content_kind)[0]
        view_model = {'artwork': ArtworkView, 'book': BookView, 'article': ArticleView}[self.content_kind]
        device_id = device_id_for(request)
        device_key = f'device:{device_id}'
        account_key = f'user:{request.user.pk}' if request.user.is_authenticated else None
        keys = [device_key] + ([account_key] if account_key else [])
        identity_filter = {'content_kind': self.content_kind, 'content_id': id}

        # Lock the content row: identity aliases and the counter commit together,
        # including simultaneous refreshes/tabs and login/logout transitions.
        with transaction.atomic():
            obj = model.objects.select_for_update().filter(pk=id, moderation_status='PUBLISHED').first()
            if obj is None:
                raise Http404('Content not found.')
            seen = ContentViewIdentity.objects.filter(**identity_filter, visitor_id__in=keys).exists()
            counted = False
            if not seen:
                _, counted = view_model.objects.get_or_create(
                    **{self.content_kind: obj}, visitor_id=account_key or device_key,
                )
                if counted:
                    model.objects.filter(pk=id).update(views_count=F('views_count') + 1)
                    obj.views_count += 1
            # Remember both aliases even when no new view was counted. An anonymous
            # view followed by login, another device, or logout stays deduplicated.
            ContentViewIdentity.objects.bulk_create([
                ContentViewIdentity(**identity_filter, visitor_id=key) for key in keys
            ], ignore_conflicts=True)

        response = Response({'counted': counted, 'views_count': obj.views_count, 'visitor_id': device_id})
        response.set_cookie('art_experts_visitor', device_id, max_age=60 * 60 * 24 * 365 * 2,
                            httponly=True, secure=request.is_secure(), samesite='Lax', path='/')
        response['Cache-Control'] = 'private, no-store'
        return response

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'private, no-store'
        return response

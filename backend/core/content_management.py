"""Owner-only content management, including translations and processed uploads."""
import math
import os
import uuid
import re
from pathlib import Path
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.text import slugify
from django.utils.html import strip_tags
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.services.media import media_service
from core.validators import validate_pdf_file


def content_spec(kind):
    # Lazy imports keep this shared module independent of application import order.
    if kind == 'artwork':
        from artworks.models import Artwork, ArtworkTranslation
        from artworks.api.serializers import ArtworkCreateUpdateSerializer, ArtworkDetailSerializer
        return Artwork, ArtworkTranslation, ArtworkCreateUpdateSerializer, ArtworkDetailSerializer, 'owner', ('title', 'description')
    if kind == 'article':
        from articles.models import Article, ArticleTranslation
        from articles.api.serializers import ArticleCreateUpdateSerializer, ArticleDetailSerializer
        return Article, ArticleTranslation, ArticleCreateUpdateSerializer, ArticleDetailSerializer, 'author', ('title', 'excerpt', 'content')
    from books.models import Book, BookTranslation
    from books.api.serializers import BookCreateUpdateSerializer, BookDetailSerializer
    return Book, BookTranslation, BookCreateUpdateSerializer, BookDetailSerializer, 'owner', ('title', 'short_description', 'full_description', 'table_of_contents')


@transaction.atomic
def save_content(kind, request, instance=None, partial=False):
    model, translation_model, write_serializer, _, owner_field, translated_fields = content_spec(kind)
    operation = None
    if request.data.get('submission_id'):
        from core.models import ContentSaveOperation
        from rest_framework.exceptions import PermissionDenied
        try:
            key = uuid.UUID(str(request.data['submission_id']))
        except (ValueError, TypeError):
            raise ValidationError({'submission_id': 'Yanlış sorğu identifikatoru.'})
        ContentSaveOperation.objects.get_or_create(pk=key, defaults={'owner': request.user, 'content_kind': kind, 'target_id': instance.pk if instance else None})
        operation = ContentSaveOperation.objects.select_for_update().get(pk=key)
        if operation.owner_id != request.user.pk or operation.content_kind != kind or operation.target_id != (instance.pk if instance else None):
            raise PermissionDenied()
        if operation.result_id:
            completed = model.objects.filter(pk=operation.result_id).first()
            if completed and (getattr(completed, f'{owner_field}_id') == request.user.pk or request.user.is_staff):
                return completed
            raise ValidationError({'submission_id': 'Bu paylaşım artıq silinib və ya əlçatan deyil.'})
    serializer = write_serializer(instance, data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)
    data = dict(serializer.validated_data)
    pdf_upload_id = data.pop('pdf_upload_id', None)
    translated = {f'{field}_{lang}': data.pop(f'{field}_{lang}')
                  for lang in ('az', 'en', 'ru') for field in translated_fields
                  if f'{field}_{lang}' in data}
    authors = data.pop('authors', None)
    remove_digital_file = data.pop('remove_digital_file', False)
    rights = data.pop('rights_confirmed', False)
    if instance is None and not rights:
        raise ValidationError({'rights_confirmed': 'Please confirm your publishing rights.'})
    if kind == 'artwork':
        data['rights_confirmed'] = rights or bool(instance and instance.rights_confirmed)
    image_field = 'original_master' if kind == 'artwork' else 'cover_image'
    image = data.get(image_field)
    if image:
        try:
            media_service.validate_image(image)
        except DjangoValidationError as exc:
            raise ValidationError({image_field: exc.messages})
        image.seek(0)
    pdf = data.get('digital_file')
    if pdf:
        if pdf_upload_id:
            raise ValidationError({'digital_file': 'İki yükləmə üsulundan yalnız birini istifadə edin.'})
        try:
            validate_pdf_file(pdf)
        except DjangoValidationError as exc:
            raise ValidationError({'digital_file': exc.messages})
        pdf.seek(0)
        data['digital_filename'] = re.sub(r'[\x00-\x1f\x7f]', '', Path(pdf.name.replace('\\', '/')).name)[:250]
    if remove_digital_file:
        if pdf:
            raise ValidationError({'digital_file': 'Choose either replacement or removal.'})
        data['digital_file'] = None
        data['digital_filename'] = ''

    with transaction.atomic():
        uploaded = None
        if pdf_upload_id and kind == 'book':
            from books.models import BookUploadSession
            from books.uploads import session_path
            uploaded = BookUploadSession.objects.select_for_update().filter(pk=pdf_upload_id, uploader=request.user, expires_at__gt=timezone.now()).first()
            if not uploaded or uploaded.target_book_id != (instance.pk if instance else None):
                raise ValidationError({'digital_file': 'Yükləmə sessiyası etibarlı deyil. Faylı yenidən seçin.'})
            if uploaded.state == 'CONSUMED':
                # Recover a lost final response without creating a second book.
                existing = model.objects.filter(pk=uploaded.consumed_book_id).first()
                if existing and (existing.owner_id == request.user.pk or request.user.is_staff):
                    if operation:
                        operation.result_id = existing.pk
                        operation.save(update_fields=['result_id', 'updated_at'])
                    return existing
                raise ValidationError({'digital_file': 'Bu yükləmə artıq istifadə olunub.'})
            if uploaded.state != 'READY' or uploaded.uploaded_bytes != uploaded.expected_size:
                raise ValidationError({'digital_file': 'PDF yüklənməsi hələ tamamlanmayıb.'})
            path = session_path(uploaded)
            if not path.is_file() or path.stat().st_size != uploaded.expected_size:
                raise ValidationError({'digital_file': 'PDF faylı tapılmadı. Yükləməni yenidən başladın.'})
            destination = Path(settings.MEDIA_ROOT) / 'private' / 'books' / 'files' / f'{uploaded.pk}.pdf'
            destination.parent.mkdir(parents=True, exist_ok=True)
            if path != destination:
                os.replace(path, destination)
            data['digital_file'] = f'private/books/files/{uploaded.pk}.pdf'
            data['digital_filename'] = uploaded.filename
        if instance is not None:
            instance = model.objects.select_for_update().get(pk=instance.pk)
            if getattr(instance, f'{owner_field}_id') != request.user.pk and not request.user.is_staff:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied()
        if kind == 'artwork' and instance is None and not data.get('artist_attribution'):
            profile = getattr(request.user, 'artist_profile', None)
            data['artist_attribution'] = profile.full_name if profile else request.user.email
        if instance is None:
            # First publication requires approval. Editing preserves the locked
            # current status, so approved content stays public and pending content
            # cannot be approved by an owner edit.
            data['moderation_status'] = 'PENDING_REVIEW'
            data['rejection_reason'] = ''
            instance = model.objects.create(**{owner_field: request.user}, **data)
        else:
            for field, value in data.items():
                setattr(instance, field, value)
            instance.save()
        if uploaded:
            uploaded.state = 'CONSUMED'
            uploaded.consumed_book = instance
            uploaded.expires_at = timezone.now() + timedelta(days=7)
            uploaded.save(update_fields=['state', 'consumed_book', 'expires_at', 'updated_at'])

        for lang in ('az', 'en', 'ru'):
            existing = instance.translations.filter(language=lang).first()
            values = {field: translated[f'{field}_{lang}'] for field in translated_fields if f'{field}_{lang}' in translated}
            if lang != 'az' and not any(f'{field}_{lang}' in translated for field in translated_fields):
                # The single-language editor updates existing translated records too,
                # keeping their stable URLs while showing the same submitted text.
                if existing:
                    for field in translated_fields:
                        if f'{field}_az' in translated:
                            setattr(existing, field, translated[f'{field}_az'])
                    existing.save()
                continue
            if lang != 'az' and values.get('title') == '':
                # Empty optional translations fall back to the primary language.
                primary = instance.translations.filter(language='az').first()
                if primary:
                    values = {field: values.get(field) or getattr(primary, field, '') for field in translated_fields}
            if existing:
                if values:
                    for field, value in values.items():
                        setattr(existing, field, value)
                    # Keep existing article/book URLs stable when the title changes.
                    existing.save()
                continue
            if lang != 'az' and not values.get('title'):
                values = {field: translated.get(f'{field}_{lang}') or translated.get(f'{field}_az', '') for field in translated_fields}
            if not values.get('title'):
                continue
            if kind != 'artwork':
                # UUID suffix prevents duplicate titles colliding across creators.
                values['slug'] = f"{slugify(values['title'])[:205] or kind}-{instance.pk.hex}"
            translation_model.objects.create(**{kind: instance}, language=lang, **values)

        if kind == 'article':
            az = instance.translations.filter(language='az').first()
            instance.reading_time_minutes = max(1, math.ceil(len(strip_tags(az.content if az else '').split()) / 200))
            instance.save(update_fields=['reading_time_minutes'])
        if kind == 'book' and (authors is not None or not instance.contributor_links.exists()):
            from books.models import BookContributor, BookContributorLink
            profile = getattr(request.user, 'artist_profile', None)
            owner_name = profile.full_name if profile else request.user.email
            authors = authors or [{'name': owner_name, 'role': 'AUTHOR', 'bio': ''}]
            instance.contributor_links.all().delete()
            for order, author in enumerate(authors):
                contributor, _ = BookContributor.objects.get_or_create(
                    full_name=author['name'], bio=author.get('bio', ''),
                    linked_user=request.user if author['name'] == owner_name else None,
                )
                BookContributorLink.objects.create(book=instance, contributor=contributor, role=author['role'], order=order)
    if operation:
        operation.result_id = instance.pk
        operation.save(update_fields=['result_id', 'updated_at'])
    return instance


class ContentCreateView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return content_spec(self.content_kind)[2]

    def create(self, request, *args, **kwargs):
        instance = save_content(self.content_kind, request)
        serializer = content_spec(self.content_kind)[3](instance, context={'request': request})
        response = Response(serializer.data, status=201)
        response['Cache-Control'] = 'no-store'
        return response


class ContentManageView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        model, _, _, _, owner_field, _ = content_spec(self.content_kind)
        queryset = model.objects.all().prefetch_related('translations')
        if not self.request.user.is_staff:
            queryset = queryset.filter(**{owner_field: self.request.user})
        return queryset

    def get_serializer_class(self):
        if getattr(self.request, 'method', '') in ('PATCH', 'PUT'):
            return content_spec(self.content_kind)[2]
        return content_spec(self.content_kind)[3]

    def update(self, request, *args, **kwargs):
        instance = save_content(self.content_kind, request, self.get_object(), partial=kwargs.get('partial', False))
        serializer = content_spec(self.content_kind)[3](instance, context={'request': request})
        return Response(serializer.data)

    def perform_destroy(self, instance):
        instance.delete()

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


class ContentOwnerListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return content_spec(self.content_kind)[3]

    def get_queryset(self):
        model, _, _, _, owner_field, _ = content_spec(self.content_kind)
        queryset = model.objects.filter(**{owner_field: self.request.user}).select_related(
            f'{owner_field}__artist_profile', 'category'
        ).prefetch_related('translations')
        if self.content_kind == 'book':
            queryset = queryset.prefetch_related('contributor_links__contributor')
        return queryset.order_by('-created_at')

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response


import hashlib, os, shutil, subprocess, json
from pathlib import Path
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.files import File
from django.core.files.base import ContentFile
from django.utils.html import strip_tags
from rest_framework import views, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from core.validators import MAX_PDF_SIZE_BYTES, validate_pdf_file
from core.pagination import StandardResultsSetPagination
from articles.rich_text import sanitize_article_html
from core.services.media import media_service
from users.api.serializers import ArtistProfileSerializer
from .models import Entry, Asset

CHUNK = 8 * 1024 * 1024
class Superuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_superuser)

class AssetSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.role == 'pdf':
            data['file'] = None
        return data

    class Meta:
        model = Asset
        fields = ['id','role','filename','size','file','poster','order']
class EntrySerializer(serializers.ModelSerializer):
    assets = AssetSerializer(many=True, read_only=True)
    author_profile = serializers.SerializerMethodField()
    def get_author_profile(self, obj):
        profile = getattr(obj.owner, 'artist_profile', None)
        return ArtistProfileSerializer(profile, context=self.context).data if profile else None
    class Meta:
        model = Entry
        fields = ['id','kind','title','summary','content','assets','author_profile','created_at','updated_at']

class EntryWrite(serializers.Serializer):
    title = serializers.CharField(max_length=250)
    summary = serializers.CharField(required=False, allow_blank=True, max_length=5000, default='')
    content = serializers.CharField(required=False, allow_blank=True, max_length=2000000, default='')
    asset_ids = serializers.ListField(child=serializers.UUIDField(), max_length=25, default=list)
    submission_id = serializers.UUIDField()

class EntryListSerializer(EntrySerializer):
    class Meta(EntrySerializer.Meta):
        fields = ['id','kind','title','summary','assets','author_profile','created_at','updated_at']

class EntryList(views.APIView):
    def get(self, request, kind):
        qs = Entry.objects.filter(kind=kind).select_related('owner__artist_profile').prefetch_related('assets')
        search = request.query_params.get('search','').strip()[:200]
        if search: qs = qs.filter(Q(title__icontains=search)|Q(summary__icontains=search)|Q(content__icontains=search))
        page = StandardResultsSetPagination(); rows = page.paginate_queryset(qs, request)
        return page.get_paginated_response(EntryListSerializer(rows, many=True, context={'request': request}).data)

class EntryDetail(views.APIView):
    def get(self, request, kind, id):
        return Response(EntrySerializer(get_object_or_404(Entry, kind=kind, pk=id), context={'request': request}).data)

class EntryManage(views.APIView):
    permission_classes = [Superuser]
    def post(self, request, kind, id=None): return self.save(request, kind, id)
    def patch(self, request, kind, id): return self.save(request, kind, id)
    def delete(self, request, kind, id):
        get_object_or_404(Entry, kind=kind, pk=id).delete()
        return Response(status=204)
    @transaction.atomic
    def save(self, request, kind, id):
        s = EntryWrite(data=request.data); s.is_valid(raise_exception=True); data = s.validated_data
        existing = Entry.objects.select_for_update().filter(pk=id or data['submission_id']).first()
        if existing and (existing.kind != kind): raise ValidationError({'title':'Invalid entry.'})
        if id and not existing: raise ValidationError({'title':'Entry no longer exists.'})
        if not id and existing: return Response(EntrySerializer(existing,context={'request':request}).data)
        assets = list(Asset.objects.select_for_update().filter(pk__in=data['asset_ids'], ready=True).filter(Q(owner=request.user, entry__isnull=True)|Q(entry=existing) if existing else Q(owner=request.user, entry__isnull=True)))
        if len(assets) != len(set(data['asset_ids'])): raise ValidationError({'assets':'Invalid or unavailable media.'})
        html = sanitize_article_html(data['content'])
        has_text = bool(strip_tags(html).replace('&nbsp;', '').strip()) or '<img ' in html
        if kind == 'lessons' and not has_text and not data['summary'].strip() and not assets: raise ValidationError({'content':'Add text, an image or a video.'})
        if kind == 'facts' and not has_text: raise ValidationError({'content':'Content is required.'})
        if kind == 'facts' and (len(assets)>1 or any(a.role not in ('cover', 'image') for a in assets)): raise ValidationError({'assets':'Use one image.'})
        if sum(a.role=='cover' for a in assets)>1: raise ValidationError({'assets':'Use one cover.'})
        entry = existing or Entry(id=data['submission_id'], owner=request.user, kind=kind)
        entry.title=data['title']; entry.summary=data['summary']; entry.content=html; entry.save()
        for old in entry.assets.exclude(pk__in=data['asset_ids']): old.delete()
        for index, asset_id in enumerate(data['asset_ids']):
            asset = next(a for a in assets if a.pk==asset_id); asset.entry=entry; asset.order=index; asset.save(update_fields=['entry','order'])
        return Response(EntrySerializer(entry,context={'request':request}).data,status=200 if existing else 201)

def part_path(asset): return Path(settings.MEDIA_ROOT)/'private'/'learning'/f'{asset.pk}.part'
def status(asset):
    return {
        'id': str(asset.pk),
        'uploaded': asset.uploaded,
        'size': asset.size,
        'chunk_size': CHUNK,
        'state': 'READY' if asset.ready else 'UPLOADING',
        'attached': asset.entry_id is not None,
    }

def cleanup():
    for asset in Asset.objects.filter(entry__isnull=True, updated_at__lt=timezone.now()-timedelta(days=2))[:100]: asset.delete()

class PrivateUpload(views.APIView):
    permission_classes=[Superuser]
    def finalize_response(self,request,response,*args,**kwargs):
        response=super().finalize_response(request,response,*args,**kwargs)
        response['Cache-Control']='private, no-store'
        return response

class UploadStart(PrivateUpload):
    permission_classes=[Superuser]
    def post(self,request):
        role=request.data.get('role'); size=request.data.get('size'); hashes=request.data.get('hashes',[])
        filename=str(request.data.get('filename','')).replace('\\','/').split('/')[-1][:250]
        ext=Path(filename).suffix.lower()
        file_types = {
            'video': (2 * 1024**3, ('.mp4', '.webm')),
            'pdf': (MAX_PDF_SIZE_BYTES, ('.pdf',)),
            'cover': (25 * 1024**2, ('.png', '.jpg', '.jpeg', '.webp')),
            'image': (25 * 1024**2, ('.png', '.jpg', '.jpeg', '.webp')),
        }
        if not isinstance(role, str) or role not in file_types:
            raise ValidationError({'assets': 'Unsupported media type.'})
        limit, extensions = file_types[role]
        import re
        if not isinstance(size,int) or not 0<size<=limit or not isinstance(hashes,list) or len(hashes)!=(size+CHUNK-1)//CHUNK or any(not isinstance(h,str) or not re.fullmatch('[0-9a-f]{64}',h) for h in hashes): raise ValidationError({'assets':'Invalid file or size.'})
        if ext not in extensions: raise ValidationError({'assets':'Unsupported media type.'})
        cleanup(); directory=Path(settings.MEDIA_ROOT)/'private'/'learning'; directory.mkdir(parents=True,exist_ok=True)
        with transaction.atomic():
            from users.models import User
            User.objects.select_for_update().get(pk=request.user.pk)
            pending=Asset.objects.filter(entry__isnull=True)
            if pending.filter(owner=request.user).count()>=40: raise ValidationError({'assets':'Too many unfinished uploads.'})
            reserved=pending.filter(ready=False).aggregate(total=Sum('size'))['total'] or 0
            if shutil.disk_usage(directory).free < reserved*2+size*2+512*1024**2: raise ValidationError({'assets':'Insufficient storage.'})
            asset=Asset.objects.create(owner=request.user,role=role,filename=filename,size=size,hashes=hashes)
        return Response(status(asset),status=201)

class UploadStatus(PrivateUpload):
    permission_classes=[Superuser]
    def get(self,request,id):
        with transaction.atomic():
            a=get_object_or_404(Asset.objects.select_for_update(),pk=id,owner=request.user)
            if not a.ready:
                path=part_path(a); actual=path.stat().st_size if path.exists() else 0
                if actual<a.uploaded: a.uploaded=actual//CHUNK*CHUNK; a.save()
            return Response(status(a))
    def delete(self,request,id):
        a=get_object_or_404(Asset,pk=id,owner=request.user,entry__isnull=True); a.delete(); return Response(status=204)

class UploadChunk(PrivateUpload):
    permission_classes=[Superuser]; parser_classes=[MultiPartParser,FormParser]
    def post(self,request,id):
        chunk=request.FILES.get('chunk')
        try: offset=int(request.data.get('offset',-1))
        except (TypeError,ValueError): offset=-1
        if not chunk or not 0<chunk.size<=CHUNK or offset<0 or offset%CHUNK: raise ValidationError({'assets':'Invalid chunk.'})
        with transaction.atomic():
            a=get_object_or_404(Asset.objects.select_for_update(),pk=id,owner=request.user)
            if a.ready: return Response(status(a))
            index=offset//CHUNK; digest=hashlib.sha256()
            for block in chunk.chunks(): digest.update(block)
            if index>=len(a.hashes) or digest.hexdigest()!=a.hashes[index] or chunk.size!=min(CHUNK,a.size-offset): raise ValidationError({'assets':'Chunk verification failed.'})
            if offset<a.uploaded: return Response(status(a))
            if offset!=a.uploaded: return Response(status=409)
            path=part_path(a); path.parent.mkdir(parents=True,exist_ok=True); chunk.seek(0)
            with open(path,'r+b' if path.exists() else 'w+b') as f:
                f.truncate(offset); f.seek(offset)
                for block in chunk.chunks(): f.write(block)
                f.flush(); os.fsync(f.fileno())
            a.uploaded+=chunk.size
            if a.uploaded==a.size:
                try: finalize(a,path)
                except Exception:
                    path.unlink(missing_ok=True)
                    raise ValidationError({'assets': 'Media could not be processed.'})
            a.save()
        return Response(status(a))

def finalize(a,path):
    if a.role == 'pdf':
        with open(path, 'rb') as source:
            pdf = File(source, name=a.filename)
            validate_pdf_file(pdf)
            a.file.save(f'private/learning/pdfs/{a.pk}.pdf', pdf, save=False)
    elif a.role != 'video':
        with open(path,'rb') as f:
            source=File(f,name=a.filename); media_service.validate_image(source); source.seek(0)
            image,_=media_service.process_artwork_derivatives(source)
            a.file.save(f'learning/images/{a.pk}.webp',image,save=False)
    else:
        probe=subprocess.run(['ffprobe','-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',str(path)],capture_output=True,timeout=30,check=True)
        metadata=json.loads(probe.stdout)
        container=metadata.get('format',{}).get('format_name','')
        if not any(fmt in container for fmt in ('mov','mp4','matroska','webm')): raise ValueError('Unsupported container')
        streams=metadata['streams']; video=next(s for s in streams if s.get('codec_type')=='video')
        if video.get('codec_name') not in ('h264','vp8','vp9','av1'): raise ValueError('Unsupported codec')
        if video.get('width',0)*video.get('height',0)>3840*2160: raise ValueError('Video dimensions too large')
        ext=Path(a.filename).suffix.lower()
        with open(path,'rb') as f: a.file.save(f'learning/videos/{a.pk}{ext}',File(f),save=False)
        try:
            frame=subprocess.run(['ffmpeg','-v','error','-protocol_whitelist','file,pipe','-i',str(path),'-frames:v','1','-vf','scale=960:-2','-f','image2pipe','-vcodec','mjpeg','pipe:1'],capture_output=True,timeout=20,check=True)
            a.poster.save(f'learning/posters/{a.pk}.jpg',ContentFile(frame.stdout),save=False)
        except (subprocess.SubprocessError,OSError): pass
    a.ready=True
    transaction.on_commit(lambda: path.unlink(missing_ok=True))

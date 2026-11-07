import io, hashlib, tempfile
from PIL import Image
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from users.models import User
from .models import Entry, Asset

@override_settings(ALLOWED_HOSTS=['testserver'])
class LearningTests(TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.setting=override_settings(MEDIA_ROOT=self.temp.name);self.setting.enable();self.addCleanup(self.setting.disable)
        self.user=User.objects.create_superuser(email='super@example.com',password='testingPassword42')
        self.staff=User.objects.create_user(email='staff@example.com',is_staff=True)
        self.client=APIClient();self.client.force_authenticate(self.user)
    def post(self,kind='lessons',**extra):
        import uuid
        return self.client.post(f'/api/v1/{kind}/publish/',dict(dict(title='Lesson',content='<h2>Title</h2><p>Text</p>',submission_id=str(uuid.uuid4())),**extra),format='json')
    def image(self):
        out=io.BytesIO();Image.new('RGB',(30,40),'red').save(out,'PNG');return out.getvalue()
    def upload(self,data,role='image',filename='image.png'):
        digest=hashlib.sha256(data).hexdigest()
        response=self.client.post('/api/v1/learning/uploads/',dict(filename=filename,role=role,size=len(data),hashes=[digest]),format='json')
        self.assertEqual(response.status_code,201,response.data);id=response.data['id']
        response=self.client.post(f'/api/v1/learning/uploads/{id}/chunks/',dict(offset=0,chunk=SimpleUploadedFile('chunk.bin',data)),format='multipart')
        return id,response
    def test_superuser_only_write_but_public_read(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.post().status_code,403)
        self.assertEqual(self.client.post('/api/v1/learning/uploads/',{}).status_code,403)
        self.client.force_authenticate(self.user);r=self.post();self.assertEqual(r.status_code,201,r.data)
        self.client.force_authenticate(None);self.assertEqual(self.client.get('/api/v1/lessons/').data['count'],1)
        self.assertEqual(self.client.get(f"/api/v1/lessons/{r.data['id']}/").status_code,200)
        self.assertEqual(self.client.delete(f"/api/v1/lessons/{r.data['id']}/manage/").status_code,403)
    def test_empty_content_and_rich_html(self):
        import uuid
        for kind in ['lessons','facts']:
            bad=self.client.post(f'/api/v1/{kind}/publish/',dict(title='Empty',content='<p></p>',submission_id=str(uuid.uuid4())),format='json')
            self.assertEqual(bad.status_code,400)
        r=self.client.post('/api/v1/facts/publish/',dict(title='Fact',content='<script>alert(1)</script><table><tr><td>Cell</td></tr></table>',submission_id=str(uuid.uuid4())),format='json')
        self.assertEqual(r.status_code,201,r.data);self.assertNotIn('<script',r.data['content']);self.assertIn('<table>',r.data['content'])
    def test_upload_attachment_and_idempotent_publication(self):
        import uuid
        data=self.image();id,r=self.upload(data);self.assertEqual(r.status_code,200,r.data);self.assertEqual(r.data['state'],'READY')
        payload=dict(title='Image lesson',asset_ids=[id],submission_id=str(uuid.uuid4()))
        r=self.client.post('/api/v1/lessons/publish/',payload,format='json');self.assertEqual(r.status_code,201,r.data)
        repeat=self.client.post('/api/v1/lessons/publish/',payload,format='json');self.assertEqual(repeat.data['id'],r.data['id']);self.assertEqual(Entry.objects.count(),1)
        self.assertTrue(r.data['assets'][0]['file'])
        self.assertEqual(self.client.patch(f"/api/v1/lessons/{r.data['id']}/manage/",dict(payload,title='Edited'),format='json').status_code,200)
    def test_chunk_digest_invalid_media_and_cross_user_isolation(self):
        id,r=self.upload(b'not a real image');self.assertEqual(r.status_code,400)
        self.client.force_authenticate(self.staff);self.assertEqual(self.client.get(f'/api/v1/learning/uploads/{id}/').status_code,403)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post('/api/v1/learning/uploads/',dict(filename='evil.html',role='image',size=4,hashes=['0'*64]),format='json').status_code,400)
    def test_search_pagination_and_separate_sections(self):
        for i in range(14):self.post(title=str(i))
        self.post('facts',title='Only fact')
        first=self.client.get('/api/v1/lessons/');self.assertEqual(first.data['count'],14);self.assertEqual(len(first.data['results']),12)
        self.assertEqual(len(self.client.get('/api/v1/lessons/?page=2').data['results']),2)
        self.assertEqual(self.client.get('/api/v1/facts/?search=Only').data['count'],1)
    def test_delete_removes_media_on_commit(self):
        id,r=self.upload(self.image());a=Asset.objects.get(pk=id);path=a.file.path
        with self.captureOnCommitCallbacks(execute=True):a.delete()
        from pathlib import Path
        self.assertFalse(Path(path).exists())

    def test_chunks_resume_and_duplicate_ack(self):
        from unittest.mock import patch
        data=self.image(); chunk_size=40
        hashes=[hashlib.sha256(data[i:i+chunk_size]).hexdigest() for i in range(0,len(data),chunk_size)]
        with patch('learning.views.CHUNK',chunk_size):
            start=self.client.post('/api/v1/learning/uploads/',dict(filename='a.png',role='image',size=len(data),hashes=hashes),format='json');self.assertEqual(start.status_code,201,start.data)
            id=start.data['id'];url=f'/api/v1/learning/uploads/{id}/chunks/'
            for offset in range(0,len(data),chunk_size):
                def send():return self.client.post(url,dict(offset=offset,chunk=SimpleUploadedFile('c',data[offset:offset+chunk_size])),format='multipart')
                response=send();self.assertEqual(response.status_code,200,response.data)
                self.assertEqual(send().data['uploaded'],response.data['uploaded'])
                self.assertEqual(self.client.get(f'/api/v1/learning/uploads/{id}/').data['uploaded'],response.data['uploaded'])
            self.assertTrue(Asset.objects.get(pk=id).ready)
    def test_video_probe_poster_and_fact_rejects_video(self):
        from unittest.mock import patch
        from types import SimpleNamespace
        import uuid,json
        probe=SimpleNamespace(stdout=json.dumps({'format':{'format_name':'mov,mp4'},'streams':[{'codec_type':'video','codec_name':'h264','width':640,'height':480}]}).encode())
        with patch('learning.views.subprocess.run',side_effect=[probe,SimpleNamespace(stdout=self.image())]):
            id,response=self.upload(b'video-fixture',role='video',filename='a.mp4')
        self.assertEqual(response.status_code,200,response.data);asset=Asset.objects.get(pk=id);self.assertTrue(asset.poster)
        fact=self.client.post('/api/v1/facts/publish/',dict(title='Fact',content='Content',asset_ids=[id],submission_id=str(uuid.uuid4())),format='json')
        self.assertEqual(fact.status_code,400)

    def test_video_limit_and_upload_owner(self):
        size=2*1024**3
        payload=dict(filename='a.mp4',role='video',size=size+1,hashes=['0'*64]*257)
        self.assertEqual(self.client.post('/api/v1/learning/uploads/',payload,format='json').status_code,400)
        id,r=self.upload(self.image());self.assertEqual(r.status_code,200)
        other=User.objects.create_superuser(email='other@example.com',password='testingPassword42')
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(f'/api/v1/learning/uploads/{id}/').status_code,404)

    def test_lesson_pdf_reader_keeps_source_private_and_binds_token_to_session(self):
        pdf = io.BytesIO()
        Image.new('RGB', (64, 64), 'white').save(pdf, 'PDF')
        asset_id, uploaded = self.upload(pdf.getvalue(), role='pdf', filename='lesson.pdf')
        self.assertEqual(uploaded.status_code, 200, uploaded.data)
        asset = Asset.objects.get(pk=asset_id)
        reader = f'/api/v1/learning/pdfs/{asset_id}/reader/'
        visitor = APIClient()
        self.assertEqual(visitor.post(reader).status_code, 404)
        self.assertEqual(self.post('facts', asset_ids=[asset_id]).status_code, 400)
        lesson = self.post(content='', asset_ids=[asset_id])
        self.assertEqual(lesson.status_code, 201, lesson.data)
        self.assertIsNone(lesson.data['assets'][0]['file'])
        self.assertTrue(asset.file.name.startswith('private/learning/pdfs/'))
        self.assertEqual(visitor.get('/media/' + asset.file.name).status_code, 404)
        session = visitor.post(reader)
        self.assertEqual(session.status_code, 200, session.data)
        self.assertEqual(session.data['pages'], 1)
        params = {'token': session.data['token']}
        page = visitor.get(reader + 'pages/1/', params)
        self.assertEqual(page.status_code, 200)
        self.assertEqual(page['Content-Type'], 'image/webp')
        self.assertIn('no-store', page['Cache-Control'])
        self.assertEqual(APIClient().get(reader + 'pages/1/', params).status_code, 403)
        self.assertEqual(visitor.get(reader + 'pages/2/', params).status_code, 404)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(f"/api/v1/lessons/{lesson.data['id']}/manage/").status_code, 204)
        self.assertEqual(visitor.get(reader + 'pages/1/', params).status_code, 404)
        self.assertFalse(asset.file.storage.exists(asset.file.name))

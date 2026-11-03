# Teaching materials and facts

Routes: /az/lessons and /az/facts (also /en and /ru). All posts publish immediately. Only authenticated superusers can upload, create, edit or delete. Ordinary staff accounts cannot. Creation and editing are offered in Profile only; Django admin lists records and supports deletion.

Videos: MP4/H.264 or WebM/VP8, VP9, AV1, up to 2 GiB per file, maximum 3840x2160. Images: JPEG/PNG/WebP up to 25 MiB. Up to 25 assets per lesson, one image per fact. Titles are required. A lesson needs text (including its overview), an image, or a video. A fact requires rich text; its image is optional.

Uploads use 8 MiB chunks with SHA-256 checks, disk streaming, row locks, resume offsets and bounded network retries. Keep the page open; pause/resume works with the same selected files. After a reload, select the same files again to resume. Retain adequate free disk space for temporary uploads and the final copy. Incomplete/unattached assets expire after 48 hours and are cleaned when an upload starts. Optional scheduled maintenance: `python manage.py cleanup_learning_uploads`. Deleting published content removes its uploaded assets after the database transaction commits. Images inserted inside rich text use the existing article inline-image lifecycle.

The backend Docker image installs FFmpeg/ffprobe. ffprobe validates video codecs; FFmpeg extracts a poster. Playback uses the browser player and Nginx byte-range serving. It does not transcode every codec. A cover takes priority, then the first lesson image, then the first available video poster, then the neutral placeholder.

Deploy from repository root:

```sh
git pull origin main
docker compose up -d --build --wait --wait-timeout 180 backend frontend nginx
```

The backend entrypoint applies the learning migration automatically. No new environment variables or host services are required. Build backend and nginx as well as frontend for video processing and the 10 MiB per-chunk proxy route.

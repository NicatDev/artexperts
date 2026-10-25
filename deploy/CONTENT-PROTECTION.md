# Book reader and gallery permissions

## Author controls

- **Book online reading:** independent of the three existing download/contact
  modes; disabled by default, including for all previously uploaded books.
  Requires a PDF. Removing the PDF disables online reading.
- **Gallery downloads:** a separate switch. Downloading the private original
  requires both public sharing (`FREE`) and `allow_download=true`. Contact and
  private modes do not allow original downloads. Existing permission values are
  preserved by the migration.
- Both controls appear in Django admin and the shared create/edit forms used by
  the profile and publishing pages. New submissions retain moderation approval;
  editing a published item preserves its published status.

## How reading works

The browser receives rendered WebP page images and draws them on a canvas. It
receives neither the source PDF nor a selectable PDF text layer. The reader has
page navigation and zoom, but no download or print toolbar. Rendering requires a
15-minute signed token tied to the current account or anonymous server session,
book and file revision. Permissions are checked again for every requested page.
Disabling reading, replacing the PDF or changing publication status invalidates
subsequent access. Closing the reader aborts pending browser requests. Already
received pages cannot be recalled from a visitor's device.

PDFium runs in a separate process without initializing forms/JavaScript, with an
18-second timeout. Linux enforces CPU, address-space and output-file limits;
two render jobs can run at once per backend container. Pages are capped at
3.5 million pixels, documents at 5,000 pages. The private page cache is bounded
by file count and an approximately 128 MiB size budget. API throttles are an
additional deterrent; Django's default in-memory throttle cache is per worker,
so it is not an account-wide/global scraping quota across multiple instances.

Original PDFs, image masters and the reader cache remain under `/media/private/`.
Nginx denies that prefix, and Django also denies it when DEBUG static serving is
enabled. The public serializers never return original-file URLs. Page responses
are marked private/no-store and noindex/noimageindex.

Rendered book pages have a burned-in platform watermark and a session reference.
Gallery preview watermarks are burned into the image when original downloading
is disabled, or when the author enables preview watermarking. Old derivative
files are retired after regenerated replacements are committed; original masters
are preserved.

## Limits and accessibility

Browser code cannot guarantee prevention of screenshots, recording, OCR,
developer-tool extraction or requests by an authorized visitor. Right-click,
copy, dragging, reader save/print shortcuts and print styles are casual-copy
deterrents, not DRM. Some browsers can bypass context-menu event cancellation.
The forms explain that complete protection cannot be guaranteed.

Image-only reading does not expose book text to screen readers. Reader controls
are labeled and keyboard accessible; an accessible source edition must be
provided separately if the author permits it. PDFs with passwords, unsupported
rendering features or exceeding render limits fail closed with a retry message.

## Deploy

```sh
cd /opt/artexperts
git pull origin main
sudo docker compose up -d --build --wait --wait-timeout 180 backend frontend
sudo docker compose exec backend python manage.py protect_gallery_previews
```

The backend entrypoint applies the migrations. The image installs PDFium and
fallback fonts; no host Python packages are needed. The final command upgrades
existing gallery previews to the new watermark policy. Review any file IDs
reported as failed. Previously distributed files or CDN/browser copies cannot
be removed from readers' devices; purge old media in Cloudflare if needed.

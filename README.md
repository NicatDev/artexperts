# Art Experts

A production-minded, modular-monolith art platform acting as both the official archive and portfolio of master artist **Ilqar Mammadov**, and a curated multilingual publishing platform for emerging and established artists to share artworks, books, and editorial articles.

---

## Architecture Overview

- **Backend**: Python 3.12 + Django 5 + Django REST Framework (`/backend`)
- **Frontend**: Next.js 16 App Router + React 19 + TypeScript + `next-intl` (`/frontend`)
- **API Spec**: OpenAPI 3 with `drf-spectacular` at `/api/v1/schema/swagger/`
- **Languages Supported**: Azerbaijani (`az` - default), English (`en`), Russian (`ru`)
- **Database**: PostgreSQL in production and local development; optional SQLite for existing local data.

---

## Quickstart

### Backend Setup
1. Open a terminal in `backend/`:
   ```bash
   py -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   copy .env.example .env
   py manage.py migrate
   py manage.py runserver
   ```
2. The API will be available at `http://localhost:8000/api/v1/`.
3. Swagger Docs: `http://localhost:8000/api/v1/schema/swagger/`.

### Frontend Setup
1. Open a terminal in `frontend/`:
   ```bash
   npm install
   copy .env.example .env.local
   npm run dev
   ```
2. The application will be accessible at `http://localhost:3000/az/`.

---

## Project Structure

```text
├── backend/
│   ├── config/              # Django settings, root URLs, WSGI/ASGI
│   ├── core/                # Base models (soft-delete, timestamps), permissions, utils
│   ├── users/               # Custom User, Artist profiles, Resend email verification
│   ├── artworks/            # Artworks, categories, Pillow derivative engine
│   ├── articles/            # Editorial publishing, sanitized body, reading time
│   ├── books/               # Books catalog, multi-author contributors, BookAccess
│   ├── pages/               # Hero banner, About page (Ilqar Mammadov bio), settings
│   ├── search/              # Unified site-wide search selector
│   └── seo/                 # Dynamic sitemap & SEO metadata feeds
├── frontend/
│   ├── messages/            # az.json, en.json, ru.json
│   ├── src/
│   │   ├── app/[locale]/    # App Router multilingual pages
│   │   ├── components/      # UI, Layout, Shared components
│   │   ├── features/        # Feature-driven modules (artworks, books, articles, auth)
│   │   ├── config/          # Centralized domain and site configuration
│   │   └── lib/             # API client, auth helpers, SEO utilities
├── ARCHITECTURE.md          # Full architectural blueprint & Mermaid diagram
├── PLAN.md                  # Milestone status (TODO, IN PROGRESS, DONE, RISKS)
└── README.md                # Project documentation
```

---

## Core Principles

1. **Ilqar Mammadov Core Identity**: The platform highlights Ilqar Mammadov's artistic journey while providing a curated haven for other artists.
2. **Strict Static i18n**: All UI strings are kept in sync across `az.json`, `en.json`, and `ru.json`. No hardcoded strings.
3. **Media Security**: High-resolution originals remain private. Public feeds only serve optimized WebP thumbnails and protected derivatives.
4. **Controlled Access**: Digital books and private media are authorized server-side before streaming.
## Profile dashboard

`/az/profile` has separate artwork, book, article and profile settings tabs.
Each content tab supports adding, editing, pagination and deletion through a confirmation modal.
The shared editor also powers `/az/publish`. Content is entered once in a single
language, with no translation tabs. It includes categories,
image replacement, artwork metadata and download settings, article text, and book
publication metadata, contributor roles/order/biographies and PDF replacement/removal.
PDF uploads allow up to 300 MB in both the API and Django admin. Images remain
limited to 25 MB. Nginx allows 330 MB multipart requests for the PDF, cover and
metadata together. Django streams large files to temporary disk storage.
Profile settings support avatar, username, biography, statement, website and social links.
New posts require admin approval. Edits preserve the current moderation status:
approved posts stay public, while pending/rejected posts cannot bypass first approval.
Edits save immediately without a second confirmation modal. Ownership, moderation
flags and view counters are controlled by the server.

Only browser POSTs to `/{kind}/{id}/view/` record views; detail GETs, SSR, metadata
and prefetch requests are read-only. Accounts are deduplicated across devices, while
anonymous visitors use a UUID stored in localStorage and a first-party cookie.
Account/device aliases also prevent login/logout from recounting the same visit.
The unique view row, aliases and counter update commit in one locked transaction.
Existing browser IDs are migrated without resetting historical view counts.

Books and gallery items share three editable download modes: public (`FREE`),
contact the author (`CONTACT`), and fully restricted (`PRIVATE_ACCESS`). Only public
mode permits downloads, including for owners and administrators. Contact mode offers
phone + WhatsApp, email, or none; only the selected channel is published. Restricted
mode displays the author's restriction notice and no contact details. Legacy per-user
grants do not override these modes. Private PDF/master storage is never served by Nginx.
Public gallery previews remain visible; a displayed preview can still be saved by a browser.

Profile settings include a private mobile number (international format). It prefills
contact phone inputs for books and gallery items. Rights confirmation is required only
when creating content across all three types and is preserved during edits.
Migrations preserve public gallery downloads and convert old book modes without
making previously restricted files public. Rebuild the backend and frontend to apply them.

Article and artwork derivatives are generated whenever the source image changes,
including Django admin uploads. Cards fall back to another image of the same item;
failed images show a retry state instead of an unrelated stock image.
For older admin uploads with missing or stale derivatives, run:

```sh
sudo docker compose exec -T backend python manage.py repair_content_images --regenerate
```

This rebuilds public images from their existing sources. Missing source files
must be restored from backup or uploaded again; this command reports their IDs.

Registration validates email/username availability and Django password rules via
`POST /api/v1/auth/register/validate/` after a short typing pause. Clicking the
registration button then sends the email code and reveals the verification field.
Content forms display validation errors next to each field and focus the first
invalid field after submitting, including errors returned by the backend.

Backend regression checks are in `core.tests_content_management`. With backend dependencies installed:

```sh
cd backend
DB_ENGINE=sqlite DB_NAME=:memory: python manage.py test core.tests_content_management
```

## Server deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the PostgreSQL, Docker Compose, Nginx,
HTTPS and Resend setup for `artexperts.net` and `app.artexperts.net`.
Production environment template: `.env.example`; local template: `.env.local.example`.


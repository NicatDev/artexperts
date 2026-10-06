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
The shared editor also powers `/az/publish`. It includes AZ/EN/RU text, categories,
image replacement, artwork metadata and download settings, article text, and book
publication metadata, contributor roles/order/biographies and PDF replacement/removal.
Profile settings support avatar, username, biography, statement, website and social links.
Artist edits return content to moderation. Ownership, moderation flags and view counters
are controlled by the server.

Backend regression checks are in `core.tests_content_management`. With backend dependencies installed:

```sh
cd backend
DB_ENGINE=sqlite DB_NAME=:memory: python manage.py test core.tests_content_management
```

## Server deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the PostgreSQL, Docker Compose, Nginx,
HTTPS and Resend setup for `artexperts.net` and `app.artexperts.net`.
Production environment template: `.env.example`; local template: `.env.local.example`.


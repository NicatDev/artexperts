# System Architecture & Technical Specifications

This document outlines the architectural blueprint, security perimeter, data relationships, and deployment topology of the **Ilqar Mammadov Art Platform & Creator Publishing Ecosystem**.

---

## 1. High-Level Architecture

The platform operates as a decoupled **Modular Monolith + REST API** paired with a **Next.js App Router** server-rendered frontend.

```mermaid
graph TB
    subgraph ClientLayer ["Client & Edge Layer"]
        Browser["User Web Browser (Desktop / Tablet / Mobile)"]
        SearchCrawler["Search Engine Crawlers (Googlebot, Bingbot)"]
    end

    subgraph FrontendApp ["Frontend Application (Next.js 15+ App Router)"]
        LocaleRouter["Locale Router (/[locale]: az, en, ru)"]
        NextIntl["next-intl Localization Engine"]
        ServerComponents["Next.js React Server Components (SEO & Fast FCP)"]
        ClientHydration["Client Components (Forms, Interactivity, Modals)"]
        RobotsSitemap["robots.ts & sitemap.ts"]
        SiteConfig["Central Site Config (src/config/site.ts)"]
    end

    subgraph BackendAPI ["Backend Service (Django 5 + DRF)"]
        ApiGateway["API Router (/api/v1/...)"]
        AuthMiddleware["Authentication & Rate Limiting"]
        
        subgraph DjangoApps ["Modular Domain Apps"]
            UsersApp["users/ (Custom User, Artist Profile, Tokens)"]
            EmailModule["services/email (Resend Provider)"]
            ArtworksApp["artworks/ (Artworks, Categories, Tags)"]
            ArticlesApp["articles/ (Editorial, Sanitizer, Excerpts)"]
            BooksApp["books/ (Books, Multi-Authors, BookAccess)"]
            PagesApp["pages/ (Hero Banner, Ilqar Mammadov Bio, Mission)"]
            SearchApp["search/ (Cross-Entity Unified Search)"]
            SeoApp["seo/ (Dynamic Sitemap Feed)"]
            MediaEngine["services/media (Pillow Validation & Derivatives)"]
        end
    end

    subgraph StorageLayer ["Persistence & External Services"]
        SqliteDB[("SQLite Database (Transitional to PostgreSQL)")]
        PublicMedia["Public Media Storage (Thumbnails / WebP Derivatives)"]
        PrivateMedia["Protected Media Storage (Master Originals & Book PDFs)"]
        ResendAPI["Resend Email API (art@expertvisits.com)"]
    end

    %% Connections
    Browser -->|HTTP/HTTPS Request| LocaleRouter
    SearchCrawler -->|Reads /sitemap.xml & /robots.txt| RobotsSitemap
    LocaleRouter --> NextIntl
    NextIntl --> ServerComponents
    ServerComponents --> SiteConfig
    SiteConfig -->|Server-to-Server REST Call| ApiGateway
    ClientHydration -->|Client REST Call /api/v1/...| ApiGateway

    ApiGateway --> AuthMiddleware
    AuthMiddleware --> UsersApp
    AuthMiddleware --> ArtworksApp
    AuthMiddleware --> ArticlesApp
    AuthMiddleware --> BooksApp
    AuthMiddleware --> PagesApp
    AuthMiddleware --> SearchApp
    AuthMiddleware --> SeoApp

    UsersApp --> EmailModule
    EmailModule --> ResendAPI

    ArtworksApp --> MediaEngine
    BooksApp --> MediaEngine
    MediaEngine --> PublicMedia
    MediaEngine --> PrivateMedia

    DjangoApps --> SqliteDB
```

---

## 2. Domain Data Model & Entity Relationships

```mermaid
erDiagram
    USER ||--o| ARTIST_PROFILE : has
    USER ||--o{ ARTWORK : creates
    USER ||--o{ ARTICLE : authors
    USER ||--o{ BOOK_ACCESS : granted_to
    USER ||--o{ BOOK_CONTRIBUTOR : linked_to

    ARTWORK ||--o{ ARTWORK_TRANSLATION : localized_in
    ARTWORK }o--|| ARTWORK_CATEGORY : categorized_by
    ARTWORK }o--o{ ARTWORK_TAG : tagged_with

    ARTICLE ||--o{ ARTICLE_TRANSLATION : localized_in
    ARTICLE }o--|| ARTICLE_CATEGORY : categorized_by

    BOOK ||--o{ BOOK_TRANSLATION : localized_in
    BOOK ||--o{ BOOK_CONTRIBUTOR_LINK : has_contributors
    BOOK_CONTRIBUTOR ||--o{ BOOK_CONTRIBUTOR_LINK : contributes
    BOOK ||--o{ BOOK_ACCESS : access_rules

    HERO_BANNER ||--o{ HERO_BANNER_TRANSLATION : localized_in
    ABOUT_SECTION ||--o{ ABOUT_SECTION_TRANSLATION : localized_in

    USER {
        uuid id PK
        string email UK
        string password_hash
        boolean is_artist
        boolean is_verified
        boolean is_active
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }

    ARTIST_PROFILE {
        uuid id PK
        uuid user_id FK
        string full_name
        string username UK
        string avatar_thumbnail
        text bio
        text artist_statement
        string website
        json social_links
        string location
        string specialties
    }

    ARTWORK {
        uuid id PK
        uuid owner_id FK
        string original_file
        string detail_file
        string thumbnail_file
        string moderation_status
        boolean allow_download
        boolean is_watermarked
        int creation_year
        string dimensions
        string medium
        datetime deleted_at
    }

    BOOK {
        uuid id PK
        uuid owner_id FK
        string cover_image
        string digital_file
        string availability_mode
        decimal price
        string currency
        string isbn
        string publisher
        int page_count
        string moderation_status
        datetime deleted_at
    }

    BOOK_CONTRIBUTOR {
        uuid id PK
        string full_name
        uuid linked_user_id FK
        text bio
    }

    BOOK_CONTRIBUTOR_LINK {
        uuid id PK
        uuid book_id FK
        uuid contributor_id FK
        string role
        int order
    }

    BOOK_ACCESS {
        uuid id PK
        uuid book_id FK
        uuid user_id FK
        uuid granted_by_id FK
        datetime granted_at
        datetime expires_at
        datetime revoked_at
    }
```

---

## 3. Media Processing Pipeline & Security Model

```mermaid
sequenceDiagram
    autonumber
    actor Artist as Artist / Creator
    participant Frontend as Next.js UI
    participant Backend as Django Media Engine
    participant PrivateStore as Private Storage
    participant PublicStore as Public WebP Store
    actor Visitor as Public Visitor

    Artist->>Frontend: Uploads artwork file (PNG/JPEG, max 25MB)
    Frontend->>Backend: POST /api/v1/artworks/ (multipart/form-data)
    Note over Backend: 1. Sniff actual magic bytes (MIME)<br/>2. Purge EXIF metadata (GPS/Camera)<br/>3. Verify pixel limits (< 10000x10000)
    Backend->>PrivateStore: Store private master original (original-UUID.ext)
    Note over Backend: 4. Generate high-res detail (max 2048px, WebP q=85)<br/>5. Generate gallery thumbnail (max 600px, WebP q=80)<br/>6. Apply watermark if requested
    Backend->>PublicStore: Save detail and thumbnail derivatives
    Backend-->>Frontend: 201 Created (IDs & derivative URLs only)

    Visitor->>Frontend: Views Gallery Page
    Frontend->>PublicStore: Requests 600px thumbnail
    PublicStore-->>Visitor: Returns compressed WebP (no master URL exposed)
    Note over Visitor: UI disables right-click context menu<br/>and image drag as deterrence.
```

---

## 4. Book Granular Access Verification Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Book Owner / Admin
    participant Frontend as Next.js UI
    participant Backend as Django API
    actor User as Registered Artist / User

    Owner->>Frontend: Types recipient email in "Grant Access" modal
    Frontend->>Backend: GET /api/v1/users/lookup/?email=target@example.com (Rate Limited)
    Backend-->>Frontend: 200 { exists: true, username: "aygun_art", avatar: "..." }
    Frontend->>Owner: Renders Green Checkmark & Verified Account Pill
    Owner->>Frontend: Clicks "Confirm & Grant Download Access"
    Frontend->>Backend: POST /api/v1/books/{id}/grant-access/ { user_id: "..." }
    Backend-->>Frontend: 201 Created (BookAccess record active)

    User->>Frontend: Navigates to Book Detail Page
    Frontend->>Backend: GET /api/v1/books/{id}/
    Backend-->>Frontend: Returns book metadata + { has_download_access: true }
    Frontend->>User: Displays active "Download Digital Edition" button
    User->>Backend: GET /api/v1/books/{id}/download/ (Session Authenticated)
    Note over Backend: Server-side authorization check:<br/>1. Is user owner/admin? OR<br/>2. Is active BookAccess present?
    Backend-->>User: Streams private file with Content-Disposition attachment
```

---

## 5. Directory Structure Convention

### Backend Architecture
```text
backend/
├── config/                  # Root project settings, urls, wsgi, asgi
│   ├── settings.py          # Derives SITE_URL, BACKEND_URL, RESEND keys from env
│   └── urls.py              # Root API routing (/api/v1/...)
├── core/                    # Core infrastructural code
│   ├── models/              # TimestampedModel, SoftDeletableModel
│   ├── permissions/         # IsAdminOrOwner, IsApprovedOrOwner
│   ├── pagination.py        # Standard pagination classes
│   └── exceptions.py        # Uniform API exception format
├── users/                   # Authentication & profile domain
│   ├── models/              # Custom User, ArtistProfile, EmailVerificationToken
│   ├── services/            # RegistrationService, TokenService, EmailService
│   └── api/                 # Serializers, Views, URLs
├── artworks/                # Artworks domain
│   ├── models/              # Artwork, ArtworkCategory, ArtworkTranslation
│   ├── services/            # ArtworkMediaService (Pillow resizing/watermarking)
│   └── api/
├── articles/                # Editorial publishing domain
│   ├── models/              # Article, ArticleCategory, ArticleTranslation
│   ├── services/            # ArticleService (sanitization, reading time)
│   └── api/
├── books/                   # Digital book publishing & access control
│   ├── models/              # Book, BookTranslation, BookContributor, BookAccess
│   ├── services/            # BookAccessService, BookMediaService
│   └── api/
├── pages/                   # Editorial and home content
│   ├── models/              # HeroBanner, AboutContent, SiteSettings
│   └── api/
├── search/                  # Cross-domain search
│   └── selectors/           # SearchSelector aggregating models
└── seo/                     # Dynamic sitemap & SEO
    └── api/                 # SitemapView returning valid URLs with hreflang
```

### Frontend Architecture
```text
frontend/
├── messages/                # Strict static internationalization catalogs
│   ├── az.json              # Azerbaijani (Default)
│   ├── en.json              # English
│   └── ru.json              # Russian
├── src/
│   ├── config/
│   │   └── site.ts          # Centralized domain and environment configuration
│   ├── i18n/
│   │   ├── request.ts       # next-intl server configuration
│   │   └── routing.ts       # Supported locales and path prefixes
│   ├── app/
│   │   └── [locale]/        # Localized App Router tree
│   │       ├── layout.tsx   # Root layout with fonts, metadata, Navbar, Footer
│   │       ├── page.tsx     # Homepage (Hero, Archive, Artworks, Books, Articles)
│   │       ├── about/       # Ilqar Mammadov Biography & Platform Mission
│   │       ├── artworks/    # Gallery & Detail pages
│   │       ├── books/       # Books catalog & Detail with Access controls
│   │       ├── articles/    # Editorial blog & Article Detail
│   │       ├── artists/     # Artist directory & Public portfolios
│   │       ├── publish/     # Content submission (Artwork, Article, Book)
│   │       ├── profile/     # Artist dashboard & content management
│   │       ├── login/       # Authentication
│   │       └── register/    # Verification code flow
│   ├── components/
│   │   ├── ui/              # Buttons, inputs, modals, badges, cards
│   │   ├── layout/          # Navbar, Footer, LanguageSwitcher, MobileMenu
│   │   └── shared/          # ImageProtectionWrapper, JsonLd, Pagination
│   ├── features/            # Feature-encapsulated logic
│   │   ├── auth/            # AuthContext, hooks, login/register forms
│   │   ├── artworks/        # Gallery components, filters, artwork card
│   │   ├── books/           # Book card, AccessGrantModal, reader
│   │   ├── articles/        # Article card, markdown renderer, social share
│   │   └── publishing/      # Multilingual submission forms with review warning
│   └── lib/
│       ├── api/             # Unified fetch client with CSRF & session handling
│       └── seo/             # Structured data generators (JSON-LD)
```

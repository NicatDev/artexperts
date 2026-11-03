# SEO behavior

Each public page supplies its own canonical URL, language alternates (az/en/ru and x-default), a plain-text description, Open Graph and Twitter metadata. Detail pages use a stable primary slug across UI languages; alternate slug aliases resolve to the same canonical used in the sitemap. Paginated lists use their own ?page=N canonical. Search and filter results use noindex,follow; account and publishing pages use noindex,nofollow. Development robots disallows crawling; production allows public content. Private pages remain crawlable so crawlers can read their noindex tags.

The sitemap combines eight static public routes with published galleries, articles, books, active artist profiles and all published lessons/facts. Public entries appear and disappear with creation/deletion. Dates come from stored content/translation modification times, not the request time. Unknown static modification times are omitted. Sitemap generation uses the live backend and retains static routes on API failure.

Gallery load-more controls are crawlable links with client-side append behavior. Direct ?page=N visits render that page on the server, including without JavaScript. Facts and lessons expose structured Article/LearningResource and BreadcrumbList data; the homepage exposes WebSite and Organization data. The code does not promise indexing or ranking.

After deployment, verify https://artexperts.net/sitemap.xml and robots.txt, and submit the sitemap in the site's Google Search Console property. Use URL Inspection for a public lesson/fact detail URL. Search Console submission and Google's subsequent indexing are external operations and are not performed by deploying this code.

Validation: npm run test:seo; python manage.py test seo learning. Local production HTML was parsed for canonical/alternate/robots tags and JSON-LD, and sitemap XML was parsed with an XML parser.

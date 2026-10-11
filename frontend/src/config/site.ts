/**
 * Centralized Site and Domain Configuration.
 * All URLs, canonical domains, and API endpoints MUST derive from this source of truth.
 */
export const siteConfig = {
  name: "Art Experts",
  tagline: "Müstəqil İncəsənət Platforması və Müəllif Arxivi",
  description: "Milli və müasir rəssamlıq sənətinin rəqəmsal ocağı, müəllif kitabları, monoqrafiyalar və yaradıcılar üçün sənət məkanı.",
  creator: "İlqar Məmmədov Təşəbbüsü",
  contactEmail: "info@artexperts.net",

  // Environment-derived URLs
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000",
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1",
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000",

  defaultLocale: "az",
  locales: ["az", "en", "ru"] as const,

  // Absolute URL builder for canonical & SEO links
  absoluteUrl(path: string = "", locale?: string): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (locale) {
      return `${this.siteUrl}/${locale}${cleanPath}`;
    }
    return `${this.siteUrl}${cleanPath}`;
  },

  // Media URL resolver (handles relative media paths returned by Django backend and local public assets)
  mediaUrl(path?: string | null): string {
    if (!path) return "";
    if (path.startsWith("blob:") || path.startsWith("data:image/")) return path;
    if (path.startsWith("http://") || path.startsWith("https://")) {
      const url = new URL(path);
      const publicBackend = new URL(this.backendUrl);
      // Docker/localhost URLs and HTTP URLs behind TLS proxies must be public in the browser.
      if (url.pathname.startsWith("/media/") &&
          (["backend", "localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname) || url.hostname === publicBackend.hostname)) {
        return `${publicBackend.origin}${url.pathname}${url.search}`;
      }
      return path;
    }
    // If it is a local public asset in Next.js public directory
    if (
      path.startsWith("/placeholder") ||
      path.startsWith("/ilqar_mammadov") ||
      path.startsWith("/images/") ||
      path.startsWith("/icons/")
    ) {
      return path;
    }
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    if (cleanPath.startsWith("/media/")) {
      return `${this.backendUrl}${cleanPath}`;
    }
    return `${this.backendUrl}/media${cleanPath}`;
  }
};

export type AppLocale = (typeof siteConfig.locales)[number];

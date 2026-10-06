import { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
import { siteConfig } from "@/config/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls = [
    { path: "", priority: 1.0, changefreq: "daily" },
    { path: "artworks", priority: 0.9, changefreq: "daily" },
    { path: "books", priority: 0.9, changefreq: "daily" },
    { path: "articles", priority: 0.8, changefreq: "daily" },
    { path: "artists", priority: 0.8, changefreq: "weekly" },
    { path: "about", priority: 0.8, changefreq: "monthly" },
  ];
  let backendUrls: any[] = staticUrls;

  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL || siteConfig.apiUrl}/seo/sitemap/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      ...(process.env.API_INTERNAL_URL ? { headers: { "X-Forwarded-Proto": "https" } } : {}),
    });
    if (!res.ok) throw new Error(`Sitemap API returned HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.urls)) throw new Error("Invalid sitemap API response");
    const urlsByPath = new Map(staticUrls.map(item => [item.path, item]));
    for (const item of data.urls) {
      if (typeof item?.path === "string") urlsByPath.set(item.path, item);
    }
    backendUrls = Array.from(urlsByPath.values());
  } catch (error) {
    console.error("Sitemap API unavailable; using public static pages", error);
  }

  const sitemapEntries: MetadataRoute.Sitemap = [];

  for (const item of backendUrls) {
    for (const locale of siteConfig.locales) {
      const localizedPath = item.path ? `/${locale}/${item.path}` : `/${locale}`;
      sitemapEntries.push({
        url: `${siteConfig.siteUrl}${localizedPath}`,
        lastModified: item.lastmod ? new Date(item.lastmod) : new Date(),
        changeFrequency: item.changefreq || "weekly",
        priority: item.priority || 0.7,
        alternates: {
          languages: {
            az: `${siteConfig.siteUrl}/az${item.path ? `/${item.path}` : ""}`,
            en: `${siteConfig.siteUrl}/en${item.path ? `/${item.path}` : ""}`,
            ru: `${siteConfig.siteUrl}/ru${item.path ? `/${item.path}` : ""}`,
          },
        },
      });
    }
  }

  return sitemapEntries;
}

import { MetadataRoute } from "next";
export const dynamic = "force-dynamic";
import { siteConfig } from "@/config/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let backendUrls: any[] = [];

  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL || siteConfig.apiUrl}/seo/sitemap/`, {
      next: { revalidate: 3600 }, // revalidate hourly
    });
    if (res.ok) {
      const data = await res.json();
      backendUrls = data.urls || [];
    }
  } catch {
    backendUrls = [
      { path: "", priority: 1.0, changefreq: "daily" },
      { path: "artworks", priority: 0.9, changefreq: "daily" },
      { path: "books", priority: 0.9, changefreq: "daily" },
      { path: "articles", priority: 0.8, changefreq: "daily" },
      { path: "artists", priority: 0.8, changefreq: "weekly" },
      { path: "about", priority: 0.8, changefreq: "monthly" },
    ];
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

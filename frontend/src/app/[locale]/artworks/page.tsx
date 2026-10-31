import React from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { GalleryFeed } from "@/components/shared/GalleryFeed";
import { loadPublicData } from "@/lib/public-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: locale === "az" ? "Rəsm Qalereyası" : locale === "ru" ? "Художественная галерея" : "Art Gallery",
    description: "Təsviri sənət əsərləri, müəllifləri və kateqoriyalar üzrə ən çox baxılan əsərlər.",
  };
}

export default async function ArtworksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; search?: string; founder?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const tArtworks = await getTranslations({ locale, namespace: "artworks" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const filters = { category: sp.category || "", search: sp.search || "", founder: sp.founder || "" };
  const [artworkFeed, categoryFeed] = await Promise.all([
    loadPublicData("gallery", () => api.getArtworks({ ...filters, lang: locale, page: "1" })),
    loadPublicData("gallery categories", () => api.getArtworkCategories(locale)),
  ]);
  const artworksList = artworkFeed.data?.results || [];
  const categories = Array.isArray(categoryFeed.data) ? categoryFeed.data : categoryFeed.data?.results || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
          Kolleksiya
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif text-stone-900">
            {locale === "az" ? "Ən çox baxılan əsərlər" : tArtworks("title")}
        </h1>
        <p className="text-sm text-stone-600">
          {tArtworks("subtitle")}
        </p>
      </div>

      {/* Categories Filter Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Link
          href="/artworks"
          className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
            !sp.category
              ? "bg-stone-900 text-white font-semibold shadow-xs"
              : "bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-amber-400 shadow-2xs"
          }`}
        >
          {tCommon("all")}
        </Link>
        {categories.map((cat: any) => {
          const isActive = sp.category === cat.slug;
          return (
            <Link
              key={cat.id}
              href={`/artworks?category=${cat.slug}`}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                isActive
                  ? "bg-stone-900 text-white font-semibold shadow-xs"
                  : "bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:border-amber-400 shadow-2xs"
              }`}
            >
              {cat.name || cat.name_az}
            </Link>
          );
        })}
      </div>

      <GalleryFeed
        key={JSON.stringify([locale, filters, artworkFeed.data])}
        initialItems={artworksList}
        initialCount={artworkFeed.data?.count ?? 0}
        initialHasMore={Boolean(artworkFeed.data?.next)}
        initialFailed={artworkFeed.failed}
        filters={filters}
        locale={locale}
      />
    </div>
  );
}

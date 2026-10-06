import React from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { Pagination } from "@/components/shared/Pagination";
import { Palette, Filter, ArrowRight } from "lucide-react";

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

  const currentPage = Math.max(1, parseInt(sp.page || "1", 10));
  let artworksList: any[] = [];
  let categories: any[] = [];
  let totalPages = 1;
  let totalCount = 0;

  try {
    const [artRes, catRes] = await Promise.all([
      api.getArtworks({
        lang: locale,
        category: sp.category || "",
        search: sp.search || "",
        founder: sp.founder || "",
        page: sp.page || "1",
      }),
      api.getArtworkCategories(locale),
    ]);
    artworksList = artRes?.results || (Array.isArray(artRes) ? artRes : []);
    categories = Array.isArray(catRes) ? catRes : (catRes?.results || []);
    totalCount = artRes?.count !== undefined ? artRes.count : artworksList.length;
    totalPages = artRes?.total_pages || Math.max(1, Math.ceil(totalCount / 12));
  } catch {
    artworksList = [];
    categories = [];
    totalPages = 1;
    totalCount = 0;
  }

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

      {/* Artworks Grid */}
      {artworksList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {artworksList.map((art: any) => (
            <div
              key={art.id}
              className="group bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden hover:border-amber-400/60 transition-all duration-300 flex flex-col shadow-xs hover:shadow-xl"
            >
              <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                <ImageProtectionWrapper
                  src={art.thumbnail_image || art.detail_image}
                  alt={art.title}
                  fill
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  showWatermark={true}
                  watermarkText="Art Experts"
                />
                {art.is_founder_piece && (
                  <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded bg-amber-500/95 text-black text-[10px] font-serif font-bold uppercase tracking-wider shadow-sm">
                    Müəllif Əsəri
                  </div>
                )}
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-lg font-serif text-stone-900 group-hover:text-amber-800 transition-colors line-clamp-1 font-medium">
                    {art.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-stone-500">
                    <span>{art.medium || "Yağlı boya"}</span>
                    {art.dimensions && <span>• {art.dimensions}</span>}
                    {art.creation_year && <span>• {art.creation_year}</span>}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span className="text-amber-900 font-medium line-clamp-1">
                    {art.artist_attribution}
                  </span>
                  <Link
                    href={`/artworks/${art.id}`}
                    className="text-amber-800 hover:text-amber-950 font-semibold ml-2 inline-flex items-center gap-1"
                  >
                    {tCommon("viewDetails")} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-stone-200 rounded-2xl text-stone-500 text-sm bg-white">
          {tArtworks("empty")}
        </div>
      )}

      {/* Pagination is always visible as requested */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        basePath="/artworks"
        searchParams={{
          category: sp.category,
          search: sp.search,
          founder: sp.founder,
        }}
      />
    </div>
  );
}

import React from "react";
export const dynamic = "force-dynamic";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { ArtistSupportInitiative } from "@/components/shared/ArtistSupportInitiative";
import { 
  ArrowRight, BookOpen, Feather, Palette, Sparkles, 
  Clock, Award
} from "lucide-react";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tHome = await getTranslations({ locale, namespace: "home" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tArtworks = await getTranslations({ locale, namespace: "artworks" });
  const tBooks = await getTranslations({ locale, namespace: "books" });
  const tArticles = await getTranslations({ locale, namespace: "articles" });

  let overviewData: any = null;
  try {
    overviewData = await api.getHomeOverview(locale);
  } catch {
    overviewData = {
      featured_artworks: [],
      featured_articles: [],
      featured_books: [],
    };
  }

  const banner = overviewData?.banner;
  let artworks = overviewData?.featured_artworks || [];
  let articles = overviewData?.featured_articles || [];
  let books = overviewData?.featured_books || [];
  try {
    const [artworkRes, articleRes, bookRes] = await Promise.all([
      api.getArtworks({ lang: locale, page_size: "6" }),
      api.getArticles({ lang: locale, page_size: "3" }),
      api.getBooks({ lang: locale, page_size: "4" }),
    ]);
    artworks = artworkRes?.results || artworks;
    articles = articleRes?.results || articles;
    books = bookRes?.results || books;
  } catch {
    // Keep the public overview as a graceful fallback when a catalog API is unavailable.
  }

  return (
    <div className="space-y-24 pb-20">
      {/* 1. Hero / Banner Section (Luxury Gallery Light) */}
      <section className="relative min-h-[72vh] flex items-center justify-center bg-gradient-to-b from-[#FAF6ED] via-[#FAF9F5] to-white px-4 sm:px-6 lg:px-8 border-b border-[#EAE6DF] overflow-hidden">
        {/* Subtle decorative art canvas glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(212,175,55,0.12),transparent_65%)] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6 pt-16 pb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-900 text-xs font-serif uppercase tracking-widest shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>Milli & Müasir Təsviri Sənət Ekosistemi</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif text-stone-900 font-normal tracking-wide leading-tight">
            {locale === "az"
              ? "Art Experts — Müasir və Klassik Təsviri Sənət Platforması"
              : banner?.title && !banner.title.toLowerCase().includes("ilqar") && !banner.title.includes("İlqar")
                ? banner.title.replace(/Art Expert(?!s)/g, "Art Experts")
                : locale === "ru" ? "Art Experts — Кураторская арт-платформа" : "Art Experts — Curated Fine Art Platform"}
          </h1>

          <p className="text-base sm:text-lg text-stone-600 font-sans max-w-2xl mx-auto leading-relaxed">
            {banner?.subtitle && !banner.subtitle.toLowerCase().includes("ilqar") && !banner.subtitle.includes("İlqar")
              ? banner.subtitle
              : "Təsviri sənət əsərlərinin rəqəmsal arxivi, müəllif incəsənət monoqrafiyaları və sənətkar icması üçün kurasiya olunmuş platforma."}
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/artworks"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-stone-900 hover:bg-black text-white font-medium text-sm transition-all shadow-md hover:shadow-lg"
            >
              <Palette className="w-4 h-4 text-amber-300" />
              <span>{banner?.cta_text || tCommon("explore")}</span>
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-sm font-medium transition-colors shadow-2xs"
            >
              <span>{tCommon("readMore")}</span>
              <ArrowRight className="w-4 h-4 text-stone-500" />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Featured Artworks Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
              Qalereya
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1">
              {tHome("featuredArtworks")}
            </h2>
          </div>
          <Link
            href="/artworks"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-950 transition-colors"
          >
            <span>{tHome("viewAllArtworks")}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {artworks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {artworks.map((art: any) => (
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
                    <h3 className="text-lg font-serif text-stone-900 font-medium group-hover:text-amber-800 transition-colors line-clamp-1">
                      {art.title}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {art.description || `${art.medium || "Yağlı boya"} • ${art.creation_year || "2024"}`}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <span className="text-amber-900 font-medium line-clamp-1">
                      {art.artist_attribution}
                    </span>
                    <span className="text-stone-500 whitespace-nowrap">{art.views_count || 0} {tCommon("views")}</span>
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
          <div className="text-center py-16 border border-dashed border-stone-300 rounded-2xl text-stone-500 text-sm bg-white">
            {tArtworks("empty")}
          </div>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ArtistSupportInitiative />
      </section>

      {/* 4. Featured Digital Books Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
              Nəşrlər
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1">
              {tHome("featuredBooks")}
            </h2>
          </div>
          <Link
            href="/books"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-950 transition-colors"
          >
            <span>{tHome("viewAllBooks")}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {books.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {books.map((book: any) => (
              <div
                key={book.id}
                className="group bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden hover:border-amber-400/60 transition-all duration-300 flex flex-col shadow-xs hover:shadow-xl"
              >
                {/* 3:4 portrait book standard */}
                <div className="relative aspect-[3/4] bg-stone-100 overflow-hidden">
                  <ImageProtectionWrapper
                    src={book.cover_image}
                    alt={book.title}
                    fill
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    watermarkText="Art Experts"
                  />
                  <div className="absolute bottom-2 left-2 z-20 px-2.5 py-1 rounded bg-white/90 backdrop-blur text-[10px] font-mono text-stone-800 border border-stone-200 shadow-2xs">
                    {book.availability_mode === "FREE" ? tBooks("freeAccess") : tBooks("privateAccess")}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-serif text-base text-stone-900 group-hover:text-amber-800 transition-colors line-clamp-1 font-medium">
                      {book.title}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                      {book.short_description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-stone-600 line-clamp-1 font-medium">
                      {book.contributors?.[0]?.name || "İlqar Məmmədov"}
                    </span>
                    <Link
                      href={`/books/${book.slug || book.id}`}
                      className="text-amber-800 hover:text-amber-950 font-semibold ml-2"
                    >
                      {tCommon("viewDetails")}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-stone-300 rounded-2xl text-stone-500 text-sm bg-white">
            {tBooks("empty")}
          </div>
        )}
      </section>

      {/* 5. Editorial Articles Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
              Redaksiya
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-stone-900 mt-1">
              {tHome("featuredArticles")}
            </h2>
          </div>
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-950 transition-colors"
          >
            <span>{tHome("viewAllArticles")}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {articles.map((art: any) => (
              <article
                key={art.id}
                className="group bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden hover:border-amber-400/60 transition-all duration-300 flex flex-col shadow-xs hover:shadow-xl"
              >
                <div className="relative aspect-[16/9] bg-stone-100 overflow-hidden">
                  <ImageProtectionWrapper
                    src={art.cover_thumbnail || art.cover_image}
                    alt={art.title}
                    fill
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    watermarkText="Art Experts"
                  />
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur text-[10px] text-stone-700 border border-stone-200 shadow-2xs font-medium">
                    <Clock className="w-3 h-3 text-amber-700" />
                    <span>{art.reading_time_minutes} {tArticles("readingTime")} · {art.views_count || 0} {tCommon("views")}</span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[11px] font-mono text-amber-800 uppercase tracking-wider font-semibold">
                      {art.category_name || "Sənət Nəzəriyyəsi"}
                    </span>
                    <h3 className="text-lg font-serif text-stone-900 group-hover:text-amber-800 transition-colors mt-1.5 line-clamp-2 font-medium">
                      {art.title}
                    </h3>
                    <p className="text-xs text-stone-600 mt-2 line-clamp-3 leading-relaxed">
                      {art.excerpt}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <span className="font-medium text-stone-700">{art.author_name}</span>
                    <Link
                      href={`/articles/${art.slug || art.id}`}
                      className="text-amber-800 hover:text-amber-950 font-semibold inline-flex items-center gap-1"
                    >
                      {tCommon("readMore")} →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-stone-300 rounded-2xl text-stone-500 text-sm bg-white">
            {tArticles("empty")}
          </div>
        )}
      </section>

      {/* 6. Mission Call-to-Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#FAF6ED] border border-amber-300/60 rounded-3xl p-8 sm:p-14 text-center space-y-6 max-w-3xl mx-auto shadow-xs">
          <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-800 flex items-center justify-center mx-auto shadow-2xs">
            <Feather className="w-6 h-6" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-serif text-stone-900">
            {tHome("missionBannerTitle")}
          </h2>

          <p className="text-sm text-stone-600 leading-relaxed">
            {tHome("missionBannerText")}
          </p>

          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-stone-900 hover:bg-black text-white font-medium text-sm transition-all shadow-md hover:shadow-lg"
            >
              <span>{tHome("joinCta")}</span>
              <ArrowRight className="w-4 h-4 text-amber-300" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}


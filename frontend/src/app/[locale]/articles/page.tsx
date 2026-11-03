import { pageMetadata } from "@/lib/seo";
import React from "react";
import { CatalogSearch } from "@/components/shared/CatalogSearch";
import { loadPublicData } from "@/lib/public-data";
import { FeedError } from "@/components/shared/FeedError";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { Pagination } from "@/components/shared/Pagination";
import { Clock } from "lucide-react";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "articles" });
  return pageMetadata({ locale, path: "articles", title: t("title"), description: t("subtitle"), query: await searchParams });
}

export default async function ArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; search?: string; author?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const tArticles = await getTranslations({ locale, namespace: "articles" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const currentPage = Math.max(1, parseInt(sp.page || "1", 10));
  const [articleFeed, categoryFeed] = await Promise.all([
    loadPublicData("articles", () => api.getArticles({
      lang: locale, category: sp.category || "", search: sp.search || "",
      author: sp.author || "", page: String(currentPage),
    })),
    loadPublicData("article categories", () => api.getArticleCategories(locale)),
  ]);
  const articlesList = articleFeed.data?.results || [];
  const categories = Array.isArray(categoryFeed.data) ? categoryFeed.data : categoryFeed.data?.results || [];
  const totalCount = articleFeed.data?.count ?? articlesList.length;
  const totalPages = articleFeed.data?.total_pages || Math.max(1, Math.ceil(totalCount / 12));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
          Redaksiya
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif text-stone-900">
          {tArticles("title")}
        </h1>
        <p className="text-sm text-stone-600">
          {tArticles("subtitle")}
        </p>
      </div>

      <CatalogSearch kind="articles" locale={locale} filters={sp} />

      {/* Categories Filter Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Link
          href="/articles"
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
              href={`/articles?category=${cat.slug}`}
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

      {/* Full-width editorial list with a left-hand image. */}
      {articleFeed.failed ? <FeedError locale={locale} /> : articlesList.length > 0 ? (
        <div className="w-full space-y-4">
          {articlesList.map((art: any) => (
            <article
              key={art.id}
              className="group grid w-full grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-4 rounded-2xl border border-[#E5DFD3] bg-[#FFFCF7]/95 p-4 transition-colors hover:border-[#D4C5AD] hover:bg-[#FAF5EC] focus-within:border-[#D4C5AD] sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6 sm:p-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8"
            >
              <Link href={`/articles/${art.slug || art.id}`} aria-label={art.title} className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700">
                <ImageProtectionWrapper
                  src={art.cover_thumbnail || art.cover_image || "/images/article-placeholder.svg"}
                  fallbackSrc={art.cover_image}
                  alt={art.cover_thumbnail || art.cover_image ? art.title : ""}
                  fill
                  className="w-full h-full"
                  watermarkText="Art Experts"
                />
              </Link>

              <div className="min-w-0 space-y-3 sm:space-y-4">
                <div>
                  <span className="text-[11px] font-mono text-amber-800 uppercase tracking-wider font-semibold">
                    {art.category_name || "Sənət Nəzəriyyəsi"}
                  </span>
                  <h2 className="break-words text-base font-serif text-stone-900 group-hover:text-amber-800 transition-colors mt-1.5 font-medium sm:text-xl lg:text-2xl">
                    <Link href={`/articles/${art.slug || art.id}`} className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700">{art.title}</Link>
                  </h2>
                  <p className="break-words text-[13px] text-stone-600 mt-2 line-clamp-3 leading-relaxed sm:text-sm">
                    {art.excerpt}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-500">
                  <span className="break-words font-medium text-stone-700">
                    {art.author_name}
                  </span>
                  <span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{art.reading_time_minutes} {tArticles("readingTime")}</span>
                  <span>{art.views_count || 0} {tCommon("views")}</span>
                  <Link
                    href={`/articles/${art.slug || art.id}`}
                    className="inline-flex min-h-11 items-center gap-1 font-semibold text-amber-800 hover:text-amber-950 sm:ml-auto"
                  >
                    {tCommon("readMore")} →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-stone-200 rounded-2xl text-stone-500 text-sm bg-white">
          {sp.search ? tCommon("searchNoResults") : tArticles("empty")}
        </div>
      )}

      {/* Pagination is always visible as requested */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        basePath="/articles"
        searchParams={{
          category: sp.category,
          search: sp.search,
          author: sp.author,
        }}
      />
    </div>
  );
}

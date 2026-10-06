import React from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { Pagination } from "@/components/shared/Pagination";
import { Clock, ArrowRight, User } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: locale === "az" ? "Sənət Məqalələri" : locale === "ru" ? "Статьи об искусстве" : "Art Articles",
    description: "Rəssamlıq fəlsəfəsi, estetika dərsləri və sərgi təhlilləri.",
  };
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
  let articlesList: any[] = [];
  let categories: any[] = [];
  let totalPages = 1;
  let totalCount = 0;

  try {
    const [artRes, catRes] = await Promise.all([
      api.getArticles({
        lang: locale,
        category: sp.category || "",
        search: sp.search || "",
        author: sp.author || "",
        page: sp.page || "1",
      }),
      api.getArticleCategories(locale),
    ]);
    articlesList = artRes?.results || (Array.isArray(artRes) ? artRes : []);
    categories = Array.isArray(catRes) ? catRes : (catRes?.results || []);
    totalCount = artRes?.count !== undefined ? artRes.count : articlesList.length;
    totalPages = artRes?.total_pages || Math.max(1, Math.ceil(totalCount / 12));
  } catch {
    articlesList = [];
    categories = [];
    totalPages = 1;
    totalCount = 0;
  }

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

      {/* Articles Grid */}
      {articlesList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {articlesList.map((art: any) => (
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
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] text-stone-700 border border-stone-200 shadow-2xs font-medium">
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
                  <span className="font-medium text-stone-700">
                    {art.author_name}
                  </span>
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
        <div className="text-center py-20 border border-dashed border-stone-200 rounded-2xl text-stone-500 text-sm bg-white">
          {tArticles("empty")}
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

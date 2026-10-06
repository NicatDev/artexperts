import React from "react";

export const dynamic = "force-dynamic";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { siteConfig } from "@/config/site";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { ArrowLeft, Clock, Calendar, User, Share2 } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  try {
    const article = await api.getArticleDetail(slug, locale);
    return {
      title: `${article.title} | Redaksiya | Art Experts`,
      description: article.excerpt || article.title,
      openGraph: {
        title: article.title,
        description: article.excerpt,
        images: [siteConfig.mediaUrl(article.cover_image)],
      },
    };
  } catch {
    return { title: "Məqalə | Art Experts" };
  }
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const tArticles = await getTranslations({ locale, namespace: "articles" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  let article: any = null;
  try {
    article = await api.getArticleDetail(slug, locale);
  } catch {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.excerpt,
    "author": {
      "@type": "Person",
      "name": article.author_profile?.full_name || "İlqar Məmmədov",
    },
    "datePublished": article.created_at,
    "image": siteConfig.mediaUrl(article.cover_image),
  };

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div>
        <Link
          href="/articles"
          className="inline-flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Bütün Məqalələrə Qayıt</span>
        </Link>
      </div>

      {/* Header */}
      <div className="space-y-4">
        <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
          {article.category?.name || "Sənət Nəzəriyyəsi"}
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif text-stone-900 leading-tight">
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-500 pt-2 border-b border-stone-200 pb-6">
          <div className="flex items-center gap-1.5 text-amber-900 font-medium">
            <User className="w-4 h-4 text-amber-700" />
            <span>{article.author_profile?.full_name || "İlqar Məmmədov"}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-stone-500" />
            <span>{article.reading_time_minutes} {tArticles("readingTime")}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-stone-500" />
            <span>{new Date(article.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Hero Cover Image */}
      {article.cover_image && (
        <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden bg-stone-100 border border-[#EAE6DF] shadow-lg">
          <ImageProtectionWrapper
            src={article.cover_image}
            alt={article.title}
            fill
            className="w-full h-full object-cover"
            priority={true}
            watermarkText="Art Experts"
          />
        </div>
      )}

      {/* Excerpt Lead */}
      {article.excerpt && (
        <p className="text-base sm:text-lg text-stone-800 font-serif italic leading-relaxed border-l-2 border-amber-600 pl-4 py-2 bg-amber-50/60 rounded-r-2xl">
          {article.excerpt}
        </p>
      )}

      {/* Article Content Body */}
      <div className="text-stone-800 leading-relaxed text-base font-sans space-y-6 whitespace-pre-line border-b border-stone-200 pb-12">
        {article.content}
      </div>

      {/* Author Profile Footer Card */}
      {article.author_profile && (
        <div className="bg-[#FAF6ED] border border-amber-200/80 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 shadow-xs">
          <div className="w-16 h-16 rounded-full border border-amber-500/30 bg-white flex items-center justify-center text-amber-900 font-serif font-bold text-xl flex-shrink-0 shadow-2xs">
            {article.author_profile.full_name?.charAt(0) || "A"}
          </div>
          <div className="space-y-2 text-center sm:text-left flex-1">
            <h3 className="text-lg font-serif text-stone-900 font-medium">
              {article.author_profile.full_name}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {article.author_profile.short_bio || "Platforma rəssamı və müəllifi."}
            </p>
            <div className="pt-2">
              <Link
                href={`/artists/${article.author_profile.username}`}
                className="text-xs text-amber-800 hover:text-amber-950 font-semibold underline underline-offset-4"
              >
                Rəssamın Portfelinə Bax →
              </Link>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

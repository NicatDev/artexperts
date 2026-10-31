import React from "react";

export const dynamic = "force-dynamic";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { siteConfig } from "@/config/site";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { ArtistAvatar } from "@/components/shared/ArtistAvatar";
import { ArtistLinks } from "@/components/shared/ArtistLinks";
import { ArrowLeft, Clock, Calendar, User, Palette } from "lucide-react";
import { ContentViews } from "@/features/content/ContentViews";

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
        images: article.cover_image ? [siteConfig.mediaUrl(article.cover_image)] : [],
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
  const tArtists = await getTranslations({ locale, namespace: "artists" });
  const tEditor = await getTranslations({ locale, namespace: "editor" });

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
    ...(article.cover_image ? { image: siteConfig.mediaUrl(article.cover_image) } : {}),
  };

  return (
    <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
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

      <div className={article.author_profile ? "grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_19rem]" : "mx-auto max-w-4xl"}>
      <div className="min-w-0 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
          {article.category?.name || "Sənət Nəzəriyyəsi"}
        </span>
        <h1 className="break-words text-3xl sm:text-5xl font-serif text-stone-900 leading-tight">
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
          <span>•</span>
          <ContentViews kind="articles" id={article.id} initialCount={article.views_count || 0} />
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
      <div className="article-content border-b border-stone-200 pb-12" dangerouslySetInnerHTML={{ __html: article.content }} />

      </div>

      {article.author_profile && (
        <aside aria-labelledby="article-author-heading" className="min-w-0 rounded-3xl border border-[#E5DFD3] bg-[#FFFCF7]/95 p-6 shadow-xs lg:sticky lg:top-28">
          <h2 id="article-author-heading" className="mb-6 text-xs font-semibold uppercase tracking-widest text-amber-800">{tArticles("authorProfile")}</h2>
          <div className="flex flex-col items-center gap-4 text-center">
            <ArtistAvatar artist={article.author_profile} large />
            <h3 className="w-full break-words font-serif text-xl font-medium text-stone-900">{article.author_profile.full_name}</h3>
            {article.author_profile.specialties && <div className="w-full space-y-2 text-sm text-stone-600">
              <p className="flex items-center justify-center gap-2 text-xs font-medium text-amber-800"><Palette aria-hidden="true" className="h-4 w-4 shrink-0" />{tArtists("specialties")}</p>
              <p className="break-words leading-relaxed">{article.author_profile.specialties}</p>
            </div>}
            <ArtistLinks artist={article.author_profile} websiteLabel={tEditor("website")} />
            {article.author_profile.username && <Link href={`/artists/${article.author_profile.username}`} className="mt-2 inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700">
              {tArticles("viewArtistProfile")} →
            </Link>}
          </div>
        </aside>
      )}
      </div>
    </article>
  );
}

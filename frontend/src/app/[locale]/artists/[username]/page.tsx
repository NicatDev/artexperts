import { pageMetadata, canonicalSlug } from "@/lib/seo";
import React from "react";
import { ArtistLinks } from "@/components/shared/ArtistLinks";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { api, ApiError } from "@/lib/api";
import { loadPublicData } from "@/lib/public-data";
import { FeedError } from "@/components/shared/FeedError";
import { ArtistAvatar } from "@/components/shared/ArtistAvatar";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { Palette, MapPin, Globe, ArrowLeft, BookOpen, FileText } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; username: string }> }) {
  const { locale, username } = await params;
  try {
    const artist = await api.getArtistDetail(username);
    return pageMetadata({locale,path:`artists/${artist.username}`,title:artist.full_name,description:artist.short_bio || artist.artist_statement,image:artist.avatar_thumbnail || artist.avatar,type:"website"});
  } catch { return {robots: {index:false,follow:false}}; }
}

export default async function ArtistPortfolioPage({
  params,
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale, username } = await params;
  setRequestLocale(locale);

  const tArtists = await getTranslations({ locale, namespace: "artists" });
  const tEditor = await getTranslations({ locale, namespace: "editor" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tArtworks = await getTranslations({ locale, namespace: "artworks" });

  let artist: any;
  try {
    artist = await api.getArtistDetail(username);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [artworkFeed, bookFeed, articleFeed] = await Promise.all([
    loadPublicData("artist artworks", () => api.getArtworks({ artist: artist.username, lang: locale })),
    loadPublicData("artist books", () => api.getBooks({ artist: artist.username, lang: locale })),
    loadPublicData("artist articles", () => api.getArticles({ author: artist.username, lang: locale })),
  ]);
  const artworks = artworkFeed.data?.results || [];
  const books = bookFeed.data?.results || [];
  const articles = articleFeed.data?.results || [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": artist.full_name,
    "description": artist.short_bio,
    "jobTitle": "Artist / Painter",
    "url": artist.website || undefined,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <div>
        <Link
          href="/artists"
          className="inline-flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Bütün Rəssamlara Qayıt</span>
        </Link>
      </div>

      {/* Artist Profile Header Banner */}
      <div className="bg-white border border-[#EAE6DF] rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
          <ArtistAvatar artist={artist} large />

          <div className="space-y-4 text-center sm:text-left flex-1">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h1 className="text-2xl sm:text-4xl font-serif text-stone-900">
                  {artist.full_name}
                </h1>
                {artist.is_founder && (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-serif font-bold uppercase">
                    {tArtists("founderBadge")}
                  </span>
                )}
              </div>
              <span className="text-xs text-stone-400 font-mono">@{artist.username}</span>
            </div>

            {artist.short_bio && (
              <p className="text-sm text-stone-600 leading-relaxed max-w-2xl font-sans">
                {artist.short_bio}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-stone-500 pt-2">
              {artist.specialties && (
                <div className="flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-amber-700" />
                  <span>{artist.specialties}</span>
                </div>
              )}
              {artist.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-700" />
                  <span>{artist.location}</span>
                </div>
              )}

            </div>
            <div className="flex justify-center sm:justify-start"><ArtistLinks artist={artist} websiteLabel={tEditor("website")} /></div>
          </div>
        </div>

        {/* Artist Statement */}
        {artist.artist_statement && (
          <div className="mt-8 pt-6 border-t border-stone-100 space-y-2">
            <h3 className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
              {tArtists("statement")}
            </h3>
            <p className="text-xs sm:text-sm text-stone-700 italic leading-relaxed whitespace-pre-line font-serif">
              «{artist.artist_statement}»
            </p>
          </div>
        )}
      </div>

      {/* Published Artworks Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-serif text-stone-900 border-b border-stone-200 pb-3">
          Rəssamın Əsərləri ({artworks.length})
        </h2>
        {artworkFeed.failed ? <FeedError locale={locale} /> : artworks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {artworks.map((art: any) => (
              <div
                key={art.id}
                className="group bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden hover:border-amber-400/60 transition-all duration-300 flex flex-col shadow-xs hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                  <ImageProtectionWrapper
                    src={art.thumbnail_image || art.detail_image}
                    fallbackSrc={art.detail_image}
                    alt={art.title}
                    fill
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    showWatermark={true}
                    watermarkText="Art Experts"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <h3 className="text-base font-serif text-stone-900 group-hover:text-amber-800 transition-colors line-clamp-1 font-medium">
                    {art.title}
                  </h3>
                  <div className="flex justify-between items-center text-xs text-stone-500">
                    <span>{art.medium || "Yağlı boya"}</span>
                    <Link
                      href={`/artworks/${art.id}`}
                      className="text-amber-800 hover:text-amber-950 font-semibold"
                    >
                      Bax →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400">Hələlik təsdiqlənmiş əsər yoxdur.</p>
        )}
      </section>

      {bookFeed.failed && <FeedError locale={locale} />}
      {/* Published Books Section */}
      {books.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-serif text-stone-900 border-b border-stone-200 pb-3">
            Müəllif Kitabları ({books.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
            {books.map((b: any) => (
              <div
                key={b.id}
                className="bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden hover:border-amber-400/60 transition-all flex flex-col shadow-xs"
              >
                <div className="relative aspect-[3/4] bg-stone-100 overflow-hidden">
                  <ImageProtectionWrapper
                    src={b.cover_image}
                    imageClassName="object-contain"
                    alt={b.title}
                    fill
                    className="w-full h-full object-cover"
                    watermarkText="Art Experts"
                  />
                </div>
                <div className="p-3 text-xs space-y-1">
                  <h4 className="font-serif text-stone-900 truncate font-medium">{b.title}</h4>
                  <Link href={`/books/${b.slug || b.id}`} className="text-amber-800 hover:text-amber-950 font-semibold block">
                    Kitaba Bax →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {articleFeed.failed && <FeedError locale={locale} />}
      {/* Published Articles Section */}
      {articles.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-serif text-stone-900 border-b border-stone-200 pb-3">
            Müəllif Məqalələri ({articles.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {articles.map((art: any) => (
              <div
                key={art.id}
                className="bg-white border border-[#EAE6DF] rounded-2xl p-5 space-y-3 shadow-xs"
              >
                <h4 className="font-serif text-base text-stone-900 hover:text-amber-800 font-medium">
                  <Link href={`/articles/${art.slug || art.id}`}>{art.title}</Link>
                </h4>
                <p className="text-xs text-stone-600 line-clamp-2">{art.excerpt}</p>
                <Link
                  href={`/articles/${art.slug || art.id}`}
                  className="text-xs text-amber-800 hover:text-amber-950 font-semibold block"
                >
                  Oxu →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

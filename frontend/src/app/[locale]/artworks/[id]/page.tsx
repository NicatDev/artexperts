import React from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { siteConfig } from "@/config/site";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { Download, ShieldAlert, ArrowLeft, Palette, Calendar, Maximize, User } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  try {
    const artwork = await api.getArtworkDetail(id, locale);
    return {
      title: `${artwork.title} | ${artwork.artist_attribution}`,
      description: artwork.description || `${artwork.title} - ${artwork.medium}`,
      openGraph: {
        title: artwork.title,
        description: artwork.description,
        images: [siteConfig.mediaUrl(artwork.detail_image || artwork.thumbnail_image)],
      },
    };
  } catch {
    return { title: "Əsər | Art Experts" };
  }
}

export default async function ArtworkDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const tArtworks = await getTranslations({ locale, namespace: "artworks" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  let artwork: any = null;
  try {
    artwork = await api.getArtworkDetail(id, locale);
  } catch {
    notFound();
  }

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VisualArtwork",
    "name": artwork.title,
    "description": artwork.description,
    "creator": {
      "@type": "Person",
      "name": artwork.artist_attribution,
    },
    "artMedium": artwork.medium,
    "artform": "Painting",
    "dateCreated": artwork.creation_year,
    "image": siteConfig.mediaUrl(artwork.detail_image || artwork.thumbnail_image),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back button */}
      <div>
        <Link
          href="/artworks"
          className="inline-flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Bütün Əsərlərə Qayıt</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Protected Visual Display (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#EAE6DF] rounded-3xl p-4 sm:p-6 overflow-hidden shadow-lg">
          <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-stone-100 flex items-center justify-center">
            <ImageProtectionWrapper
              src={artwork.detail_image || artwork.thumbnail_image}
              alt={artwork.title}
              fill
              className="w-full h-full object-cover"
              priority={true}
              showWatermark={true}
              watermarkText="Art Experts"
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-stone-500 px-2">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              {tArtworks("copyRestricted")}
            </span>
            <span>{artwork.views_count || 0} {tCommon("views")}</span>
          </div>
        </div>

        {/* Artwork Metadata & Actions (5 cols) */}
        <div className="lg:col-span-5 space-y-8">
          <div>
            <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
              {artwork.category?.name || "Klassik Rəssamlıq"}
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif text-stone-900 mt-1">
              {artwork.title}
            </h1>
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-900 font-medium">
              <User className="w-4 h-4 text-amber-700" />
              <span>{artwork.artist_attribution}</span>
            </div>
          </div>

          {artwork.description && (
            <div className="text-sm text-stone-700 leading-relaxed font-sans border-t border-stone-100 pt-4 whitespace-pre-line">
              {artwork.description}
            </div>
          )}

          {/* Technical Specifications Table */}
          <div className="bg-[#FAF6ED] border border-amber-200/80 rounded-2xl p-6 space-y-3.5 text-xs text-stone-600">
            <div className="flex justify-between py-1.5 border-b border-amber-200/60">
              <span className="text-stone-500 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-amber-700" />
                {tArtworks("medium")}
              </span>
              <span className="text-stone-900 font-medium">{artwork.medium || "Yağlı boya, kətan"}</span>
            </div>

            {artwork.dimensions && (
              <div className="flex justify-between py-1.5 border-b border-amber-200/60">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <Maximize className="w-3.5 h-3.5 text-amber-700" />
                  {tArtworks("dimensions")}
                </span>
                <span className="text-stone-900 font-medium">{artwork.dimensions}</span>
              </div>
            )}

            {artwork.creation_year && (
              <div className="flex justify-between py-1.5">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-700" />
                  {tArtworks("creationYear")}
                </span>
                <span className="text-stone-900 font-medium">{artwork.creation_year}</span>
              </div>
            )}
          </div>

          {/* Download Action Controlled by Artist */}
          <div className="pt-2">
            {artwork.allow_download ? (
              <a
                href={`${siteConfig.apiUrl}/artworks/${artwork.id}/download/`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-stone-900 hover:bg-black text-white font-medium text-sm transition-all shadow-md hover:shadow-lg"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>{tArtworks("downloadAllowed")}</span>
              </a>
            ) : (
              <div className="w-full p-4 rounded-2xl bg-white border border-stone-200 text-center text-xs text-stone-500 flex items-center justify-center gap-2 shadow-2xs">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <span>{tArtworks("downloadRestricted")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

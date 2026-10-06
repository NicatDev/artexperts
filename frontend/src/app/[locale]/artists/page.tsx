import React from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { Pagination } from "@/components/shared/Pagination";
import { User, MapPin, Palette, ArrowRight, CheckCircle } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: locale === "az" ? "Platforma Rəssamları" : locale === "ru" ? "Художники платформы" : "Platform Artists",
    description: "Platformada qeydiyyatdan keçən və əsərlərini təqdim edən yaradıcılar.",
  };
}

export default async function ArtistsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const tArtists = await getTranslations({ locale, namespace: "artists" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const currentPage = Math.max(1, parseInt(sp.page || "1", 10));
  let artistsList: any[] = [];
  let totalPages = 1;
  let totalCount = 0;

  try {
    const res = await api.getArtists({ search: sp.search || "", page: sp.page || "1" });
    artistsList = res?.results || (Array.isArray(res) ? res : []);
    totalCount = res?.count !== undefined ? res.count : artistsList.length;
    totalPages = res?.total_pages || Math.max(1, Math.ceil(totalCount / 12));
  } catch {
    artistsList = [];
    totalPages = 1;
    totalCount = 0;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
          İcma və Yaradıcılar
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif text-stone-900">
          {tArtists("title")}
        </h1>
        <p className="text-sm text-stone-600">
          {tArtists("subtitle")}
        </p>
      </div>

      {/* Artists Grid */}
      {artistsList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {artistsList.map((artist: any) => (
            <div
              key={artist.id}
              className="bg-white border border-[#EAE6DF] rounded-3xl p-7 space-y-5 hover:border-amber-400/60 transition-all duration-300 flex flex-col justify-between shadow-xs hover:shadow-xl"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full border border-amber-300 bg-amber-50 flex items-center justify-center text-amber-900 font-serif font-bold text-lg flex-shrink-0 shadow-2xs">
                    {artist.full_name?.charAt(0) || "A"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-serif text-stone-900 font-medium">
                        {artist.full_name}
                      </h3>
                    </div>
                    <span className="text-xs text-stone-400 font-mono">
                      @{artist.username}
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {artist.is_founder && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-serif font-semibold uppercase">
                      {tArtists("founderBadge")}
                    </span>
                  )}
                  {artist.is_featured && !artist.is_founder && (
                    <span className="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-medium border border-stone-200">
                      {tArtists("featuredBadge")}
                    </span>
                  )}
                </div>

                {artist.short_bio && (
                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-3 font-sans">
                    {artist.short_bio}
                  </p>
                )}

                {artist.specialties && (
                  <div className="flex items-start gap-1.5 text-xs text-stone-500">
                    <Palette className="w-3.5 h-3.5 text-amber-700 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-1">{artist.specialties}</span>
                  </div>
                )}

                {artist.location && (
                  <div className="flex items-center gap-1.5 text-xs text-stone-500">
                    <MapPin className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                    <span>{artist.location}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-100 flex justify-end">
                <Link
                  href={`/artists/${artist.username}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-950 transition-colors"
                >
                  <span>{tArtists("publishedWorks")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-stone-200 rounded-2xl text-stone-500 text-sm bg-white">
          {tArtists("empty")}
        </div>
      )}

      {/* Pagination is always visible as requested */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        basePath="/artists"
        searchParams={{
          search: sp.search,
        }}
      />
    </div>
  );
}

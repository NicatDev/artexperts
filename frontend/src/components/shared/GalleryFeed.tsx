"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { Link } from "@/i18n/routing";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";

export function GalleryFeed({ initialPage = 1, initialItems, initialCount, initialHasMore, initialFailed, filters, locale }: {
  initialPage?: number;
  initialItems: any[];
  initialCount: number;
  initialHasMore: boolean;
  initialFailed: boolean;
  filters: Record<string, string>;
  locale: string;
}) {
  const tCommon = useTranslations("common");
  const tArtworks = useTranslations("artworks");
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialFailed ? initialPage-1 : initialPage);
  const [count, setCount] = useState(initialCount);
  const [hasMore, setHasMore] = useState(initialHasMore || initialFailed);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(initialFailed);
  const activeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, []);
  const nextQuery = new URLSearchParams(Object.entries(filters).filter(([,value])=>!!value));
  nextQuery.set("page",String(page+1));
  const text = locale === "az" ? {
    more: "Daha çox yüklə", loading: "Yüklənir…", retry: "Yenidən cəhd et",
    error: "Əsərləri yükləmək mümkün olmadı. Yenidən cəhd edin.", shown: "Göstərilən əsərlər",
  } : locale === "ru" ? {
    more: "Показать ещё", loading: "Загрузка…", retry: "Повторить",
    error: "Не удалось загрузить работы. Попробуйте ещё раз.", shown: "Показано работ",
  } : {
    more: "Load more", loading: "Loading…", retry: "Try again",
    error: "Could not load the artworks. Please try again.", shown: "Artworks shown",
  };

  async function loadMore() {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setFailed(false);
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30000);
    try {
      const query = new URLSearchParams(nextQuery);
      query.set("lang", locale);
      const request = () => fetch('/api/gallery?' + query, { signal: controller.signal, cache: "no-store" });
      let response = await request().catch(error => {
        if (!(error instanceof TypeError) || controller.signal.aborted) throw error;
        return null;
      });
      if (!response || [502, 503, 504].includes(response.status)) response = await request();
      if (response.status === 404 && response.headers.get("X-Gallery-End") === "1" && items.length) {
        setHasMore(false);
        setCount(items.length);
        return;
      }
      if (!response.ok) throw new Error("Could not fetch gallery");
      const result = await response.json();
      if (!Array.isArray(result?.results)) throw new Error("Invalid gallery response");
      if (controller.signal.aborted) return;
      const seen = new Set(items.map(item => item.id));
      const additions = result.results.filter((item: any) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      if (additions.length) setItems([...items, ...additions]);
      setPage(page + 1);
      setCount(result.count);
      setHasMore(Boolean(result.next));
    } catch {
      if (activeRequest.current === controller && (!controller.signal.aborted || timedOut)) setFailed(true);
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <div className="space-y-6" aria-busy={loading}>
      {items.length > 0 && (
        <div className="columns-1 gap-5 sm:columns-2 lg:columns-5">
          {items.map((art: any) => (
            <div
              key={art.id}
              className="group mb-5 w-full break-inside-avoid bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden hover:border-amber-400/60 transition-all duration-300 shadow-xs hover:shadow-xl"
            >
              <div className="relative bg-stone-100">
                <ImageProtectionWrapper
                  src={art.thumbnail_image || art.detail_image}
                  fallbackSrc={art.detail_image}
                  alt={art.title}
                  naturalAspectRatio
                  className="w-full"
                  imageClassName="object-contain"
                  showWatermark={true}
                  watermarkText="Art Experts"
                />
                {art.is_founder_piece && (
                  <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded bg-amber-500/95 text-black text-[10px] font-serif font-bold uppercase tracking-wider shadow-sm">
                    Müəllif Əsəri
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between space-y-3 p-4">
                <div>
                  <h3 className="line-clamp-2 break-words font-serif text-base font-medium leading-snug text-stone-900 transition-colors group-hover:text-amber-800">
                    {art.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-stone-500">
                    <span>{art.medium || "Yağlı boya"}</span>
                    {art.dimensions && <span>• {art.dimensions}</span>}
                    {art.creation_year && <span>• {art.creation_year}</span>}
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
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
      )}
      {!items.length && !failed && !loading && <p className="rounded-2xl border border-dashed border-stone-200 bg-white py-20 text-center text-sm text-stone-500">{filters.search ? tCommon("searchNoResults") : tArtworks("empty")}</p>}
      <div className="flex flex-col items-center gap-4 text-center">
        <p aria-live="polite" aria-atomic="true" className="text-sm text-stone-500">{text.shown}: {items.length} / {count}</p>
        {failed && <p role="alert" className="text-sm text-red-700">{text.error}</p>}
        {(hasMore || failed) && <Link href={`/artworks?${nextQuery}`} prefetch={false} onClick={event=>{event.preventDefault();void loadMore();}} aria-disabled={loading}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-stone-900 px-8 py-3 text-sm font-medium text-white transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700 aria-disabled:cursor-wait aria-disabled:opacity-60">
          {loading && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
          {loading ? text.loading : failed ? text.retry : text.more}
        </Link>}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, ChevronLeft, ChevronRight, LoaderCircle, Minus, Plus, RotateCcw, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const control = "flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white px-2 disabled:opacity-40";

export function BookReader({ bookId, title }: { bookId: string; title: string }) {
  const t = useTranslations("bookReader");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [jump, setJump] = useState("1");
  const [zoom, setZoom] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const session = useRef<{ token: string; expires: number } | null>(null);
  const titleId = useId();
  const pageInputId = useId();

  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const preventSave = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["s", "p", "c"].includes(event.key.toLowerCase())) event.preventDefault();
    };
    document.addEventListener("keydown", preventSave, true);
    return () => {
      element.close();
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", preventSave, true);
    };
  }, [open]);

  useEffect(() => {
    setJump(String(page));
    if (!open) return;
    const controller = new AbortController();
    const { signal } = controller;
    setBusy(true);
    setError("");
    async function start() {
      const data = await api.startBookReader(bookId, signal);
      session.current = { token: data.token, expires: Date.now() + data.expires_in * 1000 };
      if (!signal.aborted) setPages(data.pages);
      return data.pages;
    }
    async function load() {
      try {
        if (!session.current || session.current.expires < Date.now() + 15000) {
          const count = await start();
          if (page > count) { setPage(count); return; }
        }
        let blob: Blob;
        try { blob = await api.getBookReaderPage(bookId, page, session.current!.token, signal); }
        catch (error) {
          if (!(error instanceof ApiError) || error.status !== 403 || signal.aborted) throw error;
          const count = await start();
          if (page > count) { setPage(count); return; }
          blob = await api.getBookReaderPage(bookId, page, session.current!.token, signal);
        }
        if (signal.aborted) return;
        const url = URL.createObjectURL(blob);
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          if (signal.aborted || !canvas.current) return;
          canvas.current.width = image.naturalWidth;
          canvas.current.height = image.naturalHeight;
          const context = canvas.current.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          context.drawImage(image, 0, 0);
          viewport.current?.scrollTo({ top: 0, left: 0 });
        } finally { URL.revokeObjectURL(url); }
      } catch (error) {
        if (!signal.aborted) setError(t(error instanceof ApiError && error.status === 403 ? "permissionError" : error instanceof ApiError && error.status === 429 ? "rateError" : "loadError"));
      } finally { if (!signal.aborted) setBusy(false); }
    }
    void load();
    return () => controller.abort();
  }, [bookId, open, page, retry, t]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-950 hover:bg-amber-100"><BookOpen aria-hidden="true" className="h-4 w-4 shrink-0" />{t("open")}</button>
    <p className="text-center text-xs leading-5 text-stone-500">{t("notice")}</p>
    <dialog ref={dialog} data-book-reader={open ? "open" : undefined} data-protected-content="book" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); setOpen(false); }} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}
      className="fixed inset-0 m-auto h-[calc(100dvh_-_1rem)] max-h-[calc(100dvh_-_1rem)] w-[calc(100%_-_1rem)] max-w-6xl overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/70 sm:h-[calc(100dvh_-_3rem)] sm:max-h-[calc(100dvh_-_3rem)] sm:w-[calc(100%_-_3rem)]">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-3 py-2 sm:px-5">
          <div className="min-w-0 flex-1"><h2 id={titleId} className="truncate font-serif text-base sm:text-xl">{title}</h2><p className="text-xs text-stone-500">{t("protectedReader")}</p></div>
          <button type="button" autoFocus onClick={() => setOpen(false)} aria-label={t("close")} className={control}><X aria-hidden="true" className="h-5 w-5" /></button>
        </header>
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-stone-200 bg-white p-2 sm:justify-between sm:px-5">
          <div className="flex items-center gap-2">
            <button type="button" disabled={busy || page <= 1} onClick={() => setPage(value => value - 1)} aria-label={t("previous")} className={control}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
            <form onSubmit={event => { event.preventDefault(); const next = Number(jump); if (Number.isInteger(next) && next >= 1 && next <= pages) setPage(next); else setJump(String(page)); }} className="flex items-center gap-2 text-sm">
              <label htmlFor={pageInputId} className="sr-only">{t("page")}</label><input id={pageInputId} type="number" inputMode="numeric" min={1} max={pages || 1} disabled={busy || !pages} value={jump} onChange={event => setJump(event.target.value)} className="min-h-11 w-16 rounded-lg border border-stone-300 bg-white px-2 text-center tabular-nums" />
              <span className="tabular-nums text-stone-500">/ {pages || "—"}</span><button type="submit" disabled={busy || !pages} className={`${control} text-xs`}>{t("go")}</button>
            </form>
            <button type="button" disabled={busy || !pages || page >= pages} onClick={() => setPage(value => value + 1)} aria-label={t("next")} className={control}><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button type="button" disabled={zoom <= 75} onClick={() => setZoom(value => Math.max(75, value - 25))} aria-label={t("zoomOut")} className={control}><Minus aria-hidden="true" className="h-4 w-4" /></button>
            <span className="w-9 text-center tabular-nums">{zoom}%</span><button type="button" disabled={zoom >= 250} onClick={() => setZoom(value => Math.min(250, value + 25))} aria-label={t("zoomIn")} className={control}><Plus aria-hidden="true" className="h-4 w-4" /></button>
          </div>
        </div>
        <div ref={viewport} aria-busy={busy} className="relative min-h-0 flex-1 overflow-auto overscroll-contain p-2 sm:p-5">
          {busy && <p role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-stone-600"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />{t("loading")}</p>}
          {error && <div role="alert" className="mx-auto max-w-md rounded-xl border border-rose-200 bg-white p-5 text-center text-sm leading-6 text-rose-700"><p>{error}</p><button type="button" onClick={() => { session.current = null; setRetry(value => value + 1); }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-stone-900"><RotateCcw aria-hidden="true" className="h-4 w-4" />{t("retry")}</button></div>}
          <canvas ref={canvas} role="img" aria-label={t("pageLabel", { page, total: pages || 1 })} className={`${busy || error ? "hidden" : "block"} mx-auto h-auto max-w-none bg-white shadow-md`} style={{ width: `${zoom}%` }} />
        </div>
        <p className="shrink-0 border-t border-stone-200 bg-white px-3 py-2 text-center text-[11px] leading-5 text-stone-500">{t("notice")}</p>
      </div>
    </dialog>
  </>;
}

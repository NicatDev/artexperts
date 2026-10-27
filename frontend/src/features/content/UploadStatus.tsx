"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, LoaderCircle, AlertCircle } from "lucide-react";
import type { UploadProgress } from "@/lib/content-upload";

export function UploadStatus({ progress, busy, error }: { progress: UploadProgress | null; busy: boolean; error: string }) {
  const t = useTranslations("upload");
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const stage = progress?.stage || "preparing";
  const stages = ["preparing", "uploading", "verifying", "saving"] as const;
  const index = stage === "retrying" ? 1 : stage === "complete" ? 4 : stages.indexOf(stage);
  const percent = progress?.percent;
  const unit = progress?.total && progress.total < 1024 * 1024 ? "KB" : "MB";
  const divisor = unit === "KB" ? 1024 : 1024 * 1024;
  const size = (bytes: number) => (bytes / divisor).toFixed(1);
  return <div className="mt-5 min-w-0 space-y-4" aria-live="polite" aria-busy={busy}>
    <div className="flex items-center justify-between gap-3"><p className="flex min-w-0 items-center gap-2 text-sm font-medium text-stone-800">
      {error ? <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-700" /> : busy ? <LoaderCircle aria-hidden="true" className="h-5 w-5 shrink-0 animate-spin text-amber-700" /> : <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-green-700" />}
      {error ? t("interrupted") : t(stage)}
    </p>{typeof percent === "number" && <span className="shrink-0 text-lg font-semibold tabular-nums text-amber-900">{percent}%</span>}</div>
    <div role="progressbar" aria-label={t(stage)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={typeof percent === "number" ? percent : undefined} className="h-2.5 overflow-hidden rounded-full bg-stone-100"><div className={`h-full rounded-full bg-amber-600 transition-[width] duration-200 ${typeof percent !== "number" && busy ? "animate-pulse" : ""}`} style={{ width: typeof percent === "number" ? `${percent}%` : "100%" }} /></div>
    {!!progress?.total && <p className="flex flex-wrap justify-between gap-2 text-xs tabular-nums text-stone-500"><span>{size(progress.loaded)} / {size(progress.total)} {unit}</span>{!!progress.speed && <span>{progress.speed < 1024 * 1024 ? `${(progress.speed / 1024).toFixed(1)} KB/s` : `${(progress.speed / (1024 * 1024)).toFixed(1)} MB/s`}</span>}</p>}
    <p className="flex flex-wrap justify-between gap-2 text-xs text-stone-500"><span>{t("elapsed", { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` })}</span>{!!progress?.eta && stage === "uploading" && <span>{t("remaining", { seconds: progress.eta })}</span>}</p>
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">{stages.map((item, i) => <li key={item} className={`flex min-w-0 items-center gap-2 rounded-lg border p-2 text-[11px] leading-5 ${i < index ? "border-green-200 bg-green-50 text-green-800" : i === index ? "border-amber-300 bg-amber-50 text-amber-900" : "border-stone-200 text-stone-400"}`}><span className="shrink-0">{i < index ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : i + 1}</span><span>{t(item)}</span></li>)}</ol>
    {stage === "retrying" && <p role="status" className="text-sm leading-6 text-amber-800">{t("retryNotice", { attempt: progress?.attempt || 1 })}</p>}
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">{error}</p> : <p className="text-xs leading-6 text-stone-500">{t(stage === "saving" || stage === "verifying" ? "serverNotice" : "keepOpen")}</p>}
    {!error && busy && seconds > 60 && stage === "saving" && <p className="text-xs leading-6 text-amber-800">{t("slowServer")}</p>}
  </div>;
}

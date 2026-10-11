"use client";

import React from "react";
import Image from "next/image";
import { siteConfig } from "@/config/site";
import { useTranslations } from "next-intl";
import { ImageOff } from "lucide-react";

interface ImageProtectionWrapperProps {
  src?: string | null;
  fallbackSrc?: string | null;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  showWatermark?: boolean;
  watermarkText?: string;
  unoptimized?: boolean;
  imageClassName?: string;
}

/**
 * Museum-grade Image Protection & Presentation Wrapper.
 * - Prevents native image drag.
 * - Suppresses context-menu clicks as an immediate deterrent against basic asset scraping.
 * - Adds a subtle, elegant watermark badge if requested.
 * - Eliminates CLS with fixed aspect ratios.
 * - Falls back only to another image belonging to the same content, with a retry state on failure.
 */
export function ImageProtectionWrapper({
  src,
  fallbackSrc,
  alt,
  width,
  height,
  fill = false,
  className = "",
  priority = false,
  showWatermark = false,
  watermarkText = "Art Experts",
  unoptimized = true,
  imageClassName = "object-cover",
}: ImageProtectionWrapperProps) {
  const t = useTranslations("common");
  const [failedSources, setFailedSources] = React.useState<string[]>([]);
  const [attempt, setAttempt] = React.useState(0);
  const sources = [...new Set([siteConfig.mediaUrl(src), siteConfig.mediaUrl(fallbackSrc)].filter(Boolean))];
  const currentSrc = sources.find(url => !failedSources.includes(url));

  return (
    <div
      className={`relative select-none overflow-hidden group ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {currentSrc ? <Image
        key={`${currentSrc}-${attempt}`}
        src={currentSrc}
        alt={alt}
        width={!fill ? width || 800 : undefined}
        height={!fill ? height || 600 : undefined}
        fill={fill}
        priority={priority}
        unoptimized={unoptimized}
        onError={() => setFailedSources(previous => [...new Set([...previous, currentSrc])])}
        className={`${imageClassName} transition-transform duration-500 ease-out group-hover:scale-[1.02] pointer-events-none`}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      /> : <div role="img" aria-label={alt} className={`${fill ? "absolute inset-0" : "min-h-40"} flex flex-col items-center justify-center gap-3 bg-stone-100 p-4 text-center text-stone-500`}>
        <ImageOff aria-hidden="true" className="h-8 w-8" />
        <span className="text-xs">{t("imageUnavailable")}</span>
        {sources.length > 0 && <button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); setFailedSources([]); setAttempt(value => value + 1); }} className="relative z-20 min-h-11 rounded-lg border border-stone-300 px-4 text-xs hover:bg-white">{t("retryImage")}</button>}
      </div>}

      {/* Transparent protective shield layer to block direct right-click on image tag */}
      {currentSrc && <div
        className="absolute inset-0 z-10 bg-transparent"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />}

      {showWatermark && (
        <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 text-[10px] font-serif tracking-widest uppercase bg-stone-900/75 backdrop-blur-md text-amber-200 border border-amber-400/30 rounded-full shadow-sm pointer-events-none">
          {watermarkText}
        </div>
      )}
    </div>
  );
}

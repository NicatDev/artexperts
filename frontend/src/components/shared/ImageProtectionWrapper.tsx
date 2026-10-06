"use client";

import React from "react";
import Image from "next/image";
import { siteConfig } from "@/config/site";

interface ImageProtectionWrapperProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  showWatermark?: boolean;
  watermarkText?: string;
  unoptimized?: boolean;
}

/**
 * Museum-grade Image Protection & Presentation Wrapper.
 * - Prevents native image drag.
 * - Suppresses context-menu clicks as an immediate deterrent against basic asset scraping.
 * - Adds a subtle, elegant watermark badge if requested.
 * - Eliminates CLS with fixed aspect ratios.
 * - Uses direct reliable unoptimized asset delivery for backend media and local placeholders.
 */
export function ImageProtectionWrapper({
  src,
  alt,
  width,
  height,
  fill = false,
  className = "",
  priority = false,
  showWatermark = false,
  watermarkText = "Art Experts",
  unoptimized = true,
}: ImageProtectionWrapperProps) {
  const initialSrc = siteConfig.mediaUrl(src);
  const [currentSrc, setCurrentSrc] = React.useState(initialSrc);

  React.useEffect(() => {
    setCurrentSrc(siteConfig.mediaUrl(src));
  }, [src]);

  return (
    <div
      className={`relative select-none overflow-hidden group ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <Image
        src={currentSrc}
        alt={alt}
        width={!fill ? width || 800 : undefined}
        height={!fill ? height || 600 : undefined}
        fill={fill}
        priority={priority}
        unoptimized={unoptimized}
        onError={() => setCurrentSrc("/placeholder-art.png")}
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02] pointer-events-none"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />

      {/* Transparent protective shield layer to block direct right-click on image tag */}
      <div
        className="absolute inset-0 z-10 bg-transparent"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />

      {showWatermark && (
        <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 text-[10px] font-serif tracking-widest uppercase bg-stone-900/75 backdrop-blur-md text-amber-200 border border-amber-400/30 rounded-full shadow-sm pointer-events-none">
          {watermarkText}
        </div>
      )}
    </div>
  );
}

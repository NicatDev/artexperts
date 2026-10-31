"use client";

import { useState } from "react";
import Image from "next/image";
import { siteConfig } from "@/config/site";

export function ArtistAvatar({ artist, large = false }: {
  artist: { full_name?: string; username?: string; avatar?: string | null; avatar_thumbnail?: string | null };
  large?: boolean;
}) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const sources = [artist.avatar_thumbnail, artist.avatar].filter(Boolean).map(src => siteConfig.mediaUrl(src!));
  const src = sources.find(source => !failedSources.includes(source));
  const name = artist.full_name || artist.username || "Artist";
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full border border-amber-300 bg-amber-50 flex items-center justify-center text-amber-900 font-serif font-bold ${large ? 'h-24 w-24 sm:h-28 sm:w-28 text-3xl' : 'h-14 w-14 text-lg'}`}>
      {src ? <Image src={src} alt={name} fill unoptimized sizes={large ? "112px" : "56px"} className="object-cover" onError={() => setFailedSources(previous => [...previous, src])} />
        : <span aria-label={name}>{name.charAt(0)}</span>}
    </div>
  );
}

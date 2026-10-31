import { Globe, Camera } from 'lucide-react';
import { instagramUrl, websiteUrl } from '@/lib/artist-links';

export function ArtistLinks({ artist, websiteLabel }: {
  artist: { website?: string; social_links?: Record<string, string> }; websiteLabel: string;
}) {
  const website = websiteUrl(artist.website);
  const account = Object.entries(artist.social_links || {}).find(([key]) => key.trim().toLowerCase() === 'instagram')?.[1];
  const instagram = account ? instagramUrl(account) : null;
  if (!website && !instagram) return null;
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-amber-800">
    {website && <a href={website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"><Globe aria-hidden="true" className="h-4 w-4 shrink-0" />{websiteLabel}</a>}
    {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"><Camera aria-hidden="true" className="h-4 w-4 shrink-0" />Instagram</a>}
  </div>;
}

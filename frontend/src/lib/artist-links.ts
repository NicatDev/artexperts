export function instagramUrl(value: string): string | null {
  let account = value.trim();
  if (!account) return null;
  if (/^(https?:\/\/|(?:www\.)?instagram\.com\/)/i.test(account)) {
    try {
      const url = new URL(/^https?:\/\//i.test(account) ? account : `https://${account}`);
      if (!['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
      account = url.pathname.replace(/^\/+|\/+$/g, '');
    } catch { return null; }
  } else account = account.replace(/^@/, '');
  return /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-zA-Z0-9._]{1,30}$/.test(account)
    ? `https://www.instagram.com/${account}/` : null;
}

export function websiteUrl(value?: string): string | null {
  try {
    const url = new URL(value || '');
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function artistSummary(artist: { short_bio?: string; artist_statement?: string }, limit = 180) {
  const text = (artist.short_bio?.trim() || artist.artist_statement?.trim() || '').replace(/\s+/g, ' ');
  const characters = Array.from(text);
  return characters.length > limit ? characters.slice(0, limit).join('').trimEnd() + '…' : text;
}

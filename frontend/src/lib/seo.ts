import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
export function plainDescription(value: string = '', fallback = '') {
  const text = value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim() || fallback;
  return Array.from(text).length > 160 ? Array.from(text).slice(0, 157).join('').trimEnd() + '…' : text;
}
export function pageMetadata({ locale, path = '', title, description, image, query = {}, type = 'website' }: {
  locale: string; path?: string; title: string; description?: string; image?: string | null;
  query?: Record<string, string | string[] | undefined>; type?: 'website' | 'article';
}): Metadata {
  const cleanTitle = title.replace(/(?:\s*[|—]\s*Art Experts)+$/g, '').trim();
  const suffix = new URLSearchParams();
  for (const key of ['search','category','author','artist','mode','founder']) {
    const value = query[key]; if (typeof value === 'string' && value.trim()) suffix.set(key, value.trim());
  }
  const page = Number(query.page); if (Number.isSafeInteger(page) && page > 1) suffix.set('page',String(page));
  const qs = suffix.size ? `?${suffix}` : '';
  const relative = (lang: string) => `/${lang}${path ? `/${path}` : ''}${qs}`;
  const canonical = new URL(relative(locale), siteConfig.siteUrl).href;
  const desc = plainDescription(description, cleanTitle);
  const picture = image ? siteConfig.mediaUrl(image) : `${siteConfig.siteUrl}/art-expert-logo.png`;
  const noindex = [...suffix.keys()].some(key => key !== 'page');
  return {
    title: cleanTitle.startsWith(siteConfig.name) ? {absolute:cleanTitle} : cleanTitle, description: desc,
    alternates: { canonical, languages: Object.fromEntries([...siteConfig.locales.map(lang => [lang,new URL(relative(lang),siteConfig.siteUrl).href]),['x-default',new URL(relative('az'),siteConfig.siteUrl).href]]) },
    robots: { index: !noindex, follow: true },
    openGraph: { title: cleanTitle, description: desc, url: canonical, siteName: siteConfig.name, type, locale: locale === 'az' ? 'az_AZ' : locale === 'ru' ? 'ru_RU' : 'en_US', images: picture ? [{url:picture,alt:cleanTitle}] : [] },
    twitter: {card:'summary_large_image',title:cleanTitle,description:desc,images:picture ? [picture] : []},
  };
}
export function canonicalSlug(item: {translations?: {language:string;slug:string}[];slug?:string;id?:string}) {
  return item.translations?.find(t=>t.language==='az')?.slug || item.translations?.[0]?.slug || item.slug || item.id || '';
}

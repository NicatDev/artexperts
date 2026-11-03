import { getTranslations } from 'next-intl/server';
import { Search } from 'lucide-react';
import { Link } from '@/i18n/routing';

export async function CatalogSearch({ kind, locale, filters }: {
  kind: 'artworks' | 'articles' | 'artists' | 'books' | 'lessons' | 'facts'; locale: string;
  filters: Record<string, string | undefined>;
}) {
  const t = await getTranslations({ locale, namespace: 'catalogSearch' });
  const preserved = Object.entries(filters).filter(([key, value]) => key !== 'page' && key !== 'search' && value);
  const clearQuery = new URLSearchParams(preserved as [string, string][]).toString();
  const id = `search-${kind}`;
  return <form role="search" aria-label={t(kind)} method="get" action={`/${locale}/${kind}`} className="mx-auto w-full max-w-2xl space-y-2">
    <label htmlFor={id} className="block text-sm font-medium text-stone-700">{t(kind)}</label>
    {preserved.map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1"><Search aria-hidden="true" className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-stone-400" /><input key={filters.search || ''} id={id} name="search" type="search" defaultValue={filters.search || ''} maxLength={200} placeholder={t('placeholder')} className="min-h-13 w-full rounded-xl border border-stone-300 bg-[#FFFCF7] py-3 pl-12 pr-4 text-base text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-100" /></div>
      <button type="submit" className="min-h-13 cursor-pointer rounded-xl bg-stone-900 px-6 text-sm font-medium text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700">{t('submit')}</button>
    </div>
    {filters.search && <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600"><p className="min-w-0 break-words">{t('query', { query: filters.search })}</p><Link href={`/${kind}${clearQuery ? `?${clearQuery}` : ''}`} className="inline-flex min-h-11 items-center text-amber-800 underline">{t('clear')}</Link></div>}
  </form>;
}

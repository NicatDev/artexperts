import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Link } from '@/i18n/routing';
import { siteConfig } from '@/config/site';
import { ImageProtectionWrapper } from './ImageProtectionWrapper';
import { Pagination } from './Pagination';
import { CatalogSearch } from './CatalogSearch';
import { ArtistAvatar } from './ArtistAvatar';
import { BookReader } from '@/features/books/BookReader';
import { FileText, Image as ImageIcon, Video } from 'lucide-react';
export const entryCover = (entry: any) => { const a = entry.assets || []; return a.find((x: any) => x.role === 'cover')?.file || a.find((x: any) => x.role === 'image')?.file || a.find((x: any) => x.role === 'video' && x.poster)?.poster || '/images/article-placeholder.svg'; };
type LearningCardEntry = {
  id: string;
  title: string;
  summary?: string;
  assets: { role: string }[];
};

export async function LearningCards({ entries, kind, locale, catalog = false }: {
  entries: LearningCardEntry[];
  kind: 'lessons' | 'facts';
  locale: string;
  catalog?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: 'learning' });
  const mediaTypes = [
    { roles: ['pdf'], label: 'PDF', Icon: FileText, color: 'border-rose-200 bg-rose-50 text-rose-900' },
    { roles: ['video'], label: t('videoBadge'), Icon: Video, color: 'border-sky-200 bg-sky-50 text-sky-900' },
    { roles: ['cover', 'image'], label: t('imageBadge'), Icon: ImageIcon, color: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  ];
  return (
    <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 ${catalog ? "lg:grid-cols-5" : "lg:grid-cols-6"}`}>
      {entries.map(entry => {
        const href = `/${kind}/${entry.id}`;
        return (
          <article key={entry.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-[#FFFCF7] transition-colors hover:border-amber-300">
            <Link href={href} aria-label={entry.title} className="block">
              <ImageProtectionWrapper src={entryCover(entry)} alt={entry.title} fill className="aspect-[4/3] w-full" />
            </Link>
            <div className={`flex flex-1 flex-col p-4 ${catalog ? "gap-2" : "gap-3 lg:p-3"}`}>
              {kind === 'lessons' && (
                <div className="flex flex-wrap gap-1.5">
                  {mediaTypes.filter(type => entry.assets.some(asset => type.roles.includes(asset.role))).map(({ label, Icon, color }) => (
                    <span key={label} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${color}`}>
                      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <h2 className={`break-words font-serif ${catalog ? "line-clamp-3 text-base leading-snug" : "text-lg"}`}>
                <Link href={href} className="text-stone-900 hover:text-amber-800">{entry.title}</Link>
              </h2>
              {entry.summary && <p className={`break-words text-stone-600 ${catalog ? "line-clamp-2 text-xs leading-5" : "line-clamp-3 text-sm leading-6"}`}>{entry.summary}</p>}
              <Link href={href} className="mt-auto inline-flex min-h-11 items-center text-sm font-medium text-amber-800">{t('open')} →</Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export async function LearningList({ kind, params, searchParams }: { kind: 'lessons' | 'facts'; params: Promise<{ locale: string }>; searchParams: Promise<{ search?: string; page?: string }> }) {
  const { locale } = await params; const sp = await searchParams; setRequestLocale(locale); const t = await getTranslations({ locale, namespace: 'learning' }), c = await getTranslations({ locale, namespace: 'common' });
  let data: any = null; try { data = await api.learningList(kind, { search: sp.search || '', page: sp.page || '1' }); } catch { }
  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8"><header className="mx-auto max-w-2xl space-y-4 text-center"><h1 className="font-serif text-3xl text-stone-900 sm:text-4xl">{t(kind)}</h1><p className="text-sm leading-7 text-stone-600">{t(kind + 'Intro')}</p></header><CatalogSearch kind={kind} locale={locale} filters={sp} />
    {!data ? <p role="alert" className="rounded-xl bg-amber-50 p-5">{t('loadError')}</p> : !data.results.length ? <p className="rounded-2xl border border-dashed bg-white p-10 text-center text-stone-600">{sp.search ? c('searchNoResults') : t('empty')}</p> : <LearningCards entries={data.results} kind={kind} locale={locale} catalog />}

    {data && <Pagination currentPage={Number(sp.page) || 1} totalPages={data.total_pages} totalCount={data.count} basePath={`/${kind}`} searchParams={{ search: sp.search }} />}</div>;
}
export async function LearningDetail({ kind, params }: { kind: 'lessons' | 'facts'; params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; setRequestLocale(locale); const t = await getTranslations({ locale, namespace: 'learning' }); let entry: any;
  try { entry = await api.learningDetail(kind, id); } catch(e) { if(e instanceof ApiError && e.status === 404) notFound(); throw e; }
  const pdfs = entry.assets.filter((asset: { role: string }) => asset.role === 'pdf');
  const images = entry.assets.filter((a: any) => a.role === 'image'), videos = entry.assets.filter((a: any) => a.role === 'video');
  const hasCover = entry.assets.some((asset: { role: string }) => asset.role === 'cover');
  const compactCover = kind === 'lessons' && hasCover;
  const url=siteConfig.absoluteUrl(`/${kind}/${entry.id}`,locale);
  const schema={"@context":"https://schema.org","@type":kind==='lessons'?'LearningResource':'Article',name:entry.title,headline:entry.title,description:entry.summary||undefined,url,datePublished:entry.created_at,dateModified:entry.updated_at,isAccessibleForFree:true,author:entry.author_profile?{'@type':'Person',name:entry.author_profile.full_name,url:siteConfig.absoluteUrl(`/artists/${entry.author_profile.username}`,locale)}:undefined,image:entryCover(entry).endsWith('.svg')?undefined:siteConfig.mediaUrl(entryCover(entry)),publisher:{'@type':'Organization',name:siteConfig.name,url:siteConfig.siteUrl}};
  return <article className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6 lg:px-8"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({"@context":"https://schema.org","@graph":[schema,{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:siteConfig.name,item:siteConfig.absoluteUrl('',locale)},{"@type":"ListItem",position:2,name:t(kind),item:siteConfig.absoluteUrl(kind,locale)},{"@type":"ListItem",position:3,name:entry.title,item:url}]}]}).replace(/</g,"\\u003c")}}/>
    <Link href={`/${kind}`} className="inline-flex min-h-11 items-center text-sm text-amber-800">← {t(kind)}</Link>
    <div className={compactCover ? 'space-y-8 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center lg:gap-8 lg:space-y-0' : 'space-y-8'}>
      <header className="space-y-5">
        <h1 className="break-words font-serif text-3xl leading-tight text-stone-900 sm:text-5xl">{entry.title}</h1>
        {entry.author_profile && <div className="flex items-center gap-3"><ArtistAvatar artist={entry.author_profile} /><span className="text-sm text-stone-700">{entry.author_profile.full_name}</span></div>}
      </header>
      {hasCover && <ImageProtectionWrapper
        src={entryCover(entry)}
        alt={entry.title}
        naturalAspectRatio
        className="w-full rounded-2xl"
        imageClassName={compactCover ? 'object-cover lg:max-h-56 lg:object-contain' : undefined}
      />}
    </div>
    {entry.summary && <section className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 sm:p-7"><h2 className="mb-3 font-serif text-xl">{t('summary')}</h2><p className="whitespace-pre-line break-words text-sm leading-8 text-stone-700">{entry.summary}</p></section>}
    {entry.content && <div className="article-content min-w-0 rounded-2xl border border-stone-200 bg-[#FFFCF7]/95 p-5 sm:p-8" dangerouslySetInnerHTML={{ __html: entry.content }} />}
    {pdfs.length > 0 && (
      <section className="space-y-4">
        <h2 className="font-serif text-2xl">{t('pdfDocuments')}</h2>
        {pdfs.map((pdf: { id: string; filename: string }) => (
          <div key={pdf.id} className="space-y-3 rounded-2xl border border-rose-200 bg-[#FFFCF7] p-5">
            <h3 className="flex items-center gap-2 break-all font-medium text-stone-900">
              <FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-800" />
              {pdf.filename}
            </h3>
            <BookReader bookId={pdf.id} title={pdf.filename} source="learning/pdfs" />
          </div>
        ))}
      </section>
    )}
    {videos.length > 0 && <section className="space-y-5"><h2 className="font-serif text-2xl">{t('videos')}</h2>{videos.map((a: any, i: number) => <figure key={a.id} className="space-y-2"><video className="max-h-[75vh] w-full rounded-2xl bg-stone-900" controls playsInline preload="metadata" poster={a.poster ? siteConfig.mediaUrl(a.poster) : undefined} src={siteConfig.mediaUrl(a.file)} aria-label={`${t('videos')} ${i + 1}`} /><figcaption className="text-sm text-stone-600">{t('videos')} {i + 1}</figcaption></figure>)}</section>}
    {images.length > 0 && <section className="space-y-5"><h2 className="font-serif text-2xl">{t('images')}</h2><div className="grid items-start gap-5 sm:grid-cols-2">{images.map((a: any, i: number) => <ImageProtectionWrapper key={a.id} src={a.file} alt={`${entry.title} — ${i + 1}`} naturalAspectRatio className="w-full rounded-2xl" />)}</div></section>}
  </article>;
}

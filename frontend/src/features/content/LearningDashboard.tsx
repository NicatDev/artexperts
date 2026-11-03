"use client";
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { uploadLearning } from '@/lib/learning-upload';
import { type UploadProgress } from '@/lib/content-upload';
import { RichTextEditor } from './RichTextEditor';
import { UploadStatus } from './UploadStatus';
import { Modal } from '@/components/shared/Modal';
import { Link } from '@/i18n/routing';
import { useAuth } from '@/features/auth/AuthContext';

type Kind = 'lessons' | 'facts';
export function LearningDashboard({ kind }: { kind: Kind }) {
  const t = useTranslations('learning'), c = useTranslations('common'); const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]), [page, setPage] = useState(1), [pages, setPages] = useState(1), [editing, setEditing] = useState<any>(null), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [deleting, setDeleting] = useState<string | null>(null);
  async function load() { setError(''); setLoaded(false); try { const r = await api.learningList(kind, { page: String(page) }); setRows(r.results); setPages(r.total_pages); } catch { setError(t('loadError')); } finally { setLoaded(true); } }
  useEffect(() => { void load(); }, [kind, page]);
  if(!user?.is_superuser) return null;
  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">{error}</p>}
    {editing ? <LearningEditor key={editing.id || 'new'} kind={kind} initial={editing.id ? editing : null} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} /> : <>
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-serif text-2xl">{t(kind)}</h2><button className="min-h-12 cursor-pointer rounded-xl bg-stone-900 px-5 text-white" onClick={() => setEditing({})}>{t('add')}</button></div>
      {!loaded ? <p>{c('loading')}</p> : !rows.length ? <p className="rounded-xl bg-white p-6">{t('empty')}</p> : rows.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5"><Link className="min-w-0 break-words font-serif text-lg text-amber-900" href={`/${kind}/${row.id}`}>{row.title}</Link><div className="flex gap-3"><button className="min-h-11 cursor-pointer rounded-xl border px-4" onClick={async () => { try { setEditing(await api.learningDetail(kind, row.id)); } catch { setError(t('loadError')); } }}>{c('edit')}</button><button className="min-h-11 cursor-pointer rounded-xl border border-rose-200 px-4 text-rose-700" onClick={() => setDeleting(row.id)}>{c('delete')}</button></div></article>)}
      <div className="flex justify-center gap-4"><button className="min-h-11 cursor-pointer rounded-xl border px-4 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('previous')}</button><span className="py-3">{page} / {pages}</span><button className="min-h-11 cursor-pointer rounded-xl border px-4 disabled:opacity-40" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('next')}</button></div></>}
    <Modal open={!!deleting} title={t('deleteTitle')} onClose={() => setDeleting(null)}><p className="my-5 text-sm">{t('deletePrompt')}</p><div className="grid grid-cols-2 gap-3"><button className="min-h-12 rounded-xl border" onClick={() => setDeleting(null)}>{c('cancel')}</button><button className="min-h-12 rounded-xl bg-rose-700 text-white" onClick={async () => { try { await api.learningDelete(kind, deleting!); setDeleting(null); if(rows.length === 1 && page > 1) setPage(page - 1); else void load(); } catch { setError(t('loadError')); } }}>{c('delete')}</button></div></Modal>
  </div>;
}
function LearningEditor({ kind, initial, onCancel, onSaved }: { kind: Kind; initial: any; onCancel: () => void; onSaved: () => void }) {
  const t = useTranslations('learning'), c = useTranslations('common'); const { user } = useAuth();
  const [title, setTitle] = useState(initial?.title || ''), [summary, setSummary] = useState(initial?.summary || ''), [content, setContent] = useState(initial?.content || ''), [assets, setAssets] = useState<any[]>(initial?.assets || []), [files, setFiles] = useState<{ file: File; role: string }[]>([]), [error, setError] = useState(''), [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [open, setOpen] = useState(false), [progress, setProgress] = useState<UploadProgress | null>(null), [imageBusy, setImageBusy] = useState(false), [active, setActive] = useState('');
  const submission = useRef(crypto.randomUUID()), transfer = useRef<AbortController | null>(null), form = useRef<HTMLFormElement>(null), completed = useRef(new Map<File, string>()), saving = useRef(false);
  useEffect(() => () => transfer.current?.abort(), []);
  useEffect(() => { if(!busy) return; const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [busy]);
  const input = 'w-full min-w-0 rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-base focus:outline-amber-600';
  function select(list: FileList | null, role: string) { if(!list) return; setFiles(old => [...old.filter(x => role !== 'cover' || x.role !== 'cover'), ...Array.from(list).map(file => ({ file, role }))]); }
  async function save(e?: React.FormEvent) {    
e?.preventDefault(); if(saving.current || imageBusy) return;
    const errors: Record<string, string> = {}; if(!title.trim()) errors.title = t('required');
    if(kind === 'facts' && !content.replace(/<[^>]*>/g, '').trim() && !content.includes('<img')) errors.content = t('required');
    if(kind === 'lessons' && !content.replace(/<[^>]*>/g, '').trim() && !content.includes('<img') && !summary.trim() && !assets.length && !files.length) errors.content = t('atLeastOne');
    if(assets.length + files.length > 25) errors.assets = t('mediaLimit');
    if(kind === 'facts' && assets.length + files.length > 1) errors.assets = t('oneImage');
    for(const { file, role } of files) if(file.size > (role === 'video' ? 2 * 1024 ** 3 : 25 * 1024 ** 2) || !file.size || !(role === 'video' ? /\.(mp4|webm)$/i : /\.(jpg|jpeg|png|webp)$/i).test(file.name)) errors.assets = t('fileHint');
    setFieldErrors(errors); if(Object.keys(errors).length) { setTimeout(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0); return; }
    saving.current = true; setBusy(true); setOpen(true); setError(''); const controller = new AbortController(); transfer.current = controller;
    try {      
const ids = assets.map(a => a.id); for(const { file, role } of files) { setActive(file.name); let id = completed.current.get(file); if(!id) { id = await uploadLearning(file, role, user!.id, controller.signal, setProgress); completed.current.set(file, id); } ids.push(id); }
      setProgress({ stage: 'saving', loaded: 0, total: 0, percent: null }); await api.learningSave(kind, { title, summary, content, asset_ids: ids, submission_id: submission.current }, initial?.id); setOpen(false); onSaved();    
}
    catch(err: any) { setError(controller.signal.aborted ? t('paused') : err?.details?.content ? t('atLeastOne') : t('uploadError')); } finally { setBusy(false); saving.current = false; }
  }
  return <form ref={form} onSubmit={save} className="space-y-5 rounded-2xl border bg-white p-4 sm:p-7">
    <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t('immediate')}</p>
    <fieldset disabled={busy || imageBusy} className="min-w-0 space-y-5">
      <label className="block space-y-2"><span>{t('title')}</span><input autoFocus name="title" className={input} value={title} maxLength={250} aria-invalid={!!fieldErrors.title} onChange={e => setTitle(e.target.value)} />{fieldErrors.title && <span role="alert" className="text-sm text-rose-700">{fieldErrors.title}</span>}</label>
      {kind === 'lessons' && <label className="block space-y-2"><span>{t('summary')}</span><textarea className={input} maxLength={5000} rows={3} value={summary} onChange={e => setSummary(e.target.value)} /></label>}
      <div className="space-y-2"><p id="learning-content-label">{t('content')}</p><RichTextEditor value={content} onChange={setContent} id="learning-content" labelledBy="learning-content-label" invalid={!!fieldErrors.content} disabled={busy} onUploading={setImageBusy} />{fieldErrors.content && <p role="alert" className="text-sm text-rose-700">{fieldErrors.content}</p>}</div>
      <label className="block space-y-2"><span>{t('cover')}</span><input className={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setAssets(a => a.filter(x => x.role !== 'cover')); select(e.target.files, 'cover'); }} /></label>
      {kind === 'lessons' && <><label className="block space-y-2"><span>{t('images')}</span><input className={input} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => select(e.target.files, 'image')} /></label><label className="block space-y-2"><span>{t('videos')}</span><input className={input} type="file" multiple accept="video/mp4,video/webm" onChange={e => select(e.target.files, 'video')} /></label></>}
      <p className="text-xs leading-6 text-stone-500">{t(kind === 'lessons' ? 'fileHint' : 'imageHint')}</p>
      <div tabIndex={-1} aria-invalid={!!fieldErrors.assets}>{fieldErrors.assets && <p role="alert" className="text-sm text-rose-700">{fieldErrors.assets}</p>}</div>
      {[...assets.map(a => ({ key: a.id, name: a.filename, remove: () => setAssets(old => old.filter(x => x.id !== a.id)) })), ...files.map((a, i) => ({ key: String(i), name: a.file.name, remove: () => setFiles(old => old.filter((_, j) => j !== i)) }))].map(item => <div key={item.key} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-stone-50 p-3"><span className="min-w-0 break-all text-sm">{item.name}</span><button type="button" className="min-h-11 shrink-0 cursor-pointer px-3 text-sm text-rose-700" onClick={item.remove}>{c('delete')}</button></div>)}
      <div className="flex flex-wrap gap-3"><button type="button" className="min-h-12 cursor-pointer rounded-xl border px-5" onClick={onCancel}>{c('cancel')}</button><button className="min-h-12 cursor-pointer rounded-xl bg-stone-900 px-6 text-white">{c('save')}</button></div>
    </fieldset>
    <Modal open={open} title={t('uploadTitle')} busy={busy} onClose={() => { if(!busy) setOpen(false); }}><p className="mt-4 break-all text-sm">{active}</p><UploadStatus progress={progress} busy={busy} error={error} /><div className="mt-5 flex flex-wrap gap-3">{busy && progress?.stage === 'saving' ? null : busy ? <button type="button" className="min-h-12 rounded-xl border px-5" onClick={() => transfer.current?.abort()}>{t('pause')}</button> : <><button type="button" className="min-h-12 rounded-xl border px-5" onClick={() => setOpen(false)}>{c('cancel')}</button><button type="button" className="min-h-12 rounded-xl bg-stone-900 px-5 text-white" onClick={() => void save()}>{t('retry')}</button></>}</div></Modal>
  </form>;
}

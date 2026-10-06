"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/features/auth/AuthContext";
import { ProfileSettings } from "@/features/auth/ProfileSettings";
import { ContentEditor, type ContentKind } from "@/features/content/ContentEditor";
import { Modal } from "@/components/shared/Modal";
import { api } from "@/lib/api";
import { siteConfig } from "@/config/site";
import { Palette, BookOpen, FileText, Settings, Plus, Edit3, Trash2 } from "lucide-react";

type Tab = ContentKind | "settings";
const tabs = [{ kind: "artworks", icon: Palette }, { kind: "books", icon: BookOpen }, { kind: "articles", icon: FileText }, { kind: "settings", icon: Settings }] as const;

export default function ProfileDashboardPage() {
  const t = useTranslations("editor");
  const profile = useTranslations("profile");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("artworks");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editor, setEditor] = useState<{ kind: ContentKind; item?: any } | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<{ kind: ContentKind; item: any } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const requestId = useRef(0);

  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [isLoading, user, router]);
  const load = useCallback(async () => {
    if (!user || tab === "settings") return;
    const id = ++requestId.current;
    setLoading(true); setError("");
    try {
      const response = await api.getMyContent(tab, page, locale);
      if (id !== requestId.current) return;
      setRows(response.results); setCount(response.count); setTotalPages(Math.max(1, response.total_pages));
    } catch (error) { if (id === requestId.current) setError(error instanceof Error ? error.message : t("loadError")); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [user, tab, page, locale, t]);
  useEffect(() => { void load(); return () => { requestId.current++; }; }, [load]);

  function switchTab(next: Tab) {
    if (editing || deleteBusy) return;
    if (next === tab) { setEditor(null); return; }
    requestId.current++; setTab(next); setPage(1); setRows([]); setCount(0); setTotalPages(1);
    setEditor(null); setError(""); setSuccess("");
  }
  async function edit(item: any) {
    if (tab === "settings" || editing) return;
    setEditing(true); setError(""); setSuccess("");
    try { setEditor({ kind: tab, item: await api.getManagedContent(tab, item.id) }); }
    catch (error) { setError(error instanceof Error ? error.message : t("loadError")); }
    finally { setEditing(false); }
  }
  async function remove() {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true); setDeleteError("");
    try {
      await api.deleteContent(deleting.kind, deleting.item.id);
      setDeleting(null); setSuccess(t("deleted"));
      if (rows.length === 1 && page > 1) setPage(previous => previous - 1);
      else await load();
    } catch (error) { setDeleteError(error instanceof Error ? error.message : t("deleteError")); }
    finally { setDeleteBusy(false); }
  }
  if (isLoading || !user) return <p className="px-4 py-24 text-center text-sm text-stone-500">{common("loading")}</p>;
  const name = user.artist_profile?.full_name || user.email;
  const statusText = (status: string) => profile(status === "PUBLISHED" ? "statusPublished" : status === "PENDING_REVIEW" ? "statusPending" : status === "REJECTED" ? "statusRejected" : "statusDraft");

  return <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
    <header className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="flex min-w-0 items-center gap-4">
        {user.artist_profile?.avatar ? <img src={siteConfig.mediaUrl(user.artist_profile.avatar_thumbnail || user.artist_profile.avatar)} alt={name} className="h-16 w-16 shrink-0 rounded-full object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-50 font-serif text-2xl text-amber-800">{name.charAt(0)}</div>}
        <div className="min-w-0"><h1 className="break-words font-serif text-xl sm:text-2xl">{name}</h1><p className="break-all text-xs text-stone-500">@{user.artist_profile?.username || "creator"}</p><p className="mt-1 break-all text-sm text-stone-600">{user.email}</p></div>
      </div>
      <button onClick={() => switchTab("settings")} className="min-h-11 rounded-xl border px-4 text-sm">{profile("editProfile")}</button>
    </header>
    <div role="tablist" aria-label={profile("dashboard")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tabs.map(({ kind, icon: Icon }) => <button key={kind} id={`profile-tab-${kind}`} type="button" role="tab" aria-selected={tab === kind} aria-controls={`profile-panel-${kind}`} disabled={editing || deleteBusy} onClick={() => switchTab(kind)} className={`flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium sm:text-sm ${tab === kind ? "border-amber-400 bg-amber-50 text-amber-900" : "border-stone-200 bg-white text-stone-600"} disabled:opacity-50`}><Icon className="h-4 w-4 shrink-0" />{t(kind)}</button>)}
    </div>
    {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{success}</p>}
    {error && <div role="alert" className="space-y-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-700"><p className="break-words">{error}</p><button onClick={() => void load()} className="min-h-11 rounded-lg border border-rose-200 px-4">{t("retry")}</button></div>}
    <section role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`}>
      {tab === "settings" ? <ProfileSettings /> : editor ? <ContentEditor key={`${editor.kind}-${editor.item?.id || "new"}`} kind={editor.kind} initial={editor.item} isStaff={user.is_staff} onCancel={() => setEditor(null)} onSaved={() => { setEditor(null); setSuccess(t("saved")); if (page !== 1) setPage(1); else void load(); }} /> : <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-xl sm:text-2xl">{t(tab)} {!loading && `(${count})`}</h2><button disabled={editing} onClick={() => { setSuccess(""); setEditor({ kind: tab }); }} className="flex min-h-12 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm text-white disabled:opacity-50"><Plus className="h-4 w-4" />{t("add")}</button></div>
        {loading ? <p className="py-12 text-center text-sm text-stone-500">{common("loading")}</p> : !error && rows.length === 0 ? <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-stone-500">{profile("emptyContent")}</p> : !error && <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(item => <article key={item.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <img src={siteConfig.mediaUrl(item.thumbnail_image || item.cover_thumbnail || item.cover_image)} alt={item.title} className={`h-44 w-full bg-stone-100 ${tab === "books" ? "object-contain p-3" : "object-cover"}`} />
              <div className="flex flex-1 flex-col space-y-3 p-4 sm:p-5"><h3 className="break-words font-serif text-lg">{item.title}</h3><p className="line-clamp-3 break-words text-sm leading-6 text-stone-600">{item.description || item.excerpt || item.short_description}</p>
                <span className={`self-start rounded-full px-3 py-1 text-xs ${item.moderation_status === "PUBLISHED" ? "bg-emerald-50 text-emerald-700" : item.moderation_status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-900"}`}>{statusText(item.moderation_status)}</span>
                {item.rejection_reason && <p className="break-words text-xs text-rose-700">{profile("rejectionReason")} {item.rejection_reason}</p>}
                <p className="text-xs text-stone-500">{item.views_count || 0} {common("views")}</p>
                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-stone-100 pt-4"><button disabled={editing} onClick={() => void edit(item)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm disabled:opacity-50"><Edit3 className="h-4 w-4" />{common("edit")}</button><button onClick={() => { setDeleteError(""); setDeleting({ kind: tab, item }); }} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 text-sm text-rose-700"><Trash2 className="h-4 w-4" />{common("delete")}</button></div>
              </div>
            </article>)}
          </div>
          {totalPages > 1 && <nav aria-label={t("pagination")} className="flex flex-wrap items-center justify-center gap-3"><button disabled={page <= 1 || loading} onClick={() => setPage(previous => previous - 1)} className="min-h-11 rounded-xl border bg-white px-4 text-sm disabled:opacity-40">{t("previous")}</button><span className="text-sm text-stone-600">{page} / {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => setPage(previous => previous + 1)} className="min-h-11 rounded-xl border bg-white px-4 text-sm disabled:opacity-40">{t("next")}</button></nav>}
        </>}
      </div>}
    </section>
    <Modal open={!!deleting} title={t("deleteTitle")} busy={deleteBusy} onClose={() => setDeleting(null)}>
      <p className="mt-4 break-words text-sm leading-7 text-stone-600">{t("deletePrompt", { title: deleting?.item.title || "" })}</p>
      {deleteError && <p role="alert" className="mt-3 break-words text-sm text-rose-700">{deleteError}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3"><button autoFocus disabled={deleteBusy} onClick={() => setDeleting(null)} className="min-h-12 rounded-xl border px-3 text-sm disabled:opacity-50">{common("cancel")}</button><button disabled={deleteBusy} onClick={() => void remove()} className="min-h-12 rounded-xl bg-rose-700 px-3 text-sm text-white disabled:opacity-50">{deleteBusy ? common("loading") : common("delete")}</button></div>
    </Modal>
  </div>;
}

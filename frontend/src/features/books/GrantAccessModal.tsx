"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Modal } from "@/components/shared/Modal";
import { friendlyError } from "@/lib/form-errors";

interface GrantAccessModalProps {
  bookId: string; isOpen: boolean; onClose: () => void; onSuccess: () => void;
}

export function GrantAccessModal({ bookId, isOpen, onClose, onSuccess }: GrantAccessModalProps) {
  const t = useTranslations("books");
  const common = useTranslations("common");
  const editor = useTranslations("editor");
  const v = useTranslations("validation");
  const emailId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<any>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<any[]>([]);
  const [listError, setListError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [revoking, setRevoking] = useState<any>(null);
  const revision = useRef(0);

  const load = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true); setListError(false);
    try {
      const result = await api.getBookAccessGrants(bookId, page);
      if (revision.current === current) { setGrants(result.results || []); setTotalPages(Math.max(1, result.total_pages || 1)); }
    } catch { if (revision.current === current) setListError(true); }
    finally { if (revision.current === current) setLoading(false); }
  }, [bookId, page]);

  useEffect(() => {
    if (!isOpen) return;
    setEmail(""); setFound(null); setError(""); setSuccess(""); setRevoking(null);
  }, [isOpen, bookId]);
  useEffect(() => { if (isOpen) void load(); return () => { revision.current++; }; }, [isOpen, load]);

  async function check() {
    const value = email.trim().toLowerCase();
    if (!emailRef.current?.checkValidity() || !value) { setError(v("emailInvalid")); emailRef.current?.focus(); return; }
    setBusy(true); setError(""); setSuccess(""); setFound(null);
    try {
      const result = await api.lookupUser(value);
      if (result.exists) setFound({ ...result, email: value });
      else setError(t("emailNotFound"));
    } catch { setError(v("requestFailed")); }
    finally { setBusy(false); }
  }

  async function grant() {
    if (busy || !found || found.email !== email.trim().toLowerCase()) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await api.grantBookAccess(bookId, found.email);
      setSuccess(t("grantSuccess")); setFound(null); setEmail("");
      await load(); onSuccess();
    } catch (error) { setError(error instanceof Error ? friendlyError(error.message, v) : v("requestFailed")); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (busy || !revoking) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await api.revokeBookAccess(bookId, revoking.id);
      setRevoking(null); setSuccess(t("revokeSuccess"));
      await load(); onSuccess();
    } catch { setError(v("requestFailed")); }
    finally { setBusy(false); }
  }

  return <Modal open={isOpen} title={t("grantAccessTitle")} busy={busy} onClose={onClose}>
    <p className="mt-3 text-sm leading-6 text-stone-600">{t("enterEmailPrompt")}</p>
    <fieldset disabled={busy} className="mt-5 min-w-0 space-y-4">
      <label htmlFor={emailId} className="block text-sm">{t("accessEmail")}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input ref={emailRef} id={emailId} autoFocus type="email" required name="access_email" value={email} aria-invalid={!!error} aria-describedby={error ? `${emailId}-error` : undefined}
          onChange={event => { setEmail(event.target.value); setFound(null); setError(""); }}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 text-base focus:border-amber-600 focus:outline-none sm:text-sm" />
        <button type="button" onClick={() => void check()} className="min-h-12 rounded-xl border px-4 text-sm">{t("checkUser")}</button>
      </div>
      {found && <p className="break-words rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{t("emailVerified")} — {found.full_name}</p>}
      {error && <p id={`${emailId}-error`} role="alert" className="break-words rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
      <button type="button" disabled={!found || busy} onClick={() => void grant()} className="min-h-12 w-full rounded-xl bg-stone-900 px-4 text-sm text-white disabled:opacity-40">{busy ? common("loading") : t("grantAccessBtn")}</button>
      <div className="space-y-3 border-t pt-4">
        <h3 className="font-medium">{t("accessList")}</h3>
        {loading ? <p className="text-sm text-stone-500">{common("loading")}</p> : listError ? <div role="alert" className="space-y-2 text-sm text-rose-700"><p>{t("accessListError")}</p><button type="button" onClick={() => void load()} className="min-h-11 rounded-lg border px-4">{editor("retry")}</button></div> : grants.length === 0 ? <p className="text-sm text-stone-500">{t("noAccessGrants")}</p> : grants.map(row => <div key={row.id} className="min-w-0 space-y-2 rounded-xl border p-3">
          <p className="break-all text-sm">{row.user_email}</p>
          <p className="text-xs text-stone-500">{row.is_active ? t("accessActive") : t("accessInactive")}</p>
          {row.is_active && <button type="button" onClick={() => setRevoking(row)} className="min-h-11 rounded-lg border border-rose-200 px-3 text-sm text-rose-700">{t("revokeAccess")}</button>}
        </div>)}
        {!listError && totalPages > 1 && <nav className="flex items-center justify-between gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40">{editor("previous")}</button><span className="text-sm">{page}/{totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40">{editor("next")}</button></nav>}
      </div>
      {revoking && <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
        <p className="break-words text-sm">{t("revokePrompt", { email: revoking.user_email })}</p>
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setRevoking(null)} className="min-h-11 rounded-lg border bg-white px-2 text-sm">{common("cancel")}</button><button type="button" onClick={() => void revoke()} className="min-h-11 rounded-lg bg-rose-700 px-2 text-sm text-white">{t("revokeAccess")}</button></div>
      </div>}
      <button type="button" onClick={onClose} className="min-h-11 w-full rounded-xl border px-4 text-sm">{t("closeAccess")}</button>
    </fieldset>
  </Modal>;
}

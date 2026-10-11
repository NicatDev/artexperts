"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/features/auth/AuthContext";
import { api } from "@/lib/api";
import { siteConfig } from "@/config/site";
import { focusFirstError, readFieldErrors, type FieldErrors } from "@/lib/form-errors";

const inputClass = "w-full min-w-0 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-base focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100 sm:text-sm";

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const t = useTranslations("editor");
  const common = useTranslations("common");
  const v = useTranslations("validation");
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const focusPending = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [socialLinks, setSocialLinks] = useState<{ name: string; url: string }[]>([]);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const profile = user?.artist_profile;
    if (!profile) return;
    const fields = ["full_name", "username", "specialties", "location", "website", "short_bio", "artist_statement", "phone_number"] as const;
    setValues(Object.fromEntries(fields.map(field => [field, profile[field] || ""])));
    setSocialLinks(Object.entries(profile.social_links || {}).map(([name, url]) => ({ name, url })));
  }, [user]);
  useEffect(() => {
    if (!avatar) { setPreview(user?.artist_profile?.avatar ? siteConfig.mediaUrl(user.artist_profile.avatar) : ""); return; }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar, user]);

  useEffect(() => {
    if (!busy && focusPending.current) { focusPending.current = false; focusFirstError(formRef.current, fieldErrors); }
  }, [busy, fieldErrors]);
  const clearError = (name: string) => setFieldErrors(previous => { const next = { ...previous }; delete next[name]; return next; });
  function inputProps(name: string) { return { name, "aria-invalid": !!fieldErrors[name], "aria-describedby": fieldErrors[name] ? `${formId}-${name}-error` : undefined }; }
  function errorBelow(name: string) { return fieldErrors[name] ? <span id={`${formId}-${name}-error`} role="alert" className="block text-xs leading-5 text-rose-700">{fieldErrors[name]}</span> : null; }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(""); setSuccess("");
    const names = socialLinks.map(row => row.name.trim().toLowerCase());
    const next: FieldErrors = {};
    for (const input of Array.from(formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[name]") || [])) {
      if (input.disabled) continue;
      if (input.validity.valueMissing || (input.required && !input.value.trim())) next[input.name] = v("required");
      else if (input.validity.typeMismatch) next[input.name] = v("urlInvalid");
      else if (input.validity.patternMismatch) next[input.name] = v("usernameInvalid");
    }
    if (values.phone_number && !/^\+[1-9]\d{6,14}$/.test(values.phone_number.replace(/[\s().-]/g, ""))) next.phone_number = v("phoneInvalid");
    if (new Set(names).size !== names.length || names.some(name => !name)) next.social_links = t("socialDuplicate");
    if (avatar && avatar.size > 25 * 1024 * 1024) next.avatar = v("fileSize");
    else if (avatar && !["image/jpeg", "image/png", "image/webp"].includes(avatar.type)) next.avatar = v("imageInvalid");
    setFieldErrors(next);
    if (Object.keys(next).length) { focusPending.current = true; return; }
    setBusy(true);
    try {
      const form = new FormData();
      for (const [name, value] of Object.entries(values)) form.append(name, value.trim());
      form.append("social_links", JSON.stringify(Object.fromEntries(socialLinks.map((row, index) => [names[index], row.url.trim()]))));
      if (avatar) form.append("avatar", avatar);
      if (removeAvatar) form.append("remove_avatar", "true");
      await api.updateProfile(form);
      setAvatar(null); setRemoveAvatar(false);
      await refreshUser(); setSuccess(t("profileSaved"));
    } catch (error) { const next = readFieldErrors(error, v); setFieldErrors(next); focusPending.current = true; if (!Object.keys(next).length) setError(v("requestFailed")); }
    finally { setBusy(false); }
  }

  if (!user?.artist_profile) return <p className="text-sm text-stone-600">{t("noProfile")}</p>;
  return <form ref={formRef} noValidate onSubmit={save} className="max-w-3xl rounded-2xl border border-stone-200 bg-white p-4 sm:p-7">
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      {error && <p role="alert" className="break-words rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {success && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{success}</p>}
      <label className="block space-y-2 text-sm"><span>{t("avatar")}</span>
        {preview && !removeAvatar && <img src={preview} alt={t("avatar")} className="h-24 w-24 rounded-full object-cover" />}
        <input {...inputProps("avatar")} className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" disabled={removeAvatar} onChange={event => { clearError("avatar"); setAvatar(event.target.files?.[0] || null); }} />
        {errorBelow("avatar")}
      </label>
      {user.artist_profile.avatar && <label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={!!avatar} className="h-4 w-4" checked={removeAvatar} onChange={event => setRemoveAvatar(event.target.checked)} />{t("removeAvatar")}</label>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {["full_name", "username", "phone_number", "specialties", "location", "website"].map(name => <label key={name} className="block min-w-0 space-y-2 text-sm"><span>{t(name)}</span><input {...inputProps(name)} className={inputClass} type={name === "website" ? "url" : name === "phone_number" ? "tel" : "text"} autoComplete={name === "phone_number" ? "tel" : undefined} required={name === "full_name" || name === "username"} maxLength={name === "full_name" ? 200 : name === "username" ? 100 : name === "phone_number" ? 25 : name === "specialties" ? 250 : name === "location" ? 150 : 300} pattern={name === "username" ? "[a-z0-9_-]+" : undefined} value={values[name] || ""} onChange={event => { clearError(name); setValues(previous => ({ ...previous, [name]: name === "username" ? event.target.value.toLowerCase() : event.target.value })); }} />{errorBelow(name)}{name === "phone_number" && <span className="block text-xs leading-5 text-stone-500">{t("profilePhoneHint")}</span>}</label>)}
      </div>
      {["short_bio", "artist_statement"].map(name => <label key={name} className="block space-y-2 text-sm"><span>{t(name)}</span><textarea {...inputProps(name)} className={inputClass} rows={4} value={values[name] || ""} onChange={event => { clearError(name); setValues(previous => ({ ...previous, [name]: event.target.value })); }} />{errorBelow(name)}</label>)}
      <div className="space-y-3"><h3 className="text-sm font-medium">{t("socialLinks")}</h3>
        {socialLinks.map((row, index) => <div key={index} className="grid grid-cols-1 items-end gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_2fr_auto]">
          <label className="min-w-0 space-y-2 text-sm"><span>{t("networkName")}</span><input {...inputProps(`social_links.${index}.name`)} className={inputClass} required maxLength={50} value={row.name} onChange={event => { clearError(`social_links.${index}.name`); clearError("social_links"); setSocialLinks(rows => rows.map((item, i) => i === index ? { ...item, name: event.target.value } : item)); }} />{errorBelow(`social_links.${index}.name`)}</label>
          <label className="min-w-0 space-y-2 text-sm"><span>{t("link")}</span><input {...inputProps(`social_links.${index}.url`)} className={inputClass} required type="url" value={row.url} onChange={event => { clearError(`social_links.${index}.url`); clearError("social_links"); setSocialLinks(rows => rows.map((item, i) => i === index ? { ...item, url: event.target.value } : item)); }} />{errorBelow(`social_links.${index}.url`)}</label>
          <button type="button" className="min-h-11 rounded-xl border px-3 text-sm text-rose-700" onClick={() => setSocialLinks(rows => rows.filter((_, i) => i !== index))}>{common("delete")}</button>
        </div>)}
        {errorBelow("social_links")}
        <button type="button" onClick={() => setSocialLinks(rows => [...rows, { name: "", url: "" }])} className="min-h-11 rounded-xl border px-4 text-sm">{t("addSocial")}</button>
      </div>
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-stone-900 px-6 text-sm text-white disabled:opacity-50 sm:w-auto">{busy ? common("loading") : common("save")}</button>
    </fieldset>
  </form>;
}

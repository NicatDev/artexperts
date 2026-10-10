"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { siteConfig } from "@/config/site";
import { Modal } from "@/components/shared/Modal";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { focusFirstError, readFieldErrors, type FieldErrors } from "@/lib/form-errors";

export type ContentKind = "artworks" | "books" | "articles";
type Contributor = { name: string; role: string; bio: string };
const translatedFields: Record<ContentKind, string[]> = {
  artworks: ["title", "description"], articles: ["title", "excerpt", "content"],
  books: ["title", "short_description", "full_description", "table_of_contents"],
};
const inputClass = "w-full min-w-0 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:opacity-60";

export function ContentEditor({ kind, initial, isStaff, onSaved, onCancel }: {
  kind: ContentKind; initial?: any; isStaff: boolean; onSaved: () => void; onCancel: () => void;
}) {
  const t = useTranslations("editor");
  const common = useTranslations("common");
  const publish = useTranslations("publish");
  const locale = useLocale();
  const formId = useId();
  const v = useTranslations("validation");
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const focusPending = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [values, setValues] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const field of ["artist_attribution", "creation_year", "medium", "dimensions", "availability_mode", "price", "currency", "publication_year", "isbn", "publisher", "languages", "page_count"])
      result[field] = String(initial?.[field] ?? "");
    result.category = String(initial?.category?.id ?? initial?.category ?? "");
    result.availability_mode ||= "PRIVATE_ACCESS";
    result.currency ||= "AZN";
    result.languages ||= "AZ";
    const translation = initial?.translations?.find((row: any) => row.language === "az") || initial?.translations?.[0];
    for (const field of translatedFields[kind]) result[`${field}_az`] = translation?.[field] ?? initial?.[field] ?? "";
    return result;
  });
  const [allowDownload, setAllowDownload] = useState(initial?.allow_download ?? false);
  const [watermarked, setWatermarked] = useState(initial?.is_watermarked ?? false);
  const [rights, setRights] = useState(false);
  const [removePdf, setRemovePdf] = useState(false);
  const [contributors, setContributors] = useState<Contributor[]>(() => initial?.contributors?.map((row: any) => ({ name: row.full_name, role: row.role, bio: row.bio || "" })) || []);
  const [image, setImage] = useState<File | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!busy && !confirmOpen && focusPending.current) {
      focusPending.current = false;
      if (Object.keys(fieldErrors).length) focusFirstError(formRef.current, fieldErrors);
      else if (error) { errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); errorRef.current?.focus({ preventScroll: true }); }
    }
  }, [fieldErrors, error, busy, confirmOpen]);

  useEffect(() => {
    let active = true;
    setLoadingCategories(true);
    const load = kind === "artworks" ? api.getArtworkCategories : kind === "books" ? api.getBookCategories : api.getArticleCategories;
    load(locale).then(rows => { if (active) { setCategories(rows); setCategoryError(false); } })
      .catch(() => { if (active) setCategoryError(true); })
      .finally(() => { if (active) setLoadingCategories(false); });
    return () => { active = false; };
  }, [kind, locale]);

  useEffect(() => {
    if (!image) { setPreview(initial ? siteConfig.mediaUrl(initial.detail_image || initial.cover_image) : ""); return; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image, initial]);

  const clearError = (name: string) => setFieldErrors(previous => { const next = { ...previous }; delete next[name]; return next; });
  const set = (field: string, value: string) => { clearError(field); setValues(previous => ({ ...previous, [field]: value })); };
  const changeContributor = (index: number, field: keyof Contributor, value: string) => { clearError(`authors.${index}.${field}`); clearError("authors"); setContributors(rows => rows.map((row, i) => i === index ? { ...row, [field]: value } : row)); };
  const moveContributor = (index: number, offset: number) => setContributors(rows => {
    const next = [...rows];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    return next;
  });

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    for (const input of Array.from(formRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("[name]") || [])) {
      if (input.disabled) continue;
      if (input.validity.valueMissing || (input.required && input.type !== "checkbox" && input.type !== "file" && !input.value.trim())) next[input.name] = v("required");
      else if (input.validity.badInput || input.validity.stepMismatch || input.validity.rangeUnderflow || input.validity.rangeOverflow) next[input.name] = v("numberInvalid");
      else if (input.validity.tooLong) next[input.name] = v("tooLong");
    }
    if (!rights) next.rights_confirmed = v("rights");
    if (image && image.size > 25 * 1024 * 1024) next[kind === "artworks" ? "original_master" : "cover_image"] = v("fileSize");
    else if (image && !["image/jpeg", "image/png", "image/webp"].includes(image.type)) next[kind === "artworks" ? "original_master" : "cover_image"] = v("imageInvalid");
    if (pdf && pdf.size > 25 * 1024 * 1024) next.digital_file = v("fileSize");
    else if (pdf && !/\.pdf$/i.test(pdf.name)) next.digital_file = v("pdfInvalid");
    if (kind === "books") {
      if (values.availability_mode === "FUTURE_PAID" && !(Number(values.price) > 0)) next.price = v("positivePrice");
      const seen = new Set<string>();
      contributors.forEach((row, index) => {
        const key = `${row.name.trim().toLowerCase()}|${row.role}`;
        if (!row.name.trim()) next[`authors.${index}.name`] = v("required");
        else if (seen.has(key)) next[`authors.${index}.name`] = v("duplicateContributor");
        seen.add(key);
      });
    }
    return next;
  }

  function prepare(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (busy) return;
    const next = validate();
    setFieldErrors(next);
    if (Object.keys(next).length) { focusPending.current = true; return; }
    setConfirmOpen(true);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      for (const field of translatedFields[kind]) form.append(`${field}_az`, values[`${field}_az`].trim());
      form.append("category", values.category);
      form.append("rights_confirmed", "true");
      if (kind === "artworks") {
        for (const field of ["artist_attribution", "medium", "dimensions"]) form.append(field, values[field]);
        form.append("creation_year", values.creation_year);
        form.append("allow_download", String(allowDownload));
        form.append("is_watermarked", String(watermarked));
      }
      if (kind === "books") {
        for (const field of ["availability_mode", "price", "currency", "publication_year", "isbn", "publisher", "languages", "page_count"]) form.append(field, values[field]);
        form.append("authors", JSON.stringify(contributors.map(row => ({ ...row, name: row.name.trim() }))));
        if (removePdf) form.append("remove_digital_file", "true");
        if (pdf) form.append("digital_file", pdf);
      }
      if (image) form.append(kind === "artworks" ? "original_master" : "cover_image", image);
      await api.saveContent(kind, form, initial?.id);
      onSaved();
    } catch (error) {
      const next = readFieldErrors(error, v);
      setFieldErrors(next);
      if (!Object.keys(next).length) setError(v("requestFailed"));
      setConfirmOpen(false);
      focusPending.current = true;
    } finally {
      setBusy(false);
    }
  }

  function field(name: string, type = "text", required = false, maxLength?: number) {
    return <label key={name} className="block min-w-0 space-y-2 text-sm text-stone-700">
      <span>{t(name)}{required && " *"}</span>
      <input {...inputProps(name)} className={inputClass} type={type} value={values[name] || ""} onChange={event => set(name, event.target.value)} required={required} maxLength={maxLength}
        min={type === "number" ? 0 : undefined} max={type === "number" ? name === "price" ? 99999999.99 : 2147483647 : undefined} step={name === "price" ? "0.01" : type === "number" ? "1" : undefined} />
      {errorBelow(name)}
    </label>;
  }

  function inputProps(name: string) {
    return { name, "aria-invalid": !!fieldErrors[name], "aria-describedby": fieldErrors[name] ? `${formId}-${name}-error` : undefined };
  }
  function errorBelow(name: string) {
    return fieldErrors[name] ? <span id={`${formId}-${name}-error`} role="alert" className="block text-xs leading-5 text-rose-700">{fieldErrors[name]}</span> : null;
  }

  return <div className="max-w-4xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-serif text-xl sm:text-2xl">{initial ? common("edit") : t("add")} — {t(kind)}</h2>
      <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm disabled:opacity-50">{common("cancel")}</button>
    </div>
    <form ref={formRef} noValidate onSubmit={prepare} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-7">
      <fieldset disabled={busy} className="min-w-0 space-y-6">
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="break-words rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        <div className="space-y-4">
          {translatedFields[kind].map(name => <label key={name} className="block space-y-2 text-sm text-stone-700">
            <span id={`${formId}-${name}`}>{t(name)}{name !== "description" && name !== "table_of_contents" && " *"}</span>
            {name === "title" ? <input {...inputProps(`${name}_az`)} aria-labelledby={`${formId}-${name}`} className={inputClass} value={values[`${name}_az`]} maxLength={250} onChange={event => set(`${name}_az`, event.target.value)} required />
              : <textarea {...inputProps(`${name}_az`)} aria-labelledby={`${formId}-${name}`} className={inputClass} rows={name === "content" || name === "full_description" ? 8 : 3} value={values[`${name}_az`]} onChange={event => set(`${name}_az`, event.target.value)} required={name !== "description" && name !== "table_of_contents"} />}
            {errorBelow(`${name}_az`)}
          </label>)}
        </div>
        <label className="block space-y-2 text-sm text-stone-700">
          <span>{t("category")}</span>
          <select {...inputProps("category")} className={inputClass} disabled={loadingCategories || categoryError} value={values.category} onChange={event => set("category", event.target.value)}>
            <option value="">{loadingCategories ? common("loading") : t("noCategory")}</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name || category.name_az}</option>)}
          </select>
          {errorBelow("category")}
        </label>
        {categoryError && <p role="alert" className="text-sm text-rose-700">{t("categoriesError")}</p>}
        {kind === "artworks" && <>
          {field("artist_attribution", "text", false, 200)}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{field("creation_year", "number")}{field("medium", "text", false, 150)}{field("dimensions", "text", false, 100)}</div>
          <div><label className="flex items-start gap-3 text-sm"><input {...inputProps("allow_download")} type="checkbox" className="mt-1 h-4 w-4 accent-amber-700" checked={allowDownload} onChange={event => { clearError("allow_download"); setAllowDownload(event.target.checked); }} />{publish("allowDownloadLabel")}</label>{errorBelow("allow_download")}</div>
          <div><label className="flex items-start gap-3 text-sm"><input {...inputProps("is_watermarked")} type="checkbox" className="mt-1 h-4 w-4 accent-amber-700" checked={watermarked} onChange={event => { clearError("is_watermarked"); setWatermarked(event.target.checked); }} />{publish("watermarkLabel")}</label>{errorBelow("is_watermarked")}</div>
        </>}
        {kind === "books" && <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("publication_year", "number")}{field("publisher", "text", false, 150)}{field("isbn", "text", false, 50)}{field("page_count", "number")}{field("languages", "text", true, 100)}
            <label className="block space-y-2 text-sm"><span>{t("availability_mode")}</span><select {...inputProps("availability_mode")} className={inputClass} value={values.availability_mode} onChange={event => set("availability_mode", event.target.value)}>{["FREE", "PRIVATE_ACCESS", "NOT_FOR_SALE", "FUTURE_PAID"].map(mode => <option key={mode} value={mode}>{t(mode)}</option>)}</select>{errorBelow("availability_mode")}</label>
            {field("price", "number", values.availability_mode === "FUTURE_PAID")}{field("currency", "text", true, 10)}
          </div>
          <div className="space-y-3">
            <h3 className="font-medium">{t("contributors")}</h3>
            <p className="text-xs text-stone-500">{t("contributorsHint")}</p>
            {contributors.map((row, index) => <div key={index} className="space-y-3 rounded-xl border border-stone-200 p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm"><span>{t("contributorName")}</span><input {...inputProps(`authors.${index}.name`)} className={inputClass} value={row.name} maxLength={200} required onChange={event => changeContributor(index, "name", event.target.value)} />{errorBelow(`authors.${index}.name`)}</label>
                <label className="space-y-2 text-sm"><span>{t("role")}</span><select {...inputProps(`authors.${index}.role`)} className={inputClass} value={row.role} onChange={event => changeContributor(index, "role", event.target.value)}>{["AUTHOR", "CO_AUTHOR", "EDITOR", "TRANSLATOR"].map(role => <option key={role} value={role}>{t(role)}</option>)}</select>{errorBelow(`authors.${index}.role`)}</label>
              </div>
              <label className="block space-y-2 text-sm"><span>{t("bio")}</span><textarea {...inputProps(`authors.${index}.bio`)} className={inputClass} rows={2} value={row.bio} onChange={event => changeContributor(index, "bio", event.target.value)} />{errorBelow(`authors.${index}.bio`)}</label>
              <div className="flex gap-2">
                <button type="button" disabled={index === 0} onClick={() => moveContributor(index, -1)} aria-label={t("moveUp")} className="min-h-11 min-w-11 rounded-lg border disabled:opacity-30"><ArrowUp className="mx-auto h-4 w-4" /></button>
                <button type="button" disabled={index === contributors.length - 1} onClick={() => moveContributor(index, 1)} aria-label={t("moveDown")} className="min-h-11 min-w-11 rounded-lg border disabled:opacity-30"><ArrowDown className="mx-auto h-4 w-4" /></button>
                <button type="button" onClick={() => setContributors(rows => rows.filter((_, i) => i !== index))} aria-label={common("delete")} className="ml-auto min-h-11 min-w-11 rounded-lg border text-rose-700"><Trash2 className="mx-auto h-4 w-4" /></button>
              </div>
            </div>)}
            {errorBelow("authors")}
            <button type="button" disabled={contributors.length >= 30} onClick={() => setContributors(rows => [...rows, { name: "", role: "AUTHOR", bio: "" }])} className="flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm disabled:opacity-50"><Plus className="h-4 w-4" />{t("addContributor")}</button>
          </div>
        </>}
        <label className="block space-y-2 text-sm">
          <span>{kind === "artworks" ? t("image") : t("cover")} {!initial && "*"}</span>
          {preview && <img src={preview} alt={t("preview")} className="max-h-64 max-w-full rounded-xl object-contain" />}
          <input {...inputProps(kind === "artworks" ? "original_master" : "cover_image")} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-2 file:text-xs`} type="file" accept="image/jpeg,image/png,image/webp" required={!initial} onChange={event => { clearError(kind === "artworks" ? "original_master" : "cover_image"); setImage(event.target.files?.[0] || null); }} />
          {errorBelow(kind === "artworks" ? "original_master" : "cover_image")}
          <span className="block text-xs text-stone-500">{initial ? t("keepImage") : t("imageHint")}</span>
        </label>
        {kind === "books" && <label className="block space-y-2 text-sm">
          <span>{t("pdf")}</span>
          <input {...inputProps("digital_file")} className={inputClass} type="file" accept="application/pdf,.pdf" disabled={removePdf} onChange={event => { clearError("digital_file"); setPdf(event.target.files?.[0] || null); }} />
          {errorBelow("digital_file")}
          <span className="block text-xs text-stone-500">{t("pdfHint")}</span>
          {initial?.has_digital_file && <span className="flex items-start gap-3"><input {...inputProps("remove_digital_file")} type="checkbox" disabled={!!pdf} className="mt-1 h-4 w-4" checked={removePdf} onChange={event => { clearError("digital_file"); setRemovePdf(event.target.checked); }} />{t("removePdf")}</span>}
        </label>}
        <div><label className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm leading-6"><input {...inputProps("rights_confirmed")} type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-amber-700" checked={rights} required onChange={event => { clearError("rights_confirmed"); setRights(event.target.checked); }} />{common("rightsNotice")}</label>{errorBelow("rights_confirmed")}</div>
        <p className="text-xs leading-6 text-stone-500">{isStaff ? t("staffPublish") : t("reviewNotice")}</p>
        <button type="submit" disabled={busy || loadingCategories || categoryError} className="min-h-12 w-full rounded-xl bg-stone-900 px-6 py-3 text-sm font-medium text-white hover:bg-black disabled:opacity-50 sm:w-auto">{busy ? common("loading") : initial ? common("save") : t("add")}</button>
      </fieldset>
    </form>
    <Modal open={confirmOpen} title={initial ? t("confirmEdit") : publish("modalNoticeTitle")} busy={busy} onClose={() => setConfirmOpen(false)}>
      <p className="mt-4 text-sm leading-7 text-stone-600">{isStaff ? t("staffPublish") : t("reviewNotice")}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" autoFocus disabled={busy} onClick={() => setConfirmOpen(false)} className="min-h-12 rounded-xl border px-3 py-3 text-sm disabled:opacity-50">{common("cancel")}</button>
        <button type="button" disabled={busy} onClick={save} className="min-h-12 rounded-xl bg-stone-900 px-3 py-3 text-sm text-white disabled:opacity-50">{busy ? common("loading") : common("submit")}</button>
      </div>
    </Modal>
  </div>;
}

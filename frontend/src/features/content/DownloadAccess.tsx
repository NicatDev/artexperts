"use client";

import { useTranslations } from "next-intl";
import { Download, Lock, Phone, Mail, MessageCircle } from "lucide-react";

export function DownloadAccess({ mode, contact, downloadUrl, hasFile, kind, allowDownload = true, allowReading = false }: {
  mode: string;
  contact?: { mode: "PHONE" | "EMAIL"; value: string } | null;
  downloadUrl: string;
  hasFile: boolean;
  kind: "books" | "artworks";
  allowDownload?: boolean;
  allowReading?: boolean;
}) {
  const t = useTranslations("downloadAccess");
  if (mode === "FREE" && !allowDownload) return <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-center"><p className="flex items-center justify-center gap-2 text-sm font-medium text-amber-950"><Lock className="h-4 w-4" />{t("downloadDisabled")}</p><p className="text-xs leading-6 text-stone-600">{t("artworkProtectionNotice")}</p></div>;
  if (mode === "FREE") return hasFile ? <a href={downloadUrl} className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-black">
    <Download className="h-4 w-4 shrink-0 text-amber-300" />{t(kind === "books" ? "downloadBook" : "downloadArtwork")}
  </a> : <p className="rounded-2xl border border-stone-200 p-4 text-center text-sm text-stone-600">{t("fileUnavailable")}</p>;

  const isContact = mode === "CONTACT";
  return <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-center">
    <p className="flex items-center justify-center gap-2 text-sm font-medium text-amber-950"><Lock className="h-4 w-4 shrink-0" />{t(isContact ? "contactTitle" : "privateTitle")}</p>
    <p className="text-sm leading-6 text-stone-600">{t(isContact ? "contactNotice" : kind === "books" ? allowReading ? "privateBookReadingNotice" : "privateBookNotice" : "privateArtworkNotice")}</p>
    {isContact && !contact && <p className="text-xs leading-5 text-stone-500">{t("noContact")}</p>}
    {isContact && contact?.mode === "PHONE" && /^\+[1-9]\d{6,14}$/.test(contact.value) && <div className="space-y-2">
      <a href={`tel:${contact.value}`} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-amber-950"><Phone className="h-4 w-4 shrink-0" /><span dir="ltr">{contact.value}</span></a>
      <a href={`https://wa.me/${contact.value.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"><MessageCircle className="h-4 w-4 shrink-0" />{t("whatsapp")}</a>
    </div>}
    {isContact && contact?.mode === "EMAIL" && <a href={`mailto:${encodeURIComponent(contact.value)}`} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-amber-950"><Mail className="h-4 w-4 shrink-0" /><span className="min-w-0 break-all">{contact.value}</span></a>}
  </div>;
}

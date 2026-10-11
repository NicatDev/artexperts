"use client";

import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { siteConfig } from "@/config/site";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { GrantAccessModal } from "@/features/books/GrantAccessModal";
import { Download, Lock, UserPlus, FileText, Phone, Mail, MessageCircle } from "lucide-react";

export function BookDetailClient({ book }: { book: any }) {
  const tBooks = useTranslations("books");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { user, isLoading } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resolved, setResolved] = useState<{ key: string; data: any } | null>(null);
  const requestKey = `${book.id}:${locale}:${user?.id || "anonymous"}`;
  const currentBook = resolved?.key === requestKey ? resolved.data : book;
  const checkingAccess = isLoading || (!!user && resolved?.key !== requestKey);
  const contact = currentBook.contact;

  useEffect(() => {
    if (isLoading) return;
    let active = true;
    // SSR has no browser session: fetch the visitor's actual download permissions.
    api.getBookDetail(book.id, locale)
      .then(data => { if (active) setResolved({ key: requestKey, data }); })
      .catch(() => { if (active) setResolved({ key: requestKey, data: book }); });
    return () => { active = false; };
  }, [book, locale, requestKey, isLoading]);

  const downloadUrl = `${siteConfig.apiUrl}/books/${currentBook.id}/download/`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
      {/* Book Cover (4 cols) */}
      <div className="lg:col-span-4 bg-white border border-[#EAE6DF] rounded-3xl p-5 sm:p-7 shadow-lg">
        <div className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-stone-100 shadow-md">
          <ImageProtectionWrapper
            src={currentBook.cover_image}
            alt={currentBook.title}
            fill
            className="w-full h-full object-cover"
            imageClassName="object-contain"
            priority={true}
            watermarkText="Art Experts"
          />
        </div>

        <div className="mt-6 space-y-3">
          {checkingAccess ? <p role="status" className="p-4 text-center text-sm text-stone-500">{tCommon("loading")}</p> : currentBook.has_download_access ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-stone-900 hover:bg-black text-white font-medium text-sm transition-all shadow-md hover:shadow-lg"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>{tBooks("downloadEdition")}</span>
            </a>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-center space-y-2">
              <div className="flex items-center justify-center gap-1.5 text-amber-900 text-xs font-semibold">
                <Lock className="w-4 h-4 text-amber-700" />
                <span>{tBooks("privateAccess")}</span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                {contact ? tBooks("contactForAccess") : tBooks("restrictedAccessNotice")}
              </p>
              {contact?.mode === "PHONE" && /^\+[1-9]\d{6,14}$/.test(contact.value) && <div className="space-y-2 pt-2">
                <a href={`tel:${contact.value}`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-amber-950"><Phone className="h-4 w-4 shrink-0" /><span dir="ltr">{contact.value}</span></a>
                <a href={`https://wa.me/${contact.value.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"><MessageCircle className="h-4 w-4 shrink-0" />{tBooks("whatsappContact")}</a>
              </div>}
              {contact?.mode === "EMAIL" && <a href={`mailto:${encodeURIComponent(contact.value)}`} className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-amber-950"><Mail className="h-4 w-4 shrink-0" /><span className="min-w-0 break-all">{contact.value}</span></a>}
            </div>
          )}

          {!checkingAccess && currentBook.can_manage_access && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-medium transition-colors shadow-2xs"
            >
              <UserPlus className="w-4 h-4 text-amber-700" />
              <span>{tBooks("grantAccessBtn")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Book Details (8 cols) */}
      <div className="lg:col-span-8 space-y-8">
        <div>
          <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
            {currentBook.availability_mode === "FREE" ? tBooks("freeAccess") : tBooks("privateAccess")}
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-stone-900 mt-1">
            {currentBook.title}
          </h1>

          {/* Contributors / Authors list */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-xs text-stone-500">{tBooks("authors")}:</span>
            {currentBook.contributors?.map((c: any) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-stone-200 text-xs font-medium text-amber-900 shadow-2xs"
              >
                <span>{c.full_name}</span>
                <span className="text-[10px] text-stone-500">({c.role})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Short & Full Description */}
        <div className="space-y-4 border-t border-stone-100 pt-6">
          <h3 className="text-base font-serif text-stone-900 font-medium">Kitab Haqqında</h3>
          <p className="text-sm text-stone-700 leading-relaxed font-sans whitespace-pre-line">
            {currentBook.full_description || currentBook.short_description}
          </p>
        </div>

        {/* Table of Contents */}
        {currentBook.table_of_contents && (
          <div className="bg-[#FAF6ED] border border-amber-200/80 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-sm font-serif text-stone-900 border-b border-amber-200/60 pb-2">
              <FileText className="w-4 h-4 text-amber-700" />
              <span>{tBooks("tableOfContents")}</span>
            </div>
            <pre className="text-xs text-stone-700 font-sans whitespace-pre-line leading-relaxed">
              {currentBook.table_of_contents}
            </pre>
          </div>
        )}

        {/* Publication Metadata Details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white border border-stone-200 rounded-2xl p-5 text-xs shadow-2xs">
          <div>
            <span className="text-stone-500 block">{tBooks("year")}</span>
            <span className="text-stone-900 font-medium mt-0.5 block">{currentBook.publication_year || "—"}</span>
          </div>
          <div>
            <span className="text-stone-500 block">{tBooks("publisher")}</span>
            <span className="text-stone-900 font-medium mt-0.5 block">{currentBook.publisher || "—"}</span>
          </div>
          <div>
            <span className="text-stone-500 block">{tBooks("isbn")}</span>
            <span className="text-stone-900 font-medium mt-0.5 block">{currentBook.isbn || "—"}</span>
          </div>
          <div>
            <span className="text-stone-500 block">{tBooks("pages")}</span>
            <span className="text-stone-900 font-medium mt-0.5 block">{currentBook.page_count ? `${currentBook.page_count} səh.` : "—"}</span>
          </div>
        </div>
      </div>

      {/* Grant Access Modal */}
      <GrantAccessModal
        bookId={currentBook.id}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          api.getBookDetail(book.id, locale).then(data => setResolved({ key: requestKey, data })).catch(() => {});
        }}
      />
    </div>
  );
}

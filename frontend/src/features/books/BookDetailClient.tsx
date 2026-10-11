"use client";

import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthContext";
import { siteConfig } from "@/config/site";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { DownloadAccess } from "@/features/content/DownloadAccess";
import { FileText } from "lucide-react";

export function BookDetailClient({ book }: { book: any }) {
  const tBooks = useTranslations("books");
  const tCommon = useTranslations("common");
  const tEditor = useTranslations("editor");
  const locale = useLocale();
  const { user, isLoading } = useAuth();

  const [resolved, setResolved] = useState<{ key: string; data: any } | null>(null);
  const requestKey = `${book.id}:${locale}:${user?.id || "anonymous"}`;
  const currentBook = resolved?.key === requestKey ? resolved.data : book;
  const checkingAccess = isLoading || (!!user && resolved?.key !== requestKey);

  useEffect(() => {
    if (isLoading) return;
    let active = true;
    // Refresh the current mode; downloads never depend on an implicit owner grant.
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
          {checkingAccess ? <p role="status" className="p-4 text-center text-sm text-stone-500">{tCommon("loading")}</p> : <DownloadAccess
            kind="books" mode={currentBook.availability_mode} contact={currentBook.contact}
            downloadUrl={downloadUrl} hasFile={!!currentBook.has_digital_file}
          />}
        </div>
      </div>

      {/* Book Details (8 cols) */}
      <div className="lg:col-span-8 space-y-8">
        <div>
          <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
            {tEditor(currentBook.availability_mode === "CONTACT" ? "CONTACT" : currentBook.availability_mode === "FREE" ? "FREE" : "PRIVATE_ACCESS")}
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


    </div>
  );
}

"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount?: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
}

export function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalCount,
  basePath,
  searchParams = {},
}: PaginationProps) {
  const t = useTranslations("pagination");

  const safeTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.max(1, Math.min(currentPage, safeTotalPages));

  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, val]) => {
      if (val && key !== "page") {
        params.set(key, val);
      }
    });
    if (page > 1) {
      params.set("page", page.toString());
    }
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  // Compute visible numeric pages: 1st, last, and currentPage +/- 1
  const pages: (number | string)[] = [];
  const startPage = Math.max(1, safeCurrentPage - 1);
  const endPage = Math.min(safeTotalPages, safeCurrentPage + 1);

  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) {
      pages.push("ellipsis-prev");
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    pages.push(p);
  }

  if (endPage < safeTotalPages) {
    if (endPage < safeTotalPages - 1) {
      pages.push("ellipsis-next");
    }
    pages.push(safeTotalPages);
  }

  const isFirstDisabled = safeCurrentPage <= 1;
  const isLastDisabled = safeCurrentPage >= safeTotalPages;

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-8 border-t border-stone-200 mt-12"
    >
      {/* Page Info summary */}
      <div className="text-xs text-stone-500 font-sans">
        <span>
          {t("page")} <strong className="text-amber-800">{safeCurrentPage}</strong> {t("of")}{" "}
          <strong className="text-stone-900">{safeTotalPages}</strong>
        </span>
        {totalCount !== undefined && (
          <span className="ml-2 text-stone-400">
            ({t("total")}: <strong className="text-stone-700">{totalCount}</strong>)
          </span>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* First Page Button */}
        {isFirstDisabled ? (
          <button
            disabled
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-100 text-stone-300 bg-stone-50 text-xs cursor-not-allowed"
            title={t("first")}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t("first")}</span>
          </button>
        ) : (
          <Link
            href={buildHref(1)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 bg-white hover:text-stone-900 hover:border-amber-400 text-xs transition-colors shadow-2xs"
            title={t("first")}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t("first")}</span>
          </Link>
        )}

        {/* Previous Page Button */}
        {isFirstDisabled ? (
          <button
            disabled
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-100 text-stone-300 bg-stone-50 text-xs cursor-not-allowed"
            title={t("previous")}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t("previous")}</span>
          </button>
        ) : (
          <Link
            href={buildHref(safeCurrentPage - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 bg-white hover:text-stone-900 hover:border-amber-400 text-xs transition-colors shadow-2xs"
            title={t("previous")}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t("previous")}</span>
          </Link>
        )}

        {/* Numbered Page Buttons & Ellipses */}
        <div className="flex items-center gap-1">
          {pages.map((item, idx) => {
            if (typeof item === "string") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-xs text-stone-400 select-none"
                >
                  •••
                </span>
              );
            }

            const isCurrent = item === safeCurrentPage;
            if (isCurrent) {
              return (
                <span
                  key={item}
                  aria-current="page"
                  className="min-w-[34px] h-[34px] flex items-center justify-center px-2.5 rounded-lg bg-amber-600 text-white font-semibold text-xs shadow-xs"
                >
                  {item}
                </span>
              );
            }

            return (
              <Link
                key={item}
                href={buildHref(item)}
                className="min-w-[34px] h-[34px] flex items-center justify-center px-2.5 rounded-lg border border-stone-200 text-stone-600 bg-white hover:text-stone-900 hover:border-amber-400 text-xs transition-colors shadow-2xs"
              >
                {item}
              </Link>
            );
          })}
        </div>

        {/* Next Page Button */}
        {isLastDisabled ? (
          <button
            disabled
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-100 text-stone-300 bg-stone-50 text-xs cursor-not-allowed"
            title={t("next")}
          >
            <span>{t("next")}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <Link
            href={buildHref(safeCurrentPage + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 bg-white hover:text-stone-900 hover:border-amber-400 text-xs transition-colors shadow-2xs"
            title={t("next")}
          >
            <span>{t("next")}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}

        {/* Last Page Button */}
        {isLastDisabled ? (
          <button
            disabled
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-100 text-stone-300 bg-stone-50 text-xs cursor-not-allowed"
            title={t("last")}
          >
            <span className="hidden md:inline">{t("last")}</span>
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Link
            href={buildHref(safeTotalPages)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-600 bg-white hover:text-stone-900 hover:border-amber-400 text-xs transition-colors shadow-2xs"
            title={t("last")}
          >
            <span className="hidden md:inline">{t("last")}</span>
            <ChevronsRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </nav>
  );
}

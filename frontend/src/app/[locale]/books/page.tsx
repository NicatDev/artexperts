import React from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { ImageProtectionWrapper } from "@/components/shared/ImageProtectionWrapper";
import { Pagination } from "@/components/shared/Pagination";
import { BookOpen, ArrowRight, User } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: locale === "az" ? "Kitabxana və Nəşrlər" : locale === "ru" ? "Библиотека и издания" : "Library & Books",
    description: "Sənət nəzəriyyəsi, rəssamlıq monoqrafiyaları və bədii kataloqlar.",
  };
}

export default async function BooksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ author?: string; search?: string; mode?: string; category?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const tBooks = await getTranslations({ locale, namespace: "books" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  const currentPage = Math.max(1, parseInt(sp.page || "1", 10));
  let booksList: any[] = [];
  let categories: any[] = [];
  let totalPages = 1;
  let totalCount = 0;

  try {
    const [res, catRes] = await Promise.all([api.getBooks({
      lang: locale,
      author: sp.author || "",
      search: sp.search || "",
      mode: sp.mode || "",
      category: sp.category || "",
      page: sp.page || "1",
    }), api.getBookCategories(locale)]);
    booksList = res?.results || (Array.isArray(res) ? res : []);
    categories = Array.isArray(catRes) ? catRes : catRes?.results || [];
    totalCount = res?.count !== undefined ? res.count : booksList.length;
    totalPages = res?.total_pages || Math.max(1, Math.ceil(totalCount / 12));
  } catch {
    booksList = [];
    categories = [];
    totalPages = 1;
    totalCount = 0;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <span className="text-xs font-serif uppercase tracking-widest text-amber-800 font-bold">
          Nəşrlər
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif text-stone-900">
          {tBooks("title")}
        </h1>
        <p className="text-sm text-stone-600">
          {tBooks("subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        <Link href="/books" className={`px-4 py-1.5 rounded-full text-xs font-medium ${!sp.category ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-600"}`}>{tCommon("all")}</Link>
        {categories.map((category: any) => <Link key={category.id} href={`/books?category=${category.slug}`} className={`px-4 py-1.5 rounded-full text-xs font-medium ${sp.category === category.slug ? "bg-stone-900 text-white" : "bg-white border border-stone-200 text-stone-600"}`}>{category.name || category.name_az}</Link>)}
      </div>

      {/* Books Grid with strictly equal aspect ratios */}
      {booksList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {booksList.map((book: any) => (
            <div
              key={book.id}
              className="group bg-white border border-[#EAE6DF] rounded-2xl overflow-hidden hover:border-amber-400/60 transition-all duration-300 flex flex-col shadow-xs hover:shadow-xl"
            >
              {/* Equal aspect ratio: 3:4 portrait book standard */}
              <div className="relative aspect-[3/4] bg-stone-100 overflow-hidden">
                <ImageProtectionWrapper
                  src={book.cover_image}
                  alt={book.title}
                  fill
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  watermarkText="Art Experts"
                />
                <div className="absolute bottom-2 left-2 z-20 px-2.5 py-1 rounded bg-white/90 backdrop-blur text-[10px] font-mono text-stone-800 border border-stone-200 shadow-2xs">
                  {book.availability_mode === "FREE" ? tBooks("freeAccess") : tBooks("privateAccess")}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-serif text-base text-stone-900 group-hover:text-amber-800 transition-colors line-clamp-1 font-medium">
                    {book.title}
                  </h3>
                  <p className="text-xs text-stone-500 mt-2 line-clamp-2 leading-relaxed">
                    {book.short_description}
                  </p>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span className="text-amber-900 font-medium line-clamp-1">
                    {book.contributors?.[0]?.name || "İlqar Məmmədov"}
                  </span>
                  <span className="whitespace-nowrap">{book.views_count || 0} {tCommon("views")}</span>
                  <Link
                    href={`/books/${book.slug || book.id}`}
                    className="text-amber-800 hover:text-amber-950 font-semibold ml-2 inline-flex items-center gap-1"
                  >
                    {tCommon("viewDetails")} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-stone-200 rounded-2xl text-stone-500 text-sm bg-white">
          {tBooks("empty")}
        </div>
      )}

      {/* Pagination is always visible as requested */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        basePath="/books"
        searchParams={{
          author: sp.author,
          search: sp.search,
          mode: sp.mode,
        }}
      />
    </div>
  );
}

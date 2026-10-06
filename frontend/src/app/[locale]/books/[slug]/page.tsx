import React from "react";

export const dynamic = "force-dynamic";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { api } from "@/lib/api";
import { siteConfig } from "@/config/site";
import { BookDetailClient } from "@/features/books/BookDetailClient";
import { ArrowLeft } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  try {
    const book = await api.getBookDetail(slug, locale);
    return {
      title: `${book.title} | Nəşrlər | Art Experts`,
      description: book.short_description || book.title,
      openGraph: {
        title: book.title,
        description: book.short_description,
        images: [siteConfig.mediaUrl(book.cover_image)],
      },
    };
  } catch {
    return { title: "Kitab | Art Experts" };
  }
}

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  let book: any = null;
  try {
    book = await api.getBookDetail(slug, locale);
  } catch {
    notFound();
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    "name": book.title,
    "description": book.short_description,
    "isbn": book.isbn,
    "numberOfPages": book.page_count,
    "datePublished": book.publication_year ? `${book.publication_year}` : undefined,
    "image": siteConfig.mediaUrl(book.cover_image),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div>
        <Link
          href="/books"
          className="inline-flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Bütün Kitablara Qayıt</span>
        </Link>
      </div>

      <BookDetailClient book={book} />
    </div>
  );
}

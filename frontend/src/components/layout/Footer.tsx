"use client";

import React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { HeartHandshake } from "lucide-react";

export function Footer() {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");

  return (
    <footer className="bg-[#F4F1EA] border-t border-[#E5E0D8] text-stone-600 text-sm mt-20 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Column 1: Brand & Identity */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-amber-200/80 bg-white shadow-2xs">
                <Image
                  src="/art-expert-logo.png"
                  alt="Art Experts Logo"
                  fill
                  className="object-contain p-0.5"
                />
              </div>
              <div>
                <span className="font-serif text-lg text-stone-900 tracking-wider uppercase font-medium">
                  {tCommon("siteName")}
                </span>
                <span className="block text-[10px] tracking-widest uppercase text-stone-500 -mt-1 font-sans">
                  Fine Art & Author Archive
                </span>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-stone-600 max-w-md font-sans">
              Milli və beynəlxalq təsviri sənət ənənələrinin rəqəmsal ocağı. Sənət əsərlərinin, müəllif kitablarının və nəzəri məqalələrin qorunub paylaşıldığı müstəqil sənət ekosistemi.
            </p>
            <div className="pt-1 flex items-center gap-2 text-xs text-amber-900/90 font-medium">
              <HeartHandshake className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-sans">
                Təsisçi rəssam <strong>İlqar Məmmədovun</strong> gənc sənətçilərə dəstək təşəbbüsü ilə yaradılmışdır.
              </span>
            </div>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-serif uppercase tracking-widest text-stone-900 font-bold">
              Naviqasiya
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/artworks" className="text-stone-600 hover:text-amber-800 transition-colors">
                  {tNav("artworks")}
                </Link>
              </li>
              <li>
                <Link href="/books" className="text-stone-600 hover:text-amber-800 transition-colors">
                  {tNav("books")}
                </Link>
              </li>
              <li>
                <Link href="/articles" className="text-stone-600 hover:text-amber-800 transition-colors">
                  {tNav("articles")}
                </Link>
              </li>
              <li>
                <Link href="/artists" className="text-stone-600 hover:text-amber-800 transition-colors">
                  {tNav("artists")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-stone-600 hover:text-amber-800 transition-colors">
                  {tNav("about")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Founder's Artist Support Initiative */}
          <div className="space-y-3">
            <h4 className="text-xs font-serif uppercase tracking-widest text-stone-900 font-bold">
              Sənətçilərə Dəstək
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              {tHome("missionBannerText")}
            </p>
            <div className="pt-1">
              <Link
                href="/register"
                className="inline-block text-xs text-amber-800 hover:text-amber-900 font-semibold underline underline-offset-4"
              >
                {tHome("joinCta")} →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>
            © {new Date().getFullYear()} Art Experts Platforması. Bütün hüquqlar qorunur.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/about" className="text-stone-600 hover:text-stone-900 transition-colors">
              {tNav("about")}
            </Link>
            <span className="text-[10px] text-amber-800 border border-amber-300 bg-amber-50 px-2.5 py-0.5 rounded-full font-medium">
              Curated Fine Art & Editorial
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}


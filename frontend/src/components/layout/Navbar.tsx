"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useAuth } from "@/features/auth/AuthContext";
import { 
  Menu, X, User as UserIcon, PlusSquare,
  LogOut
} from "lucide-react";

export function Navbar() {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const handleLanguageChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const navLinks = [
    { href: "/", label: tNav("home") },
    { href: "/artworks", label: tNav("artworks") },
    { href: "/books", label: tNav("books") },
    { href: "/articles", label: tNav("articles") },
    { href: "/artists", label: tNav("artists") },
    { href: "/lessons", label: tNav("lessons") },
    { href: "/facts", label: tNav("facts") },
    { href: "/about", label: tNav("about") },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EAE6DF] text-[#18181B] shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 xl:h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Name: Art Experts */}
          <Link href="/" className="group flex min-w-0 items-center gap-3 xl:shrink-0">
            <div className="relative w-11 h-11 shrink-0 rounded-xl overflow-hidden border border-amber-200/80 bg-white shadow-2xs group-hover:border-amber-400 group-hover:shadow-xs transition-all duration-300">
              <Image
                src="/art-expert-logo.png"
                alt="Art Experts Logo"
                fill
                className="object-contain p-0.5"
                priority
              />
            </div>
            <div>
              <span className="block font-serif text-lg sm:text-xl font-medium tracking-wider text-stone-900 uppercase">
                {tCommon("siteName")}
              </span>
            </div>
          </Link>

          {/* Desktop Auth Controls */}
          <div className="hidden xl:flex items-center gap-4">
            {/* Language Switcher */}
            <div className="flex items-center gap-1 border border-stone-200 rounded-full p-1 bg-stone-100/70 text-xs font-mono">
              {(["az", "en", "ru"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLanguageChange(l)}
                  className={`px-2.5 py-0.5 rounded-full transition-all uppercase text-[11px] ${
                    locale === l
                      ? "bg-white text-amber-800 font-bold border border-amber-300 shadow-2xs"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* User Status / Action Buttons */}
            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-stone-200">
                <Link
                  href="/publish"
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors shadow-2xs"
                >
                  <PlusSquare className="w-3.5 h-3.5 text-amber-700" />
                  <span>{tNav("publish")}</span>
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 text-xs text-stone-700 hover:text-stone-950 font-medium py-1.5"
                >
                  <UserIcon className="w-3.5 h-3.5 text-amber-700" />
                  <span className="max-w-48 truncate">{user.artist_profile?.full_name || tNav("profile")}</span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="text-stone-400 hover:text-rose-600 transition-colors p-1"
                  title={tNav("logout")}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
                <Link
                  href="/login"
                  className="text-xs text-stone-600 hover:text-stone-900 font-medium px-3 py-1.5 transition-colors"
                >
                  {tNav("login")}
                </Link>
                <Link
                  href="/register"
                  className="bg-stone-900 hover:bg-black text-white font-medium text-xs px-4 py-1.5 rounded-full transition-colors shadow-xs"
                >
                  {tNav("register")}
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="flex items-center gap-2 xl:hidden">
            {/* Language Switcher Mobile */}
            <div className="flex items-center gap-1 text-[11px] font-mono mr-1">
              {(["az", "en", "ru"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLanguageChange(l)}
                  className={`px-1.5 py-0.5 rounded uppercase ${
                    locale === l ? "text-amber-800 font-bold bg-amber-50" : "text-stone-500"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-stone-700 hover:text-stone-950 focus:outline-none"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6 text-stone-800" />}
            </button>
          </div>
        </div>

        <div className="hidden border-t border-stone-100 xl:block">
          {/* Desktop Navigation Links */}
          <nav className="mx-auto hidden max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-1 px-8 py-1 text-sm font-medium xl:flex">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href + "/"));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative whitespace-nowrap py-2 transition-colors ${
                    isActive
                      ? "text-amber-800 font-semibold"
                      : "text-stone-600 hover:text-stone-950"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-600 to-transparent rounded" />
                  )}
                </Link>
              );
            })}
          </nav>

        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="xl:hidden border-t border-stone-200 bg-[#FAF9F5] px-4 pt-4 pb-6 space-y-4 shadow-lg">
            <nav className="flex flex-col space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="py-2 text-sm text-stone-700 hover:text-amber-800 font-medium border-b border-stone-200/60"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="pt-2 flex flex-col gap-2">
              {user ? (
                <>
                  <Link
                    href="/publish"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-sm font-medium"
                  >
                    <PlusSquare className="w-4 h-4 text-amber-700" />
                    {tNav("publish")}
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center gap-2 w-full py-2 text-sm text-stone-800 font-medium"
                  >
                    <UserIcon className="w-4 h-4 text-amber-700" />
                    {user.artist_profile?.full_name || tNav("profile")}
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="flex items-center justify-center gap-2 w-full py-2 text-sm text-rose-600"
                  >
                    <LogOut className="w-4 h-4" />
                    {tNav("logout")}
                  </button>
                </>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2.5 rounded-lg border border-stone-300 text-sm font-medium text-stone-800 bg-white"
                  >
                    {tNav("login")}
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2.5 rounded-lg bg-stone-900 text-white text-sm font-semibold"
                  >
                    {tNav("register")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

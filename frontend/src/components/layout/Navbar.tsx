"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useAuth } from "@/features/auth/AuthContext";
import { 
  Menu, X, Search, User as UserIcon, PlusSquare, 
  LogOut, BookOpen, Feather, Palette
} from "lucide-react";

export function Navbar() {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tSearch = useTranslations("searchModal");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input when modal is opened
  useEffect(() => {
    if (searchModalOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [searchModalOpen]);

  // Handle ESC key to close search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && searchModalOpen) {
        setSearchModalOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchModalOpen]);

  const handleLanguageChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/artworks?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchModalOpen(false);
      setSearchQuery("");
      setMobileOpen(false);
    }
  };

  const navLinks = [
    { href: "/", label: tNav("home") },
    { href: "/artworks", label: tNav("artworks") },
    { href: "/books", label: tNav("books") },
    { href: "/articles", label: tNav("articles") },
    { href: "/artists", label: tNav("artists") },
    { href: "/about", label: tNav("about") },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#EAE6DF] text-[#18181B] shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Brand Logo & Name: Art Experts */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-amber-200/80 bg-white shadow-2xs group-hover:border-amber-400 group-hover:shadow-xs transition-all duration-300">
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
              <span className="block text-[10px] tracking-widest uppercase text-stone-500 -mt-1 font-sans font-medium">
                Fine Art & Author Archive
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors py-1 relative ${
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

          {/* Desktop Search Icon & Auth Controls */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Search Icon Trigger */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="p-2.5 rounded-full text-stone-500 hover:text-amber-800 hover:bg-stone-100 border border-stone-200/70 hover:border-amber-400/50 transition-all duration-300 group flex items-center gap-1.5"
              title={`${tCommon("search")} (Ctrl+K)`}
              aria-label={tCommon("search")}
            >
              <Search className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
            </button>

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
                  <span>{user.artist_profile?.full_name || tNav("profile")}</span>
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

          {/* Mobile menu toggle & Mobile search icon */}
          <div className="flex items-center gap-2 lg:hidden">
            {/* Search Icon Trigger Mobile */}
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="p-2 text-stone-600 hover:text-amber-800"
              aria-label={tCommon("search")}
            >
              <Search className="w-5 h-5" />
            </button>

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

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-stone-200 bg-[#FAF9F5] px-4 pt-4 pb-6 space-y-4 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setSearchModalOpen(true);
                setMobileOpen(false);
              }}
              className="w-full flex items-center gap-3 bg-white border border-stone-200 rounded-lg py-2.5 px-3.5 text-sm text-stone-500 hover:text-amber-800 hover:border-amber-400 transition-colors shadow-2xs"
            >
              <Search className="w-4 h-4 text-amber-700" />
              <span>{tSearch("placeholder")}</span>
            </button>

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

      {/* Animated Light Search Modal */}
      <div
        className={`fixed inset-0 z-[100] flex items-start justify-center pt-20 sm:pt-28 px-4 transition-all duration-300 ease-out ${
          searchModalOpen
            ? "opacity-100 backdrop-blur-sm bg-stone-900/40 pointer-events-auto"
            : "opacity-0 backdrop-blur-none bg-transparent pointer-events-none"
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSearchModalOpen(false);
          }
        }}
      >
        <div
          className={`max-w-2xl w-full bg-white border border-stone-200 rounded-2xl shadow-2xl p-6 sm:p-8 transition-all duration-300 ease-out transform ${
            searchModalOpen
              ? "scale-100 translate-y-0 opacity-100"
              : "scale-95 -translate-y-6 opacity-0"
          }`}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-6">
            <div className="flex items-center gap-2 text-amber-800">
              <Search className="w-5 h-5" />
              <h2 className="text-base font-serif font-medium tracking-wide text-stone-900">
                {tSearch("title")}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono text-stone-500 bg-stone-100 border border-stone-200">
                ESC
              </span>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors"
                aria-label="Bağla"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tSearch("placeholder")}
                className="w-full text-lg sm:text-xl font-serif text-stone-900 bg-transparent border-b-2 border-amber-500/40 pb-3.5 pl-10 pr-4 focus:outline-none focus:border-amber-600 transition-colors placeholder-stone-400"
              />
              <Search className="w-5 h-5 text-amber-700 absolute left-1 bottom-4 pointer-events-none" />
            </div>

            {/* Hint & Enter button */}
            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-stone-100 text-stone-700 border border-stone-200">
                  ENTER ↵
                </span>
                <span>{tSearch("hint")}</span>
              </div>
              <button
                type="submit"
                disabled={!searchQuery.trim()}
                className="px-4 py-1.5 rounded-full bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                {tCommon("search")}
              </button>
            </div>
          </form>

          {/* Quick Filter Shortcuts */}
          <div className="mt-8 pt-6 border-t border-stone-100">
            <span className="block text-[11px] font-mono uppercase tracking-wider text-stone-400 mb-3">
              {tSearch("quickFilters")}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSearchModalOpen(false);
                  router.push("/artworks");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-xs text-stone-700 hover:text-stone-950 transition-colors"
              >
                <Palette className="w-3.5 h-3.5 text-amber-700" />
                <span>{tSearch("allArtworks")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchModalOpen(false);
                  router.push("/books");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-xs text-stone-700 hover:text-stone-950 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                <span>{tSearch("books")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchModalOpen(false);
                  router.push("/articles");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-xs text-stone-700 hover:text-stone-950 transition-colors"
              >
                <Feather className="w-3.5 h-3.5 text-amber-700" />
                <span>{tSearch("articles")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchModalOpen(false);
                  router.push("/artists");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 text-xs text-stone-700 hover:text-stone-950 transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 text-amber-700" />
                <span>{tSearch("artists")}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


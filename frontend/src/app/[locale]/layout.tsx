import React from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/features/auth/AuthContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ContentProtection } from "@/components/shared/ContentProtection";
import { siteConfig } from "@/config/site";
import "@/app/globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: {
      default: "Art Experts — İncəsənət Platforması və Müəllif Arxivi",
      template: "%s | Art Experts",
    },
    description: "Milli və müasir rəssamlıq sənətinin rəqəmsal arxivi, müəllif kitabları və yaradıcılar üçün kurasiya olunmuş sənət məkanı.",
    metadataBase: new URL(siteConfig.siteUrl),
    icons: {
      icon: [
        { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
        { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      ],
      shortcut: "/favicon.ico",
      apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    },
    alternates: {
      canonical: `/${locale}`,
      languages: {
        az: "/az",
        en: "/en",
        ru: "/ru",
      },
    },
    openGraph: {
      title: "Art Experts — İncəsənət Platforması",
      description: "Milli və müasir rəssamlıq sənətinin rəqəmsal arxivi və yaradıcılar üçün sənət məkanı.",
      url: siteConfig.siteUrl,
      siteName: siteConfig.name,
      locale: locale === "az" ? "az_AZ" : locale === "ru" ? "ru_RU" : "en_US",
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className="light">
      <body className="site-shell min-h-screen flex flex-col bg-[#FAF9F5] text-[#18181B] antialiased selection:bg-[#D4AF37] selection:text-white">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <ContentProtection />
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

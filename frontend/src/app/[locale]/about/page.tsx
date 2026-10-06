import React from "react";
import { setRequestLocale } from "next-intl/server";
import { ArtistSupportInitiative } from "@/components/shared/ArtistSupportInitiative";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: locale === "az" ? "Haqqımızda" : locale === "ru" ? "О нас" : "About Us",
    description: "Azərbaycan rəssamlarını və təsviri incəsənət yaradıcılığını təqdim edən platforma.",
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-12">
      <section className="space-y-5">
        <h1 className="text-3xl sm:text-5xl font-serif text-stone-900">Haqqımızda</h1>
        <p className="text-base sm:text-lg text-stone-700 leading-relaxed">
          Bu platforma Azərbaycan rəssamlarının və təsviri incəsənət sahəsində fəaliyyət göstərən yaradıcı insanların əsərlərini, kitablarını və yaradıcılıq irsini daha geniş auditoriyaya təqdim etmək məqsədi ilə yaradılmışdır. Platformada rəssamlar qeydiyyatdan keçərək öz kitablarını, rəsmlərini və digər yaradıcılıq nümunələrini paylaşa, şəxsi yaradıcılıq profillərini formalaşdıra bilərlər.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl sm:text-3xl font-serif text-stone-900">Vizyonumuz</h2>
        <p className="text-base text-stone-700 leading-relaxed">
          Azərbaycan təsviri incəsənətinin və rəssamlıq ənənələrinin rəqəmsal mühitdə tanıdıldığı, rəssamların öz yaradıcılıqlarını sərbəst şəkildə təqdim edə bildiyi vahid və əlçatan platforma yaratmaq. Məqsədimiz həm tanınmış, həm də gənc rəssamların yaradıcılığını geniş auditoriyaya çatdırmaq və onların əsərlərinin gələcək nəsillərə ötürülməsinə töhfə verməkdir.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl sm:text-3xl font-serif text-stone-900">Missiyamız</h2>
        <p className="text-base text-stone-700 leading-relaxed">
          Rəssamlar üçün yaradıcılıqlarını nümayiş etdirmək, kitab və əsərlərini paylaşmaq və öz auditoriyaları ilə əlaqə yaratmaq üçün əlverişli rəqəmsal mühit formalaşdırmaq. Eyni zamanda, təsviri incəsənətə maraq göstərən hər kəs üçün Azərbaycan rəssamlarının yaradıcılığına, kitablarına və sənət əsərlərinə asan çıxış imkanı yaratmaq.
        </p>
      </section>

      <p className="border-t border-stone-200 pt-8 text-base text-stone-700 leading-relaxed">
        Platformamız sənətkarları və sənətsevərləri bir araya gətirərək Azərbaycan rəssamlığının rəqəmsal irsinin formalaşmasına və təbliğinə xidmət edir.
      </p>

      <ArtistSupportInitiative />
    </div>
  );
}

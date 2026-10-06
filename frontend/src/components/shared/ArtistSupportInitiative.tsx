import { ArrowRight, HeartHandshake } from "lucide-react";
import { Link } from "@/i18n/routing";

export function ArtistSupportInitiative() {
  return (
    <section className="w-full">
      <div className="rounded-3xl border border-amber-300/80 bg-gradient-to-tr from-[#FFFDF8] via-[#FAF6ED] to-[#F5EFE1] p-8 shadow-xs sm:p-12 lg:p-14">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/60 bg-orange-100/60 px-4 py-1.5 text-xs font-serif font-semibold uppercase tracking-widest text-orange-900">
            <HeartHandshake className="h-4 w-4 text-orange-700" />
            <span>Sənətçilərə Dəstək Təşəbbüsü</span>
          </div>

          <h2 className="text-2xl font-serif leading-tight text-stone-900 sm:text-4xl">
            İlqar Məmmədovun Sənətçilərə Dəstək Təşəbbüsü
          </h2>

          <p className="text-sm leading-relaxed text-stone-700 sm:text-base">
            Art Experts platforması rəssam İlqar Məmmədov tərəfindən istedadlı gənclərin və müəlliflərin özlərini dünyaya tanıtması, əsərlərini və kitablarını peşəkar şəkildə təqdim etməsi məqsədilə təsis edilmişdir.
          </p>

          <div className="rounded-2xl border border-amber-300/70 bg-white/75 p-4 text-xs leading-relaxed text-stone-700 sm:p-5 sm:text-sm">
            İlqar Məmmədovun yaradıcılıq və pedaqoji fəaliyyəti Azərbaycan təsviri incəsənət təhsilinin inkişafına xidmət edən dəyərli nümunələrdəndir. Onun kitabları həm tələbələr, həm də rəsm və təsviri incəsənət sahəsi ilə maraqlananlar üçün faydalı mənbə kimi xüsusi əhəmiyyət daşıyır.
          </div>

          <Link
            href="/about"
            className="inline-flex items-center gap-3 rounded-full bg-stone-900 px-7 py-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-black"
          >
            <span>Haqqında və Missiya</span>
            <ArrowRight className="h-4 w-4 text-amber-300" />
          </Link>
        </div>
      </div>
    </section>
  );
}

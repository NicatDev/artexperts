"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/features/auth/AuthContext";
import { ContentEditor, type ContentKind } from "@/features/content/ContentEditor";

export default function PublishPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const publish = useTranslations("publish");
  const common = useTranslations("common");
  const t = useTranslations("editor");
  const [kind, setKind] = useState<ContentKind>("artworks");
  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [isLoading, user, router]);
  if (isLoading || !user) return <p className="py-24 text-center text-sm">{common("loading")}</p>;
  return <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
    <h1 className="font-serif text-2xl sm:text-3xl">{publish("title")}</h1>
    <p className="text-sm text-stone-600">{publish("subtitle")}</p>
    <div className="grid grid-cols-3 gap-2">{(["artworks", "books", "articles"] as const).map(value => <button key={value} onClick={() => setKind(value)} className={`min-h-12 rounded-xl border px-2 text-xs sm:text-sm ${kind === value ? "border-amber-400 bg-amber-50 text-amber-900" : "bg-white text-stone-600"}`}>{t(value)}</button>)}</div>
    <ContentEditor key={kind} kind={kind} isStaff={user.is_staff} onCancel={() => router.push("/profile")} onSaved={() => router.push("/profile")} />
  </div>;
}

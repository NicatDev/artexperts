import { pageMetadata } from "@/lib/seo";
import { LearningList } from '@/components/shared/LearningPages';
import { getTranslations } from 'next-intl/server';
export const dynamic='force-dynamic';
export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "learning" });
  return pageMetadata({ locale, path: "facts", title: t("facts"), description: t("factsIntro"), query: await searchParams });
}

export default function Page(props:{params:Promise<{locale:string}>;searchParams:Promise<{search?:string;page?:string}>}){return <LearningList kind="facts" {...props}/>;}

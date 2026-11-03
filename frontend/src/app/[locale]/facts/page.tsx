import { LearningList } from '@/components/shared/LearningPages';
import { getTranslations } from 'next-intl/server';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{locale:string}>}){const {locale}=await params;const t=await getTranslations({locale,namespace:'learning'});return {title:t('facts')};}
export default function Page(props:{params:Promise<{locale:string}>;searchParams:Promise<{search?:string;page?:string}>}){return <LearningList kind="facts" {...props}/>;}

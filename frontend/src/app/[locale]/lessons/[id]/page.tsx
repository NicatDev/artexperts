import { LearningDetail } from '@/components/shared/LearningPages';
import { api } from '@/lib/api';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{locale:string;id:string}>}){const {id}=await params;try{const entry=await api.learningDetail('lessons',id);return {title:entry.title,description:entry.summary||entry.title};}catch{return {};}}
export default function Page(props:{params:Promise<{locale:string;id:string}>}){return <LearningDetail kind="lessons" {...props}/>;}

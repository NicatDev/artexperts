import { pageMetadata } from "@/lib/seo";
import { entryCover } from "@/components/shared/LearningPages";
import { LearningDetail } from '@/components/shared/LearningPages';
import { api } from '@/lib/api';
export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{locale:string;id:string}>}){
 const {locale,id}=await params;
 try{const entry=await api.learningDetail('lessons',id);return pageMetadata({locale,path:`lessons/${entry.id}`,title:entry.title,description:entry.summary||entry.content,image:entryCover(entry).endsWith(".svg") ? undefined : entryCover(entry),type:'article'});}
 catch{return {robots:{index:false,follow:false}};}
}
export default function Page(props:{params:Promise<{locale:string;id:string}>}){return <LearningDetail kind="lessons" {...props}/>;}

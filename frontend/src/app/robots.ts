import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
export default function robots():MetadataRoute.Robots {
 const production=process.env.NODE_ENV==='production';
 return {rules:{userAgent:'*',allow:production?'/':undefined,disallow:production?['/api/','/admin/']:['/']},sitemap:`${siteConfig.siteUrl}/sitemap.xml`};
}

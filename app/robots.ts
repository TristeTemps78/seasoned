import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Les pages de resultats ne sont pas du contenu : les faire explorer gaspille
      // le budget de crawl et cree des doublons. Le SEO se joue sur `/serie/*`.
      disallow: '/recherche',
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Les pages de resultats ne sont pas du contenu : les faire explorer gaspille
      // le budget de crawl et cree des doublons. Le SEO se joue sur `/serie/*`.
      //
      // `/moi` et `/hors-ligne` sont vides vues d'un robot — la bibliotheque se
      // remplit dans le navigateur, jamais sur le serveur. Les faire indexer
      // n'apporterait rien et donnerait des pages sans contenu dans l'index.
      disallow: ['/recherche', '/moi', '/hors-ligne'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

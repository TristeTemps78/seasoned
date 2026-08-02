import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';

/**
 * Chemins sans interet pour un moteur, **dans toutes les langues**.
 *
 * ⚠️ La liste etait ecrite en dur (`/recherche`, `/moi`, `/hors-ligne`) et ne couvrait
 * donc que l'anglais depuis le routage par locale : `/fr/recherche`, `/fr/moi` et
 * `/fr/hors-ligne` restaient explorables. Le budget de crawl — qui doit aller sur
 * `/serie/*`, le canal d'acquisition n°1 — partait sur des pages vides par construction,
 * et l'index se remplissait de doublons de resultats de recherche.
 *
 * Un defaut discret, du meme genre que le sitemap a une seule URL : le fichier existait,
 * il avait l'air juste, et il ne couvrait que la moitie du site. Les declinaisons sont
 * donc **derivees** de la liste des langues, pour qu'ajouter une langue ne puisse pas
 * rouvrir le trou en silence.
 */
const PRIVATE_PATHS = ['/recherche', '/moi', '/hors-ligne'];

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
      //
      // `/convertir` n'y est PAS : c'est du contenu, et la seule page non-serie qui
      // reponde a une intention de recherche reelle.
      disallow: PRIVATE_PATHS.flatMap((path) =>
        SUPPORTED_LOCALES.map((locale) => pathIn(path, locale)),
      ),
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

import type { MetadataRoute } from 'next';
import { discover } from '@/lib/catalog';
import { siteUrl } from '@/lib/site';
import { SUPPORTED_LOCALES, type Locale } from '@/lib/i18n';
import { pathIn } from '@/lib/routes';

/**
 * Regeneration quotidienne. Le sitemap est un fichier, pas une requete par visiteur.
 */
export const revalidate = 86_400;

/**
 * Nombre de pages de resultats parcourues par liste (20 series chacune).
 *
 * Trois listes x 3 pages = 9 appels par jour, pour ~180 series. C'est le compromis
 * entre deux contraintes opposees :
 *
 *   - **enumerer le catalogue TMDB est interdit** par leurs conditions, en plus d'etre
 *     hors budget ;
 *   - **un sitemap qui ne contient que l'accueil ne sert a rien** — c'etait le cas
 *     jusqu'a l'audit du 2026-08-01, et le canal d'acquisition n°1 en dependait.
 *
 * On publie donc ce qui a une chance reelle d'etre cherche, pas tout ce qui existe.
 */
const PAGES_PER_LIST = 3;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const lists = await Promise.all(
    (['trending', 'popular', 'on_the_air'] as const).flatMap((kind) =>
      Array.from({ length: PAGES_PER_LIST }, (_, i) => discover(kind, i + 1)),
    ),
  );

  /**
   * Les equivalents d'une page dans les autres langues, au format du sitemap.
   *
   * Google accepte les `hreflang` **soit** dans le HTML, **soit** dans le sitemap. Les
   * deux valent mieux qu'un : le sitemap est ce qui est lu en premier, et c'est lui qui
   * fait decouvrir les URL francaises — sans quoi elles n'existent que pour qui clique
   * sur le selecteur de langue, c'est-a-dire pour personne au moment ou il n'y a pas
   * encore de visiteurs.
   */
  /**
   * Une URL absolue, sous **une seule** forme.
   *
   * `base` ne porte pas de barre finale et `pathIn('/')` en rend une : concatener
   * naivement produisait `…/` dans les alternates face a `…` dans le `<loc>` — deux
   * ecritures de la meme adresse dans le meme document. Google normalise la racine, donc
   * l'effet est nul ; mais un sitemap qui se contredit lui-meme est une invitation a
   * chercher un bug ailleurs le jour ou il y en aura un.
   */
  const absolute = (path: string, locale: Locale): string => {
    const p = pathIn(path, locale);
    return p === '/' ? base : `${base}${p}`;
  };

  const languagesOf = (path: string): MetadataRoute.Sitemap[number]['alternates'] => ({
    languages: Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [locale, absolute(path, locale)]),
    ),
  });

  // Une serie peut figurer dans plusieurs listes : on ne la publie qu'une fois.
  const seen = new Set<string>();
  const seriesEntries: MetadataRoute.Sitemap = [];
  for (const list of lists) {
    for (const series of list) {
      if (seen.has(series.providerId)) continue;
      seen.add(series.providerId);
      const path = `/serie/${series.providerId}`;
      // Une seule entree par serie, portant ses variantes de langue — et non une entree
      // par langue, qui ferait passer deux traductions pour deux pages concurrentes.
      seriesEntries.push({
        url: `${base}${path}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
        alternates: languagesOf(path),
      });
    }
  }

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
      alternates: languagesOf('/'),
    },
    {
      // `/convertir` est la seule page **non-serie** qui reponde a une intention de
      // recherche reelle : 26,4 millions de personnes ont perdu leur historique a la
      // fermeture de TV Time. La laisser hors du sitemap la rendrait invisible a ceux
      // qui la cherchent — le meme cul-de-sac que l'audit SEO du 2026-08-01.
      url: `${base}/convertir`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates: languagesOf('/convertir'),
    },
    // Les pages legales : peu visitees, mais elles doivent etre **trouvables**, y
    // compris par quelqu'un qui cherche a qui s'adresser. Priorite basse, elles ne
    // disputent pas le budget de crawl aux pages serie.
    // `/regles` y figure pour la meme raison, et une plus forte : c'est la page qu'on
    // cherche quand on veut signaler quelque chose. Introuvable, elle ne sert a rien.
    ...['/mentions', '/confidentialite', '/regles'].map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
      alternates: languagesOf(path),
    })),
    ...seriesEntries,
  ];
}

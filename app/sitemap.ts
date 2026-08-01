import type { MetadataRoute } from 'next';
import { discover } from '@/lib/catalog';
import { siteUrl } from '@/lib/site';

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
 *     hors budget (`ROADMAP.md` §1.3) ;
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

  // Une serie peut figurer dans plusieurs listes : on ne la publie qu'une fois.
  const seen = new Set<string>();
  const seriesEntries: MetadataRoute.Sitemap = [];
  for (const list of lists) {
    for (const series of list) {
      if (seen.has(series.providerId)) continue;
      seen.add(series.providerId);
      seriesEntries.push({
        url: `${base}/serie/${series.providerId}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  }

  return [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...seriesEntries,
  ];
}

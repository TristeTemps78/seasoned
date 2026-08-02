import type { Metadata } from 'next';
import { searchSeries, withStatus, type SeriesWithStatus } from '@/lib/catalog';

/**
 * Nombre de resultats dont on va chercher le statut reel.
 *
 * Un appel par element, et cette page est **dynamique** : contrairement a l'accueil,
 * le cout est paye a chaque requete distincte. On le limite a ce que l'oeil parcourt
 * d'abord, le cache de donnees rendant les recherches repetees gratuites.
 */
const HYDRATED_RESULTS = 8;
import { SearchForm } from '@/app/components/SearchForm';
import { SeriesCard } from '@/app/components/SeriesCard';

interface PageProps {
  readonly searchParams: Promise<{ readonly q?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim();
  return {
    title: query !== undefined && query.length > 0 ? `« ${query} »` : 'Recherche',
    // Les pages de resultats ne sont pas du contenu : on ne les fait pas indexer.
    // Ce sont les pages serie qui portent le SEO (`ROADMAP.md` §0.2).
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  // Le catalogue est une dependance externe : il peut tomber, changer, ou n'etre pas
  // configure. Une recherche qui echoue doit rendre une page lisible, pas une 500 —
  // c'est la meme regle que le parsing tolerant du fournisseur : on degrade, on ne
  // casse pas. Le detail part dans les journaux du serveur, jamais a l'ecran.
  let results: readonly SeriesWithStatus[] = [];
  let total = 0;
  let unavailable = false;
  if (query.length > 0) {
    try {
      const found = await searchSeries(query);
      total = found.length;
      // Le statut n'est hydrate que sur les premiers resultats : cette page est
      // dynamique, donc un appel par element serait paye a chaque requete. Les
      // suivants gardent leur vignette, sans statut — degradation choisie plutot
      // que subie (`ROADMAP.md` §1.4).
      const [head, tail] = [found.slice(0, HYDRATED_RESULTS), found.slice(HYDRATED_RESULTS)];
      results = [...(await withStatus(head)), ...tail.map((summary) => ({ summary }))];
    } catch {
      unavailable = true;
    }
  }

  return (
    <div className="space-y-8">
      <SearchForm defaultValue={query} autoFocus={query.length === 0} />

      {query.length === 0 ? (
        <p className="text-(--color-muted)">Tapez le nom d’une série.</p>
      ) : unavailable ? (
        <p className="text-(--color-warn)">
          Le catalogue est momentanément indisponible. Réessayez dans un instant.
        </p>
      ) : results.length === 0 ? (
        <p className="text-(--color-muted)">
          Aucun résultat pour « {query} ».
        </p>
      ) : (
        <>
          <p className="text-sm text-(--color-muted)">
            {total} résultat{total > 1 ? 's' : ''} pour « {query} »
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-5">
            {results.map(({ summary, status }) => (
              <li key={summary.providerId}>
                <SeriesCard series={summary} {...(status !== undefined ? { status } : {})} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

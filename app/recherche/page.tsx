import type { Metadata } from 'next';
import { searchSeries } from '@/lib/catalog';
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
  let results: readonly Awaited<ReturnType<typeof searchSeries>>[number][] = [];
  let unavailable = false;
  if (query.length > 0) {
    try {
      results = await searchSeries(query);
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
            {results.length} résultat{results.length > 1 ? 's' : ''} pour « {query} »
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-5">
            {results.map((series) => (
              <li key={series.providerId}>
                <SeriesCard series={series} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

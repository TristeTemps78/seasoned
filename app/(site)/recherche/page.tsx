import type { Metadata } from 'next';
import { searchSeries, withStatus, type SeriesWithStatus } from '@/lib/catalog';
import { DEFAULT_LOCALE, t, tn, type Locale } from '@/lib/i18n';

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

export function searchMetadata(query: string | undefined, locale: Locale): Metadata {
  const clean = query?.trim();
  return {
    title:
      clean !== undefined && clean.length > 0
        ? t(locale, 'search.titleQuery', { q: clean })
        : t(locale, 'search.title'),
    // Les pages de resultats ne sont pas du contenu : on ne les fait pas indexer.
    // Ce sont les pages serie qui portent le SEO.
    robots: { index: false, follow: true },
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return searchMetadata(q, DEFAULT_LOCALE);
}

/**
 * La recherche, dans une langue.
 *
 * Exportee pour que `/fr/recherche` serve exactement la meme page. Sans cette adresse,
 * le formulaire d'une page francaise renvoyait vers la page anglaise — le francais
 * existait, et aucun chemin n'y restait.
 */
export async function SearchView({ query, locale }: {
  readonly query: string;
  readonly locale: Locale;
}) {
  // Le catalogue est une dependance externe : il peut tomber, changer, ou n'etre pas
  // configure. Une recherche qui echoue doit rendre une page lisible, pas une 500 —
  // c'est la meme regle que le parsing tolerant du fournisseur : on degrade, on ne
  // casse pas. Le detail part dans les journaux du serveur, jamais a l'ecran.
  let results: readonly SeriesWithStatus[] = [];
  let total = 0;
  let unavailable = false;
  if (query.length > 0) {
    try {
      const found = await searchSeries(query, locale);
      total = found.length;
      // Le statut n'est hydrate que sur les premiers resultats : cette page est
      // dynamique, donc un appel par element serait paye a chaque requete. Les
      // suivants gardent leur vignette, sans statut — degradation choisie plutot
      // que subie.
      const [head, tail] = [found.slice(0, HYDRATED_RESULTS), found.slice(HYDRATED_RESULTS)];
      results = [
        ...(await withStatus(head, new Date(), locale)),
        ...tail.map((summary) => ({ summary })),
      ];
    } catch {
      unavailable = true;
    }
  }

  return (
    <div className="space-y-8">
      {/* ⚠️ Borne a la meme largeur que sur l'accueil. Le formulaire prenait les 1024 px
          de la colonne pour saisir trois mots — un champ aussi large se lit comme une
          zone de texte, pas comme une recherche, et l'oeil doit traverser tout l'ecran
          pour aller du dernier caractere tape au bouton. */}
      <div className="max-w-2xl">
        <SearchForm defaultValue={query} autoFocus={query.length === 0} locale={locale} />
      </div>

      {query.length === 0 ? (
        <p className="text-(--color-muted)">{t(locale, 'search.prompt')}</p>
      ) : unavailable ? (
        <p className="text-(--color-warn)">{t(locale, 'search.unavailable')}</p>
      ) : results.length === 0 ? (
        <p className="text-(--color-muted)">{t(locale, 'search.none', { q: query })}</p>
      ) : (
        <>
          <p className="text-sm text-(--color-muted)">
            {tn(locale, 'search.count', total, { q: query })}
          </p>
          {/* ⚠️ Cette page avait sa propre grille (`sm:grid-cols-3 md:grid-cols-5`), donc
              une affiche changeait de taille selon la page d'ou l'on venait — le defaut que
              `.poster-grid` avait ete extraite pour empecher. */}
          <ul className="bleed poster-grid">
            {results.map(({ summary, status }) => (
              <li key={summary.providerId}>
                <SeriesCard
                  series={summary}
                  locale={locale}
                  {...(status !== undefined ? { status } : {})}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  return <SearchView query={q?.trim() ?? ''} locale={DEFAULT_LOCALE} />;
}

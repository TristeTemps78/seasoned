import type { Metadata } from 'next';
import Link from 'next/link';
import { browse } from '@/lib/catalog';
import { DEFAULT_LOCALE, t, tn, type Locale } from '@/lib/i18n';
import { PageHeader } from '@/app/components/PageHeader';
import { SeriesCard } from '@/app/components/SeriesCard';
import { EmptyState } from '@/app/components/EmptyState';
import { pathIn } from '@/lib/routes';
import {
  ALL_BROWSE_GENRES,
  ALL_BROWSE_SORTS,
  type BrowseGenre,
  type BrowseSort,
} from '@/src/catalog/provider';
import type { MessageKey } from '@/lib/i18n/engine';

/**
 * Parcourir le catalogue — **la seule facon d'arriver quelque part sans savoir ou l'on va**.
 *
 * ## Ce qui manquait
 *
 * Le produit avait deux portes : la recherche, qui exige de connaitre le titre, et trois
 * rangees editorialisees, qui montrent ce que *nous* avons choisi. Entre les deux, rien —
 * impossible de demander « les policiers britanniques des annees 2000 », qui est pourtant la
 * forme la plus banale d'une envie de serie. Letterboxd expose ces facettes des sa page
 * `/films/`, et c'est la premiere chose qu'on y fait apres avoir cherche un titre.
 *
 * ## ⛔ Aucun etat React : les facettes sont des LIENS
 *
 * Trois consequences, et les trois comptent :
 *
 *   1. **L'adresse porte la question.** `/parcourir?genre=crime&annees=2000` se partage,
 *      se met en favori et revient en arriere. Un filtre en `useState` ne fait aucun des
 *      trois, et c'est exactement le reproche que `routes.ts` adresse a la detection de
 *      langue : *changer de langue est un lien qu'on clique*.
 *   2. **Ca marche sans JavaScript**, comme le reste du site.
 *   3. **Le rendu reste serveur**, donc le catalogue est appele une fois par combinaison et
 *      mis en cache par `throughDiscover` — pas une fois par visiteur.
 *
 * ## Ce que cette page ne fait PAS
 *
 * Pas de filtre par service de streaming, alors que Letterboxd en a un. Il demanderait un
 * appel `/watch/providers` **par serie** pour etre exact, ou un parametre TMDB qui ne
 * connait qu'un pays a la fois — et le produit laisse deja la personne choisir plusieurs
 * pays (`Journal.regions`). Une facette qui repondrait juste pour un pays et faux pour les
 * autres serait pire que son absence.
 */
export const dynamic = 'force-dynamic';

interface PageProps {
  readonly searchParams: Promise<{
    readonly genre?: string;
    readonly annees?: string;
    readonly tri?: string;
  }>;
}

/**
 * Les decennies proposees.
 *
 * ⚠️ Bornees a ce qui rend quelque chose. Descendre sous 1960 rend des listes de deux ou
 * trois titres sur TMDB, et proposer une porte qui ne mene nulle part est precisement ce que
 * le filtre par annee du journal evite en ne listant que les annees vecues. La decennie en
 * cours est incluse : elle se remplit d'elle-meme.
 */
const DECADES: readonly number[] = [2020, 2010, 2000, 1990, 1980, 1970, 1960];

const GENRE_LABEL = {
  action: 'browse.genre.action',
  animation: 'browse.genre.animation',
  comedy: 'browse.genre.comedy',
  crime: 'browse.genre.crime',
  documentary: 'browse.genre.documentary',
  drama: 'browse.genre.drama',
  family: 'browse.genre.family',
  kids: 'browse.genre.kids',
  mystery: 'browse.genre.mystery',
  sci_fi: 'browse.genre.sciFi',
  war: 'browse.genre.war',
  western: 'browse.genre.western',
} as const satisfies Record<BrowseGenre, MessageKey>;

const SORT_LABEL = {
  popular: 'browse.sort.popular',
  rating: 'browse.sort.rating',
  recent: 'browse.sort.recent',
} as const satisfies Record<BrowseSort, MessageKey>;

/** Le genre demande, ou rien. Une valeur inconnue est **ignoree**, jamais devinee. */
function readGenre(raw: string | undefined): BrowseGenre | undefined {
  return ALL_BROWSE_GENRES.find((g) => g === raw);
}

function readSort(raw: string | undefined): BrowseSort | undefined {
  return ALL_BROWSE_SORTS.find((s) => s === raw);
}

/**
 * La decennie demandee, ou rien.
 *
 * ⚠️ Verifiee contre {@link DECADES} et pas seulement « est-ce un nombre » : sans ca,
 * `?annees=1` partirait chez TMDB en `0001-01-01`, qui rend zero resultat sans erreur — la
 * panne la plus difficile a voir, et une porte ouverte a des URL fabriquees.
 */
function readDecade(raw: string | undefined): number | undefined {
  const n = Number(raw);
  return DECADES.find((d) => d === n);
}

export function browseMetadata(locale: Locale): Metadata {
  return {
    title: t(locale, 'browse.title'),
    // Comme la recherche : ce sont des pages de resultats, pas du contenu. Le SEO vit sur
    // `/serie/*`, et faire explorer la combinatoire des facettes gaspillerait le budget de
    // crawl qui doit y aller. `follow` reste vrai : les liens vers les fiches comptent.
    robots: { index: false, follow: true },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return browseMetadata(DEFAULT_LOCALE);
}

export async function BrowseView({ params, locale }: {
  readonly params: { readonly genre?: string; readonly annees?: string; readonly tri?: string };
  readonly locale: Locale;
}) {
  const genre = readGenre(params.genre);
  const decade = readDecade(params.annees);
  const sort = readSort(params.tri) ?? 'popular';

  const results = await browse(
    {
      ...(genre !== undefined ? { genre } : {}),
      ...(decade !== undefined ? { decade } : {}),
      sort,
    },
    1,
    locale,
  );

  /** L'adresse de cette page avec **un** critere change, les autres preserves. */
  const withFacet = (
    change: { readonly genre?: string; readonly annees?: string; readonly tri?: string },
  ): string => {
    const next = new URLSearchParams();
    const g = 'genre' in change ? change.genre : genre;
    const a = 'annees' in change ? change.annees : decade?.toString();
    const s = 'tri' in change ? change.tri : sort;
    if (g !== undefined && g !== '') next.set('genre', g);
    if (a !== undefined && a !== '') next.set('annees', a);
    // `popular` est le defaut : ne pas l'ecrire garde l'adresse courte et rend une seule
    // URL canonique pour l'etat par defaut, au lieu de deux qui donnent la meme page.
    if (s !== undefined && s !== 'popular') next.set('tri', s);
    const query = next.toString();
    return `${pathIn('/parcourir', locale)}${query.length > 0 ? `?${query}` : ''}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t(locale, 'browse.title')} lede={t(locale, 'browse.lede')}>
        <div className="space-y-3 pt-3">
          <Facets
            label={t(locale, 'browse.genre')}
            all={t(locale, 'browse.any')}
            allHref={withFacet({ genre: '' })}
            allActive={genre === undefined}
            options={ALL_BROWSE_GENRES.map((g) => ({
              key: g,
              label: t(locale, GENRE_LABEL[g]),
              href: withFacet({ genre: g }),
              active: genre === g,
            }))}
          />
          <Facets
            label={t(locale, 'browse.decade')}
            all={t(locale, 'browse.any')}
            allHref={withFacet({ annees: '' })}
            allActive={decade === undefined}
            options={DECADES.map((d) => ({
              key: String(d),
              label: t(locale, 'browse.decadeLabel', { d }),
              href: withFacet({ annees: String(d) }),
              active: decade === d,
            }))}
          />
          <Facets
            label={t(locale, 'browse.sort')}
            options={ALL_BROWSE_SORTS.map((s) => ({
              key: s,
              label: t(locale, SORT_LABEL[s]),
              href: withFacet({ tri: s }),
              active: sort === s,
            }))}
          />
        </div>
      </PageHeader>

      {results.length === 0 ? (
        /* ⚠️ Le vide **de la combinaison**, jamais celui du catalogue. Les deux gestes qui en
           sortent sont a l'ecran juste au-dessus, donc une phrase suffit et un bouton
           menerait ailleurs qu'a l'endroit ou l'on agit (`EmptyState`, `actions` facultatif).
           Ca arrive pour de vrai : « western » + « annees 2020 » ne rend presque rien. */
        <EmptyState title={t(locale, 'browse.noneTitle')}>
          {t(locale, 'browse.noneBody')}
        </EmptyState>
      ) : (
        <>
          <p className="meta">{tn(locale, 'browse.count', results.length)}</p>
          {/* La grille partagee, jamais une grille locale : c'est le defaut pour lequel
              `.poster-grid` a ete extraite — une affiche changeait de taille selon la page
              d'ou l'on venait. */}
          <ul className="bleed poster-grid">
            {results.map((summary) => (
              <li key={summary.providerId}>
                <SeriesCard series={summary} locale={locale} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Une ligne de facettes : un libelle, puis des liens dont un seul est actif. */
function Facets({ label, all, allHref, allActive, options }: {
  readonly label: string;
  /** Le libelle du choix « aucun filtre ». Absent quand la facette en a toujours un (le tri). */
  readonly all?: string;
  readonly allHref?: string;
  readonly allActive?: boolean;
  readonly options: readonly {
    readonly key: string;
    readonly label: string;
    readonly href: string;
    readonly active: boolean;
  }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label shrink-0">{label}</span>
      {all !== undefined && allHref !== undefined ? (
        // ⚠️ `aria-current` et pas une classe : l'etat vit dans l'attribut d'accessibilite,
        // et l'apparence en derive (`.btn[aria-current='true']`). Deux sources pour un meme
        // etat finissent toujours par diverger, et c'est l'attribut qui dit la verite a un
        // lecteur d'ecran.
        <Link
          href={allHref}
          aria-current={allActive === true ? 'true' : undefined}
          className="btn rounded-full text-xs"
        >
          {all}
        </Link>
      ) : null}
      {options.map((option) => (
        <Link
          key={option.key}
          href={option.href}
          aria-current={option.active ? 'true' : undefined}
          className="btn rounded-full text-xs"
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

export default async function BrowsePage({ searchParams }: PageProps) {
  return <BrowseView params={await searchParams} locale={DEFAULT_LOCALE} />;
}

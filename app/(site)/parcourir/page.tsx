import type { Metadata } from 'next';
import { browse } from '@/lib/catalog';
import { DEFAULT_LOCALE, t, tn, type Locale } from '@/lib/i18n';
import { Menu } from '@/app/components/Menu';
import { PageHeader } from '@/app/components/PageHeader';
import { SeriesCard } from '@/app/components/SeriesCard';
import { EmptyState } from '@/app/components/EmptyState';
import { pathIn } from '@/lib/routes';
import {
  ALL_BROWSE_GENRES,
  ALL_BROWSE_RUNS,
  ALL_BROWSE_SORTS,
  type BrowseRun,
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
    readonly etat?: string;
    readonly page?: string;
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

const RUN_LABEL: Readonly<Record<BrowseRun, MessageKey>> = {
  ended: 'browse.run.ended',
  running: 'browse.run.running',
};

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

function readRun(raw: string | undefined): BrowseRun | undefined {
  return ALL_BROWSE_RUNS.find((r) => r === raw);
}

/**
 * Le numero de page, borne des deux cotes.
 *
 * ⚠️ Le plafond n'est pas de la prudence : TMDB refuse `page` au-dela de 500, et une adresse
 * fabriquee a la main ne doit pas transformer un parcours en erreur de fournisseur.
 */
function readPage(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(500, Math.max(1, Math.floor(n)));
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
  readonly params: {
    readonly genre?: string;
    readonly annees?: string;
    readonly tri?: string;
    readonly etat?: string;
    readonly page?: string;
  };
  readonly locale: Locale;
}) {
  const genre = readGenre(params.genre);
  const decade = readDecade(params.annees);
  const sort = readSort(params.tri) ?? 'popular';
  const run = readRun(params.etat);
  const page = readPage(params.page);

  const { items: results, hasMore } = await browse(
    {
      ...(genre !== undefined ? { genre } : {}),
      ...(decade !== undefined ? { decade } : {}),
      ...(run !== undefined ? { run } : {}),
      sort,
    },
    page,
    locale,
  );

  /**
   * L'adresse d'une autre page, **avec la question intacte**.
   *
   * ⚠️ Reconstruite depuis les criteres lus, jamais depuis `params` brut : recopier ce qui
   * arrive reinjecterait dans un `href` une valeur qu'on n'a pas validee, et suffirait a
   * faire de cette page un relais pour n'importe quelle chaine.
   */
  const pageHref = (n: number) => {
    const query = new URLSearchParams();
    if (genre !== undefined) query.set('genre', genre);
    if (decade !== undefined) query.set('annees', String(decade));
    if (run !== undefined) query.set('etat', run);
    if (sort !== 'popular') query.set('tri', sort);
    if (n > 1) query.set('page', String(n));
    const suffix = query.toString();
    return `${pathIn('/parcourir', locale)}${suffix === '' ? '' : `?${suffix}`}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t(locale, 'browse.title')} lede={t(locale, 'browse.lede')}>
        {/*
         * 🔴 **C'etaient vingt-quatre boutons empiles, et ils prenaient l'ecran entier.**
         * Mesure au navigateur le 2026-08-15, en 375 px : **803 px de commandes avant le
         * premier resultat, pour une fenetre de 812**. La page qui existe pour parcourir ne
         * montrait pas une seule serie sans defiler. Treize genres a 252 px, huit epoques a
         * 148, trois tris a 96.
         *
         * ⚠️ **Un `<form method="get">`, donc toujours zero etat React.** L'en-tete de ce
         * fichier tient : l'adresse porte la question, elle se partage, se met en favori et
         * revient en arriere — c'est l'envoi du formulaire qui la construit au lieu d'un
         * lien par combinaison. La page reste un composant **serveur pur** et marche le
         * JavaScript coupe, ce qu'un menu branche sur `router.push` ne ferait pas.
         *
         * ⚠️ Ce qu'on perd, et c'est assume : l'adresse porte desormais les criteres vides
         * (`?genre=&annees=&tri=popular`). Le commentaire d'origine tenait a une URL
         * canonique — un souci de moteur, or cette page est `robots: { index: false }`.
         * L'enjeu n'existe pas ici.
         */}
        <form method="get" action={pathIn('/parcourir', locale)} className="flex flex-wrap items-center gap-2 pt-3">
          <Menu
            id="browse-genre"
            label={t(locale, 'browse.genre')}
            name="genre"
            defaultValue={genre ?? ''}
            options={[
              { value: '', label: t(locale, 'browse.any') },
              ...ALL_BROWSE_GENRES.map((g) => ({ value: g, label: t(locale, GENRE_LABEL[g]) })),
            ]}
          />
          <Menu
            id="browse-decade"
            label={t(locale, 'browse.decade')}
            name="annees"
            defaultValue={decade === undefined ? '' : String(decade)}
            options={[
              { value: '', label: t(locale, 'browse.any') },
              ...DECADES.map((d) => ({ value: String(d), label: t(locale, 'browse.decadeLabel', { d }) })),
            ]}
          />
          {/* 🔴 La facette que personne d'autre n'offre, et la seule qui parle de la these du
              produit : « montre-moi des choses qui **se terminent** ». Genre, epoque et tri
              sont ce que tous les catalogues proposent ; celle-ci est ce que cette page
              existe pour rendre possible, et elle n'etait posable nulle part. */}
          <Menu
            id="browse-run"
            label={t(locale, 'browse.run')}
            name="etat"
            defaultValue={run ?? ''}
            options={[
              { value: '', label: t(locale, 'browse.any') },
              ...ALL_BROWSE_RUNS.map((r) => ({ value: r, label: t(locale, RUN_LABEL[r]) })),
            ]}
          />
          <Menu
            id="browse-sort"
            label={t(locale, 'browse.sort')}
            name="tri"
            defaultValue={sort}
            options={ALL_BROWSE_SORTS.map((s) => ({ value: s, label: t(locale, SORT_LABEL[s]) }))}
          />
          {/* ⚠️ Le bouton reste **visible**, il ne se cache pas quand JavaScript repond. Le
              faire disparaitre demanderait de savoir si JS tourne — donc du JS —, et laisser
              un envoi automatique **sans** bouton casserait la page pour qui n'en a pas. Un
              geste explicite, le meme pour tout le monde. */}
          <button type="submit" className="btn btn-primary">
            {t(locale, 'browse.apply')}
          </button>
        </form>
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
          <p className="meta">
            {tn(locale, 'browse.count', results.length)}
            {page > 1 ? (
              <span className="text-(--color-muted)">
                {' · '}
                {t(locale, 'browse.page', { n: page })}
              </span>
            ) : null}
          </p>
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

          {/* 🔴 **La page s'arretait a dix-huit series, sans page 2.** Un catalogue de dizaines
              de milliers de titres rendait dix-huit reponses et n'avait aucune suite : la seule
              facon d'en voir d'autres etait de changer les criteres, c'est-a-dire de renoncer a
              la question qu'on posait.

              ⚠️ Des LIENS, pas un bouton : la page est un composant serveur pur et marche sans
              JavaScript. L'adresse porte donc toujours la question — c'est ce qui la rend
              partageable, et c'est deja la raison d'etre du formulaire GET juste au-dessus.

              ⚠️ « Suivante » ne s'affiche que si le fournisseur a rendu une page pleine :
              proposer une suite qui n'existe pas serait un bouton qui a l'air de marcher. */}
          {page > 1 || hasMore ? (
            <nav className="flex items-center gap-3" aria-label={t(locale, 'browse.pages')}>
              {page > 1 ? (
                <a className="btn" href={pageHref(page - 1)} rel="prev">
                  {t(locale, 'browse.previous')}
                </a>
              ) : null}
              {hasMore ? (
                <a className="btn" href={pageHref(page + 1)} rel="next">
                  {t(locale, 'browse.next')}
                </a>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

export default async function BrowsePage({ searchParams }: PageProps) {
  return <BrowseView params={await searchParams} locale={DEFAULT_LOCALE} />;
}

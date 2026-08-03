import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  alsoByCreators,
  episodeRatings,
  getSeriesPageData,
  posterDimensions,
  posterUrl,
  publicTrajectory,
  stopPointAdvice,
  watchOptions,
} from '@/lib/catalog';
import { SeriesCard } from '@/app/components/SeriesCard';
import { formatCommitment, formatDate, statusLabel, year } from '@/lib/format';
import { DEFAULT_LOCALE, localeTag, t, tn, watchRegion, type Locale } from '@/lib/i18n';
import { judgeCurrentSeason } from '@/src/domain/current-season';
import { findEntryPoint } from '@/src/domain/entry-point';
import { serializeJsonLd } from '@/lib/jsonld';
import { alternatesFor } from '@/lib/routes';
import { TmdbError } from '@/src/catalog/tmdb';
import { starsFromTen } from '@/src/domain/rating-scale';
import { StatusBadge } from '@/app/components/StatusBadge';
import { SeasonList } from '@/app/components/SeasonList';
import { TrajectorySection } from '@/app/components/TrajectorySection';
import { WatchOptions } from '@/app/components/WatchOptions';
import { MyProgress } from '@/app/components/MyProgress';

/**
 * Regeneration toutes les 24 h.
 *
 * C'est une decision de budget, pas de fraicheur (`ROADMAP.md` §1.4) : la page est
 * servie depuis le cache de bord, donc le trafic ne declenche pas d'appel a TMDB. Une
 * grille de diffusion ne bouge pas plus d'une fois par jour.
 */
export const revalidate = 86_400;

/**
 * ⚠️ Indispensable, et pas une optimisation.
 *
 * `revalidate` **ne suffit pas** sur une route dynamique : sans `generateStaticParams`,
 * Next la rend a la demande et ne la met jamais en cache. Verifie en production le
 * 2026-08-02 — la page repondait `X-Vercel-Cache: MISS` et `Cache-Control: no-store`
 * pendant que l'accueil, route statique, repondait `PRERENDER`.
 *
 * `force-static` retablit le comportement attendu : rendu a la premiere demande, puis
 * servi depuis le cache jusqu'a expiration. `dynamicParams` restant vrai par defaut,
 * une serie encore inconnue est rendue a la volee puis mise en cache a son tour — on
 * ne pre-genere donc rien, ce que le budget interdirait de toute facon.
 */
export const dynamic = 'force-static';

interface PageProps {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Charge la page, en distinguant les deux echecs possibles.
 *
 * `'missing'` — la serie n'existe pas : c'est une 404 legitime, indexable comme telle.
 * `'unavailable'` — le catalogue est en panne ou mal configure : surtout **pas** une
 * 404, qui dirait a un moteur de recherche de desindexer une page valide. On degrade.
 */
/**
 * Un identifiant de serie est un entier positif.
 *
 * Sans cette verification, `/serie/1396%2F..%2F..%2Fetc` repondait **200** au lieu de
 * 404 (constate en production le 2026-08-02) : l'appel partait chez le fournisseur,
 * echouait, et la page de repli « catalogue indisponible » etait servie avec un code
 * de succes. Une URL inventee devenait ainsi une page indexable — de quoi remplir
 * l'index de pages vides.
 */
function isValidSeriesId(id: string): boolean {
  return /^[0-9]+$/.test(id);
}

async function load(id: string, locale: Locale) {
  if (!isValidSeriesId(id)) return { kind: 'missing' as const };
  try {
    return { kind: 'ok' as const, data: await getSeriesPageData(id, new Date(), locale) };
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) {
      return { kind: 'missing' as const };
    }
    return { kind: 'unavailable' as const };
  }
}

/**
 * Les metadonnees d'une page serie, dans une langue.
 *
 * Exportee pour que la route francaise (`app/fr/serie/[id]`) serve **exactement** la
 * meme page dans une autre langue, au lieu d'en entretenir une copie qui divergera.
 */
export async function seriesMetadata(id: string, locale: Locale): Promise<Metadata> {
  const loaded = await load(id, locale);
  if (loaded.kind !== 'ok') return { title: t(locale, 'series.unavailableTitle') };

  const { detail, seasons, status, episodeCount, totalRuntimeMinutes } = loaded.data;
  const started = year(detail.firstAirDate);

  // La description est ecrite pour la page de resultats d'un moteur : elle repond
  // immediatement aux deux questions qu'on pose a une serie — ou elle en est, et
  // combien elle coute. C'est le canal d'acquisition n°1 (`ROADMAP.md` §0.2).
  const parts = [
    statusLabel(status.status, locale).toLowerCase(),
    tn(locale, 'series.seasons', seasons.rateable.length),
    tn(locale, 'series.episodes', episodeCount),
    ...(totalRuntimeMinutes !== undefined
      ? [formatCommitment(totalRuntimeMinutes, locale)]
      : []),
  ];

  const title = started !== undefined ? `${detail.title} (${started})` : detail.title;
  const description = `${detail.title} — ${parts.join(', ')}.`;
  const image = posterUrl(detail.posterPath, 'w500');
  // Canonique **de cette langue**, et declaration reciproque des autres. Pointer toutes
  // les canoniques vers l'anglais reviendrait a demander la desindexation du francais.
  const alternates = alternatesFor(`/serie/${id}`, locale);

  return {
    title,
    description,
    alternates,
    // Un lien partage sans apercu ne circule pas. L'affiche est verticale (2:3),
    // d'ou `summary` et non `summary_large_image` : une carte large la rognerait.
    openGraph: {
      type: 'video.tv_show',
      title,
      description,
      url: alternates.canonical,
      locale: localeTag(locale).replace('-', '_'),
      ...(image !== undefined
        ? { images: [{ url: image, ...posterDimensions('w500'), alt: detail.title }] }
        : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(image !== undefined ? { images: [image] } : {}),
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return seriesMetadata(id, DEFAULT_LOCALE);
}

export async function SeriesView({ id, locale }: {
  readonly id: string;
  readonly locale: Locale;
}) {
  const loaded = await load(id, locale);

  if (loaded.kind === 'missing') notFound();
  if (loaded.kind === 'unavailable') {
    return (
      <div className="mx-auto max-w-2xl py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t(locale, 'series.unavailableHeading')}
        </h1>
        <p className="text-(--color-muted)">{t(locale, 'series.unavailableBody')}</p>
      </div>
    );
  }

  const { detail, seasons, status, episodeCount, totalRuntimeMinutes } = loaded.data;
  const poster = posterUrl(detail.posterPath, 'w342');
  const started = year(detail.firstAirDate);
  // Sur la meme echelle que les notes de l'utilisateur : comparer un 8,4/10 a un
  // 4,5/5 ne veut rien dire, et la conversion doit se faire une seule fois.
  const publicStars = starsFromTen(detail.voteAverage);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: detail.title,
    ...(detail.overview !== undefined ? { description: detail.overview } : {}),
    ...(started !== undefined ? { datePublished: String(started) } : {}),
    numberOfSeasons: seasons.rateable.length,
    numberOfEpisodes: episodeCount,
  };

  return (
    <article className="space-y-10">
      <script
        type="application/ld+json"
        // ⚠️ `serializeJsonLd` et non `JSON.stringify` : ce dernier n'echappe pas `<`,
        // donc un titre TMDB valant `</script><script>…` refermait la balise et faisait
        // executer ce qui suit — sur toutes les pages servies depuis le cache de bord.
        // Les titres viennent de contributeurs : au sens de la securite, c'est une
        // entree non fiable, et le parsing tolerant ne protege que du mal forme.
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <header className="flex flex-col gap-6 sm:flex-row">
        {poster !== undefined ? (
          // C'est le plus gros element visible au chargement, donc celui que Google
          // chronometre. `fetchPriority="high"` le sort de la file d'attente ; les
          // dimensions declarees empechent la page de sauter quand il arrive.
          <img
            src={poster}
            alt=""
            fetchPriority="high"
            decoding="async"
            width={posterDimensions('w342').width}
            height={posterDimensions('w342').height}
            className="w-36 shrink-0 self-start rounded-lg border border-(--color-edge)"
          />
        ) : null}

        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {detail.title}
              {started !== undefined ? (
                <span className="ml-2 font-normal text-(--color-muted)">{started}</span>
              ) : null}
            </h1>
            {detail.originalTitle !== undefined && detail.originalTitle !== detail.title ? (
              <p className="text-sm text-(--color-muted)">{detail.originalTitle}</p>
            ) : null}
          </div>

          {/* Le differenciateur immediat : personne n'affiche correctement la
              difference entre « entre deux saisons » et « morte depuis 18 mois ». */}
          {/* ⚠️ `locale` n'etait pas transmis : le badge — le differenciateur meme du
              produit — s'affichait en anglais sur les pages francaises. Un defaut que
              ni le typage ni les tests ne pouvaient voir, la valeur par defaut etant
              legale. */}
          <StatusBadge status={status} withDetail locale={locale} />

          {/* La seule information du site qui donne une raison de revenir a une date
              precise. « Dans trois jours » laissait le lecteur calculer et ignorer de
              quel episode il s'agit. */}
          {detail.nextEpisode !== undefined ? (
            <p className="rounded-md bg-(--color-live)/10 px-3 py-2 text-sm">
              <strong>
                S{detail.nextEpisode.seasonNumber}E{detail.nextEpisode.episodeNumber}
              </strong>
              {detail.nextEpisode.title !== undefined
                ? ` — ${detail.nextEpisode.title}`
                : ''}{' '}
              <span className="text-(--color-muted)">
                {t(locale, 'series.airsOn', {
                  date: formatDate(detail.nextEpisode.airsOn, locale),
                })}
              </span>
            </p>
          ) : null}

          {detail.overview !== undefined ? (
            <p className="max-w-prose leading-relaxed text-(--color-muted)">
              {detail.overview}
            </p>
          ) : null}
        </div>
      </header>

      <section aria-label={t(locale, 'series.demands')}>
        {/* Titre masque visuellement : les chiffres se lisent d'eux-memes, mais la
            structure du document doit rester coherente pour qui navigue au clavier
            ou au lecteur d'ecran — et pour les moteurs, qui lisent la hierarchie. */}
        <h2 className="sr-only">{t(locale, 'series.demands')}</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t(locale, 'stat.seasons')} value={String(seasons.rateable.length)} />
          <Stat label={t(locale, 'stat.episodes')} value={String(episodeCount)} />
          {totalRuntimeMinutes !== undefined ? (
            // Le tilde n'est pas cosmetique : le total est une estimation (mediane
            // d'une saison x nombre d'episodes), et l'annoncer comme exact serait
            // mentir sur la seule promesse chiffree de la page d'accueil.
            <Stat
              label={t(locale, 'stat.commitment')}
              value={`~ ${formatCommitment(totalRuntimeMinutes, locale)}`}
              emphasis
            />
          ) : null}
          {detail.lastAiredAt !== undefined ? (
            <Stat
              label={t(locale, 'stat.lastEpisode')}
              value={formatDate(detail.lastAiredAt, locale)}
            />
          ) : null}
        </dl>
      </section>

      {/* Le seul element de la page qui vous connaisse. Il s'ajoute cote navigateur :
          la page elle-meme reste statique et mise en cache, et **aucune donnee de
          journal ne traverse le serveur** — le HTML est partage entre tous les
          visiteurs par le cache de bord. */}
      <MyProgress
        seriesId={id}
        seasons={seasons.rateable.map((s) => ({
          seasonNumber: s.ref.seasonNumber,
          episodeCount: s.episodeCount,
        }))}
        // Ce que la page sait deja : memorise tel quel, la bibliotheque pourra
        // dessiner cette serie sans un seul appel (`src/domain/library.ts`).
        series={{
          title: detail.title,
          ...(detail.posterPath !== undefined ? { posterPath: detail.posterPath } : {}),
          statusLabel: statusLabel(status.status, locale),
          ...(detail.nextEpisode !== undefined
            ? { nextEpisodeAt: detail.nextEpisode.airsOn.toISOString() }
            : {}),
          ...(publicStars !== undefined ? { publicStars } : {}),
        }}
        // Mediane deduite du total : `lib/catalog.ts` l'a deja calculee sur une saison
        // representative, la redemander couterait un appel pour rien.
        {...(totalRuntimeMinutes !== undefined && episodeCount > 0
          ? { episodeMinutes: totalRuntimeMinutes / episodeCount }
          : {})}
      />

      <WatchHere id={id} locale={locale} />

      <Trajectory
        id={id}
        title={detail.title}
        seasons={seasons}
        locale={locale}
        episodeCount={episodeCount}
        {...(totalRuntimeMinutes !== undefined ? { totalRuntimeMinutes } : { totalRuntimeMinutes: undefined })}
        airingSeason={detail.nextEpisode?.seasonNumber}
      />

      <SeasonList seasons={seasons} locale={locale} />

      <AlsoByCreators detail={detail} locale={locale} />
    </article>
  );
}

export default async function SeriesPage({ params }: PageProps) {
  const { id } = await params;
  return <SeriesView id={id} locale={DEFAULT_LOCALE} />;
}

/**
 * Le seul maillage interne du site.
 *
 * Une page serie ne renvoyait vers aucune autre : cul-de-sac pour le visiteur comme
 * pour le crawl. « Du meme createur » est un **credit de production**, pas un calcul
 * de similarite — ce qui le distingue de la recommandation algorithmique, ecartee
 * par `ROADMAP.md` §3.
 */
async function AlsoByCreators({ detail, locale }: {
  readonly detail: Awaited<ReturnType<typeof getSeriesPageData>>['detail'];
  readonly locale: Locale;
}) {
  const others = await alsoByCreators(detail, 6, locale);
  if (others.length === 0) return null;

  const names = (detail.creators ?? [])
    .slice(0, 2)
    .map((c) => c.name)
    .join(t(locale, 'join.and'));

  return (
    <section className="space-y-4" aria-label={t(locale, 'series.sameCreator')}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          {t(locale, 'series.sameCreator')}
        </h2>
        {names.length > 0 ? (
          <p className="text-sm text-(--color-muted)">{names}</p>
        ) : null}
      </div>
      <ul className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
        {others.map((series) => (
          <li key={series.providerId}>
            <SeriesCard series={series} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Ou regarder la serie — le dernier maillon de la decision.
 *
 * ⚠️ **La region suit la langue, faute de mieux.** Un francophone belge n'a pas le
 * catalogue francais (`lib/i18n.ts`, {@link watchRegion}) : c'est un repli assume, pas
 * une verite. Ce qui ne l'etait pas, en revanche : la region reelle etait la France pour
 * tout le monde, tandis que la mention affichee disait « en France » a un lecteur
 * americain. Les deux sont desormais la meme valeur, et elle est affichee.
 */
async function WatchHere({ id, locale }: {
  readonly id: string;
  readonly locale: Locale;
}) {
  const region = watchRegion(locale);
  return <WatchOptions options={await watchOptions(id, region)} region={region} />;
}

/**
 * La trajectoire, **coupee a l'horizon du spectateur**.
 *
 * `docs/RATING-MODEL.md` §6bis pose la regle : rien qui depasse la position du
 * spectateur ne s'affiche sans qu'il le demande. Or la courbe est elle-meme un
 * spoiler — montrer qu'elle s'effondre en saison 5 est une information que quelqu'un
 * en saison 2 n'a pas demandee, et le decrochage annonce en toutes lettres qu'il va
 * etre decu, et quand.
 *
 * Ce composant ne fait que **charger** : c'est `TrajectorySection`, cote navigateur,
 * qui decide de ce qui s'affiche — lui seul connait la position, qui ne doit jamais
 * traverser le serveur. Sans position, tout reste derriere le geste explicite ; avec,
 * la courbe se decouvre a mesure qu'on avance.
 */
async function Trajectory({ id, title, seasons, totalRuntimeMinutes, episodeCount, locale, airingSeason }: {
  readonly id: string;
  readonly title: string;
  readonly seasons: Awaited<ReturnType<typeof getSeriesPageData>>['seasons'];
  readonly totalRuntimeMinutes: number | undefined;
  readonly episodeCount: number;
  readonly locale: Locale;
  /** Saison en cours de diffusion, quand un episode est annonce. */
  readonly airingSeason: number | undefined;
}) {
  // Les deux partagent le meme cache de saisons : afficher la grille en plus de la
  // courbe ne coute pas un appel supplementaire.
  const [trajectory, grid] = await Promise.all([
    publicTrajectory(id, seasons, locale),
    episodeRatings(id, seasons, locale),
  ]);
  if (trajectory === undefined) return null;

  const advice = stopPointAdvice(trajectory, seasons, totalRuntimeMinutes, episodeCount);
  // Aucun appel supplementaire : la grille est deja chargee pour l'affichage, et le
  // point d'entree n'est qu'une lecture de plus sur les memes donnees.
  const rated = grid.flatMap((season) => season.episodes);
  const entry = findEntryPoint(rated);
  // La saison en cours est celle du prochain episode annonce. Deduire « la plus haute
  // saison notee » serait faux : le catalogue annonce parfois la suivante avant qu'elle
  // ne soit diffusee.
  const current =
    airingSeason !== undefined ? judgeCurrentSeason(rated, airingSeason) : undefined;

  return (
    <TrajectorySection
      seriesId={id}
      title={title}
      trajectory={trajectory}
      grid={grid}
      advice={advice}
      entryPoint={entry}
      currentSeason={current}
    />
  );
}

/**
 * Un chiffre de la fiche.
 *
 * ## `emphasis` designe **la** reponse de la page, et une seule
 *
 * « ~ 50 heures — 2 jours et 2 h » repond a la question que pose le nom du site. Elle
 * s'affichait avec exactement le meme poids visuel que « 29 septembre 2013 » : quatre
 * cartes identiques, dont une seule comptait. Le regard n'avait aucune raison d'aller au
 * bon endroit.
 *
 * Elle porte donc l'accent du produit, la grille monospace et un liseré lumineux — et les
 * trois autres restent volontairement plates. Mettre deux chiffres en avant reviendrait a
 * n'en mettre aucun.
 */
function Stat({ label, value, emphasis = false }: {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        emphasis
          ? 'border-(--color-volt)/40 bg-(--color-volt)/[0.06] shadow-[0_0_24px_-12px_var(--color-volt)]'
          : 'border-(--color-edge) bg-(--color-surface)'
      }`}
    >
      <dt
        className={`text-xs uppercase tracking-wide ${
          emphasis ? 'text-(--color-volt)/80' : 'text-(--color-muted)'
        }`}
      >
        {label}
      </dt>
      <dd
        className={`numeric mt-1 ${
          emphasis
            ? 'text-lg font-semibold text-(--color-volt) text-balance'
            : 'text-sm'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSeriesPageData, posterUrl, publicTrajectory, stopPointAdvice } from '@/lib/catalog';
import { STATUS_LABEL, formatCommitment, formatDate, year } from '@/lib/format';
import { TmdbError } from '@/src/catalog/tmdb';
import { StatusBadge } from '@/app/components/StatusBadge';
import { SeasonList } from '@/app/components/SeasonList';
import { TrajectoryChart } from '@/app/components/TrajectoryChart';

/**
 * Regeneration toutes les 24 h.
 *
 * C'est une decision de budget, pas de fraicheur (`ROADMAP.md` §1.4) : la page est
 * servie depuis le cache de bord, donc le trafic ne declenche pas d'appel a TMDB. Une
 * grille de diffusion ne bouge pas plus d'une fois par jour.
 */
export const revalidate = 86_400;

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
async function load(id: string) {
  try {
    return { kind: 'ok' as const, data: await getSeriesPageData(id) };
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) {
      return { kind: 'missing' as const };
    }
    return { kind: 'unavailable' as const };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const loaded = await load(id);
  if (loaded.kind !== 'ok') return { title: 'Série indisponible' };

  const { detail, seasons, status, episodeCount, totalRuntimeMinutes } = loaded.data;
  const started = year(detail.firstAirDate);

  // La description est ecrite pour la page de resultats d'un moteur : elle repond
  // immediatement aux deux questions qu'on pose a une serie — ou elle en est, et
  // combien elle coute. C'est le canal d'acquisition n°1 (`ROADMAP.md` §0.2).
  const parts = [
    STATUS_LABEL[status.status].toLowerCase(),
    `${seasons.rateable.length} saison${seasons.rateable.length > 1 ? 's' : ''}`,
    `${episodeCount} épisodes`,
    ...(totalRuntimeMinutes !== undefined ? [formatCommitment(totalRuntimeMinutes)] : []),
  ];

  return {
    title: started !== undefined ? `${detail.title} (${started})` : detail.title,
    description: `${detail.title} — ${parts.join(', ')}.`,
    alternates: { canonical: `/serie/${id}` },
  };
}

export default async function SeriesPage({ params }: PageProps) {
  const { id } = await params;
  const loaded = await load(id);

  if (loaded.kind === 'missing') notFound();
  if (loaded.kind === 'unavailable') {
    return (
      <div className="mx-auto max-w-2xl py-12 space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Catalogue indisponible
        </h1>
        <p className="text-(--color-muted)">
          Impossible de récupérer cette série pour le moment. Réessayez dans un
          instant.
        </p>
      </div>
    );
  }

  const { detail, seasons, status, episodeCount, totalRuntimeMinutes } = loaded.data;
  const poster = posterUrl(detail.posterPath, 'w342');
  const started = year(detail.firstAirDate);

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
        // Contenu construit par nous a partir de champs deja decodes, jamais du HTML tiers.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="flex flex-col gap-6 sm:flex-row">
        {poster !== undefined ? (
          <img
            src={poster}
            alt=""
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
          <StatusBadge status={status} withDetail />

          {detail.overview !== undefined ? (
            <p className="max-w-prose leading-relaxed text-(--color-muted)">
              {detail.overview}
            </p>
          ) : null}
        </div>
      </header>

      <section aria-label="Ce que la série demande">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Saisons" value={String(seasons.rateable.length)} />
          <Stat label="Épisodes" value={String(episodeCount)} />
          {totalRuntimeMinutes !== undefined ? (
            // Le tilde n'est pas cosmetique : le total est une estimation (mediane
            // d'une saison x nombre d'episodes), et l'annoncer comme exact serait
            // mentir sur la seule promesse chiffree de la page d'accueil.
            <Stat
              label="Engagement"
              value={`~ ${formatCommitment(totalRuntimeMinutes)}`}
              emphasis
            />
          ) : null}
          {detail.lastAiredAt !== undefined ? (
            <Stat label="Dernier épisode" value={formatDate(detail.lastAiredAt)} />
          ) : null}
        </dl>
      </section>

      <Trajectory
        id={id}
        seasons={seasons}
        episodeCount={episodeCount}
        {...(totalRuntimeMinutes !== undefined ? { totalRuntimeMinutes } : { totalRuntimeMinutes: undefined })}
      />

      <SeasonList seasons={seasons} />
    </article>
  );
}

/**
 * La trajectoire, **derriere un geste explicite**.
 *
 * `docs/RATING-MODEL.md` §6bis pose la regle : rien qui depasse la position du
 * spectateur ne s'affiche sans qu'il le demande. Or la courbe est elle-meme un
 * spoiler — montrer qu'elle s'effondre en saison 5 est une information que quelqu'un
 * en saison 2 n'a pas demandee, et le decrochage annonce en toutes lettres qu'il va
 * etre decu, et quand.
 *
 * En phase 1 il n'y a pas de compte, donc pas de position connue : impossible de
 * distinguer celui qui n'a pas commence — et qui vient precisement chercher cette
 * information — de celui qui est au milieu. Le `<details>` tranche sans compte : c'est
 * le geste explicite que la regle demande, et il ne coute rien a qui veut savoir.
 */
async function Trajectory({ id, seasons, totalRuntimeMinutes, episodeCount }: {
  readonly id: string;
  readonly seasons: Awaited<ReturnType<typeof getSeriesPageData>>['seasons'];
  readonly totalRuntimeMinutes: number | undefined;
  readonly episodeCount: number;
}) {
  const trajectory = await publicTrajectory(id, seasons);
  if (trajectory === undefined) return null;

  const advice = stopPointAdvice(trajectory, seasons, totalRuntimeMinutes, episodeCount);

  return (
    <section aria-label="Trajectoire">
      <details className="group rounded-lg border border-(--color-edge) bg-(--color-surface)">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none">
          <span className="group-open:hidden">Voir la trajectoire saison par saison</span>
          <span className="hidden group-open:inline">Trajectoire saison par saison</span>
          <span className="ml-2 font-normal text-(--color-muted)">
            contient un jugement sur les saisons suivantes
          </span>
        </summary>

        <div className="border-t border-(--color-edge) px-4 py-5">
          {/* `interpret={false}` : on montre la courbe, le pic et le decrochage — des
              faits — mais ni « forme » ni « constance », qui sont des jugements
              normalises sur une echelle que les notes de foule n'occupent pas. */}
          <TrajectoryChart trajectory={trajectory} interpret={false} />

          {/* La question que pose le produit — « ca vaut le coup ? » — enfin chiffree.
              Formulee comme un FAIT OBSERVE et jamais comme une injonction : sur des
              notes de foule, un decrochage se compte en dixiemes d'etoile, ce qui ne
              justifie pas de dire a quelqu'un ce qu'il doit regarder. */}
          {advice !== undefined ? (
            <p className="mt-5 rounded-md bg-(--color-warn)/10 px-3 py-2.5 text-sm">
              S’arrêter après la saison {advice.afterSeason} ramène la série à{' '}
              <strong>~ {formatCommitment(advice.shortenedMinutes)}</strong>, au lieu de{' '}
              ~ {formatCommitment(advice.fullMinutes)}.
            </p>
          ) : null}
          {/* L'origine des notes remonte jusqu'ici : ce ne sont pas celles de ce
              produit, et les presenter autrement serait malhonnete. */}
          <p className="mt-5 text-xs text-(--color-muted)">
            Établie à partir des notes du public TMDB, saison par saison — pas des notes
            de ce site. Ces notes se ressemblent beaucoup d’une saison à l’autre&nbsp;:
            les écarts comptent plus que les valeurs.
          </p>
        </div>
      </details>
    </section>
  );
}

function Stat({ label, value, emphasis = false }: {
  readonly label: string;
  readonly value: string;
  readonly emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-(--color-muted)">{label}</dt>
      <dd className={`mt-1 ${emphasis ? 'text-lg font-semibold' : 'text-sm'}`}>{value}</dd>
    </div>
  );
}

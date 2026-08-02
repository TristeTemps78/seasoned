'use client';

import { useJournal } from '@/app/journal/useJournal';
import { EpisodeGrid, type GridSeason } from '@/app/components/EpisodeGrid';
import { ShareCard } from '@/app/components/ShareCard';
import { TrajectoryChart } from '@/app/components/TrajectoryChart';
import { journalKey } from '@/src/domain/journal';
import { redactTrajectory } from '@/src/domain/spoiler';
import type { Trajectory } from '@/src/domain/trajectory';
import { formatCommitment } from '@/lib/format';

export interface StopPoint {
  readonly afterSeason: number;
  readonly shortenedMinutes: number;
  readonly fullMinutes: number;
}

/**
 * La trajectoire, coupee a l'horizon du spectateur.
 *
 * ## Ce que ce composant repare
 *
 * `redactTrajectory` existait depuis le premier jour, ecrite, testee sur treize cas —
 * et **appelee par rien**. C'est la repetition exacte du cas `computeTrajectory`, qui
 * a dormi de la meme facon et s'est revele faux le jour ou on l'a branche. Un module
 * teste mais jamais execute en conditions reelles n'est pas une garantie, c'est une
 * intention.
 *
 * Il n'y avait pas d'excuse : la position est connue depuis que le journal existe.
 *
 * ## Pourquoi c'est mieux que de tout cacher
 *
 * La regle est « rien qui depasse la position sans un geste explicite »
 * (`AGENTS.md` regle 7). Jusqu'ici, faute de position, tout etait derriere un
 * `<details>` — y compris pour quelqu'un qui vient precisement chercher cette
 * information.
 *
 * Maintenant, **la courbe se decouvre a mesure qu'on avance** : elle s'affiche
 * d'emblee jusqu'a l'episode ou l'on en est, et le geste explicite ne couvre plus que
 * ce qui vient apres. Plus sur *et* plus engageant — la progression devient visible,
 * ce qui est precisement le ressort qui manquait.
 *
 * `redactTrajectory` **recalcule** au lieu de masquer : couper la courbe a l'affichage
 * laisserait fuir le pic et le point de rupture par les agregats.
 */
export function TrajectorySection({
  seriesId,
  title,
  trajectory,
  grid,
  advice,
}: {
  readonly seriesId: string;
  readonly title: string;
  readonly trajectory: Trajectory;
  readonly grid: readonly GridSeason[];
  readonly advice: StopPoint | undefined;
}) {
  const { journal, ready } = useJournal();
  const entry = journal.entries[journalKey(seriesId)];
  const position = entry?.position;

  const redacted =
    position !== undefined
      ? redactTrajectory(trajectory, {
          at: {
            seriesId,
            seasonNumber: position.seasonNumber,
            episodeNumber: position.episodeNumber,
          },
          declaredAt: new Date(position.declaredAt),
        })
      : undefined;

  // Assez de saisons vues pour qu'une courbe personnelle veuille dire quelque chose ?
  const showsMine = ready && redacted !== undefined && redacted.trajectory.scores.length >= 2;
  const hidden = redacted?.hiddenSeasons ?? 0;

  return (
    <section aria-label="Trajectoire">
      <h2 className="sr-only">Trajectoire saison par saison</h2>

      {showsMine && redacted !== undefined ? (
        <div className="mb-4 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4">
          <h3 className="mb-3 text-sm font-medium">
            Jusqu’où vous en êtes
            <span className="ml-2 font-normal text-(--color-muted)">
              saisons 1 à {position?.seasonNumber}
            </span>
          </h3>
          <TrajectoryChart trajectory={redacted.trajectory} interpret={false} />
          <Comparison
            scores={redacted.trajectory.scores}
            mine={entry?.seasonRatings}
          />
          {/* Partager sa courbe, sans compte et sans serveur : l'image ne contient
              que les saisons deja vues, donc elle ne spoile pas celui qui la recoit
              plus loin que celui qui l'envoie. */}
          <ShareCard
            title={title}
            points={redacted.trajectory.scores.map((score) => {
              const ours = entry?.seasonRatings?.[String(score.seasonNumber)]?.stars;
              return {
                seasonNumber: score.seasonNumber,
                stars: score.stars,
                ...(ours !== undefined ? { mine: ours } : {}),
              };
            })}
          />

          {hidden > 0 ? (
            <p className="mt-4 text-xs text-(--color-muted)">
              {hidden} saison{hidden > 1 ? 's' : ''} au-delà de votre position
              {hidden > 1 ? ' ne sont pas affichées' : ' n’est pas affichée'}.
            </p>
          ) : null}
        </div>
      ) : null}

      <details className="group rounded-lg border border-(--color-edge) bg-(--color-surface)">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none">
          <span className="group-open:hidden">
            {hidden > 0 ? 'Voir la suite de la trajectoire' : 'Voir la trajectoire saison par saison'}
          </span>
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

          {grid.length > 0 ? (
            <div className="mt-6 border-t border-(--color-edge) pt-5">
              <h3 className="mb-3 text-sm font-medium">Épisode par épisode</h3>
              <p className="mb-3 text-xs text-(--color-muted)">
                Cliquez un épisode pour dire où vous en êtes, ou le noter.
              </p>
              <EpisodeGrid seriesId={seriesId} seasons={grid} />
            </div>
          ) : null}

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

/**
 * « Vous : 4,5 · le public : 3,8 ».
 *
 * La comparaison sociale **sans personne d'autre** : le public du catalogue est deja
 * un tiers, et se comparer a lui fonctionne des le premier utilisateur — sans compte,
 * sans base, sans moderation. Ne s'affiche que sur les saisons que l'on a notees
 * soi-meme, et jamais au-dela de la position.
 */
function Comparison({ scores, mine }: {
  readonly scores: readonly { readonly seasonNumber: number; readonly stars: number }[];
  readonly mine: Readonly<Record<string, { readonly stars: number }>> | undefined;
}) {
  const rows = scores
    .map((score) => ({ ...score, ours: mine?.[String(score.seasonNumber)]?.stars }))
    .filter((row): row is typeof row & { ours: number } => row.ours !== undefined);

  if (rows.length === 0) return null;

  return (
    <div className="mt-5 border-t border-(--color-edge) pt-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-(--color-muted)">
        Vous, et le public
      </p>
      <ul className="space-y-1 text-sm">
        {rows.map((row) => {
          const gap = row.ours - row.stars;
          return (
            <li key={row.seasonNumber} className="flex flex-wrap items-baseline gap-x-3">
              <span className="w-16 shrink-0 text-(--color-muted)">S{row.seasonNumber}</span>
              <span className="tabular-nums">
                vous {row.ours.toFixed(1).replace('.', ',')}
              </span>
              <span className="tabular-nums text-(--color-muted)">
                public {row.stars.toFixed(1).replace('.', ',')}
              </span>
              {/* Sous un demi-point, l'ecart n'est pas un desaccord : les notes de
                  foule tiennent dans une bande etroite, et le bruit y ressemble a un
                  avis. */}
              {Math.abs(gap) >= 0.5 ? (
                <span className={gap > 0 ? 'text-(--color-live)' : 'text-(--color-warn)'}>
                  {gap > 0 ? 'vous aimez plus' : 'vous aimez moins'}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

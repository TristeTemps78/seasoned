'use client';

import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { EpisodeGrid, type GridSeason } from '@/app/components/EpisodeGrid';
import { ShareCard } from '@/app/components/ShareCard';
import { TrajectoryChart } from '@/app/components/TrajectoryChart';
import type { CurrentSeasonVerdict } from '@/src/domain/current-season';
import type { EntryPoint } from '@/src/domain/entry-point';
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
  entryPoint,
  currentSeason,
}: {
  readonly seriesId: string;
  readonly title: string;
  readonly trajectory: Trajectory;
  readonly grid: readonly GridSeason[];
  readonly advice: StopPoint | undefined;
  /**
   * Le point d'entree, calcule sur le serveur.
   *
   * ⚠️ **Il s'affiche hors du geste explicite**, contrairement au point d'arret, et ce
   * n'est pas une inattention. La regle 7 d'`AGENTS.md` interdit de montrer ce qui
   * **depasse** la position du spectateur ; or le point d'entree est par construction
   * dans le premier tiers, donc en deca de la position de tout le monde. Il ne revele
   * rien de l'intrigue, et il s'adresse precisement a qui n'a pas commence — le cacher
   * derriere un depliant reviendrait a le refuser a son seul public.
   */
  readonly entryPoint: EntryPoint | undefined;
  /**
   * Ou en est la saison en cours de diffusion, si elle merite un commentaire.
   *
   * ⚠️ **Son emplacement depend de la position**, et c'est la regle 7 d'`AGENTS.md`
   * appliquee : pour quelqu'un qui suit la serie chaque semaine, savoir que la saison en
   * cours est en dessous n'est pas un spoiler — c'est ce qu'il vient chercher. Pour
   * quelqu'un reste en saison 2, c'est un jugement sur son avenir. Le meme fait va donc
   * a l'air libre dans le premier cas, et rejoint les jugements deplies dans le second.
   */
  readonly currentSeason: CurrentSeasonVerdict | undefined;
}) {
  const { journal, ready } = useJournal();
  const { t, tn, n, locale } = useT();
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
    <section aria-label={t('traj.aria')}>
      <h2 className="sr-only">{t('traj.srTitle')}</h2>

      {/* Pour qui est deja a jour : ni surprise, ni spoiler. */}
      {currentSeason !== undefined &&
      position !== undefined &&
      position.seasonNumber >= currentSeason.seasonNumber ? (
        <CurrentSeasonNote verdict={currentSeason} />
      ) : null}

      {/* Rendu par le serveur et donc **indexable** : c'est la reponse a « est-ce que ca
          s'ameliore ? », la question la plus posee sur une serie. La cacher derriere un
          depliant la retirerait du seul canal d'acquisition qui marche a froid. */}
      {entryPoint !== undefined ? (
        <div className="mb-4 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-3">
          <p className="text-sm font-medium">{t('entry.title')}</p>
          <p className="mt-1 text-sm text-(--color-muted)">
            {tn('entry.body', entryPoint.skipped, {
              before: n(entryPoint.before, 1),
              after: n(entryPoint.after, 1),
              s: entryPoint.startSeason,
              e: entryPoint.startEpisode,
            })}
          </p>
        </div>
      ) : null}

      {showsMine && redacted !== undefined ? (
        <div className="mb-4 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4">
          <h3 className="mb-3 text-sm font-medium">
            {t('traj.yours')}
            <span className="ml-2 font-normal text-(--color-muted)">
              {t('traj.seasonsTo', { n: position?.seasonNumber ?? 1 })}
            </span>
          </h3>
          <TrajectoryChart trajectory={redacted.trajectory} interpret={false} locale={locale} />
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
            <p className="mt-4 text-xs text-(--color-muted)">{tn('traj.hidden', hidden)}</p>
          ) : null}
        </div>
      ) : null}

      <details className="group rounded-lg border border-(--color-edge) bg-(--color-surface)">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:content-none">
          <span className="group-open:hidden">
            {hidden > 0 ? t('traj.seeMore') : t('traj.seeAll')}
          </span>
          <span className="hidden group-open:inline">{t('traj.srTitle')}</span>
          <span className="ml-2 font-normal text-(--color-muted)">{t('traj.warning')}</span>
        </summary>

        <div className="border-t border-(--color-edge) px-4 py-5">
          {/* `interpret={false}` : on montre la courbe, le pic et le decrochage — des
              faits — mais ni « forme » ni « constance », qui sont des jugements
              normalises sur une echelle que les notes de foule n'occupent pas. */}
          <TrajectoryChart trajectory={trajectory} interpret={false} locale={locale} />

          {grid.length > 0 ? (
            <div className="mt-6 border-t border-(--color-edge) pt-5">
              <h3 className="mb-3 text-sm font-medium">{t('traj.episodeByEpisode')}</h3>
              <p className="mb-3 text-xs text-(--color-muted)">{t('traj.clickHint')}</p>
              <EpisodeGrid seriesId={seriesId} seasons={grid} />
            </div>
          ) : null}

          {/* La question que pose le produit — « ca vaut le coup ? » — enfin chiffree.
              Formulee comme un FAIT OBSERVE et jamais comme une injonction : sur des
              notes de foule, un decrochage se compte en dixiemes d'etoile, ce qui ne
              justifie pas de dire a quelqu'un ce qu'il doit regarder. */}
          {/* Pour qui n'y est pas encore : le meme fait, mais range avec les autres
              jugements, derriere le geste explicite. */}
          {currentSeason !== undefined &&
          (position === undefined || position.seasonNumber < currentSeason.seasonNumber) ? (
            <div className="mt-5">
              <CurrentSeasonNote verdict={currentSeason} />
            </div>
          ) : null}

          {advice !== undefined ? (
            <p className="mt-5 rounded-md bg-(--color-warn)/10 px-3 py-2.5 text-sm">
              {t('traj.stop.before', { n: advice.afterSeason })}
              <strong>~ {formatCommitment(advice.shortenedMinutes, locale)}</strong>
              {t('traj.stop.after', {
                full: formatCommitment(advice.fullMinutes, locale),
              })}
            </p>
          ) : null}

          {/* L'origine des notes remonte jusqu'ici : ce ne sont pas celles de ce
              produit, et les presenter autrement serait malhonnete. */}
          <p className="mt-5 text-xs text-(--color-muted)">{t('traj.source')}</p>
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
  const { t, n } = useT();
  const rows = scores
    .map((score) => ({ ...score, ours: mine?.[String(score.seasonNumber)]?.stars }))
    .filter((row): row is typeof row & { ours: number } => row.ours !== undefined);

  if (rows.length === 0) return null;

  return (
    <div className="mt-5 border-t border-(--color-edge) pt-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-(--color-muted)">
        {t('traj.youAndPublic')}
      </p>
      <ul className="space-y-1 text-sm">
        {rows.map((row) => {
          const gap = row.ours - row.stars;
          return (
            <li key={row.seasonNumber} className="flex flex-wrap items-baseline gap-x-3">
              <span className="w-16 shrink-0 text-(--color-muted)">S{row.seasonNumber}</span>
              <span className="tabular-nums">{t('traj.you', { v: n(row.ours, 1) })}</span>
              <span className="tabular-nums text-(--color-muted)">
                {t('traj.publicIs', { v: n(row.stars, 1) })}
              </span>
              {/* Sous un demi-point, l'ecart n'est pas un desaccord : les notes de
                  foule tiennent dans une bande etroite, et le bruit y ressemble a un
                  avis. */}
              {Math.abs(gap) >= 0.5 ? (
                <span className={gap > 0 ? 'text-(--color-live)' : 'text-(--color-warn)'}>
                  {gap > 0 ? t('traj.likeMore') : t('traj.likeLess')}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * « Saison 5 : 4 episodes sortis, notes 0,6 sous la moyenne de la serie. »
 *
 * Un **fait sur les episodes deja diffuses**, jamais une prediction. La distinction est
 * la meme qui a fait retirer « forme » et « constance » de la trajectoire publique :
 * on montre la mesure, on tait le pronostic.
 */
function CurrentSeasonNote({ verdict }: { readonly verdict: CurrentSeasonVerdict }) {
  const { t, tn, n } = useT();
  const below = verdict.gap < 0;

  return (
    <p
      className={`rounded-md px-3 py-2.5 text-sm ${
        below ? 'bg-(--color-warn)/10' : 'bg-(--color-live)/10'
      }`}
    >
      {t(below ? 'season.below' : 'season.above', {
        season: verdict.seasonNumber,
        episodes: tn('season.aired', verdict.airedEpisodes),
        gap: n(Math.abs(verdict.gap), 1),
        current: n(verdict.current, 1),
      })}
    </p>
  );
}

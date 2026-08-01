import type { Trajectory, TrajectoryShape } from '@/src/domain/trajectory';
import { MAX_STARS } from '@/src/domain/types';

const SHAPE_LABEL: Readonly<Record<TrajectoryShape, string>> = {
  masterpiece: 'Tenue de bout en bout',
  steady: 'Constante',
  decline: 'Décroche en route',
  grower: 'S’améliore',
  erratic: 'En dents de scie',
  insufficient_data: 'Pas assez de saisons notées',
};

/**
 * La trajectoire, saison par saison.
 *
 * C'est le livrable du produit : **une forme, pas un nombre** (`docs/RATING-MODEL.md`
 * §2.3). La qualite d'une serie est une fonction du temps ; un scalaire ne peut pas la
 * representer, et c'est ce qui produit les incoherences d'IMDb.
 *
 * Le composant est place derriere un geste explicite par la page appelante — voir
 * `docs/RATING-MODEL.md` §6bis. Montrer qu'une courbe s'effondre en saison 5 est une
 * information que quelqu'un en saison 2 n'a pas demandee.
 */
export function TrajectoryChart({ trajectory }: { readonly trajectory: Trajectory }) {
  const { scores, peak, peakSeason, consistency, shape, breakPoint } = trajectory;
  if (scores.length < 2) return null;

  return (
    <div className="space-y-5">
      <ol className="flex items-end gap-1.5" aria-label="Note par saison">
        {scores.map(({ seasonNumber, stars }) => {
          const height = (stars / MAX_STARS) * 100;
          const isPeak = seasonNumber === peakSeason;
          const isDrop = breakPoint !== undefined && seasonNumber === breakPoint.beforeSeason;
          return (
            <li
              key={seasonNumber}
              className="flex flex-1 flex-col items-center gap-1"
              title={`Saison ${seasonNumber} — ${stars.toFixed(1)}/5`}
            >
              <span className="text-[10px] tabular-nums text-(--color-muted)">
                {stars.toFixed(1)}
              </span>
              <div className="flex h-24 w-full items-end">
                <div
                  className={`w-full rounded-sm ${
                    isDrop
                      ? 'bg-(--color-warn)'
                      : isPeak
                        ? 'bg-(--color-live)'
                        : 'bg-(--color-edge)'
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-(--color-muted)">
                S{seasonNumber}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-(--color-muted)">Forme</dt>
          <dd>{SHAPE_LABEL[shape]}</dd>
        </div>
        {peak !== undefined ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-(--color-muted)">Pic</dt>
            <dd>
              {peak.toFixed(1)}/5 <span className="text-(--color-muted)">· S{peakSeason}</span>
            </dd>
          </div>
        ) : null}
        {/* La constance n'est publiee qu'a partir de trois saisons notees : afficher un
            ecart-type calcule sur deux points serait malhonnete (`RATING-MODEL.md` §4). */}
        {consistency !== undefined ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-(--color-muted)">
              Constance
            </dt>
            <dd>{Math.round(consistency * 100)} %</dd>
          </div>
        ) : null}
      </dl>

      {breakPoint !== undefined ? (
        <p className="text-sm text-(--color-warn)">
          Décrochage après la saison {breakPoint.afterSeason} —{' '}
          {breakPoint.drop.toFixed(1)} étoile{breakPoint.drop > 1 ? 's' : ''} de moins à
          la saison {breakPoint.beforeSeason}
          {breakPoint.contiguous ? '' : ' (saisons non contiguës)'}.
        </p>
      ) : null}
    </div>
  );
}

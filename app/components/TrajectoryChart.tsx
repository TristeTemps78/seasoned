import type { Trajectory, TrajectoryShape } from '@/src/domain/trajectory';
import { MAX_STARS } from '@/src/domain/types';
import {
  DEFAULT_LOCALE,
  formatNumberIn,
  t,
  tn,
  type Locale,
  type MessageKey,
} from '@/lib/i18n';

/**
 * Le libelle de chaque forme, par cle et non par texte.
 *
 * Se taire est la seule reponse honnete quand les saisons sont trop proches
 * (`undifferentiated`) : qualifier du bruit serait pire que ne rien dire.
 */
const SHAPE_KEY: Readonly<Record<TrajectoryShape, MessageKey>> = {
  masterpiece: 'shape.masterpiece',
  steady: 'shape.steady',
  decline: 'shape.decline',
  grower: 'shape.grower',
  erratic: 'shape.erratic',
  undifferentiated: 'shape.undifferentiated',
  insufficient_data: 'shape.insufficient_data',
};

/**
 * La trajectoire, saison par saison.
 *
 * C'est le livrable du produit : **une forme, pas un nombre**. La qualite d'une serie
 * est une fonction du temps ; un scalaire ne peut pas la representer, et c'est ce qui
 * produit les incoherences d'IMDb.
 *
 * Le composant est place derriere un geste explicite par la page appelante. Montrer
 * qu'une courbe s'effondre en saison 5 est une information que quelqu'un en saison 2
 * n'a pas demandee.
 */
export function TrajectoryChart({ trajectory, interpret = true, locale = DEFAULT_LOCALE }: {
  readonly trajectory: Trajectory;
  readonly locale?: Locale;
  /**
   * Afficher la **forme** et la **constance** — c'est-a-dire des jugements.
   *
   * A desactiver pour des notes de foule. Ces deux indicateurs sont normalises sur
   * l'echelle complete (0,5 a 5), or une moyenne de foule n'en occupe qu'une fraction :
   * les notes de *Dexter* tiennent entre 3,6 et 4,2. L'ecart-type y parait alors
   * minuscule, la constance monte a 92 %, et la serie ressort « tenue de bout en bout »
   * alors qu'elle decroche visiblement.
   *
   * La courbe, le pic et le decrochage restent affiches : ce sont des faits, pas des
   * jugements.
   */
  readonly interpret?: boolean;
}) {
  const { scores, peak, peakSeason, consistency, shape, breakPoint } = trajectory;
  if (scores.length < 2) return null;
  const n = (value: number, digits?: number) => formatNumberIn(value, locale, digits);

  return (
    <div className="space-y-5">
      <ol className="flex items-end gap-1.5" aria-label={t(locale, 'chart.aria')}>
        {scores.map(({ seasonNumber, stars }) => {
          const height = (stars / MAX_STARS) * 100;
          const isPeak = seasonNumber === peakSeason;
          const isDrop = breakPoint !== undefined && seasonNumber === breakPoint.beforeSeason;
          return (
            <li
              key={seasonNumber}
              className="flex flex-1 flex-col items-center gap-1"
              title={t(locale, 'chart.seasonTitle', {
                n: seasonNumber,
                v: n(stars, 1),
              })}
            >
              {/* C'est l'affichage qui arrondit, jamais le calcul : arrondir en amont
                  ecrasait toute la dispersion des notes de foule. */}
              <span className="text-[10px] tabular-nums text-(--color-muted)">
                {n(stars, 1)}
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
        {interpret ? (
          <div>
            <dt className="label">
              {t(locale, 'chart.shape')}
            </dt>
            <dd>{t(locale, SHAPE_KEY[shape])}</dd>
          </div>
        ) : null}
        {peak !== undefined ? (
          <div>
            <dt className="label">
              {t(locale, 'chart.peak')}
            </dt>
            <dd>
              {n(peak, 1)}/5 <span className="text-(--color-muted)">· S{peakSeason}</span>
            </dd>
          </div>
        ) : null}
        {/* La constance n'est publiee qu'a partir de trois saisons notees : afficher un
            ecart-type calcule sur deux points serait malhonnete.
            Et jamais sur des notes de foule, ou sa normalisation n'a pas de sens. */}
        {interpret && consistency !== undefined ? (
          <div>
            <dt className="label">
              {t(locale, 'chart.consistency')}
            </dt>
            <dd>{Math.round(consistency * 100)} %</dd>
          </div>
        ) : null}
      </dl>

      {breakPoint !== undefined ? (
        <p className="text-sm text-(--color-warn)">
          {tn(locale, 'chart.break', breakPoint.drop, {
            after: breakPoint.afterSeason,
            drop: n(breakPoint.drop, 1),
            before: breakPoint.beforeSeason,
            gap: breakPoint.contiguous ? '' : t(locale, 'chart.break.gap'),
          })}
        </p>
      ) : null}
    </div>
  );
}

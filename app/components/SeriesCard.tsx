import Link from 'next/link';
import type { SeriesSummary } from '@/src/catalog/provider';
import type { StatusResult } from '@/src/domain/status';
import { posterDimensions, posterUrl } from '@/lib/catalog';
import { STATUS_TONE, shortStatus, year } from '@/lib/format';
import { DEFAULT_LOCALE, t, type Locale } from '@/lib/i18n';
import { seriesPath } from '@/lib/routes';

const TONE_TEXT = {
  live: 'text-(--color-live)',
  warning: 'text-(--color-warn)',
  neutral: 'text-(--color-muted)',
} as const;

/**
 * Vignette de resultat.
 *
 * « L'affiche est l'interface » : elle n'est pas une decoration, elle est le moyen de
 * navigation. D'ou une carte qui n'est presque que l'affiche.
 *
 * Le `status` est optionnel a dessein : il coute un appel par serie, donc on ne
 * l'hydrate que sur les pages mises en cache (`lib/catalog.ts`, `withStatus`).
 */
export function SeriesCard({ series, status, locale = DEFAULT_LOCALE }: {
  readonly series: SeriesSummary;
  readonly status?: StatusResult;
  readonly locale?: Locale;
}) {
  const poster = posterUrl(series.posterPath, 'w342');
  const firstYear = year(series.firstAirDate);
  const badge = status !== undefined ? shortStatus(status, locale) : undefined;

  return (
    // Le lien reste dans la langue de la page : sans cela, chaque vignette de l'accueil
    // francais etait une sortie du francais.
    <Link
      href={seriesPath(series.providerId, locale)}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-live) rounded-lg"
    >
      <div className="aspect-2/3 overflow-hidden rounded-lg border border-(--color-edge) bg-(--color-surface)">
        {poster !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- servi par le CDN TMDB,
          // jamais par nous : c'est une ligne du budget (`ROADMAP.md` §1.4).
          // `width`/`height` declares : sans eux le navigateur ne reserve pas la
          // place et la page saute a l'arrivee des affiches (decalage de mise en
          // page, mesure par Google). Le ratio d'une affiche TMDB est constant, on
          // peut donc les donner sans rien charger.
          <img
            src={poster}
            alt=""
            loading="lazy"
            decoding="async"
            width={posterDimensions('w342').width}
            height={posterDimensions('w342').height}
            className="h-full w-full object-cover transition-opacity group-hover:opacity-85"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-(--color-muted)">
            {t(locale, 'card.noPoster')}
          </div>
        )}
      </div>
      <p className="mt-2 text-sm font-medium leading-snug">{series.title}</p>
      <p className="text-xs text-(--color-muted)">
        {firstYear !== undefined ? firstYear : null}
        {/* Le chiffre est la valeur : « en attente · 11 mois » repond a la question
            que se pose le spectateur, la ou « Returning Series » ne dit rien. */}
        {badge !== undefined && status !== undefined ? (
          <>
            {firstYear !== undefined ? ' · ' : null}
            <span className={TONE_TEXT[STATUS_TONE[status.status]]}>{badge}</span>
          </>
        ) : null}
      </p>
    </Link>
  );
}

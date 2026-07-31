import Link from 'next/link';
import type { SeriesSummary } from '@/src/catalog/provider';
import { posterUrl } from '@/lib/catalog';
import { year } from '@/lib/format';

/**
 * Vignette de resultat.
 *
 * « L'affiche est l'interface » : elle n'est pas une decoration, elle est le moyen de
 * navigation. D'ou une carte qui n'est presque que l'affiche.
 */
export function SeriesCard({ series }: { readonly series: SeriesSummary }) {
  const poster = posterUrl(series.posterPath, 'w342');
  const firstYear = year(series.firstAirDate);

  return (
    <Link
      href={`/serie/${series.providerId}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-live) rounded-lg"
    >
      <div className="aspect-2/3 overflow-hidden rounded-lg border border-(--color-edge) bg-(--color-surface)">
        {poster !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- servi par le CDN TMDB,
          // jamais par nous : c'est une ligne du budget (`ROADMAP.md` §1.4).
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-opacity group-hover:opacity-85"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-(--color-muted)">
            Pas d’affiche
          </div>
        )}
      </div>
      <p className="mt-2 text-sm font-medium leading-snug">{series.title}</p>
      {firstYear !== undefined ? (
        <p className="text-xs text-(--color-muted)">{firstYear}</p>
      ) : null}
    </Link>
  );
}

'use client';

import Link from 'next/link';
import { posterDimensions, posterUrl } from '@/lib/catalog';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn, seriesPath } from '@/lib/routes';
import { parseJournalKey } from '@/src/domain/journal';
import type { LibraryItem } from '@/src/domain/library';

/**
 * Une vignette de la bibliotheque.
 *
 * Volontairement proche de `SeriesCard` sans la reutiliser : celle-ci ne connait pas
 * de `SeriesSummary`, elle ne dispose que de ce que le journal a memorise. C'est
 * precisement ce qui permet a la bibliotheque de s'afficher **sans un seul appel** —
 * la condition pour qu'elle tienne a cent mille utilisateurs.
 *
 * Une serie dont l'instantane a expire garde sa place : on affiche son identifiant
 * plutot que de la faire disparaitre. Perdre une vignette est un defaut d'affichage ;
 * perdre une serie suivie serait une perte de donnee.
 */
export function LibraryCard({ item }: { readonly item: LibraryItem }) {
  const { t, tn, locale } = useT();
  const parsed = parseJournalKey(item.key);
  const href =
    parsed !== undefined ? seriesPath(parsed.providerId, locale) : pathIn('/', locale);
  const poster = posterUrl(item.snapshot?.posterPath, 'w342');
  const position = item.entry.position;

  return (
    <Link
      href={href}
      className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-live)"
    >
      <div className="aspect-2/3 overflow-hidden rounded-lg border border-(--color-edge) bg-(--color-surface)">
        {poster !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN TMDB, jamais nous.
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
          // Meme repli que `SeriesCard` : ne pas repeter le titre, qui est juste
          // en dessous.
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-(--color-muted)">
            {t('card.noPoster')}
          </div>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
        {item.snapshot?.title ?? t('library.card.tracked')}
      </p>

      <p className="text-xs text-(--color-muted)">
        {item.daysUntilNext !== undefined ? (
          // Le chiffre est la valeur : « dans 3 jours » repond a la question qu'on se
          // pose, la ou « en cours » ne dit rien.
          <span className="text-(--color-live)">
            {item.daysUntilNext === 0
              ? t('library.card.today')
              : item.daysUntilNext === 1
                ? t('library.card.tomorrow')
                : tn('library.card.inDays', item.daysUntilNext)}
          </span>
        ) : position !== undefined ? (
          <>
            S{position.seasonNumber}E{position.episodeNumber}
          </>
        ) : (
          (item.snapshot?.statusLabel ?? t('library.card.toWatch'))
        )}
      </p>
    </Link>
  );
}

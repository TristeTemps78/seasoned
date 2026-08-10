'use client';

import Link from 'next/link';
import { Poster } from '@/app/components/Poster';
import { statusLabel } from '@/lib/format';
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
export function LibraryCard({ item, lead = false }: {
  readonly item: LibraryItem;
  /** Rendue dans la rangee de tete : l'affiche y fait ~300 px, `w342` y serait flou. */
  readonly lead?: boolean;
}) {
  const tr = useT();
  const { t, tn, locale } = tr;
  const parsed = parseJournalKey(item.key);
  const href =
    parsed !== undefined ? seriesPath(parsed.providerId, locale) : pathIn('/', locale);
  const position = item.entry.position;

  // 🔴 Le statut brut d'abord, traduit dans la langue de CETTE page ; le libelle fige en
  // repli, pour les journaux ecrits avant que `status` existe. Sans cette priorite, une
  // note posee depuis une page francaise faisait dire « Entre deux saisons » a la
  // bibliotheque anglaise — constate au navigateur, pas deduit.
  const snapshotStatus =
    item.snapshot?.status !== undefined
      ? statusLabel(item.snapshot.status, tr)
      : item.snapshot?.statusLabel;

  const decision = item.entry.decision?.kind;
  const decisionLabel =
    decision === 'completed'
      ? t('decision.completed')
      : decision === 'abandoned'
        ? t('decision.abandoned')
        : decision === 'paused'
          ? t('decision.paused')
          : undefined;

  return (
    <Link
      href={href}
      className="group block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-live)"
    >
      <div className="aspect-2/3 overflow-hidden panel">
        {/* ⚠️ L'affiche **choisie** passe devant celle du catalogue. C'est tout l'interet
            de la feature : elle doit se voir dans la bibliotheque, pas seulement sur la
            fiche ou on l'a choisie. */}
        <Poster
          path={item.entry.poster ?? item.snapshot?.posterPath}
          title={item.snapshot?.title ?? t('library.card.tracked')}
          size={lead ? 'w500' : 'w342'}
          className="transition-opacity group-hover:opacity-85"
        />
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
          // Une coordonnee, donc en grille : sur une colonne de vignettes, « S3E7 » et
          // « S10E12 » cessent de danser d'une ligne a l'autre.
          <span className="numeric">
            S{position.seasonNumber}E{position.episodeNumber}
          </span>
        ) : (
          // ⚠️ La decision passe **avant** le repli « a voir ». Trouve a la
          // verification : une serie rangee dans « Terminees et abandonnees » affichait
          // « a voir » des que son instantane n'avait pas de libelle de statut — ce qui
          // arrive des qu'il expire. La vignette contredisait alors la section qui la
          // contient, et c'est le genre de detail qui fait douter de tout le reste.
          decisionLabel ?? snapshotStatus ?? t('library.card.toWatch')
        )}
      </p>
    </Link>
  );
}

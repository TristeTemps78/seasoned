'use client';

import Link from 'next/link';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { StarRating } from '@/app/components/StarRating';
import {
  completionCount,
  favoritesOf,
  hasCompletionOn,
  journalKey,
  MAX_FAVORITES,
} from '@/src/domain/journal';
import { pathIn } from '@/lib/routes';
import type { SeasonShape } from '@/app/components/MyProgress';

/**
 * Les gestes a un tap, **dans le premier ecran**.
 *
 * ## 🔴 Le defaut que ce composant repare
 *
 * Mesure au navigateur le 2026-08-15 sur `/serie/1396`, fenetre 1440 x 619, bandeau du
 * journal deja renvoye :
 *
 *     .show-backdrop                          400 px de haut
 *     <h1>                                    y = 307
 *     section[aria-label="My progress"]       y = 714
 *     premier bouton d'action                 y = 775   → 156 px SOUS la ligne de flottaison
 *
 * La page existe pour recueillir un geste, et ce geste n'etait jamais visible a l'arrivee.
 * Letterboxd pose le sien (vu / aime / a voir, puis les etoiles) **a cote du titre**, et
 * double la mise avec un bouton vert permanent dans son en-tete.
 *
 * ## Deplace, jamais duplique
 *
 * Ces commandes vivaient dans {@link MyProgress}, qui ne les rend plus : un geste, un
 * endroit. Ce qui reste dans la colonne laterale est ce qui **coute** — la grille des
 * episodes, la decision, la critique, les mots — et qui n'a rien a faire au-dessus de la
 * ligne de flottaison.
 *
 * ⚠️ La note de la saison courante, elle, est rendue **ici et dans la liste des saisons**.
 * Ce n'est pas la faute « deux sources pour un meme etat » que le depot chasse ailleurs :
 * les deux lisent `entry.seasonRatings` par `useJournal`, il n'y a qu'une verite. C'est une
 * liste complete d'un cote, le cran du moment de l'autre.
 *
 * ## Pourquoi ce composant peut vivre dans un en-tete rendu au serveur
 *
 * Il est client, et la page reste `○ Static` : aucune donnee de journal ne traverse le
 * serveur, le HTML est partage entre tous les visiteurs par le cache de bord. C'est la meme
 * mecanique que `MyProgress`, montee un cran plus haut dans le document.
 */
export function ProgressSummary({ seriesId, seasons }: {
  readonly seriesId: string;
  readonly seasons: readonly SeasonShape[];
}) {
  const { journal, ready, setPosition, setSeasonRating, setWanted, setLiked, watchAgain, toggleFavorite } =
    useJournal();
  const { t, locale } = useT();

  const key = journalKey(seriesId);
  const entry = journal.entries[key];
  const position = entry?.position;

  // La hauteur reservee est celle du bloc **non suivi** — le cas de la quasi-totalite des
  // arrivees : deux rangees de boutons dans une colonne de 18 rem. `.show-actions` porte le
  // meme `min-height`, donc les deux etats coincident et rien ne saute a l'hydratation.
  //
  // ⚠️ **La classe `.show-actions` est indispensable ici, pas seulement au rendu**. Sans
  // elle, le gabarit d'attente ne recevrait aucun placement explicite et retomberait sur la
  // regle de 40 rem (`grid-column: 2`) — c'est-a-dire par-dessus le titre, dans le HTML servi
  // et jusqu'a l'hydratation. Pas de `panel` en revanche : un cadre vide qui clignote se lit
  // comme un defaut de chargement.
  if (!ready || seasons.length === 0) {
    return <div className="show-actions" aria-hidden="true" />;
  }

  const favorites = favoritesOf(journal);
  const pinned = favorites.includes(key);
  const passes = completionCount(entry);
  // Idempotent dans la journee : proposer le geste un jour ou il ne peut rien ecrire
  // donnerait un bouton qui a l'air de marcher.
  const passedToday = hasCompletionOn(entry, new Date());
  const currentSeason = position?.seasonNumber;
  const currentRating =
    currentSeason !== undefined ? entry?.seasonRatings?.[String(currentSeason)] : undefined;

  return (
    <section className="show-actions panel" aria-label={t('progress.quickAria')}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Niveau 0 — le seul geste possible pour qui arrive d'un moteur de recherche et
            n'a pas vu la serie. Sans lui, le produit demandait de finir pour commencer. */}
        <button
          type="button"
          aria-pressed={entry?.wanted !== undefined}
          onClick={() => setWanted(key, entry?.wanted === undefined)}
          // Aucune classe conditionnelle : `.btn[aria-pressed='true']` porte l'etat choisi.
          className="btn rounded-full"
        >
          {entry?.wanted !== undefined ? t('progress.wanted') : t('progress.want')}
        </button>

        {/* Le coeur — l'attachement, qui n'est pas la note. Sans condition de position :
            on peut aimer une serie qu'on n'a pas finie. */}
        <button
          type="button"
          aria-pressed={entry?.liked !== undefined}
          onClick={() => setLiked(key, entry?.liked === undefined)}
          className="btn rounded-full"
        >
          <span aria-hidden="true">{entry?.liked !== undefined ? '♥' : '♡'}</span>{' '}
          {entry?.liked !== undefined ? t('progress.liked') : t('progress.like')}
        </button>

        {/* ⚠️ Disparait quand quatre series sont deja epinglees et que celle-ci n'en fait pas
            partie : `toggleFavorite` rend alors le journal inchange. La phrase qui le remplace
            dit la condition et ou la lever — une porte nommee n'est pas un bouton mort. */}
        {pinned || favorites.length < MAX_FAVORITES ? (
          <button
            type="button"
            aria-pressed={pinned}
            onClick={() => toggleFavorite(key)}
            className="btn rounded-full"
          >
            {pinned ? t('favorites.pinned') : t('favorites.pin')}
          </button>
        ) : (
          <span className="meta-sm">
            {t('favorites.full')}{' '}
            <Link
              href={pathIn('/moi', locale)}
              className="tap-line underline hover:text-(--color-text)"
            >
              {t('favorites.manage')}
            </Link>
          </span>
        )}

        {passes > 0 && !passedToday ? (
          <button type="button" onClick={() => watchAgain(key)} className="btn rounded-full">
            {t('rewatch.mark')}
          </button>
        ) : null}

        {position === undefined ? (
          <button
            type="button"
            onClick={() => setPosition(key, seasons[0]?.seasonNumber ?? 1, 1)}
            className="btn rounded-full"
          >
            {t('progress.start')}
          </button>
        ) : null}
      </div>

      {/* Ou l'on en est, et le cran du moment. Deux lignes seulement : le detail — changer de
          saison, la grille, la decision — vit plus bas, la ou on descend quand on le cherche. */}
      {position !== undefined && currentSeason !== undefined ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="numeric text-sm text-(--color-volt)">
            S{position.seasonNumber}E{position.episodeNumber}
          </span>
          <StarRating
            value={currentRating?.stars}
            label={t('rating.season', { n: currentSeason })}
            onChange={(stars) => setSeasonRating(key, currentSeason, stars)}
          />
        </div>
      ) : null}
    </section>
  );
}

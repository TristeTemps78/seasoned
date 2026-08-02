'use client';

import { useState } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { StarRating } from '@/app/components/StarRating';
import { episodeKey, journalKey } from '@/src/domain/journal';
import { COLOR_CEILING, COLOR_FLOOR, ratingHue } from '@/src/domain/rating-scale';
import type { Stars } from '@/src/domain/types';

/** Une note d'episode du public, telle que la page la fournit. */
export interface GridEpisode {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly title?: string;
  readonly voteAverage: number;
  readonly voteCount: number;
}

export interface GridSeason {
  readonly seasonNumber: number;
  readonly episodes: readonly GridEpisode[];
}

type Layer = 'public' | 'mine';

/**
 * La grille des episodes, coloree par note — et vivante.
 *
 * L'idee vient d'IMDb, ou cette grille est de loin l'ecran le plus capture et partage :
 * on y **voit** d'un coup d'oeil la saison qui s'effondre et l'episode culte. C'est la
 * seule chose de ce site qui soit frappante avant d'etre lue.
 *
 * Elle etait pourtant **morte** : l'element le plus fort de la page ne reagissait a
 * rien, alors que c'est exactement l'endroit ou l'on veut dire « j'en suis la » et
 * « celui-la etait enorme ». Un clic pose desormais l'un ou l'autre, et le commutateur
 * fait basculer la couleur des notes du public aux siennes — **les deux couches sur la
 * meme grille**, ce qu'aucun des deux modeles ne fait separement.
 *
 * Trois precautions que la version d'IMDb ne prend pas :
 *
 *   - **La couleur ne porte jamais l'information seule.** Chaque case indique sa note
 *     en texte accessible ; qui ne distingue pas les couleurs lit la meme chose.
 *   - **L'echelle est bornee sur la plage reellement occupee** (6 a 9). Etaler sur
 *     0–10 donnerait une grille uniformement verte, ou l'on ne verrait rien.
 *   - **La position estompe ce qui la depasse**, au lieu de tout montrer a plat : la
 *     regle de spoiler vaut aussi pour une grille de couleurs, ou un trou sombre en
 *     fin de saison 5 se lit de loin.
 */
export function EpisodeGrid({ seriesId, seasons }: {
  readonly seriesId: string;
  readonly seasons: readonly GridSeason[];
}) {
  const { journal, ready, setPosition, setEpisodeRating } = useJournal();
  const { t, n } = useT();
  const [selected, setSelected] = useState<GridEpisode | undefined>(undefined);
  const [layer, setLayer] = useState<Layer>('public');

  const key = journalKey(seriesId);
  const entry = journal.entries[key];
  const position = entry?.position;
  const mine = entry?.episodeRatings ?? {};
  const hasMine = Object.keys(mine).length > 0;

  if (seasons.length === 0) return null;
  const widest = Math.max(...seasons.map((s) => s.episodes.length));

  const myStars = (e: GridEpisode): Stars | undefined =>
    mine[episodeKey(e.seasonNumber, e.episodeNumber)]?.stars;

  return (
    <div className="space-y-3">
      {hasMine ? (
        <div className="flex items-center gap-2 text-xs">
          {(
            [
              ['public', 'grid.public'],
              ['mine', 'grid.mine'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={layer === value}
              onClick={() => setLayer(value)}
              className={`rounded-full border px-2.5 py-1 ${
                layer === value
                  ? 'border-(--color-live)/40 bg-(--color-live)/15 text-(--color-live)'
                  : 'border-(--color-edge) text-(--color-muted) hover:border-(--color-muted)'
              }`}
            >
              {t(label)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-[10px]">
          <caption className="sr-only">
            {layer === 'mine' ? t('grid.captionMine') : t('grid.captionPublic')}
          </caption>
          <tbody>
            {seasons.map((season) => (
              <tr key={season.seasonNumber}>
                <th
                  scope="row"
                  className="pr-2 text-right font-normal tabular-nums text-(--color-muted)"
                >
                  S{season.seasonNumber}
                </th>
                {Array.from({ length: widest }, (_, i) => {
                  const episode = season.episodes[i];
                  if (episode === undefined) {
                    return <td key={i} className="h-5 w-5" />;
                  }

                  const stars = myStars(episode);
                  const beyond = isBeyond(episode, position);
                  const isCurrent =
                    position?.seasonNumber === episode.seasonNumber &&
                    position.episodeNumber === episode.episodeNumber;

                  const hue =
                    layer === 'mine'
                      ? stars !== undefined
                        ? (stars - 0.5) / 4.5
                        : undefined
                      : ratingHue(episode.voteAverage);

                  return (
                    <td key={i} className="h-5 w-5 p-0">
                      <button
                        type="button"
                        disabled={!ready}
                        onClick={() =>
                          setSelected((current) =>
                            current?.seasonNumber === episode.seasonNumber &&
                            current.episodeNumber === episode.episodeNumber
                              ? undefined
                              : episode,
                          )
                        }
                        className={`flex h-5 w-5 items-center justify-center rounded-[2px] ${
                          isCurrent ? 'ring-1 ring-(--color-text)' : ''
                        } ${beyond ? 'opacity-35' : ''} enabled:hover:ring-1 enabled:hover:ring-(--color-muted)`}
                        style={{
                          backgroundColor:
                            hue !== undefined ? cellColor(hue) : 'var(--color-surface)',
                        }}
                        title={`S${episode.seasonNumber}E${episode.episodeNumber}${
                          episode.title !== undefined ? ` — ${episode.title}` : ''
                        } · ${n(episode.voteAverage, 1)}/10${
                          stars !== undefined ? ` · ${t('grid.you')} : ${n(stars)}/5` : ''
                        }`}
                      >
                        <span className="sr-only">
                          {t('grid.cell', {
                            s: episode.seasonNumber,
                            e: episode.episodeNumber,
                            v: n(episode.voteAverage, 1),
                          })}
                          {stars !== undefined ? t('grid.cellMine', { n: n(stars) }) : ''}
                        </span>
                        {/* Un point marque les episodes que l'on a notes soi-meme : sur
                            la couche du public, rien d'autre ne les distinguerait. */}
                        {layer === 'public' && stars !== undefined ? (
                          <span
                            aria-hidden="true"
                            className="h-1 w-1 rounded-full bg-(--color-ink)"
                          />
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected !== undefined && ready ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-(--color-edge) bg-(--color-ink) px-3 py-2 text-sm">
          <span className="font-medium">
            S{selected.seasonNumber}E{selected.episodeNumber}
            {selected.title !== undefined ? (
              <span className="ml-2 font-normal text-(--color-muted)">{selected.title}</span>
            ) : null}
          </span>

          <button
            type="button"
            onClick={() => setPosition(key, selected.seasonNumber, selected.episodeNumber)}
            className="rounded-full border border-(--color-edge) px-2.5 py-1 text-xs hover:border-(--color-muted)"
          >
            {t('grid.here')}
          </button>

          <StarRating
            size="sm"
            value={myStars(selected)}
            label={t('rating.episode', {
              s: selected.seasonNumber,
              e: selected.episodeNumber,
            })}
            onChange={(stars) =>
              setEpisodeRating(key, selected.seasonNumber, selected.episodeNumber, stars)
            }
          />

          <span className="text-xs text-(--color-muted)">
            {t('grid.publicShort')}&nbsp;: {n(selected.voteAverage, 1)}/10
          </span>
        </div>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-(--color-muted)">
        {layer === 'mine' ? (
          <>
            <span>{n(0.5, 1)}</span>
            <Scale />
            <span>{t('grid.scaleStars')}</span>
          </>
        ) : (
          <>
            <span>{COLOR_FLOOR}/10</span>
            <Scale />
            <span>{t('grid.scaleCeiling', { n: COLOR_CEILING })}</span>
          </>
        )}
      </p>
    </div>
  );
}

function Scale() {
  return (
    <span className="flex" aria-hidden="true">
      {[0, 0.25, 0.5, 0.75, 1].map((h) => (
        <span key={h} className="h-3 w-6" style={{ backgroundColor: cellColor(h) }} />
      ))}
    </span>
  );
}

/** Un episode depasse-t-il la position declaree ? */
function isBeyond(
  episode: GridEpisode,
  position: { readonly seasonNumber: number; readonly episodeNumber: number } | undefined,
): boolean {
  if (position === undefined) return false;
  if (episode.seasonNumber !== position.seasonNumber) {
    return episode.seasonNumber > position.seasonNumber;
  }
  return episode.episodeNumber > position.episodeNumber;
}

/**
 * Rouge sombre vers vert, en passant par l'ambre.
 *
 * Teintes reprises de la charte (`app/globals.css`) plutot qu'un degrade arbitraire,
 * pour que la grille appartienne visuellement au reste du site.
 */
function cellColor(hue: number): string {
  const stops = [
    [0, [127, 29, 29]],
    [0.5, [180, 130, 30]],
    [1, [74, 222, 128]],
  ] as const;

  for (let i = 1; i < stops.length; i += 1) {
    const [prevAt, prev] = stops[i - 1]!;
    const [nextAt, next] = stops[i]!;
    if (hue > nextAt && i < stops.length - 1) continue;
    const t = (hue - prevAt) / (nextAt - prevAt);
    const mix = prev.map((c, k) => Math.round(c + (next[k]! - c) * Math.min(1, Math.max(0, t))));
    return `rgb(${mix[0]} ${mix[1]} ${mix[2]})`;
  }
  return 'rgb(127 29 29)';
}

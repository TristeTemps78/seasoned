'use client';

import { useJournal } from '@/app/journal/useJournal';
import type { Stars } from '@/src/domain/types';

const STARS: readonly Stars[] = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

export interface SeasonShape {
  readonly seasonNumber: number;
  readonly episodeCount: number;
}

/**
 * Ce que le produit retient de vous, sur une serie.
 *
 * Trois gestes, dans l'ordre exact de la friction croissante decrite par
 * `docs/RATING-MODEL.md` §5 :
 *
 *   1. **la position** — un geste, et tout ce qui precede est implicitement vu ;
 *   2. **la note de saison** — un geste de plus, et seulement si on le veut ;
 *   3. **la decision** — continuer, mettre en pause, abandonner.
 *
 * Personne ne doit voir le niveau au-dessus de celui qu'il a choisi : les notes
 * n'apparaissent qu'une fois la position declaree, et la decision qu'ensuite.
 *
 * Tout est garde dans le navigateur. Aucun compte, aucune donnee envoyee nulle part —
 * et la page qui l'accueille reste statique et mise en cache.
 */
export function MyProgress({ seriesId, seasons }: {
  readonly seriesId: string;
  readonly seasons: readonly SeasonShape[];
}) {
  const { journal, ready, setPosition, setSeasonRating, setDecision } = useJournal();
  const entry = journal.entries[seriesId];
  const position = entry?.position;

  // Tant que le stockage n'a pas ete lu, on n'affiche rien : dire « vous n'avez rien
  // vu » a quelqu'un qui a tout note serait pire que d'attendre un instant.
  if (!ready || seasons.length === 0) {
    return <div className="h-24" aria-hidden="true" />;
  }

  const current = seasons.find((s) => s.seasonNumber === position?.seasonNumber);

  return (
    <section
      className="space-y-4 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4"
      aria-label="Ma progression"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Où j’en suis</h2>
        <span className="text-xs text-(--color-muted)">
          gardé dans ce navigateur, rien n’est envoyé
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-(--color-muted)" htmlFor="season">
          Saison
        </label>
        <select
          id="season"
          className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1.5 text-sm"
          value={position?.seasonNumber ?? ''}
          onChange={(e) => {
            const season = Number(e.target.value);
            if (Number.isNaN(season)) return;
            setPosition(seriesId, season, 1);
          }}
        >
          <option value="">—</option>
          {seasons.map((s) => (
            <option key={s.seasonNumber} value={s.seasonNumber}>
              {s.seasonNumber}
            </option>
          ))}
        </select>

        {current !== undefined ? (
          <>
            <label className="text-sm text-(--color-muted)" htmlFor="episode">
              Épisode
            </label>
            <select
              id="episode"
              className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1.5 text-sm"
              value={position?.episodeNumber ?? 1}
              onChange={(e) =>
                setPosition(seriesId, current.seasonNumber, Number(e.target.value))
              }
            >
              {Array.from({ length: current.episodeCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="text-xs text-(--color-muted)">
              tout ce qui précède compte comme vu
            </span>
          </>
        ) : null}
      </div>

      {/* Niveau 1 : la note de saison n'apparait qu'une fois la position declaree. */}
      {position !== undefined ? (
        <div className="space-y-2 border-t border-(--color-edge) pt-3">
          <p className="text-xs uppercase tracking-wide text-(--color-muted)">
            Mes notes de saison
          </p>
          <ul className="space-y-1.5">
            {seasons
              .filter((s) => s.seasonNumber <= position.seasonNumber)
              .map((s) => {
                const rating = entry?.seasonRatings?.[String(s.seasonNumber)];
                return (
                  <li key={s.seasonNumber} className="flex items-center gap-2 text-sm">
                    <span className="w-16 text-(--color-muted)">Saison {s.seasonNumber}</span>
                    <select
                      aria-label={`Note de la saison ${s.seasonNumber}`}
                      className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1 text-sm"
                      value={rating?.stars ?? ''}
                      onChange={(e) =>
                        setSeasonRating(
                          seriesId,
                          s.seasonNumber,
                          e.target.value === ''
                            ? undefined
                            : (Number(e.target.value) as Stars),
                        )
                      }
                    >
                      <option value="">—</option>
                      {STARS.map((v) => (
                        <option key={v} value={v}>
                          {v.toFixed(1)}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      {/* Niveau 2 : la decision, qui est la donnee propre du produit. */}
      {position !== undefined ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-(--color-edge) pt-3">
          {(
            [
              ['continuing', 'Je continue'],
              ['paused', 'En pause'],
              ['abandoned', 'J’abandonne'],
              ['completed', 'Terminée'],
            ] as const
          ).map(([kind, label]) => {
            const active = entry?.decision?.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => setDecision(seriesId, active ? undefined : kind)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active
                    ? 'border-(--color-live)/40 bg-(--color-live)/15 text-(--color-live)'
                    : 'border-(--color-edge) text-(--color-muted) hover:border-(--color-muted)'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

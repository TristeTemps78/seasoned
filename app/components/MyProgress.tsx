'use client';

import { useEffect } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { StarRating } from '@/app/components/StarRating';
import { completionCount, isRewatching, journalKey, suggestedSeasonRating } from '@/src/domain/journal';
import { catchUpPlan } from '@/src/domain/catch-up';
import { seasonToRate } from '@/src/domain/nudge';
import { remainingAfter } from '@/src/domain/remaining';
import { formatCommitment } from '@/lib/format';
import { tn as translateN } from '@/lib/i18n';

export interface SeasonShape {
  readonly seasonNumber: number;
  readonly episodeCount: number;
}

/** Ce que la page sait deja de la serie, et qu'il suffit de memoriser. */
export interface SeriesShape {
  readonly title: string;
  readonly posterPath?: string;
  readonly statusLabel?: string;
  readonly nextEpisodeAt?: string;
  readonly publicStars?: number;
}

/**
 * Ce que le produit retient de vous, sur une serie.
 *
 * Les gestes sont ranges par friction croissante (`docs/RATING-MODEL.md` §5), et le
 * premier d'entre eux a longtemps manque :
 *
 *   0. **« je veux la voir »** — ne suppose rien, ni d'avoir commence, ni d'avoir un
 *      avis. C'est le seul geste possible pour la quasi-totalite des arrivants, qui
 *      viennent d'un moteur de recherche et n'ont pas vu la serie. Sans lui, le
 *      produit demandait de finir avant de pouvoir commencer ;
 *   1. **la position** — un geste, et tout ce qui precede est implicitement vu ;
 *   2. **la note de saison** — un tap de plus, et seulement si on le veut ;
 *   3. **la decision** — continuer, mettre en pause, abandonner.
 *
 * Personne ne voit le niveau au-dessus de celui qu'il a choisi.
 *
 * Tout est garde dans le navigateur. Aucun compte, aucune donnee envoyee nulle part —
 * et la page qui l'accueille reste statique et mise en cache.
 */
export function MyProgress({ seriesId, seasons, series, episodeMinutes }: {
  readonly seriesId: string;
  readonly seasons: readonly SeasonShape[];
  readonly series: SeriesShape;
  /**
   * Duree mediane d'un episode. Absente sur les series dont TMDB ne dit rien — et
   * c'est le cas courant, pas l'exception (`TASKS.md` §1.10).
   */
  readonly episodeMinutes?: number;
}) {
  const {
    journal,
    ready,
    setPosition,
    setSeasonRating,
    setDecision,
    setWanted,
    rememberSnapshot,
  } = useJournal();
  const { t, tn, n, locale } = useT();

  // Jamais l'identifiant nu : les cles du journal portent leur fournisseur, pour qu'un
  // changement de catalogue reste un remappage et non une perte (`journal.ts`).
  const key = journalKey(seriesId);
  const entry = journal.entries[key];
  const position = entry?.position;
  const tracked = entry !== undefined;

  // De quoi dessiner cette serie ailleurs — dans la bibliotheque — sans aucun appel.
  // N'ecrit que si l'entree existe deja : passer sur une page ne doit pas remplir le
  // journal, ni constituer une base de metadonnees que le contrat interdit.
  useEffect(() => {
    if (!ready || !tracked) return;
    rememberSnapshot(key, series);
  }, [ready, tracked, key, series, rememberSnapshot]);

  // Tant que le stockage n'a pas ete lu, on n'affiche rien : dire « vous n'avez rien
  // vu » a quelqu'un qui a tout note serait pire que d'attendre un instant.
  //
  // La hauteur reservee est celle du bloc **replie**, pas une valeur ronde : la
  // premiere version reservait 96 px pour un bloc qui en fait bien plus, et
  // reintroduisait ainsi le decalage de mise en page que la tache 1.24 avait supprime
  // sur cette page meme.
  if (!ready || seasons.length === 0) {
    return <div className="h-[4.5rem]" aria-hidden="true" />;
  }

  const current = seasons.find((s) => s.seasonNumber === position?.seasonNumber);

  // Ce qu'il reste, et la saison qu'on peut noter maintenant : deux calculs purs, tires
  // de la seule position. Le serveur n'en sait rien et n'a pas a en savoir.
  const left = remainingAfter(seasons, position, episodeMinutes);
  const rated = new Set(
    Object.keys(entry?.seasonRatings ?? {})
      .map(Number)
      .filter((n) => Number.isFinite(n)),
  );
  const toRate = seasonToRate(seasons, position, rated);

  // Le revisionnage : le seul comportement qui distingue une serie aimee d'une serie
  // simplement finie. Une note de cinq etoiles se pose une fois ; un troisieme passage
  // est bien plus difficile a falsifier.
  const passes = completionCount(entry);
  const again = isRewatching(entry);

  // « 14 episodes en 12 jours » : ce qui reste, rapporte a la date de retour. Croiser
  // les deux transforme une bibliotheque en plan — et ne coute rien, tout est deja la.
  const plan = catchUpPlan(
    left,
    series.nextEpisodeAt !== undefined ? new Date(series.nextEpisodeAt) : undefined,
    new Date(),
    episodeMinutes,
  );

  return (
    <section
      className="space-y-4 rounded-lg border border-(--color-edge) bg-(--color-surface) px-4 py-4"
      aria-label={t('progress.aria')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('progress.title')}</h2>
        <span className="text-xs text-(--color-muted)">{t('progress.local')}</span>
      </div>

      {passes > 0 ? (
        <p className="text-sm text-(--color-live)">
          {again ? tn('rewatch.again', passes + 1) : tn('rewatch.done', passes)}
        </p>
      ) : null}

      {/* Niveau 0 — le geste qui ne suppose rien. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={entry?.wanted !== undefined}
          onClick={() => setWanted(key, entry?.wanted === undefined)}
          className={`rounded-full border px-3 py-1.5 text-sm ${
            entry?.wanted !== undefined
              ? 'border-(--color-live)/40 bg-(--color-live)/15 text-(--color-live)'
              : 'border-(--color-edge) hover:border-(--color-muted)'
          }`}
        >
          {entry?.wanted !== undefined ? t('progress.wanted') : t('progress.want')}
        </button>

        {position === undefined ? (
          <button
            type="button"
            onClick={() => setPosition(key, seasons[0]?.seasonNumber ?? 1, 1)}
            className="rounded-full border border-(--color-edge) px-3 py-1.5 text-sm hover:border-(--color-muted)"
          >
            {t('progress.start')}
          </button>
        ) : null}
      </div>

      {/* Le chiffre du produit, enfin soustrait. « ~62 h » ne parle qu'a un arrivant :
          des qu'on a commence, c'est un cout deja paye en partie. Or c'est au milieu
          d'une serie qu'on se demande si on la finit. */}
      {left !== undefined && !left.done ? (
        <p className="border-t border-(--color-edge) pt-3 text-sm">
          {t('progress.remaining', {
            episodes: translateN(locale, 'series.episodes', left.episodes),
            time:
              left.minutes !== undefined
                ? `~ ${formatCommitment(left.minutes, locale)}`
                : '—',
          })}
        </p>
      ) : null}

      {/* Le plan de rattrapage. Il s'affiche meme quand il est intenable : « il faudrait
          5 h par jour » est precisement l'information qui evite un marathon perdu
          d'avance. Le domaine donne le chiffre, c'est ici qu'on choisit la formulation. */}
      {plan !== undefined ? (
        <p
          className={`text-sm ${plan.withinReach ? 'text-(--color-live)' : 'text-(--color-warn)'}`}
        >
          {plan.minutesPerDay !== undefined
            ? t(plan.withinReach ? 'catchup.pace' : 'catchup.tight', {
                episodes: translateN(locale, 'series.episodes', plan.episodes),
                days: translateN(locale, 'catchup.days', plan.days),
                time: formatCommitment(plan.minutesPerDay, locale),
              })
            : t('catchup.plain', {
                episodes: translateN(locale, 'series.episodes', plan.episodes),
                days: translateN(locale, 'catchup.days', plan.days),
              })}
        </p>
      ) : null}

      {/* Niveau 1 — la position, qui n'apparait qu'une fois la serie commencee. */}
      {position !== undefined ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-(--color-edge) pt-3">
          <label className="text-sm text-(--color-muted)" htmlFor="season">
            {t('progress.season')}
          </label>
          <select
            id="season"
            className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1.5 text-sm"
            value={position.seasonNumber}
            onChange={(e) => {
              const season = Number(e.target.value);
              if (Number.isNaN(season)) return;
              setPosition(key, season, 1);
            }}
          >
            {seasons.map((s) => (
              <option key={s.seasonNumber} value={s.seasonNumber}>
                {s.seasonNumber}
              </option>
            ))}
          </select>

          {current !== undefined ? (
            <>
              <label className="text-sm text-(--color-muted)" htmlFor="episode">
                {t('progress.episode')}
              </label>
              <select
                id="episode"
                className="rounded-md border border-(--color-edge) bg-(--color-ink) px-2 py-1.5 text-sm"
                value={position.episodeNumber}
                onChange={(e) =>
                  setPosition(key, current.seasonNumber, Number(e.target.value))
                }
              >
                {Array.from({ length: current.episodeCount }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="text-xs text-(--color-muted)">{t('progress.orGrid')}</span>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Niveau 2 : les notes de saison. Jamais au-dela de la position — la regle de
          spoiler vaut aussi pour la saisie : proposer de noter la saison 6 dit qu'elle
          existe. */}
      {position !== undefined ? (
        <div className="space-y-2 border-t border-(--color-edge) pt-3">
          <p className="text-xs uppercase tracking-wide text-(--color-muted)">
            {t('progress.seasonRatings')}
          </p>

          {/* Le moment ou une note a le plus de sens est celui ou l'on vient de finir
              la saison. Le produit connaissait ce moment et n'en faisait rien : la
              note de saison etait offerte, jamais demandee. Un seul rappel a la fois —
              en reclamer six n'en ferait satisfaire aucun. */}
          {toRate !== undefined ? (
            <p className="text-sm text-(--color-live)">
              {t('progress.rateSeason', { n: toRate })}
            </p>
          ) : null}
          <ul className="space-y-1">
            {seasons
              .filter((s) => s.seasonNumber <= position.seasonNumber)
              .map((s) => {
                const rating = entry?.seasonRatings?.[String(s.seasonNumber)];
                const suggestion = suggestedSeasonRating(entry, s.seasonNumber);
                return (
                  <li key={s.seasonNumber} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-16 shrink-0 text-(--color-muted)">
                      {t('progress.seasonN', { n: s.seasonNumber })}
                    </span>
                    <StarRating
                      value={rating?.stars}
                      label={t('rating.season', { n: s.seasonNumber })}
                      onChange={(stars) => setSeasonRating(key, s.seasonNumber, stars)}
                    />
                    {/* On signale, on ne repare pas en silence (`AGENTS.md` regle 8) :
                        des episodes notes suggerent une note de saison, ils ne
                        l'ecrivent pas. */}
                    {rating === undefined && suggestion !== undefined ? (
                      <button
                        type="button"
                        onClick={() => setSeasonRating(key, s.seasonNumber, suggestion)}
                        className="text-xs text-(--color-muted) underline decoration-dotted underline-offset-2 hover:text-(--color-text)"
                      >
                        {t('progress.suggest', { v: n(suggestion, 1) })}
                      </button>
                    ) : null}
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      {/* Niveau 3 : la decision, qui est la donnee propre du produit. */}
      {position !== undefined ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-(--color-edge) pt-3">
          {(
            [
              ['continuing', 'decision.continuing'],
              ['paused', 'decision.paused'],
              ['abandoned', 'decision.abandoned'],
              ['completed', 'decision.completed'],
            ] as const
          ).map(([kind, label]) => {
            const active = entry?.decision?.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => setDecision(key, active ? undefined : kind)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active
                    ? 'border-(--color-live)/40 bg-(--color-live)/15 text-(--color-live)'
                    : 'border-(--color-edge) text-(--color-muted) hover:border-(--color-muted)'
                }`}
              >
                {t(label)}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

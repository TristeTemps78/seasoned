'use client';

import { useState } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { MAX_REVIEW_CHARS, checkReview, journalKey, reviewKey } from '@/src/domain/journal';

/**
 * Ecrire ce qu'on a pense — le premier champ de texte libre de tout le produit.
 *
 * ## Deux gestes, pas un
 *
 * **Ecrire** enregistre dans le journal, tout de suite et sans reseau : c'est chez soi, ca
 * marche hors ligne, et ca part dans l'export (regle 9). **Publier** est un second geste,
 * explicite — *rien ne devient public sans qu'on l'ait demande*.
 *
 * La consequence pratique compte : on peut tenir un carnet prive sur ses series sans jamais
 * rien publier, et le corpus existe deja le jour ou l'on ouvre.
 *
 * ## La borne de spoiler est declaree, jamais deduite
 *
 * Elle est prerenseignee depuis la cible — une critique de la saison 3 annonce la saison 3 —
 * mais l'auteur peut dire « sans spoiler », et c'est **lui** qui tranche. La deduire de sa
 * position reviendrait a publier ou il en est sans qu'il l'ait choisi.
 */
export function ReviewEditor({ seriesId, seasonNumber, canPublish }: {
  readonly seriesId: string;
  /** Absent : la critique porte sur la serie entiere. */
  readonly seasonNumber?: number;
  /** Faux quand le verrou legal est ferme : on peut ecrire, pas publier. */
  readonly canPublish: boolean;
}) {
  const { journal, ready, setReview } = useJournal();
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);

  const key = journalKey(seriesId);
  const target = reviewKey(seasonNumber);
  const entry = journal.entries[key];
  const existing = entry?.reviews?.[target];

  // La saison que le texte annonce quand il n'est pas « sans spoiler ».
  //
  // Pour une critique de saison, c'est la saison elle-meme. Pour une critique de serie,
  // c'est **la ou en est l'auteur** — il ne peut pas revelér plus loin que ce qu'il a vu.
  // Prerenseignee et non deduite en silence : le libelle du bouton l'affiche, et l'auteur
  // peut toujours basculer sur « sans spoiler » (regle 7 — le geste est le sien).
  const bound = seasonNumber ?? entry?.position?.seasonNumber ?? 1;
  const [text, setText] = useState(existing?.text ?? '');
  const [spoilerFree, setSpoilerFree] = useState((existing?.throughSeason ?? 0) === 0);

  if (!ready) return null;

  const check = checkReview(text);
  const label = seasonNumber === undefined ? t('review.onSeries') : t('review.onSeason', { n: seasonNumber });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn rounded-full">
        {existing === undefined ? t('review.write') : t('review.edit')}
        <span className="sr-only"> — {label}</span>
      </button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <label className="block meta" htmlFor={`review-${target}`}>
        {label}
      </label>
      <textarea
        id={`review-${target}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        className="field w-full"
        placeholder={t('review.placeholder')}
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="meta-sm">
          {text.trim().length} / {MAX_REVIEW_CHARS}
        </span>

        {/* La borne, en un seul interrupteur : « sans spoiler » ou « jusqu'a la saison N ».
            Un champ libre demanderait de choisir un nombre que personne n'a envie de
            choisir, pour une nuance que le texte ne porte de toute facon pas. */}
        <button
          type="button"
          aria-pressed={spoilerFree}
          onClick={() => setSpoilerFree((value) => !value)}
          className="btn rounded-full"
        >
          {spoilerFree ? t('review.noSpoiler') : t('review.spoilerThrough', { n: bound })}
        </button>

        <button
          type="button"
          disabled={!check.ok && text.trim().length > 0}
          onClick={() => {
            setReview(key, target, {
              text,
              throughSeason: spoilerFree ? 0 : bound,
              lang: locale,
            });
            setOpen(false);
          }}
          className="btn rounded-full"
        >
          {t('review.save')}
        </button>
      </div>

      {!check.ok && check.reason === 'too_long' ? (
        <p className="text-sm text-(--color-warn)">{t('review.tooLong', { n: MAX_REVIEW_CHARS })}</p>
      ) : null}

      {/* ⛔ Le verrou legal. On peut ecrire sans, jamais publier : sans adresse de contact,
          il n'existe aucune voie de recours — meme raison qui ferme la face « Mes amis ». */}
      {!canPublish ? <p className="meta-sm">{t('review.publishLocked')}</p> : null}
    </div>
  );
}


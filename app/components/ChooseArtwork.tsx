'use client';

import { useState } from 'react';

import { backdropUrl, posterUrl } from '@/lib/catalog';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { journalKey } from '@/src/domain/journal';

/**
 * Choisir son affiche — parmi celles que TMDB porte deja.
 *
 * ## Ce que cette feature ne cree PAS, et c'est tout son interet
 *
 * C'est la fonctionnalite la plus aimee de Serializd. Le reflexe serait de laisser envoyer
 * une image : ce serait ouvrir d'un coup le **stockage non borne**, la **moderation
 * d'images** et une **surface de droit d'auteur** a notre charge — les trois raisons pour
 * lesquelles A12 a ecarte l'upload pour les GIF.
 *
 * On ne propose donc que ce que le catalogue sert deja, et on ne garde que **le choix** —
 * un chemin, jamais une image. Aucun envoi, aucun hebergement, rien a moderer.
 *
 * ## Pourquoi ce composant est client
 *
 * Le choix vit dans le journal, donc dans le navigateur, tandis que la page serie est
 * rendue au bord et **partagee entre tous les visiteurs**. Le serveur sert les visuels
 * possibles (les memes pour tout le monde, donc cachables) et c'est ici qu'on decide
 * lequel s'affiche.
 *
 * ⚠️ **Se tait quand il n'y a rien a choisir.** Beaucoup de series n'ont qu'une affiche :
 * un selecteur a un seul element est un bouton qui ne fait rien.
 */
export function ChooseArtwork({
  seriesId,
  posters,
  backdrops,
}: {
  /** L'identifiant du catalogue. La cle de journal se fabrique **ici**, jamais sur le
   *  serveur : `no-journal-on-server` interdit a un module serveur d'importer le journal. */
  readonly seriesId: string;
  readonly posters: readonly string[];
  readonly backdrops: readonly string[];
}) {
  const { t } = useT();
  const { journal, ready, setArtwork } = useJournal();
  const [open, setOpen] = useState(false);

  if (!ready) return null;
  if (posters.length < 2 && backdrops.length < 2) return null;

  const key = journalKey(seriesId);
  const entry = journal.entries[key];

  // ⚠️ Par les helpers de `lib/catalog`, jamais par une concatenation locale : affiches et
  // bannieres ont **deux jeux de tailles** chez TMDB, et les melanger sert un 404.
  const rows = [
    {
      which: 'poster' as const,
      paths: posters,
      chosen: entry?.poster,
      url: (path: string) => posterUrl(path, 'w154'),
    },
    {
      which: 'backdrop' as const,
      paths: backdrops,
      chosen: entry?.backdrop,
      url: (path: string) => backdropUrl(path, 'w300'),
    },
  ].filter((row) => row.paths.length >= 2);

  return (
    <section className="space-y-3" aria-label={t('artwork.aria')}>
      <button type="button" className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        {t(open ? 'artwork.close' : 'artwork.open')}
      </button>

      {open
        ? rows.map((row) => (
            <div key={row.which} className="space-y-2">
              <p className="label">{t(`artwork.${row.which}`)}</p>
              <ul className="flex flex-wrap gap-2">
                {/* Le visuel du catalogue reste le premier choix : « revenir a celui
                    d'origine » doit etre aussi facile que d'en changer. */}
                <li>
                  <button
                    type="button"
                    aria-pressed={row.chosen === undefined}
                    onClick={() => setArtwork(key, row.which, undefined)}
                    className={`btn text-xs ${
                      row.chosen === undefined ? 'border-(--color-volt) text-(--color-volt)' : ''
                    }`}
                  >
                    {t('artwork.default')}
                  </button>
                </li>
                {row.paths.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      aria-pressed={row.chosen === path}
                      onClick={() => setArtwork(key, row.which, path)}
                      className={`overflow-hidden rounded border ${
                        row.chosen === path
                          ? 'border-(--color-volt)'
                          : 'border-(--color-edge) hover:border-(--color-muted)'
                      }`}
                    >
                      {/* Le CDN de TMDB, comme partout ailleurs : rien n'est heberge ici.
                          eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.url(path)}
                        alt=""
                        loading="lazy"
                        className="block h-24 w-auto"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        : null}
    </section>
  );
}

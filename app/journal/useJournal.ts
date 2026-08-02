'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DecisionKind, SeriesId, Stars } from '@/src/domain/types';
import {
  EMPTY_JOURNAL,
  parseJournal,
  serializeJournal,
  setDecision as setDecisionIn,
  setPosition as setPositionIn,
  setSeasonRating as setSeasonRatingIn,
  type Journal,
} from '@/src/domain/journal';

const STORAGE_KEY = 'seasoned.journal.v1';

/**
 * Evenement emis a chaque ecriture.
 *
 * Sans lui, deux composants de la meme page — la position et les notes de saison —
 * s'ignoreraient : chacun garderait son propre etat et l'ecran deviendrait incoherent.
 * `storage` ne suffit pas, le navigateur ne le declenche pas dans l'onglet qui ecrit.
 */
const CHANGE_EVENT = 'seasoned:journal';

function read(): Journal {
  if (typeof window === 'undefined') return EMPTY_JOURNAL;
  try {
    return parseJournal(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Stockage refuse : navigation privee, quota plein, parametres restrictifs.
    // Le site doit rester utilisable, simplement sans memoire.
    return EMPTY_JOURNAL;
  }
}

function write(journal: Journal): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeJournal(journal));
  } catch {
    // Ecriture impossible : on garde l'etat en memoire pour la session en cours
    // plutot que de faire echouer l'interaction sous les yeux de l'utilisateur.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Le journal personnel, cote navigateur.
 *
 * **La page reste statique et mise en cache** : le serveur ne sait rien de cet etat,
 * il est ajoute apres coup. C'est ce qui permet d'avoir de la memoire sans renoncer au
 * budget (`ROADMAP.md` §1.4) — et sans base de donnees, donc sans compte a creer ni
 * donnee personnelle a heberger.
 *
 * `ready` distingue « journal vide » de « pas encore lu ». Sans cette distinction, le
 * premier rendu afficherait « vous n'avez rien vu » a quelqu'un qui a tout note, et le
 * serveur et le client rendraient deux choses differentes.
 */
export function useJournal() {
  const [journal, setJournal] = useState<Journal>(EMPTY_JOURNAL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setJournal(read());
    sync();
    setReady(true);

    window.addEventListener(CHANGE_EVENT, sync);
    // `storage` couvre les autres onglets ; CHANGE_EVENT couvre celui-ci.
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((next: Journal) => {
    setJournal(next);
    write(next);
  }, []);

  return {
    journal,
    ready,
    setPosition: useCallback(
      (seriesId: SeriesId, season: number, episode: number) =>
        update(setPositionIn(read(), seriesId, season, episode)),
      [update],
    ),
    setSeasonRating: useCallback(
      (seriesId: SeriesId, season: number, stars: Stars | undefined) =>
        update(setSeasonRatingIn(read(), seriesId, season, stars)),
      [update],
    ),
    setDecision: useCallback(
      (seriesId: SeriesId, kind: DecisionKind | undefined) =>
        update(setDecisionIn(read(), seriesId, kind)),
      [update],
    ),
  };
}

/** Le journal entier, pour l'export. */
export function exportJournal(): string {
  return serializeJournal(read());
}

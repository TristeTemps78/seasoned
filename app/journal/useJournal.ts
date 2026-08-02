'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecisionKind, Stars } from '@/src/domain/types';
import {
  EMPTY_JOURNAL,
  mergeJournals,
  parseJournal,
  serializeJournal,
  setDecision as setDecisionIn,
  setEpisodeRating as setEpisodeRatingIn,
  setPlatforms as setPlatformsIn,
  setPosition as setPositionIn,
  setSeasonRating as setSeasonRatingIn,
  setSnapshot as setSnapshotIn,
  setWanted as setWantedIn,
  type Journal,
  type JournalKey,
  type JournalSnapshot,
} from '@/src/domain/journal';
import { browserJournalStore } from '@/src/journal/local';
import type { JournalStore } from '@/src/journal/store';

/**
 * Le journal personnel, cote navigateur.
 *
 * **La page reste statique et mise en cache** : le serveur ne sait rien de cet etat,
 * il est ajoute apres coup. C'est ce qui permet d'avoir de la memoire sans renoncer au
 * budget (`ROADMAP.md` §1.4) — et sans base de donnees, donc sans compte a creer ni
 * donnee personnelle a heberger.
 *
 * Tout passe par le port {@link JournalStore} : ce module ne sait pas ou les donnees
 * sont rangees. Le jour ou elles vivront sur un serveur — ou dans IndexedDB, pour le
 * volume — c'est une implementation a ecrire, pas cette couche a reprendre.
 *
 * `ready` distingue « journal vide » de « pas encore lu ». Sans cette distinction, le
 * premier rendu afficherait « vous n'avez rien vu » a quelqu'un qui a tout note, et le
 * serveur et le client rendraient deux choses differentes.
 */
export function useJournal() {
  const [journal, setJournal] = useState<Journal>(EMPTY_JOURNAL);
  const [ready, setReady] = useState(false);
  const storeRef = useRef<JournalStore | undefined>(undefined);
  // Le journal courant, hors du cycle de rendu : une ecriture doit partir du dernier
  // etat connu, pas de celui capture a la creation du gestionnaire d'evenement.
  const latest = useRef<Journal>(EMPTY_JOURNAL);

  useEffect(() => {
    const store = browserJournalStore();
    storeRef.current = store;
    if (store === undefined) return;

    let alive = true;
    const apply = (next: Journal) => {
      if (!alive) return;
      latest.current = next;
      setJournal(next);
    };

    void store.load().then((loaded) => {
      apply(loaded);
      if (alive) setReady(true);
    });

    const stop = store.subscribe(apply);
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const update = useCallback((next: Journal) => {
    latest.current = next;
    setJournal(next);
    void storeRef.current?.save(next);
  }, []);

  const mutate = useCallback(
    (change: (current: Journal) => Journal) => update(change(latest.current)),
    [update],
  );

  return {
    journal,
    ready,

    setPosition: useCallback(
      (key: JournalKey, season: number, episode: number) =>
        mutate((j) => setPositionIn(j, key, season, episode)),
      [mutate],
    ),
    setSeasonRating: useCallback(
      (key: JournalKey, season: number, stars: Stars | undefined) =>
        mutate((j) => setSeasonRatingIn(j, key, season, stars)),
      [mutate],
    ),
    setEpisodeRating: useCallback(
      (key: JournalKey, season: number, episode: number, stars: Stars | undefined) =>
        mutate((j) => setEpisodeRatingIn(j, key, season, episode, stars)),
      [mutate],
    ),
    setDecision: useCallback(
      (key: JournalKey, kind: DecisionKind | undefined) =>
        mutate((j) => setDecisionIn(j, key, kind)),
      [mutate],
    ),
    setWanted: useCallback(
      (key: JournalKey, wanted: boolean) => mutate((j) => setWantedIn(j, key, wanted)),
      [mutate],
    ),
    setPlatforms: useCallback(
      (platforms: readonly string[]) => mutate((j) => setPlatformsIn(j, platforms)),
      [mutate],
    ),

    /**
     * Memorise de quoi dessiner la vignette de cette serie **ailleurs**.
     *
     * N'ecrit que si l'entree existe deja, et ne declenche donc rien pour un visiteur
     * qui ne fait que passer : voir `setSnapshot` dans le domaine.
     */
    rememberSnapshot: useCallback(
      (key: JournalKey, snapshot: Omit<JournalSnapshot, 'cachedAt'>) => {
        const current = latest.current;
        const next = setSnapshotIn(current, key, snapshot);
        if (next !== current) update(next);
      },
      [update],
    ),

    /**
     * Relit un journal exporte et le **fusionne** avec celui-ci.
     *
     * Fusionner et non remplacer : importer sur un appareil deja utilise ne doit pas
     * effacer ce qu'on y a fait. `mergeJournals` tranche champ par champ, donc les
     * deux apports survivent.
     *
     * @returns le nombre de series presentes apres fusion, ou `undefined` si le
     *   fichier n'a rien donne de lisible — un import muet serait pire qu'une erreur.
     */
    importJournal: useCallback(
      (raw: string): number | undefined => {
        const incoming = parseJournal(raw);
        if (Object.keys(incoming.entries).length === 0) return undefined;
        const merged = mergeJournals(latest.current, incoming);
        update(merged);
        return Object.keys(merged.entries).length;
      },
      [update],
    ),

    /** Le journal entier, tel qu'il sera ecrit dans le fichier d'export. */
    exportJournal: useCallback(() => serializeJournal(latest.current), []),
  };
}

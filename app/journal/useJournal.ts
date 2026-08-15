'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DecisionKind, Stars } from '@/src/domain/types';
import type { FaceId } from '@/src/domain/face';
import {
  EMPTY_JOURNAL,
  mergeJournals,
  parseJournal,
  serializeJournal,
  markCompleted as markCompletedIn,
  setDecision as setDecisionIn,
  setEpisodeRating as setEpisodeRatingIn,
  setPlatforms as setPlatformsIn,
  setRegions as setRegionsIn,
  setArtwork as setArtworkIn,
  setHideHours as setHideHoursIn,
  setKeepStopsPrivate as setKeepStopsPrivateIn,
  announceFace as announceFaceIn,
  setPosition as setPositionIn,
  setSeasonRating as setSeasonRatingIn,
  setSnapshot as setSnapshotIn,
  setWanted as setWantedIn,
  setLiked as setLikedIn,
  setEpisodeMark as setEpisodeMarkIn,
  setReview as setReviewIn,
  type Journal,
  type JournalKey,
  type JournalSnapshot,
} from '@/src/domain/journal';
import type { SeasonSize } from '@/src/domain/remaining';
import { activeJournalStore, watchJournalStore } from '@/app/journal/journalStore';
import type { JournalStore } from '@/src/journal/store';

/** Delai en deca duquel un instantane identique n'est pas reecrit. */
const SNAPSHOT_REWRITE_MS = 86_400_000;

/**
 * Deux decoupages en saisons identiques ?
 *
 * Compare le **contenu**, jamais les references : le tableau entrant est reconstruit a
 * chaque rendu de la page, donc une egalite de reference serait toujours fausse et
 * provoquerait une ecriture par rendu.
 */
function sameSizes(
  a: readonly SeasonSize[] | undefined,
  b: readonly SeasonSize[] | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  if (a.length !== b.length) return false;
  return a.every((season, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      season.seasonNumber === other.seasonNumber &&
      season.episodeCount === other.episodeCount
    );
  });
}

/**
 * L'instantane range est-il deja celui qu'on s'apprete a ecrire ?
 *
 * ⚠️ **Chaque champ de l'instantane doit figurer ici.** Un champ oublie rend son ecriture
 * invisible pendant vingt-quatre heures : la comparaison declare « rien n'a change », donc
 * la valeur neuve n'est jamais rangee. C'est arrive deux fois de suite — `episodeMinutes`
 * puis `seasonSizes` ont ete ajoutes a l'instantane sans l'etre ici, et le premier est
 * reste sans effet sur toute serie revisitee dans la journee.
 */
function isFresh(
  existing: JournalSnapshot | undefined,
  incoming: Omit<JournalSnapshot, 'cachedAt'>,
): boolean {
  if (existing === undefined) return false;
  const age = Date.now() - new Date(existing.cachedAt).getTime();
  if (Number.isNaN(age) || age > SNAPSHOT_REWRITE_MS) return false;
  return (
    existing.title === incoming.title &&
    existing.posterPath === incoming.posterPath &&
    // ⚠️ Troisieme occurrence evitee : `status` a ete ajoute a l'instantane le
    // 2026-08-03, et l'oublier ici aurait rendu son ecriture invisible 24 h — donc la
    // bibliotheque aurait continue d'afficher le libelle fige, defaut inchange.
    existing.status === incoming.status &&
    existing.statusLabel === incoming.statusLabel &&
    existing.nextEpisodeAt === incoming.nextEpisodeAt &&
    existing.publicStars === incoming.publicStars &&
    existing.episodeMinutes === incoming.episodeMinutes &&
    sameSizes(existing.seasonSizes, incoming.seasonSizes)
  );
}

/**
 * Le journal personnel, cote navigateur.
 *
 * **La page reste statique et mise en cache** : le serveur ne sait rien de cet etat,
 * il est ajoute apres coup. C'est ce qui permet d'avoir de la memoire sans renoncer au
 * budget — et sans base de donnees, donc sans compte a creer ni
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
    let alive = true;
    let stop: (() => void) | undefined;

    const apply = (next: Journal) => {
      if (!alive) return;
      latest.current = next;
      setJournal(next);
    };

    // ⚠️ Rejoue a chaque changement de store, c'est-a-dire a la connexion et a la
    // deconnexion : le journal du compte n'est pas celui de l'appareil, et un ecran qui
    // continuerait de lire l'ancien afficherait le journal de la session precedente.
    const attach = () => {
      stop?.();
      const store = activeJournalStore();
      storeRef.current = store;
      if (store === undefined) return;

      void store.load().then((loaded) => {
        apply(loaded);
        if (alive) setReady(true);
      });
      stop = store.subscribe(apply);
    };

    attach();
    const unwatch = watchJournalStore(attach);

    return () => {
      alive = false;
      unwatch();
      stop?.();
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
    /**
     * Pose la decision, et **enregistre le passage** quand elle vaut « terminee ».
     *
     * Les deux ensemble, et pas l'un a la place de l'autre : la decision decrit un etat
     * courant qui se retire, un visionnage acheve est un evenement qui ne se retire pas.
     * `markCompleted` est idempotent dans la journee, donc basculer la decision dix fois
     * ne compte jamais dix visionnages.
     */
    setDecision: useCallback(
      (key: JournalKey, kind: DecisionKind | undefined) =>
        mutate((j) => {
          const withDecision = setDecisionIn(j, key, kind);
          return kind === 'completed' ? markCompletedIn(withDecision, key) : withDecision;
        }),
      [mutate],
    ),
    /**
     * Enregistre un passage de plus, **sans toucher a la decision**.
     *
     * ## Pourquoi ce geste existe separement
     *
     * `setDecision(key, 'completed')` enregistrait le seul passage que le produit savait
     * compter, et il ne le faisait qu'**une fois** : une serie deja terminee n'a plus de
     * decision a poser, donc revoir *The Office* une troisieme fois n'avait aucun endroit
     * ou s'ecrire. Le format savait le retenir depuis la v3 (`completions` est une liste),
     * l'interface ne savait pas l'ecrire — septieme « une fonctionnalite ecrite n'est pas
     * une fonctionnalite qui marche ».
     *
     * Et c'est le fait le plus difficile a falsifier du produit : une note de cinq etoiles
     * se pose en un clic, un troisieme visionnage se merite.
     *
     * ⚠️ Idempotent dans la journee ({@link dedupeByDay}). L'appelant doit donc demander
     * {@link hasCompletionOn} **avant** de proposer le geste, sans quoi il rend un bouton
     * qui a l'air de marcher et ne fait rien.
     */
    watchAgain: useCallback(
      (key: JournalKey) => mutate((j) => markCompletedIn(j, key)),
      [mutate],
    ),
    setWanted: useCallback(
      (key: JournalKey, wanted: boolean) => mutate((j) => setWantedIn(j, key, wanted)),
      [mutate],
    ),
    setReview: useCallback(
      (
        key: JournalKey,
        target: string,
        review: { readonly text: string; readonly throughSeason: number; readonly lang?: string },
      ) => mutate((j) => setReviewIn(j, key, target, review)),
      [mutate],
    ),
    setLiked: useCallback(
      (key: JournalKey, liked: boolean) => mutate((j) => setLikedIn(j, key, liked)),
      [mutate],
    ),
    setEpisodeMark: useCallback(
      (
        key: JournalKey,
        seasonNumber: number,
        episodeNumber: number,
        kind: 'skipped' | 'watched' | undefined,
      ) => mutate((j) => setEpisodeMarkIn(j, key, seasonNumber, episodeNumber, kind)),
      [mutate],
    ),
    setPlatforms: useCallback(
      (platforms: readonly string[]) => mutate((j) => setPlatformsIn(j, platforms)),
      [mutate],
    ),
    setRegions: useCallback(
      (regions: readonly string[]) => mutate((j) => setRegionsIn(j, regions)),
      [mutate],
    ),
    setHideHours: useCallback(
      (hide: boolean) => mutate((j) => setHideHoursIn(j, hide)),
      [mutate],
    ),
    setKeepStopsPrivate: useCallback(
      (keepPrivate: boolean) => mutate((j) => setKeepStopsPrivateIn(j, keepPrivate)),
      [mutate],
    ),
    /**
     * Retenir qu'on vient de montrer cette face (9.3).
     *
     * ⚠️ `announceFace` rend le journal **tel quel** quand la face est deja celle annoncee :
     * l'appel est donc sans effet hors d'une vraie bascule, y compris s'il part a chaque
     * rendu. C'est ce qui evite qu'une annonce devienne un battement de coeur — et avec lui
     * une sauvegarde, une synchronisation et un envoi social par page affichee.
     */
    announceFace: useCallback(
      (id: FaceId) => mutate((j) => announceFaceIn(j, id)),
      [mutate],
    ),
    setArtwork: useCallback(
      (key: JournalKey, which: 'poster' | 'backdrop', path: string | undefined) =>
        mutate((j) => setArtworkIn(j, key, which, path)),
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
        const entry = current.entries[key];
        if (entry === undefined) return;
        // Ne pas reecrire pour rien : une visite de plus sur une fiche inchangee ne
        // doit pas provoquer une ecriture, ni faire tourner un cycle de rendu.
        if (isFresh(entry.snapshot, snapshot)) return;

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

    /**
     * Ecrit un journal deja construit.
     *
     * Reserve aux appelants qui ont fait la fusion eux-memes — l'import d'un export
     * tiers, ou `src/domain/import.ts` fusionne deja avec l'existant. Volontairement
     * distinct de {@link importJournal} : celui-la lit **notre** format, celui-ci
     * accepte un resultat quelconque, et confondre les deux ferait passer un journal
     * etranger pour un des notres.
     */
    replaceJournal: useCallback((next: Journal) => update(next), [update]),

    /** Le journal entier, tel qu'il sera ecrit dans le fichier d'export. */
    exportJournal: useCallback(() => serializeJournal(latest.current), []),
  };
}

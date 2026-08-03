'use client';

import { accountStorageKey, browserJournalStore } from '@/src/journal/local';
import { RemoteJournalStore } from '@/src/journal/remote';
import { SyncingJournalStore } from '@/src/journal/syncing';
import type { JournalStore } from '@/src/journal/store';
import type { AuthConfig } from '@/src/auth/client';

/**
 * **Un seul** store par document, et qui peut changer.
 *
 * ## 🔴 Le defaut que ce module repare
 *
 * `useJournal()` appelait `browserJournalStore()` a chaque appel, et **treize composants**
 * l'appellent sur une meme page. Sans compte, c'etait sans consequence visible : treize
 * objets qui lisent le meme `localStorage`. Des qu'un journal se synchronise, ce sont
 * **treize lectures distantes et treize boucles de poussee** par page ouverte.
 *
 * Un module a etat plutot qu'un contexte React : le store doit survivre au demontage d'un
 * composant, et il est lu par du code qui n'est pas un rendu (la poussee differee).
 */

let store: JournalStore | undefined;
let syncing: SyncingJournalStore | undefined;
let token: string | undefined;

const watchers = new Set<() => void>();

function announce(): void {
  for (const watcher of watchers) watcher();
}

/** Le store courant, ou `undefined` hors navigateur (la regle du journal cote serveur). */
export function activeJournalStore(): JournalStore | undefined {
  if (typeof window === 'undefined') return undefined;
  store ??= browserJournalStore();
  return store;
}

/** Previent quand le store change — c'est-a-dire a la connexion et a la deconnexion. */
export function watchJournalStore(listener: () => void): () => void {
  watchers.add(listener);
  return () => watchers.delete(listener);
}

/**
 * Branche la synchronisation pour un compte.
 *
 * ⚠️ Le jeton est lu **a chaque requete** et non capture : il se rafraichit, et le figer
 * ferait echouer tout ce qui suit le premier rafraichissement, avec une erreur
 * d'autorisation trompeuse.
 */
export function connectJournal(config: AuthConfig, userId: string, accessToken: string): void {
  token = accessToken;
  if (syncing !== undefined) return;

  const local = browserJournalStore(accountStorageKey(userId));
  if (local === undefined) return;

  syncing = new SyncingJournalStore({
    local,
    remote: new RemoteJournalStore({
      url: config.url,
      anonKey: config.anonKey,
      accessToken: () => token,
      userId,
    }),
  });

  store = syncing;
  announce();
  // Une premiere synchronisation tout de suite : c'est elle qui ramene ce qui a ete note
  // sur l'autre appareil. Les abonnes du store local seront prevenus si elle apporte
  // quelque chose.
  void syncing.sync();
}

/**
 * Debranche — a la deconnexion.
 *
 * Ce qui attendait d'etre pousse ne l'est pas : se deconnecter est un ordre. Le journal du
 * compte reste range sous sa propre cle, donc rien n'est perdu et rien ne se melange.
 */
export function disconnectJournal(): void {
  if (syncing === undefined) return;
  syncing.stop();
  syncing = undefined;
  token = undefined;
  store = browserJournalStore();
  announce();
}

/** Pousse maintenant ce qui attendait. Appele quand la page se ferme. */
export function flushJournal(): void {
  void syncing?.flush();
}

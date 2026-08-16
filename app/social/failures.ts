import type { SocialOptions } from '@/src/social/client';

/**
 * Le canal des pannes d'ecriture — de `socialFrom` jusqu'a l'ecran.
 *
 * ## 🔴 Le defaut, et pourquoi il a coute trois fonctionnalites
 *
 * `onFailure` a ete ajoute le 2026-08-11 « pour qu'un echec cesse d'etre indiscernable d'un
 * vide ». Mesure le 2026-08-16 : **aucun appelant ne le passait**. Le rappel existait, il
 * etait documente, teste, propage jusqu'a `socialFrom` — et il n'avait pas un seul abonne.
 *
 * Consequence, trois fois : le lot 10.0 (trois lectures en 400 depuis toujours), `017`
 * (quatre ecritures sur cinq en 42501), la carte des abandons (chaque publication refusee
 * depuis le lot 11). A chaque fois, l'ecran d'une fonctionnalite en panne etait **identique**
 * a celui d'un demarrage a froid, et il a fallu ouvrir l'onglet reseau d'un navigateur pour
 * l'apprendre.
 *
 * ## Pourquoi un module et pas un contexte React
 *
 * Douze composants appellent `socialFrom(accessToken)`. Un contexte obligerait chacun a lire
 * un hook et a repasser le rappel — c'est-a-dire douze fichiers a toucher, exactement ce que
 * `socialFrom` existe pour eviter, et exactement la raison pour laquelle `onFailure` n'a
 * jamais ete branche. Ici l'abonnement est **le defaut** de `socialFrom` : aucun appelant
 * n'a rien a faire, et un treizieme composant ecrit demain est couvert sans le savoir.
 *
 * ⚠️ **Seules les ecritures remontent.** Une lecture ratee a deja son ecran — `EmptyState`
 * prend un `status` et `FriendsFeed` distingue « rien a lire » de « je n'ai pas pu lire ».
 * Une ecriture ratee, elle, n'a rien : le geste a l'air d'avoir marche.
 *
 * ⚠️ **Rien n'est garde.** Pas d'historique, pas de compteur : le dernier echec, et il
 * s'efface des qu'on l'a vu. Un journal de pannes serait un etat de plus a tenir, pour une
 * information dont la duree de vie utile est celle d'un geste.
 */

/** Ce qu'un ecran a besoin de savoir : ou, et quel code. Le reste est du diagnostic. */
export interface WriteFailure {
  readonly where: string;
  readonly status?: number;
  /** Pour distinguer deux pannes successives au meme endroit — sinon l'ecran ne re-rend pas. */
  readonly at: number;
}

type Listener = (failure: WriteFailure) => void;

const listeners = new Set<Listener>();

/** S'abonner. Rend la fonction de desabonnement, a appeler au demontage. */
export function onWriteFailure(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Le rappel a donner au client social. Ecarte les lectures lui-meme.
 *
 * ⚠️ Il **n'a pas le droit de lever** : `#failed` avale les exceptions de son observateur,
 * mais compter la-dessus reviendrait a laisser une panne d'affichage masquer une panne
 * d'ecriture. Chaque abonne est donc isole ici aussi.
 */
export const reportFailure: NonNullable<SocialOptions['onFailure']> = (where, status, kind) => {
  if (kind !== 'write') return;
  const failure: WriteFailure = {
    where,
    ...(status === undefined ? {} : { status }),
    at: Date.now(),
  };
  for (const listener of listeners) {
    try {
      listener(failure);
    } catch {
      /* Un abonne qui leve ne doit pas empecher les autres d'etre prevenus. */
    }
  }
};

/**
 * Les decisions de la synchronisation, sans reseau.
 *
 * ## Pourquoi elles vivent seules, hors du transport
 *
 * Ce qui casse dans une synchronisation n'est presque jamais la requete : c'est **ce qu'on
 * decide d'en faire**. Fusionner ou pas, adopter un journal trouve sur l'appareil, ecraser
 * ou attendre. Ces choix se testent entierement a plat, alors qu'un test de transport
 * demande un serveur et ne prouve que le tuyau.
 *
 * Module **pur** : ni reseau, ni horloge, ni stockage.
 */

import { mergeJournals, type Journal } from '../domain/journal';

/**
 * A qui appartient le journal range sur cet appareil.
 *
 * Cette cle est le garde-fou de l'appareil partage, et elle n'existe que pour lui.
 */
export const OWNER_KEY = 'voltface.owner.v1';

/**
 * Ce qu'il faut faire du journal local quand quelqu'un se connecte.
 *
 * ## ⚠️ Le defaut que ce type existe pour empecher
 *
 * Un ordinateur familial, un poste de bibliotheque, un telephone prete cinq minutes. Le
 * journal de la personne precedente est encore la. **Une fusion silencieuse le verserait
 * dans le compte de celle qui se connecte** — une fuite de donnees causee par une
 * commodite, et irreversible : une fois fusionne, on ne sait plus quoi appartenait a qui.
 *
 * Le cas est banal, la faute est grave, et rien dans le code ne la signale. D'ou un type
 * qui **force a traiter les trois cas**.
 */
export type AdoptionDecision =
  /** Rien a decider : aucun journal local, ou il est vide. */
  | { readonly kind: 'nothing_to_adopt' }
  /** Ce journal a deja ete lie a ce compte : la fusion est sure et silencieuse. */
  | { readonly kind: 'adopt' }
  /**
   * Un journal existe, et il n'est **pas** connu comme appartenant a ce compte.
   *
   * Il faut demander. Le defaut de l'interface doit etre **non** : garder un journal
   * inconnu hors du compte est reparable — on le retrouve sur l'appareil ; l'avoir
   * fusionne par erreur ne l'est pas.
   */
  | { readonly kind: 'ask'; readonly entries: number };

/**
 * Faut-il verser le journal de cet appareil dans le compte qui se connecte ?
 *
 * @param local le journal trouve sur l'appareil.
 * @param owner le compte auquel ce journal a deja ete lie, s'il y en a un.
 * @param userId le compte qui se connecte maintenant.
 */
export function decideAdoption(
  local: Journal,
  owner: string | undefined,
  userId: string,
): AdoptionDecision {
  const entries = Object.keys(local.entries).length;
  if (entries === 0) return { kind: 'nothing_to_adopt' };

  // Deja lie a ce compte : c'est le cas normal, celui de quelqu'un qui revient sur son
  // propre appareil. Rien a demander.
  if (owner === userId) return { kind: 'adopt' };

  // ⚠️ `owner === undefined` tombe ici **volontairement**. Un journal sans proprietaire
  // connu est le cas de l'appareil partage aussi bien que celui du premier compte de
  // quelqu'un : les deux sont indiscernables, et seule l'une des deux erreurs se repare.
  return { kind: 'ask', entries };
}

/**
 * Les trois issues d'une lecture distante.
 *
 * ## 🔴 Pourquoi trois cas et non un `Journal | undefined`
 *
 * « Le compte n'a rien pousse » et « je n'ai pas pu lire » **n'autorisent pas la meme
 * suite** : le premier permet d'ecrire, le second l'interdit. Les confondre est la seule
 * perte de donnees possible de toute la synchronisation.
 *
 * Le scenario, et il est banal — le cas **mixte** : un `GET` echoue (delai depasse, 5xx
 * passager, jeton expire pile entre les deux appels) puis le `POST` passe. On ecrase alors
 * le journal distant avec un local **qu'on n'a pas fusionne**, faute d'avoir pu le lire, et
 * tout ce qui n'existait que la-haut disparait.
 *
 * > Le type vit ici, dans la couche qui **decide**, et non dans celle qui transporte : une
 * > distinction que personne ne consomme ne protege de rien.
 */
export type RemoteRead =
  /** Le compte a un journal, et le voici. */
  | { readonly kind: 'found'; readonly journal: Journal }
  /** Le compte n'a encore rien pousse. Reponse **certaine** : on peut ecrire. */
  | { readonly kind: 'absent' }
  /** On n'a pas pu savoir. ⚠️ **On n'ecrit rien sur cette issue.** */
  | { readonly kind: 'unavailable' };

/**
 * Ce qui doit etre ecrit de chaque cote apres une lecture des deux.
 *
 * La fusion est **commutative** (`tests/journal-merge.test.ts`, huit lois) : l'ordre des
 * arguments n'a donc aucune importance, et deux appareils qui se synchronisent dans leur
 * propre ordre convergent vers le meme journal. C'est ce qui rend cette fonction si
 * courte, et c'est le benefice direct d'une decision prise le 2026-08-02 pour une autre
 * raison.
 */
export interface SyncOutcome {
  readonly merged: Journal;
  /** Le local doit-il etre reecrit ? Faux si la fusion n'a rien apporte. */
  readonly writeLocal: boolean;
  /** Le distant doit-il etre pousse ? */
  readonly writeRemote: boolean;
}

/**
 * Fusionne les deux cotes et dit qui doit etre reecrit.
 *
 * On ne reecrit **que ce qui change** : sans cette comparaison, chaque ouverture de page
 * declencherait une ecriture des deux cotes, donc une requete reseau et un cycle de rendu,
 * pour un journal identique.
 *
 * @param remote ce que la lecture distante a rendu — voir {@link RemoteRead}.
 */
export function syncJournals(local: Journal, remote: RemoteRead): SyncOutcome {
  // ⚠️ On n'a pas pu lire : on n'ecrit **nulle part**. Pousser ici ecraserait un journal
  // distant qu'on n'a pas fusionne, et c'est irrattrapable si l'autre appareil ne revient
  // pas. Ne rien faire est toujours reparable — la synchro suivante rattrapera.
  if (remote.kind === 'unavailable') {
    return { merged: local, writeLocal: false, writeRemote: false };
  }

  if (remote.kind === 'absent') {
    // Rien la-haut, et on en est sur : on pousse ce qu'on a, sauf s'il n'y a rien.
    const empty = Object.keys(local.entries).length === 0;
    return { merged: local, writeLocal: false, writeRemote: !empty };
  }

  const merged = mergeJournals(local, remote.journal);
  return {
    merged,
    writeLocal: !sameJournal(merged, local),
    writeRemote: !sameJournal(merged, remote.journal),
  };
}

/**
 * Serialisation **stable** : les cles d'objet sont triees, a tous les niveaux.
 *
 * ## ⚠️ Le defaut que ceci repare, trouve par le test de commutativite
 *
 * `mergeJournals(a, b)` et `mergeJournals(b, a)` produisent le meme **contenu** — c'est
 * prouve. Mais pas le meme **ordre de cles** : un objet JavaScript conserve l'ordre
 * d'insertion, qui suit l'ordre des arguments.
 *
 * Un `JSON.stringify` naif voyait donc une difference la ou il n'y en a aucune. La
 * consequence n'etait pas cosmetique : chaque synchronisation aurait conclu « il faut
 * reecrire les deux cotes », donc **deux appareils se seraient ecrit mutuellement en
 * boucle**, indefiniment, sans jamais converger — le defaut classique des synchronisations
 * naives, et exactement celui que la fusion commutative avait ete ecrite pour eviter.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return item;
    // Un objet est rendu avec ses cles triees ; le remplacant est rappele sur chaque
    // valeur, donc le tri s'applique a toute la profondeur sans recursion explicite.
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    );
  });
}

/**
 * Deux journaux portent-ils la meme chose ?
 *
 * Comparaison **serialisee**, et c'est un choix : une egalite structurelle ecrite a la
 * main devrait suivre chaque champ ajoute au journal — cinq l'ont ete en deux jours, et
 * elle aurait pris du retard sans que rien ne le signale. La serialisation, elle, suit
 * toute seule.
 *
 * Le cout est celui de deux chaines par synchronisation, sur un objet qui tient dans
 * quelques dizaines de kilo-octets : negligeable devant l'aller-retour reseau qu'il evite.
 *
 * ## 🔴 Le defaut que `withoutDeviceId` repare, et pourquoi il etait invisible
 *
 * `deviceId` identifie l'**appareil**, pas le contenu. Trois faits qui ne se rencontrent
 * qu'ici :
 *
 * 1. `LocalJournalStore.save()` estampille chaque journal d'un identifiant **propre a
 *    l'appareil** ;
 * 2. `mergeJournals(a, b)` garde **par contrat** celui de `a` — c'est-a-dire celui de
 *    l'appareil qui fusionne ;
 * 3. cette fonction comparait le journal **entier**.
 *
 * Donc `merged.deviceId` valait toujours le mien, et le distant portait toujours celui de
 * l'autre : `writeRemote` etait **vrai a chaque synchronisation**, sur deux journaux
 * pourtant identiques. Deux appareils se seraient reecrit mutuellement **indefiniment**,
 * sans qu'aucun fait ne change.
 *
 * C'est **exactement** le defaut que {@link stableStringify} avait ete ecrit pour tuer,
 * reapparu sur un autre champ. Et il etait indetectable a un seul appareil : il faut deux
 * `deviceId` differents pour le voir, ce qu'aucun test ne produisait — leurs fixtures
 * partent d'`EMPTY_JOURNAL`, que seul `save()` estampille.
 *
 * > La comparaison porte donc sur ce qui **se synchronise**, jamais sur ce qui identifie
 * > le porteur.
 */
function sameJournal(a: Journal, b: Journal): boolean {
  return stableStringify(withoutDeviceId(a)) === stableStringify(withoutDeviceId(b));
}

/** Le journal prive de ce qui designe l'appareil plutot que son contenu. */
function withoutDeviceId(journal: Journal): Omit<Journal, 'deviceId'> {
  const { deviceId: _ignored, ...content } = journal;
  return content;
}

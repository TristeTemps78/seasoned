/**
 * Les quelques statistiques que le domaine partage.
 *
 * ## Pourquoi ce fichier existe, et pourquoi il est si petit
 *
 * 🔴 `median` etait ecrite **trois fois** — `current-season.ts`, `entry-point.ts`,
 * `taste.ts` — et la troisieme copie **avait deja divergé** : elle rend `undefined` quand un
 * des deux voisins du milieu est absent, la ou les deux autres coalescent a zero. Les deux
 * branches sont inatteignables sur un tableau non vide, donc les trois se comportent pareil
 * aujourd'hui. C'est exactement la forme du defaut que ce depot connait : *deux copies
 * finissent par se repondre differemment le jour ou l'une est corrigee*, et la divergence
 * s'installe **avant** de devenir visible.
 *
 * ## ⚠️ Ce qui n'est PAS ici, et le refus est deliberé
 *
 * `mean` (`trajectory.ts`) et `average` (`taste.ts`) portent la meme formule sous deux noms
 * — mais **pas la meme convention sur le vide** : la premiere rend `0`, la seconde
 * `undefined`. Les deux sont justes chez elles : un ecart-type de rien vaut zero, un gout
 * moyen de rien n'existe pas. Les unifier demanderait de trancher une question de sens pour
 * gagner six lignes, et ce depot s'interdit de toucher du vert pour l'elegance.
 *
 * La duplication qu'on retire est celle qui est **litterale**. Celle qui recouvre deux
 * decisions differentes n'en est pas une.
 *
 * Module pur : ni reseau, ni horloge, ni langue.
 */

/**
 * La valeur du milieu, ou la moyenne des deux du milieu.
 *
 * `undefined` sur un tableau vide : il n'y a pas de mediane de rien, et rendre `0` ferait
 * passer une absence pour une mesure.
 */
export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  // ⚠️ Les deux `?? 0` sont inatteignables — `middle` et `middle - 1` sont des index
  // valides des que le tableau est non vide et de longueur paire — et ils restent parce
  // que le typage l'exige (`noUncheckedIndexedAccess`). Les remplacer par un `!` echangerait
  // une ligne morte contre une assertion, ce qui est le mauvais sens.
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

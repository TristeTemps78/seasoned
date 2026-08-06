/**
 * Le journal — **quand une entree vaut d'etre gardee**.
 *
 * Trois fonctions, et elles sont ici parce que **les trois autres briques en dependent** :
 * la lecture pour ne pas ressusciter une entree vide, l'ecriture pour ne pas en creer une,
 * la fusion pour departager. Les laisser dans le parseur aurait fait dependre l'ecriture
 * de la lecture — une inversion que rien ne justifie.
 *
 * La distinction entre {@link hasContent} et {@link worthKeeping} est le coeur du fichier,
 * et elle n'est pas cosmetique : une entree reduite a sa trace de suppression **doit
 * survivre**, sinon la synchronisation annule la suppression.
 */

import type { JournalCompletion, JournalEntry } from './types';

/**
 * Un achevement par jour, au plus.
 *
 * ⚠️ **Par jour et non par instant**, et c'est le point delicat. Deux appareils qui
 * synchronisent, ou un import rejoue, enregistrent le meme achevement a quelques
 * millisecondes d'ecart : dedupliquer sur l'horodatage exact laisserait passer les
 * doublons, et « vu 4 fois » compterait des synchronisations au lieu de visionnages.
 *
 * La contrepartie — terminer deux fois la meme serie le meme jour ne compte que pour un —
 * est acceptee : elle n'arrive pas, et l'erreur inverse arriverait tout le temps.
 */
export function dedupeByDay(
  completions: readonly JournalCompletion[],
): readonly JournalCompletion[] {
  const byDay = new Map<string, JournalCompletion>();
  for (const completion of completions) {
    const day = completion.at.slice(0, 10);
    const existing = byDay.get(day);
    // A jour egal, on garde la date la plus ancienne : c'est celle du visionnage, les
    // suivantes n'etant que des rejeux.
    if (existing === undefined || completion.at < existing.at) byDay.set(day, completion);
  }
  return [...byDay.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Une entree porte-t-elle quelque chose que l'utilisateur reconnaitrait comme sien ?
 *
 * Un instantane seul ne compte pas : ce n'est qu'un cache de vignette. Une trace de
 * suppression non plus — elle dit ce qui n'est **plus** la.
 *
 * C'est ce predicat qui gouverne l'**affichage** et les derivations.
 */
export function hasContent(entry: JournalEntry | undefined): boolean {
  if (entry === undefined) return false;
  return (
    entry.position !== undefined ||
    entry.decision !== undefined ||
    entry.wanted !== undefined ||
    entry.liked !== undefined ||
    (entry.completions ?? []).length > 0 ||
    Object.keys(entry.seasonRatings ?? {}).length > 0 ||
    Object.keys(entry.episodeRatings ?? {}).length > 0 ||
    // Une marque est un geste explicite : sans elle ici, `worthKeeping` supprimerait une
    // entree qui n'a que des marques, et le geste serait perdu a la relecture suivante.
    Object.keys(entry.episodeMarks ?? {}).length > 0 ||
    Object.keys(entry.reviews ?? {}).length > 0
  );
}

/**
 * Faut-il conserver cette entree dans le journal ?
 *
 * Distinct de {@link hasContent}, et la distinction n'est pas cosmetique : **une
 * entree reduite a sa trace de suppression doit survivre**. Sans elle, retirer sa
 * derniere note effacerait l'entree — donc la trace avec — et la note reviendrait
 * telle quelle a la premiere fusion avec un appareil qui l'ignorait. La suppression
 * serait annulee par la synchronisation, ce qui est exactement le defaut que les
 * traces existent pour empecher.
 *
 * Les traces finissent par expirer ({@link TOMBSTONE_TTL_MS}), et l'entree vide
 * disparait alors d'elle-meme a la lecture suivante.
 */
export function worthKeeping(entry: JournalEntry): boolean {
  return (
    hasContent(entry) ||
    Object.keys(entry.removed ?? {}).length > 0 ||
    // Meme raisonnement, applique au pass-through : une entree qui n'a que des champs que
    // nous ne comprenons pas n'a, pour nous, aucun contenu — la jeter la supprimerait du
    // document reecrit.
    Object.keys(entry.unknownFields ?? {}).length > 0
  );
}

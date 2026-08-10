/**
 * Le fil : des faits ET des textes, dans le meme ordre.
 *
 * ## Le trou que ce module referme
 *
 * `activity` ne porte que cinq faits — noter une saison, terminer, commencer, vouloir,
 * aimer. **Une critique n'y entre pas.** Quelqu'un pouvait donc ecrire trois paragraphes
 * sans qu'aucun de ses abonnes ne l'apprenne : le texte n'existait que sur la fiche de la
 * serie et sur son profil, c'est-a-dire aux deux endroits ou il faut deja etre alle.
 *
 * Sur un produit dont la premiere promesse est « de Letterboxd : ecrire », c'etait le trou
 * central. Letterboxd fonctionne parce que son fil est fait de **textes**.
 *
 * ## Pourquoi une fusion, et pas un sixieme genre d'activite
 *
 * Le reflexe aurait ete d'ajouter `kind = 'reviewed'` a `activity`. Il est faux :
 * `activity` est **derivee du journal** a chaque synchronisation, et une critique publiee
 * ne vit pas dans le journal — elle a sa table, sa cle naturelle et sa moderation
 * (`006_reviews.sql`). La deriver donnerait un second etat a garder d'accord avec le
 * premier, et une critique retiree resterait annoncee dans le fil.
 *
 * On lit donc les deux tables et on les range ensemble ici. **Aucune table nouvelle,
 * aucune surface de moderation nouvelle** : ces textes sont deja publies, deja lisibles,
 * deja signalables. Seul l'endroit ou on les rencontre change.
 *
 * Module pur : ni reseau, ni horloge. Le caviardage n'est pas fait ici — il l'est en amont
 * par `redactActivity` et `redactReviewsAcross`, chacun avec la position du lecteur.
 */

/** Un fait du journal, tel que le fil le rend. Seule la date compte ici. */
export interface DatedFact {
  readonly happenedOn: string;
}

/** Une critique publiee. Seule la date compte ici. */
export interface DatedReview {
  readonly publishedAt: string;
}

export type FeedEntry<F, R> =
  | { readonly of: 'fact'; readonly fact: F }
  | { readonly of: 'review'; readonly review: R };

/**
 * Le jour d'un instant, quelle que soit sa precision.
 *
 * ⚠️ Les deux sources ne portent pas la meme chose : `activity.happened_on` est une **date**
 * (c'est la granularite des faits du journal, et ce qui rend sa cle naturelle stable), tandis
 * que `reviews.published_at` est un instant complet.
 *
 * ⚠️ **Et il faut dire ce que cette fonction ne fait PAS, sinon on la croira utile pour la
 * mauvaise raison.** Avec les formats d'aujourd'hui elle ne change aucun ordre : une date
 * courte est deja lexicographiquement plus petite qu'un instant du meme jour, donc le texte
 * passerait devant le fait sans elle. Mesure faite, en retirant le `slice` : les huit
 * premiers tests restaient verts.
 *
 * Ce qu'elle apporte est ailleurs : elle rend la regle **vraie quelle que soit la
 * precision**. Le jour ou `happened_on` porterait une heure — et rien dans le schema ne
 * l'interdit — un fait de 23 h passerait devant un texte de 1 h du meme jour, et la regle
 * ecrite plus bas cesserait de tenir en silence. C'est ce cas-la que le neuvieme test couvre.
 */
function dayOf(instant: string): string {
  return instant.slice(0, 10);
}

/**
 * Range faits et critiques du plus recent au plus ancien.
 *
 * ⚠️ **A egalite de jour, le texte passe devant.** Ce n'est pas un detail d'affichage :
 * les deux sources n'ont pas la meme precision, donc il n'existe aucun ordre « vrai » a
 * l'interieur d'une journee — il fallait choisir, et le choix doit etre ecrit plutot que
 * subi (le defaut du `deviceId` de `sameJournal`, qui dependait de l'ordre d'arrivee).
 * Un texte coute a ecrire et se lit ; un « a commence Dark » ne se lit pas. Le fil met
 * donc devant ce qui merite d'etre lu.
 *
 * Le tri est **stable a l'interieur de chaque source** : les deux listes arrivent deja
 * ordonnees par la base, et `Array.prototype.sort` preserve l'ordre des elements egaux.
 *
 * ⚠️ La coupe se fait **apres** la fusion. Couper chaque source en amont rendrait les N
 * plus recents de chacune, donc de vieux textes devant des faits recents.
 */
export function mergeFeed<F extends DatedFact, R extends DatedReview>(
  facts: readonly F[],
  reviews: readonly R[],
  limit?: number,
): readonly FeedEntry<F, R>[] {
  const entries: { entry: FeedEntry<F, R>; day: string; rank: number }[] = [
    ...reviews.map((review) => ({
      entry: { of: 'review', review } as const,
      day: dayOf(review.publishedAt),
      rank: 0,
    })),
    ...facts.map((fact) => ({
      entry: { of: 'fact', fact } as const,
      day: dayOf(fact.happenedOn),
      rank: 1,
    })),
  ];

  entries.sort((a, b) => (a.day === b.day ? a.rank - b.rank : a.day < b.day ? 1 : -1));

  const ordered = entries.map((held) => held.entry);
  return limit === undefined ? ordered : ordered.slice(0, limit);
}

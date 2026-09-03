/**
 * Les couleurs d'une image de partage, **lues sur la feuille et non recopiees**.
 *
 * ## 🔴 Le defaut, mesure le 2026-08-30
 *
 * `ShareCard` et `ShareReview` dessinent au `canvas`, qui ne sait pas lire une variable CSS :
 * les deux portaient donc cinq couleurs en dur, sous un commentaire qui affirmait *« charte de
 * `app/globals.css` : l'image doit appartenir au meme systeme visuel »*.
 *
 * C'etait **deja faux**, avant toute refonte. Les valeurs figees etaient celles d'une palette
 * anterieure :
 *
 *     fond      #0f1115   au lieu de   --color-ink      #14181c
 *     texte     #e6e9ef                --color-text     #ddeeff
 *     discret   #8b94a7                --color-muted    #99aabb
 *     barre     #262b36                --color-surface  #2c3440
 *     accent    #4ade80                --color-volt     #00e054
 *
 * Une image partagee — le seul objet du produit qui vive **hors du produit**, sur le mur de
 * quelqu'un d'autre — portait donc une identite que le site avait quittee. Et c'est le pire
 * endroit ou laisser deriver une charte : personne ne compare les deux cote a cote.
 *
 * ## Pourquoi une lecture et pas une deuxieme liste
 *
 * Recopier les bonnes valeurs aurait remis le compteur a zero **et rien de plus** : la
 * prochaine palette les aurait laissees derriere de la meme facon. Ici, le jeton est lu sur
 * `<html>` au moment ou l'on dessine, donc l'image suit le site par construction. C'est le
 * meme raisonnement que `--color-volt` dans `tokens.css` : *rien d'autre a toucher*.
 *
 * ⚠️ Les valeurs de repli ne sont pas decoratives : `getComputedStyle` rend une chaine vide
 * hors navigateur (et sous jsdom, ou `getContext('2d')` rend deja `null`). Un `fillStyle`
 * vide laisserait le canvas peindre en **noir** sans rien signaler.
 */

/** Les cinq roles dont une image de partage a besoin, et leur repli. */
const REPLIS = {
  ink: '#14181c',
  text: '#ddeeff',
  muted: '#99aabb',
  surface: '#2c3440',
  volt: '#00e054',
  warn: '#fbbf24',
} as const;

export type ShareInk = Record<keyof typeof REPLIS, string>;

/** La charte courante, telle que la feuille la declare a cet instant. */
export function shareInk(): ShareInk {
  if (typeof document === 'undefined') return { ...REPLIS };

  const feuille = getComputedStyle(document.documentElement);
  const lu = (nom: string, repli: string) => {
    const valeur = feuille.getPropertyValue(`--color-${nom}`).trim();
    return valeur.length > 0 ? valeur : repli;
  };

  return {
    ink: lu('ink', REPLIS.ink),
    text: lu('text', REPLIS.text),
    muted: lu('muted', REPLIS.muted),
    surface: lu('surface', REPLIS.surface),
    volt: lu('volt', REPLIS.volt),
    warn: lu('warn', REPLIS.warn),
  };
}

/**
 * Serialiser des donnees structurees a l'interieur d'une balise `<script>`, sans faille.
 *
 * ## La faille reparee, et pourquoi elle etait invisible
 *
 * La page serie injecte un bloc `application/ld+json` — c'est ce qui donne a Google la
 * fiche de la serie, donc une piece du canal d'acquisition n°1. Il etait ecrit ainsi :
 *
 * ```tsx
 * dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
 * ```
 *
 * avec, en commentaire, « contenu construit par nous a partir de champs deja decodes,
 * jamais du HTML tiers ». Le raisonnement est faux sur un point precis : **`JSON.stringify`
 * n'echappe pas `<`.** Un titre de serie valant `</script><script>alert(1)</script>` ferme
 * donc la balise et fait executer ce qui suit.
 *
 * Et ces titres ne viennent pas de nous : **TMDB est alimente par des contributeurs**. Au
 * sens de la securite, c'est une source non fiable — au meme titre qu'un champ rempli par
 * un visiteur. Le parsing tolerant du fournisseur protege contre les
 * donnees *mal formees*, pas contre les donnees *malveillantes* : ce sont deux problemes
 * differents, et le premier a masque le second.
 *
 * Gravite reelle : le script s'executerait sur **toutes** les pages servies depuis le
 * cache de bord, donc pour tous les visiteurs, jusqu'a expiration. Et le journal personnel
 * vit dans `localStorage`, accessible a tout script de la page.
 *
 * ## Ce que fait la parade
 *
 * On remplace `<`, `>` et `&` par leurs echappements Unicode. Dans une chaine JSON,
 * `<` **est** `<` : le document reste strictement equivalent apres analyse, Google
 * lit la meme fiche, et plus aucune sequence ne peut refermer la balise.
 *
 * On traite aussi U+2028 et U+2029 : ces deux caracteres sont des fins de ligne pour un
 * analyseur JavaScript alors que JSON les laisse passer tels quels — ils cassent le
 * script sans meme qu'il y ait d'intention.
 *
 * ⚠️ **Aucun de ces caracteres n'apparait en clair dans ce fichier**, et c'est
 * volontaire : la premiere version les ecrivait litteralement dans l'expression
 * reguliere, et le compilateur TypeScript a refuse de la lire — « Unterminated regular
 * expression literal ». La demonstration la plus courte possible de ce contre quoi cette
 * fonction protege. D'ou la table indexee par **point de code**, qui ne peut pas se
 * reproduire.
 */

/** Points de code a neutraliser, et leur forme echappee. */
const ESCAPES: ReadonlyMap<number, string> = new Map([
  [0x3c, '\\u003c'], // <
  [0x3e, '\\u003e'], // >
  [0x26, '\\u0026'], // &
  [0x2028, '\\u2028'], // separateur de ligne
  [0x2029, '\\u2029'], // separateur de paragraphe
]);

// Construite depuis une chaine, pour la meme raison : la classe de caracteres est
// decrite en echappements et jamais avec les caracteres eux-memes.
const DANGEROUS = new RegExp('[<>&\\u2028\\u2029]', 'g');

/**
 * Le JSON d'un bloc `<script type="application/ld+json">`, sur du contenu tiers.
 *
 * @returns une chaine sure a injecter telle quelle, et equivalente au JSON d'origine.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(
    DANGEROUS,
    (char) => ESCAPES.get(char.codePointAt(0) ?? -1) ?? char,
  );
}

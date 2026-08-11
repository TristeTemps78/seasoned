import { FaceDot } from '@/app/components/FaceDot';
import type { FaceId } from '@/src/domain/face';

/**
 * Le visage de quelqu'un (2026-08-11).
 *
 * ## Ce qu'il remplace
 *
 * Rien. C'est le point : sur les cinq surfaces qui rendent des gens — le fil d'amis,
 * `SeriesPeople`, `PublicProfile`, `Discover`, `DailyRound` — une personne s'ecrivait
 * « `@pseudo` » en gris, et c'est tout. Le produit parlait de gens sans jamais en montrer un
 * seul. La forme (teintes, tailles, surimpression de la face) vit dans `app/globals.css`,
 * sous `.avatar` ; ici ne se decide que **ce qu'on derive du pseudo**.
 *
 * ## Pourquoi pas de photo televersee
 *
 * Accepter une image, c'est un stockage, une moderation, un recadrage et une surface d'abus.
 * Les initiales et une teinte donnent le seul benefice qui compte a ce stade — deux personnes
 * ne se ressemblent pas — pour zero octet et zero moderation.
 */

/** Le nombre de teintes declarees dans `globals.css`. ⚠️ Les deux doivent s'accorder : un
 *  `data-hue="9"` ne correspondrait a aucune regle et rendrait l'avatar gris, silencieusement.
 *  `tests/avatar.test.ts` tient les deux bouts. */
export const AVATAR_HUES = 8;

/**
 * La teinte d'un pseudo — **deterministe, et c'est toute la valeur**.
 *
 * Une couleur tiree au hasard a l'affichage ferait de l'avatar un ornement : la meme personne
 * changerait de couleur d'un ecran a l'autre, donc la couleur n'apprendrait rien. Derivee du
 * nom, elle est stable pour tous les lecteurs et sur toutes les surfaces — c'est ce qui permet
 * de reperer quelqu'un dans une liste **sans lire** son pseudo.
 *
 * ⚠️ Le pseudo est **minuscule** avant le calcul : `Jean` et `jean` designent le meme compte
 * (`checkHandle` normalise deja), et deux couleurs pour un compte defairait la stabilite qu'on
 * vient de payer.
 *
 * ⚠️ Multiplication en base 31 et modulo premier a chaque tour : sans le modulo intermediaire,
 * un pseudo de plus de dix caracteres depasse `Number.MAX_SAFE_INTEGER` et la somme perd ses
 * bits de poids faible — c'est-a-dire exactement ceux qui decident de la teinte.
 */
export function avatarHue(handle: string): number {
  let hash = 0;
  for (const char of handle.toLowerCase()) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 100000007;
  }
  return (hash % AVATAR_HUES) + 1;
}

/**
 * Les deux premieres lettres, en capitales.
 *
 * ⚠️ Les caracteres non alphanumeriques sont **retires et non remplaces** : un pseudo comme
 * `_max` rendrait « _M », c'est-a-dire un avatar qui commence par du bruit. On garde `MA`.
 *
 * ⚠️ Le repli n'est pas une chaine vide : un avatar sans lettre est un disque de couleur, que
 * personne ne relie a un compte. Un pseudo entierement fait de ponctuation est impossible
 * aujourd'hui (`checkHandle` l'interdit), mais ce composant ne le sait pas et n'a pas a le
 * supposer.
 */
export function avatarInitials(handle: string): string {
  const letters = [...handle].filter((char) => /[\p{L}\p{N}]/u.test(char));
  return letters.slice(0, 2).join('').toUpperCase() || '?';
}

export function Avatar({
  handle,
  face,
  large = false,
}: {
  readonly handle: string;
  readonly face?: FaceId | undefined;
  readonly large?: boolean;
}) {
  const disc = (
    <span
      className={`avatar${large ? ' avatar-lg' : ''}`}
      data-hue={avatarHue(handle)}
      /* ⚠️ Muet pour les lecteurs d'ecran, **toujours** : les cinq sites d'appel ecrivent le
         pseudo juste a cote. Un `aria-label` ici ferait annoncer deux fois la meme personne,
         ce qui est le defaut classique de l'avatar decoratif. */
      aria-hidden="true"
    >
      {avatarInitials(handle)}
    </span>
  );

  // Sans face, pas d'empilement : `FaceDot` rend `null` sous le seuil, et un conteneur pose
  // autour de rien ajoute une boite vide au flux.
  if (face === undefined) return disc;

  return (
    <span className="avatar-stack">
      {disc}
      <FaceDot face={face} />
    </span>
  );
}

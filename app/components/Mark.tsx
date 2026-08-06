/**
 * Le cube — la marque, portee a l'ecran.
 *
 * ## Pourquoi un SVG et non le fichier fourni
 *
 * Le logo **existe** (fabrique ailleurs, `CLAUDE.md` 2026-08-03 : « ne pas s'en occuper »),
 * et ce module ne le redessine pas : il le **porte** dans le seul format utilisable ici.
 * L'original est un bitmap de 1024 px sur fond blanc — inemployable dans une barre sombre
 * de 28 px. Un vecteur inline ne coute **aucune requete**, se colore par le CSS, s'anime, et
 * reste net sur tout ecran. Meme raisonnement que les halos du `body`, ecrits en gradient
 * « et non en image : aucun octet a telecharger ».
 *
 * ## Pourquoi la couleur est ICI et nulle part ailleurs
 *
 * Le produit s'appelle VOLT·FACE et son logo a des **faces colorees** — rouge, bleu, jaune —
 * dont pas une n'existait a l'ecran. C'etait l'origine du « site generique » : l'identite
 * etait decidee et jamais transposee.
 *
 * ⚠️ Elles restent **concentrees dans ce composant**. Repartir ces trois couleurs sur les
 * cinq onglets aurait oblige a en inventer deux qui ne sont pas dans le logo — diluer
 * l'identite en croyant l'appliquer — et aurait ajoute un troisieme registre colore sur une
 * fiche serie qui porte deja le vert du statut et le volt de la position. La marque explose
 * de couleur, l'interface reste calme : c'est ce qui permet a l'oeil d'y revenir.
 *
 * Le cyan n'est pas une face : dans le logo c'est **l'arc electrique autour**. Il reste donc
 * ce qu'il est partout ailleurs ici — la couleur de l'interaction — et se contente
 * d'apparaitre au survol.
 */
export function Mark({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={`mark ${className}`}
    >
      {/* Trois losanges, dans l'ordre du plus lointain au plus proche. Les sommets sont
          poses a la main sur une isometrie simple : une face haute, deux faces laterales. */}
      <polygon className="mark-top" points="16,3 29,10 16,17 3,10" />
      <polygon className="mark-left" points="3,10 16,17 16,29 3,22" />
      <polygon className="mark-right" points="29,10 29,22 16,29 16,17" />
    </svg>
  );
}

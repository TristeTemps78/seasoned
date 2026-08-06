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
 * ## Les eclairs ne sont pas un ornement
 *
 * 🔴 Premiere version : je les avais reduits a un `drop-shadow` cyan, c'est-a-dire a une
 * **lueur**. Un arc electrique est brise et angulaire ; un halo diffus est exactement son
 * contraire. Et surtout, ils sont dans le NOM : **volt**-face. Les retirer revenait a
 * garder la moitie de la marque.
 *
 * Deux arcs suffisent, et c'est une contrainte de taille avant d'etre un gout : a 26 px,
 * un eclair detaille se lit comme une salissure. Trois segments par arc, de part et
 * d'autre du cube — assez pour qu'on lise « electrique », pas assez pour encombrer.
 *
 * Ils sont **toujours visibles**, en trait fin : c'est l'identite du produit, pas un effet
 * de survol. Ce qui change au survol, c'est leur intensite.
 */
export function Mark({ className = '' }: { readonly className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={`mark ${className}`}
    >
      {/* Le cube : trois losanges, du plus lointain au plus proche. Il est retreci par
          rapport au cadre pour laisser respirer les arcs — sans cette marge, les eclairs
          toucheraient les faces et le tout se lirait comme une tache. */}
      <polygon className="mark-top" points="16,5 26,10.5 16,16 6,10.5" />
      <polygon className="mark-left" points="6,10.5 16,16 16,27 6,21.5" />
      <polygon className="mark-right" points="26,10.5 26,21.5 16,27 16,16" />

      {/* Les arcs. `fill: none`, tout est dans le trait. */}
      <g className="mark-arcs">
        <path d="M 6 4 L 2.5 10.5 L 5 13.5 L 2 20.5" />
        <path d="M 26 4 L 29.5 10.5 L 27 13.5 L 30 20.5" />
      </g>
    </svg>
  );
}

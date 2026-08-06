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
 * 🔴 Deuxieme version, et le mot juste est de Tristan : ce n'est pas un ECLAIR, c'est un
 * **champ**. Le logo montre des filaments qui *enveloppent* le cube — une cage, une sphere
 * de decharges. Deux zigzags angulaires poses de part et d'autre faisaient bande dessinee ;
 * la difference n'est pas l'epaisseur du trait, c'est que l'electricite doit **tourner
 * autour** au lieu d'etre plaquee a cote.
 *
 * D'ou des courbes fermees et non des segments brises, d'opacites inegales — une decharge
 * n'est jamais uniforme. Trois filaments : a 26 px, davantage se prend en masse.
 *
 * Ils sont **toujours visibles** : c'est l'identite du produit, pas un effet de survol.
 * Ce qui change au survol, c'est leur intensite.
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

      {/* Le champ : trois boucles qui contournent le cube, chacune avec ses accidents.
          `fill: none` — tout est dans le trait. */}
      <g className="mark-arcs">
        <path
          className="mark-arc-1"
          d="M 16 1.5 C 25 2 31 8 30.5 16 C 30 24 24 30.5 16 30.5 C 8 30.5 2 24 1.5 16 C 1 8 7 2 16 1.5"
        />
        <path
          className="mark-arc-2"
          d="M 8 3.5 C 2.5 8 1 13 3 18 C 4.5 22 3 25 5.5 28.5"
        />
        <path
          className="mark-arc-3"
          d="M 24.5 3.5 C 29 7 30 12 28 16.5 C 26.5 20 28.5 24 26 28"
        />
      </g>
    </svg>
  );
}

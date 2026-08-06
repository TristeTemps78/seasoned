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
 * 🔴 Troisieme version, et la correction de Tristan tient en un mot : mes courbes etaient
 * **regulieres**. Un arc lisse a rayon constant est mou par construction — l'oeil y lit un
 * cercle decoratif, pas une decharge. Ce qui fait « electrique » n'est pas le zigzag, c'est
 * l'IRREGULARITE : chaque sommet a une distance differente du centre, chaque segment une
 * longueur differente. Des droites, donc, et jamais deux pareilles.
 *
 * Trois filaments seulement : a 26 px, davantage se prend en masse.
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

      {/* Le champ : des segments DROITS qui font le tour, jamais des courbes.
          🔴 La version d'avant etait faite d'arcs lisses et reguliers, et c'est exactement
          ce qui la rendait molle : une decharge n'a pas de rayon constant. Ici chaque
          sommet est a une distance differente du centre, et les longueurs de segment sont
          inegales — c'est l'irregularite qui fait lire « electrique », pas le zigzag. */}
      <g className="mark-arcs">
        <path
          className="mark-arc-1"
          d="M 16 1 L 21.5 4.5 L 19.5 7 L 27 6.5 L 25.5 11.5 L 31 15 L 27 18.5 L 30 24 L 24 23.5 L 24.5 30 L 19 27 L 16 31 L 12.5 27.5 L 8 30.5 L 8.5 24 L 2 25 L 5 19.5 L 1 15.5 L 5.5 11.5 L 1.5 7 L 8 7.5 L 7 2 L 12 5 Z"
        />
        <path className="mark-arc-2" d="M 10 2.5 L 4 6 L 6.5 10 L 2.5 13.5 L 5 17 L 2 22 L 7 24.5" />
        <path className="mark-arc-3" d="M 23 3 L 28.5 8 L 25.5 12 L 29.5 17 L 26 20 L 28.5 26" />
      </g>
    </svg>
  );
}

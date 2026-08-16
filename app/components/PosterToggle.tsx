import { Icon, type IconName } from '@/app/components/Icon';

/**
 * Un geste pose **sur une affiche** — le meme dessin pour les deux du produit.
 *
 * ## Pourquoi il existe, et ce qu'il empeche
 *
 * Le coeur de `LibraryCard` et « je veux la voir » de `SeriesCard` ont ete ecrits a une
 * heure d'intervalle et etaient identiques a deux choses pres : l'icone, et la phrase. Meme
 * pastille, meme coin, meme `aria-pressed`, meme regle de visibilite, meme accent quand
 * l'etat est actif.
 *
 * Ce depot connait le cout exact de ne pas partager ca, et il l'ecrit deux fois — dans
 * `Lists` (*« en ecrire deux versions, c'est se garantir qu'un jour l'une affichera le
 * nombre d'elements et pas l'autre »*) et dans `controls.css` a propos de `.grid-cell` et
 * `.star-box`. `LibraryCard` et `SeriesCard` **ont deja diverge une fois**, jusqu'a ce que
 * l'une montre trois rectangles gris. Deux boutons qui doivent se ressembler ne se
 * ressemblent que s'ils sont le meme bouton.
 *
 * ⚠️ Pas de `'use client'` : ce composant n'a aucun etat propre. Il devient client par
 * contagion la ou un composant client l'importe — meme raison que `Menu`, et c'est ce qui
 * lui permettrait de servir un jour a une carte serveur sans rien changer.
 *
 * ## Ce qu'il ne decide pas
 *
 * Ni **ce que le geste ecrit** — le journal appartient a l'appelant —, ni **quand il
 * apparait** : la visibilite est dans `.poster-action` (invisible au repos a la souris,
 * toujours visible au doigt, et permanente des que l'etat est actif), parce que c'est une
 * regle de la surface et non de ce bouton-ci.
 */
export function PosterToggle({ pressed, label, icon, onToggle }: {
  /** L'etat courant. Il pilote l'accent **et** la persistance a l'ecran — voir `.poster-action`. */
  readonly pressed: boolean;
  /**
   * Le nom accessible, deja compose et **portant le titre de la serie**.
   *
   * ⚠️ Une phrase et non un mot : sur une rangee de douze vignettes, douze boutons qui
   * s'annoncent « J'aime » sont douze fois le meme mot sans dire de quoi ils parlent. C'est
   * l'appelant qui la compose, parce que lui seul sait de quelle serie il s'agit et quelle
   * phrase convient a son geste.
   */
  readonly label: string;
  readonly icon: IconName;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      // `poster-badge-liked` porte l'accent volt : c'est la meme marque que celle qu'un
      // etat actif dessinait deja en lecture seule, donc rien ne change a l'oeil quand on
      // rend le geste possible.
      className={`poster-badge poster-badge-tr poster-action ${pressed ? 'poster-badge-liked' : ''}`}
      aria-pressed={pressed}
      aria-label={label}
      onClick={onToggle}
    >
      <Icon name={icon} />
    </button>
  );
}

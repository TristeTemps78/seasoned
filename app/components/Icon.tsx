import type { ReactNode } from 'react';

/**
 * Les icones du produit (2026-08-11).
 *
 * ## Pourquoi il n'y en avait que deux
 *
 * Releve avant d'ecrire ce fichier : **2 SVG dans 61 composants** — le logo et l'etoile de
 * notation. Tout le reste du produit s'exprimait en mots seuls. Ce n'est pas un oubli, c'est
 * ce qui arrive quand aucun jeu d'icones n'existe : le premier ecran qui en voudrait une
 * devrait dessiner la sienne, donc aucun ne le fait, donc il n'y en a jamais.
 *
 * ## Ecrites ici, et pas installees
 *
 * Pas de dependance : les bibliotheques d'icones pesent de 50 Ko a 2 Mo pour un produit qui en
 * emploie douze, et la CSP (`img-src` limite a TMDB) rendrait de toute facon un sprite distant
 * inutilisable. Douze traces en ligne coutent ~2 Ko dans le paquet et rien au reseau.
 *
 * ## Un seul dessin, trois reglages
 *
 * Toutes sur une grille de 24, en **trait** et jamais en aplat, en `currentColor` : c'est ce
 * qui fait qu'une icone prend la couleur de ce qui l'entoure — le vert d'un statut, l'encre
 * d'un bouton plein — sans qu'aucun site d'appel n'ait a le dire. Une icone qui porterait sa
 * propre couleur redemanderait la question a chaque emploi, et deux emplois divergeraient.
 *
 * ⚠️ **Toujours `aria-hidden`.** Sans exception, et ce n'est pas une facilite : les douze
 * accompagnent un libelle ecrit juste a cote. Une icone qui s'annonce en double ce que le
 * texte dit deja est le defaut d'accessibilite le plus courant des jeux d'icones. Le jour ou
 * l'une porterait un sens **seule**, c'est le site d'appel qui devra fournir le nom — pas ce
 * fichier, qui ne sait pas dans quelle langue on lui parle.
 */
const PATHS = {
  /** Termine, fait, coche. */
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,

  /** L'attente qualifiee — « en attente · 7 mois », le differenciateur du produit. */
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 6.75V12.25L15.75 14.5" />
    </>
  ),

  /** L'anomalie : annulee, ou declaree vivante et morte depuis dix-huit mois. */
  alert: (
    <>
      <path d="M12 4.5 21 19.5H3Z" />
      <path d="M12 10V13.75" />
      {/* Le point du bas est un disque plein et non un trait de 0 : un trait de longueur nulle
          disparait selon la facon dont le moteur applique `stroke-linecap`. */}
      <circle cx="12" cy="16.75" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),

  /** Ca se passe maintenant — un point qui emet. */
  broadcast: (
    <>
      <circle cx="12" cy="12" r="2.25" fill="currentColor" stroke="none" />
      <path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 16.6a6.5 6.5 0 0 0 0-9.2" />
      <path d="M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 19.4a10.5 10.5 0 0 0 0-14.8" />
    </>
  ),

  /** Une personne. */
  user: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20a7.25 7.25 0 0 1 14.5 0" />
    </>
  ),

  /** Plusieurs personnes — les amis, le fil, « des gens a decouvrir ». */
  users: (
    <>
      <circle cx="9.5" cy="8.25" r="3.25" />
      <path d="M3.25 19.5a6.25 6.25 0 0 1 12.5 0" />
      <path d="M16.5 5.4a3.25 3.25 0 0 1 0 5.7" />
      <path d="M17.75 14.3a6.25 6.25 0 0 1 3 5.2" />
    </>
  ),

  /** Ce qui revient — l'agenda, la date qui tombe. */
  calendar: (
    <>
      <rect x="3.5" y="5.25" width="17" height="15.25" rx="2.25" />
      <path d="M3.5 10.25h17M8.25 3.5v3.5M15.75 3.5v3.5" />
    </>
  ),

  /** Chercher. */
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="M15.4 15.4 20.5 20.5" />
    </>
  ),

  /** Aimer — le coeur du social. */
  heart: (
    <path d="M12 20.25S3.75 15.1 3.75 9.6A4.35 4.35 0 0 1 12 7.35 4.35 4.35 0 0 1 20.25 9.6c0 5.5-8.25 10.65-8.25 10.65Z" />
  ),

  /** Une liste. */
  list: <path d="M8.5 6.75h11.75M8.5 12h11.75M8.5 17.25h11.75M4 6.75h.01M4 12h.01M4 17.25h.01" />,

  /** Ajouter. */
  plus: <path d="M12 5.25v13.5M5.25 12h13.5" />,

  /** Fermer, retirer. */
  close: <path d="M6.25 6.25 17.75 17.75M17.75 6.25 6.25 17.75" />,

  /** La suite d'une rangee qui defile, a gauche et a droite — voir `Rail`. */
  chevronLeft: <path d="M15 5.5 8.5 12 15 18.5" />,
  chevronRight: <path d="M9 5.5 15.5 12 9 18.5" />,
} as const;

export type IconName = keyof typeof PATHS;

/** Les noms declares, pour un test qui verifie qu'aucun trace n'est vide. */
export const ICON_NAMES = Object.keys(PATHS) as readonly IconName[];

export function Icon({
  name,
  className,
}: {
  readonly name: IconName;
  readonly className?: string;
}): ReactNode {
  return (
    <svg
      className={className === undefined ? 'icon' : `icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      /* ⚠️ `focusable` en plus de `aria-hidden` : sans lui, Internet Explorer et certaines
         versions d'Edge placent quand meme le SVG dans l'ordre de tabulation, ce qui donne un
         arret clavier sur un objet decoratif — invisible a la relecture, penible a l'usage. */
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

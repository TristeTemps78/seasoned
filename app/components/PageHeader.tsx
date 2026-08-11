import type { ReactNode } from 'react';

/**
 * L'en-tete d'une face — un titre, une phrase, et le meme rythme partout.
 *
 * ## 🔴 Ce qu'il unifie, mesure le 2026-08-11
 *
 * Les six faces ecrivaient leur en-tete a la main, et elles avaient diverge sur les trois
 * seules choses qu'un en-tete decide :
 *
 *   face          ecart au contenu   phrase d'accroche        balise
 *   /moi          space-y-8          text-(--color-muted)     header
 *   /calendrier   space-y-10         text-(--color-muted)     header
 *   /bilan        space-y-8          text-(--color-muted)     header
 *   /amis         space-y-6          prose-note               header
 *   /listes       space-y-6          prose-note               div
 *   /recherche    space-y-8          text-(--color-muted)     — aucun titre —
 *
 * Trois ecarts differents, deux traitements de la phrase, une face sans titre du tout. C'est
 * ce qui fait qu'en passant d'un onglet a l'autre le meme bloc ne tombe pas au meme endroit —
 * un demi-centimetre que personne ne sait nommer et que tout le monde voit. Le fichier de
 * `/amis` decrit deja exactement ce defaut, pour la marge horizontale.
 *
 * ## Et la phrase ne se lisait pas
 *
 * `text-(--color-muted)` ne pose qu'une couleur : sur quatre faces, l'accroche courait donc
 * sur **1120 px** (mesure sur `/moi`, `max-width: none`), la ou `.prose-note` la borne a 65
 * caracteres. La feuille de style ecrit la regle noir sur blanc — *« une phrase sur 1248 px ne
 * se lit pas, ce que `.prose-note` dit deja »* — et quatre faces sur six la contredisaient.
 *
 * ## ⚠️ Pourquoi ce composant ne porte AUCUNE marge exterieure
 *
 * Il serait naturel de lui donner un `margin-bottom` pour tenir l'ecart au contenu. Ca ne
 * marcherait pas : les pages sont des conteneurs `space-y-*`, et l'utilitaire de Tailwind 4
 * pose `margin-block-start: 0` sur chaque enfant suivant — c'est **exactement** ce qui a
 * annule le chevauchement de la fiche serie pendant des mois, sans qu'aucun test le voie.
 *
 * L'ecart est donc tenu par la page, avec **la meme valeur partout** (`space-y-8`). Ce
 * composant ne decide que ce qu'il contient.
 */
export function PageHeader({ title, lede, children }: {
  readonly title: string;
  /** L'accroche. Absente sur les faces qui n'en ont pas — jamais une phrase inventee. */
  readonly lede?: string;
  /** Ce qui appartient a l'en-tete plutot qu'au contenu : le champ de recherche, un filtre. */
  readonly children?: ReactNode;
}) {
  return (
    <header className="space-y-2">
      <h1 className="page-title">{title}</h1>
      {lede !== undefined ? <p className="prose-note">{lede}</p> : null}
      {children}
    </header>
  );
}

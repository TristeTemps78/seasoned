import type { ReactNode } from 'react';

/**
 * L'ecran qui n'a rien a montrer — **la regle 4, rendue structurelle**.
 *
 * ## Pourquoi un composant, et pas seulement une classe
 *
 * `CLAUDE.md` porte depuis le 2026-08-11 : *un ecran qui n'a rien a montrer dit quoi faire.*
 * Elle etait appliquee a la main dans **six** fichiers — bibliotheque, calendrier, bilan,
 * critiques, fil d'amis, porte de compte —, chacun recomposant `.empty-state`, son titre, son
 * corps et sa rangee d'actions. Six copies d'une regle, c'est six occasions de l'oublier a
 * moitie : c'est exactement ainsi que `/calendrier` s'est retrouve sans un seul bouton
 * pendant que la bibliotheque en avait deux.
 *
 * ⚠️ Ce n'est pas une extraction pour compter des repetitions — ce depot vient justement de
 * retirer cette regle-la de `surfaces.css`. C'est la **forme d'une decision de produit** : le
 * composant rend impossible d'ecrire un ecran vide sans corps, et evident d'y poser une
 * action. Une regle qu'il faut se rappeler d'appliquer n'est pas une regle, c'est un usage.
 *
 * ## Ce qu'il n'impose PAS, et c'est deliberé
 *
 * `actions` est **optionnel**. La regle dit *un ecran sans issue, pas un ecran sans bouton* :
 * quand le geste est deja sur la page — le fil d'amis, dont le formulaire de suivi est deux
 * cents pixels au-dessus —, une phrase suffit, et un bouton menerait hors de l'ecran ou
 * l'action se trouve. Forcer les actions ici transformerait la regle en doctrine, ce qui est
 * le defaut qu'elle vient de remplacer.
 *
 * `title` l'est aussi : deux appelants vivent **dans** une section qui porte deja son titre,
 * et un second niveau de titre y decrirait une hierarchie qui n'existe pas.
 */
export function EmptyState({ label, title, actions, note, status = false, children }: {
  /** Nom accessible de la region, quand l'ecran vide EST le contenu de la page. */
  readonly label?: string;
  readonly title?: string;
  /** Les boutons. Absents quand le geste est deja a l'ecran — voir l'en-tete. */
  readonly actions?: ReactNode;
  /** La reserve qui desamorce, sous les actions. Voir `AccountGate`. */
  readonly note?: ReactNode;
  /**
   * Annonce le changement aux lecteurs d'ecran.
   *
   * ⚠️ Reserve a ce qui **survient** — un fil qui n'a pas pu etre lu —, jamais a un vide
   * ordinaire : `role="status"` fait parler la page, et une page qui annonce chacun de ses
   * vides apprend a etre ignoree.
   */
  readonly status?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <section
      className="empty-state"
      {...(label !== undefined ? { 'aria-label': label } : {})}
      {...(status ? { role: 'status' as const } : {})}
    >
      {title !== undefined ? <h2 className="empty-state-title">{title}</h2> : null}
      <p className="empty-state-body">{children}</p>
      {actions !== undefined ? <div className="empty-state-actions">{actions}</div> : null}
      {note !== undefined ? <p className="meta-sm">{note}</p> : null}
    </section>
  );
}

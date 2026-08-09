'use client';

import { useT } from '@/app/i18n/LocaleProvider';
import type { FaceId } from '@/src/domain/face';

/**
 * La face de quelqu'un d'autre, en une pastille (9.4).
 *
 * ## Une pastille, et pas un mot, dans les listes
 *
 * Le fil et « des gens a decouvrir » sont des listes denses ou chaque ligne tient sur une
 * ligne. Un mot de plus par personne y ferait passer les noms a la ligne. La pastille porte
 * donc le mot en **nom accessible** : un lecteur d'ecran l'annonce, un survol l'affiche, et
 * l'oeil n'a qu'une couleur a lire.
 *
 * ⚠️ Sur la page de profil, ou il y a de la place, c'est le **mot** qui est ecrit. Une
 * couleur seule n'apprend rien a qui la voit pour la premiere fois.
 *
 * ## Rien du tout quand il n'y a rien
 *
 * `undefined` = la personne est sous le seuil, ou n'a jamais ouvert `/amis`. On n'affiche
 * ni pastille grise ni « pas de face » : *mieux vaut se taire que compter zero*.
 */
export function FaceDot({ face }: { readonly face: FaceId | undefined }) {
  const { t } = useT();
  if (face === undefined) return null;

  const label = t(`face.${face}`);
  return <span className="face-dot" data-face={face} role="img" aria-label={label} title={label} />;
}

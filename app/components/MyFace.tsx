'use client';

import { useJournal } from '@/app/journal/useJournal';
import { faceOf } from '@/src/domain/face';
import { Mark } from '@/app/components/Mark';

/**
 * La marque, coloree par **votre** face.
 *
 * ## Pourquoi ce composant existe au lieu d'une prop sur `Mark`
 *
 * `SiteChrome` est un composant **serveur**, et le journal ne se lit jamais cote serveur
 * (`tests/no-journal-on-server.test.ts`) : il vit dans le navigateur de la personne, et
 * c'est ce qui rend le produit tenable a cent mille utilisateurs. L'enveloppe ne peut donc
 * pas connaitre la face au moment du rendu.
 *
 * Cette coquille cliente est le plus petit pont possible : elle lit le journal, appelle le
 * domaine, et passe un mot a `Mark`. Elle ne decide rien — la face est calculee dans
 * `src/domain/face.ts`, qui part tel quel vers le natif (A11).
 *
 * ## Aucun ecart d'hydratation, et ce n'est pas de la chance
 *
 * Au premier rendu, `useJournal` n'a encore rien lu : le journal est vide, `faceOf` rend
 * `undefined`, et `Mark` s'affiche exactement comme avant. La face arrive ensuite, quand le
 * journal est charge. Le serveur et le premier rendu client disent donc la meme chose.
 */
export function MyFace({ className = '' }: { readonly className?: string }) {
  const { journal } = useJournal();
  const face = faceOf(journal);

  return <Mark className={className} {...(face !== undefined ? { face: face.id } : {})} />;
}

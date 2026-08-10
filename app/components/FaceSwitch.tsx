'use client';

import { useEffect, useState } from 'react';

import { Mark } from '@/app/components/Mark';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { faceOf, type FaceId } from '@/src/domain/face';

/**
 * 9.3 — **la bascule s'annonce**, une fois, la ou l'on se trouve.
 *
 * ## Ce qui manquait, et pourquoi ca vidait la feature de son sens
 *
 * La face se calcule a chaque rendu et se pose sur le cube de l'en-tete (9.2). Elle change
 * donc **en silence** : quelqu'un qui abandonne sa cinquieme serie passe de rouge a bleu
 * sans que rien ne le lui dise. Or « volte-face » ne nomme pas l'etat, il nomme le
 * **changement d'etat** — c'est litteralement le nom du produit, et c'etait la seule partie
 * qu'on ne montrait pas.
 *
 * ## Une fois, et pas une fois par appareil
 *
 * L'annonce a besoin d'une memoire, sinon elle se rejoue a chaque chargement de page — donc
 * elle ne veut plus rien dire. Cette memoire est un champ de journal
 * ({@link Journal.announcedFace}) et non un drapeau d'ecran : elle doit suivre d'un appareil
 * a l'autre, comme les pays et le masquage des heures.
 *
 * ## ⚠️ On ecrit avant d'avoir fini de montrer, et c'est un arbitrage
 *
 * L'ecriture part des la detection, pas a la fin du compte a rebours. Fermer l'onglet dans
 * la seconde fait donc perdre l'annonce. L'inverse — n'ecrire qu'apres — la rejouerait a
 * chaque page tant que personne n'est reste assez longtemps, ce qui est le defaut le plus
 * courant de ce genre de bandeau. Et la face, elle, reste lisible pour toujours sur
 * `/bilan` : ce qui se perd est l'effet de surprise, jamais l'information.
 *
 * ## Ce composant ne calcule pas la face
 *
 * Il lit `faceOf`, compare, et affiche. Toute la matiere vit dans `src/domain/face.ts`, qui
 * part tel quel vers le natif (A11).
 */

/** Combien de temps l'annonce reste a l'ecran. Assez pour etre lue, pas pour gener. */
const SHOW_MS = 9_000;

export function FaceSwitch() {
  const { t } = useT();
  const { journal, ready, announceFace } = useJournal();
  const [showing, setShowing] = useState<{ id: FaceId; first: boolean } | undefined>(undefined);

  const face = faceOf(journal);
  const current = face?.id;
  const announced = journal.announcedFace?.id;

  useEffect(() => {
    // ⚠️ `ready` d'abord : avant la lecture du stockage le journal est vide, donc `faceOf`
    // rend `undefined` et `announced` aussi. Sans ce garde on ne dirait rien de faux — mais
    // on ne dirait rien du tout, puis l'annonce arriverait au rendu suivant, ce qui est
    // exactement le scintillement que `MyFaceCard` evite deja pour la meme raison.
    if (!ready || current === undefined || current === announced) return;

    setShowing({ id: current, first: announced === undefined });
    announceFace(current);

    const timer = setTimeout(() => setShowing(undefined), SHOW_MS);
    return () => clearTimeout(timer);
  }, [ready, current, announced, announceFace]);

  if (showing === undefined) return null;

  return (
    <div
      // `status` et non `alert` : c'est une bonne nouvelle, pas une urgence. Un lecteur
      // d'ecran l'annonce a la fin de ce qu'il est en train de dire, sans couper.
      role="status"
      aria-live="polite"
      className="face-switch card mb-6 flex items-center gap-4"
    >
      {/* Le meme cube que dans l'en-tete : c'est ce qui apprend a lire la-haut ce qui vient
          d'etre annonce ici. `data-turning` porte la bascule elle-meme. */}
      <Mark className="size-10 shrink-0" face={showing.id} turning />
      <div className="space-y-1 text-sm">
        <p className="font-medium">
          {t(showing.first ? 'face.switch.first' : 'face.switch.changed')}
        </p>
        <p className="text-(--color-muted)">
          {t(`face.${showing.id}`)} — {t(`face.why.${showing.id}`)}
        </p>
      </div>
    </div>
  );
}

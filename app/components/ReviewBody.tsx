'use client';

import { useState } from 'react';

import { useT } from '@/app/i18n/LocaleProvider';

/**
 * Le corps d'une critique deja caviardee : le texte, ou le volet qui le cache.
 *
 * ## Pourquoi ce composant existe
 *
 * Deux ecrans montrent desormais des critiques ecrites par quelqu'un d'autre — la page de
 * profil et le fil. Le rendu differe (une carte la-bas, une ligne ici), mais **la partie
 * qui decide de montrer ou de cacher est la meme**, et c'est la seule partie dangereuse :
 * une divergence entre deux copies ne se verrait pas a l'oeil, elle se verrait en spoilant
 * quelqu'un.
 *
 * On partage donc exactement ce qui doit l'etre, et rien de plus. La mise en page reste a
 * chaque ecran, parce qu'elle n'a aucune raison d'etre commune.
 *
 * ⚠️ **Ce composant ne caviarde rien** : il recoit une decision deja prise par le domaine
 * (`redactReviews` / `redactReviewsAcross`, avec la position du lecteur). Lui faire prendre
 * la decision reviendrait a la sortir du domaine et a la remettre dans la couche de rendu —
 * ce que la regle du spoiler interdit explicitement, parce qu'un filtre d'affichage laisse
 * fuir les agregats.
 *
 * L'etat « je veux voir quand meme » est **local a la ligne** : deux critiques revelees
 * independamment n'ont aucune raison de partager un ensemble tenu par un parent.
 */
export function ReviewBody({
  hidden,
  text,
  hiddenText,
  throughSeason,
}: {
  readonly hidden: boolean;
  readonly text: string;
  readonly hiddenText: string;
  readonly throughSeason: number;
}) {
  const { t } = useT();
  const [revealed, setRevealed] = useState(false);

  if (hidden && !revealed) {
    return (
      <div className="space-y-2">
        <p className="meta">
          {throughSeason > 0 ? t('review.hidden', { n: throughSeason }) : t('review.hiddenSeries')}
        </p>
        <button type="button" className="btn" onClick={() => setRevealed(true)}>
          {t('review.reveal')}
        </button>
      </div>
    );
  }

  // ⚠️ `review-prose` : ce que quelqu'un a **ecrit** n'est pas de l'interface. C'est le seul
  // texte d'auteur du produit, et le serif est ce qui fait la difference entre un tracker qui
  // stocke des avis et un magazine qui les publie. Second et dernier emploi de la voix
  // editoriale, avec `.hero-title`.
  return <p className="review-prose whitespace-pre-wrap">{hidden ? hiddenText : text}</p>;
}

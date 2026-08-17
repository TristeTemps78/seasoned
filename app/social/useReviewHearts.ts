'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useSocial } from '@/app/social/useSocial';
import type { ReviewLikes } from '@/src/social/client';

/**
 * Ce qu'il faut d'une critique pour porter un coeur. Ni le texte, ni la date.
 *
 * ⚠️ Les trois champs ensemble, jamais deux : c'est `022_review_likes_across.sql` qui
 * l'explique. Sur une fiche serie le sujet est constant et `authorId:target` suffit — c'est
 * la cle qu'utilise `Reviews.tsx` —, mais un profil melange les oeuvres, et deux critiques
 * du meme auteur sur la meme cible dans deux series differentes s'y ecraseraient.
 */
export interface HeartedReview {
  readonly authorId: string;
  readonly subject: string;
  readonly target: string;
}

function heartKey(review: HeartedReview): string {
  return `${review.authorId}:${review.subject}:${review.target}`;
}

/**
 * Le separateur des sujets dans la cle de l'effet.
 *
 * Un caractere nul, ecrit en echappement pour qu'on le VOIE dans la source. Une cle de
 * journal est du texte venu de la base : une virgule ou un deux-points y seraient legitimes,
 * et deux listes de sujets differentes pourraient alors produire la meme chaine — donc une
 * dependance d'effet qui ne bouge pas quand la liste change.
 */
const SEP = '\u0000';

/**
 * Les coeurs d'un lot de critiques qui melange les series — lire, et poser le sien.
 *
 * ## Ce qu'il repare
 *
 * F4 : *« on ne peut pas aimer une critique la ou on la decouvre »*. Le coeur vivait en
 * prive dans `Reviews.tsx`, donc uniquement sur la fiche serie ; le profil public et la
 * vitrine de l'accueil rendaient des textes qu'on ne pouvait que lire.
 *
 * ## ⚠️ Un seul appel, quel que soit le nombre de series
 *
 * La boucle sur `reviewLikes` etait la reponse facile, et `015` l'interdit dans sa propre
 * documentation. D'ou `review_like_counts_across` (022) et un unique aller-retour.
 *
 * ## ⚠️ La cle de l'effet est une CHAINE, pas le tableau
 *
 * `redactReviewsAcross` construit un tableau neuf a chaque rendu : le passer en dependance
 * relancerait la lecture indefiniment. La chaine des sujets distincts tries, elle, ne change
 * que quand les sujets changent. Meme raison que le `useMemo` pose sur `orderLists` le
 * 2026-08-16 — un objet reconstruit dans le rendu est une dependance qui ment.
 *
 * ## Ce que ce crochet ne fait pas
 *
 * Il ne decide pas qui a le droit d'aimer : {@link canHeart} repond, l'appelant choisit
 * d'afficher ou non. Un bouton qui ne peut pas marcher ne s'affiche pas (2026-08-09).
 */
export function useReviewHearts(reviews: readonly HeartedReview[] | undefined): {
  /** Combien de coeurs porte cette critique. Zero par defaut, jamais devine. */
  readonly hearts: (review: HeartedReview) => number;
  /** Ai-je aime celle-la ? */
  readonly mine: (review: HeartedReview) => boolean;
  /** Puis-je l'aimer ? Un compte, et pas la mienne. */
  readonly canHeart: (review: HeartedReview) => boolean;
  readonly toggle: (review: HeartedReview, next: boolean) => Promise<boolean>;
} {
  const { account } = useAuth();
  const [counts, setCounts] = useState<Readonly<Record<string, ReviewLikes>>>({});

  const social = useSocial();
  const userId = account?.userId;

  const subjects = useMemo(
    () => [...new Set((reviews ?? []).map((one) => one.subject))].sort().join(SEP),
    [reviews],
  );

  useEffect(() => {
    if (subjects === '') return;
    // ⚠️ Aucun compte n'est requis : `review_like_counts_across` est `security definer` et
    // rend le meme compte a tout le monde. Exiger une session fermerait le chiffre a
    // l'audience qui vient d'un lien de partage — celle pour qui ces pages existent.
    if (social === undefined) return;

    let alive = true;
    void social.reviewLikesAcross(subjects.split(SEP)).then((rows) => {
      if (alive) setCounts(Object.fromEntries(rows.map((row) => [heartKey(row), row])));
    });
    return () => {
      alive = false;
    };
  }, [subjects, social]);

  const hearts = useCallback(
    (review: HeartedReview) => counts[heartKey(review)]?.likes ?? 0,
    [counts],
  );

  const mine = useCallback(
    (review: HeartedReview) => counts[heartKey(review)]?.mine ?? false,
    [counts],
  );

  const canHeart = useCallback(
    (review: HeartedReview) => userId !== undefined && userId !== review.authorId,
    [userId],
  );

  const toggle = useCallback(
    async (review: HeartedReview, next: boolean) => {
      if (userId === undefined) return false;
      if (social === undefined) return false;
      const ok = await social.likeReview(
        userId,
        review.authorId,
        review.subject,
        review.target,
        next,
      );
      if (!ok) return false;
      // On ajuste **localement** plutot que de relire : une lecture de plus par clic
      // couterait un aller-retour pour un chiffre qu'on connait deja.
      setCounts((current) => {
        const key = heartKey(review);
        return {
          ...current,
          [key]: {
            authorId: review.authorId,
            target: review.target,
            likes: Math.max(0, (current[key]?.likes ?? 0) + (next ? 1 : -1)),
            mine: next,
          },
        };
      });
      return true;
    },
    [social, userId],
  );

  return { hearts, mine, canHeart, toggle };
}

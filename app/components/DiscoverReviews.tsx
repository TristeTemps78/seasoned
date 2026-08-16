'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { parseJournalKey } from '@/src/domain/journal';
import { redactReviewsAcross } from '@/src/domain/spoiler';
import { pathIn } from '@/lib/routes';
import { formatDate } from '@/lib/format';
import { type PublishedReview } from '@/src/social/client';
import { socialFrom } from '@/app/social/socialFrom';
import { EmptyState } from '@/app/components/EmptyState';
import { FaceDot } from '@/app/components/FaceDot';
import { PosterChip } from '@/app/components/PosterChip';
import { ReviewBody } from '@/app/components/ReviewBody';

/**
 * Ce que les gens ecrivent — **et qui ne menait nulle part**.
 *
 * ## 🔴 Le defaut
 *
 * `<Reviews />` n'est monte qu'a une seule ligne du depot : `app/(site)/serie/[id]/page.tsx`.
 * Il n'existe ni route de critiques, ni rangee sur l'accueil, ni entree depuis `/parcourir`.
 * Pour lire ce que quelqu'un a ecrit, il fallait donc **deja savoir sur quelle serie
 * regarder** — c'est-a-dire connaitre la reponse avant de poser la question.
 *
 * Les listes ont eu leur vitrine le 2026-08-15 (`DiscoverLists`, et son commentaire dit mot
 * pour mot le meme constat : *« la seule surface dont le contenu existait deja et n'etait
 * montre nulle part »*). Les critiques n'ont pas eu la leur, alors que ce sont **la moitie
 * de la cible** : écrire, noter, faire des listes, un profil.
 *
 * Chez la reference, les critiques populaires sont sur l'accueil, sur chaque fiche et dans
 * un fil d'amis. C'est par elles qu'on croise quelqu'un.
 *
 * ## Zero requete neuve
 *
 * `feedReviews()` existe depuis le lot 8 et n'etait appelee **que** par `/amis`. Le cout est
 * borne — un appel, quel que soit le nombre d'auteurs — et `reviews_select` porte
 * `can_see(user_id)` : on demande tout, la base ne rend que le lisible. Aucun filtre de
 * visibilite n'est ecrit ici, sans quoi il y en aurait deux, et c'est celui du client qui se
 * perime.
 *
 * ## ⚠️ Le caviardage passe par la version « a travers les oeuvres »
 *
 * `redactReviews` ne prend **qu'une** position, parce qu'elle est ecrite pour une fiche ou
 * toutes les critiques portent sur la meme serie. Une vitrine melange les oeuvres :
 * l'appeler telle quelle revelerait la saison 6 de l'une parce que le lecteur en est a la
 * saison 6 de l'autre. C'est exactement le piege que `PublicProfile` documente, et la reponse
 * est la meme — {@link redactReviewsAcross}, dans le domaine.
 */
export function DiscoverReviews() {
  const { account } = useAuth();
  const { t, locale } = useT();
  const { journal } = useJournal();
  const [reviews, setReviews] = useState<readonly PublishedReview[] | undefined>(undefined);

  const accessToken = account?.accessToken;

  useEffect(() => {
    const social = socialFrom(accessToken);
    if (social === undefined) return;

    let alive = true;
    void social.feedReviews(6).then((rows) => {
      if (alive) setReviews(rows);
    });
    return () => {
      alive = false;
    };
  }, [accessToken]);

  // Rien tant qu'on ne sait pas : annoncer « personne n'a rien ecrit » avant d'avoir lu
  // serait le meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  // ⚠️ Couvre aussi l'installation sans base — `socialFrom` rend `undefined`, l'etat ne bouge
  // jamais, et la section reste absente, ce qui est juste.
  if (reviews === undefined) return null;

  const visible = redactReviewsAcross(reviews, (subject) => {
    const position = journal.entries[subject]?.position;
    const parsed = parseJournalKey(subject);
    if (position === undefined || parsed === undefined) return undefined;
    return {
      at: {
        seriesId: parsed.providerId,
        seasonNumber: position.seasonNumber,
        episodeNumber: position.episodeNumber,
      },
      declaredAt: new Date(position.declaredAt),
    };
  });

  return (
    <section className="space-y-3" aria-label={t('reviews.discover.title')}>
      <h2 className="section-heading">{t('reviews.discover.title')}</h2>

      {visible.length === 0 ? (
        /* Regle 4 : un ecran qui n'a rien a montrer dit quoi faire. Sans bouton — le geste
           d'ecrire vit sur une fiche serie, et les rangees d'affiches de cette page en
           proposent une douzaine juste au-dessus. */
        <EmptyState>{t('reviews.discover.none')}</EmptyState>
      ) : (
        // Deux colonnes, comme sur un profil : une opinion courte est le cas le plus
        // frequent, et elle ne merite pas la largeur d'un article.
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((shown) => {
            const parsed = parseJournalKey(shown.subject);
            const title =
              shown.title ??
              journal.entries[shown.subject]?.snapshot?.title ??
              // Jamais la cle de journal : « tmdb:94997 » a ete constate en production le
              // 2026-08-16 dans le fil, qui portait le meme repli.
              t('feed.someSeries');
            const posterPath =
              shown.posterPath ?? journal.entries[shown.subject]?.snapshot?.posterPath;
            const href =
              parsed === undefined ? undefined : pathIn(`/serie/${parsed.providerId}`, locale);

            return (
              <li key={`${shown.authorId}:${shown.subject}:${shown.target}`} className="card flex gap-4">
                {/* L'affiche a gauche : on reconnait la serie **avant** de lire, comme
                    partout ailleurs. `PosterChip` rend son monogramme quand l'affiche
                    manque — jamais un trou. */}
                {href === undefined ? (
                  <PosterChip path={posterPath} title={title} wide />
                ) : (
                  <Link href={href} className="shrink-0" aria-label={title}>
                    <PosterChip path={posterPath} title={title} wide />
                  </Link>
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  {href === undefined ? (
                    <span className="text-sm font-medium">{title}</span>
                  ) : (
                    <Link className="block text-sm font-medium hover:text-(--color-volt)" href={href}>
                      {title}
                    </Link>
                  )}

                  {/* L'auteur est un lien : croiser le gout de quelqu'un sans pouvoir ouvrir
                      son profil est le defaut deja corrige sur la fiche serie. */}
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 meta-sm">
                    <span className="flex items-center gap-1.5">
                      <FaceDot face={shown.face} />
                      <Link
                        href={pathIn(`/u/${shown.handle}`, locale)}
                        className="font-medium hover:text-(--color-volt)"
                      >
                        @{shown.handle}
                      </Link>
                    </span>
                    <time dateTime={shown.publishedAt}>
                      {formatDate(new Date(shown.publishedAt), locale)}
                    </time>
                  </p>

                  <ReviewBody
                    hidden={shown.hidden === true}
                    text={shown.text}
                    hiddenText={shown.hiddenText ?? ''}
                    throughSeason={shown.throughSeason}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

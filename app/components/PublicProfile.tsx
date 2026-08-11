'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { ReviewBody } from '@/app/components/ReviewBody';
import { ShareReview } from '@/app/components/ShareReview';
import { useJournal } from '@/app/journal/useJournal';
import { redactReviewsAcross } from '@/src/domain/spoiler';
import { parseJournalKey } from '@/src/domain/journal';
import { pathIn } from '@/lib/routes';
import { type Profile, type PublishedReview } from '@/src/social/client';
import { Lists } from '@/app/components/Lists';
import { Avatar } from '@/app/components/Avatar';
import { FaceDot } from '@/app/components/FaceDot';
import { socialFrom } from '@/app/social/socialFrom';

/**
 * La page publique de quelqu'un — `/u/<nom>`.
 *
 * ## Le maillon qui manquait
 *
 * Le lot 6 a livre « suivre quelqu'un » et le lot 8 « publier une critique », mais **aucune
 * page ou aller** : on suivait un nom sans pouvoir l'ouvrir, et les critiques ne se lisaient
 * qu'en tombant par hasard sur la fiche de la bonne serie. Tout le social existait et ne
 * menait nulle part.
 *
 * ## Pourquoi le serveur ne rend rien
 *
 * La coquille est prerendue et **vide** : deux lecteurs differents ne voient pas le meme
 * profil, puisque `can_see` depend de qui demande. Un rendu serveur devrait donc etre refait
 * par visiteur — c'est-a-dire le cout par utilisateur qui a tue TV Time. Ici la page est
 * servie depuis le cache et c'est le navigateur, avec la session du lecteur, qui remplit :
 * **RLS decide, le client affiche**.
 *
 * ## Une seule reponse pour « inconnu » et « invisible », et c'est une decision
 *
 * ⚠️ Distinguer « ce nom n'existe pas » de « ce profil ne vous est pas visible » ferait de
 * cette page un **oracle** : on pourrait tester des noms un par un pour savoir lesquels sont
 * pris, donc enumerer les comptes. La visibilite par defaut etant `followers` (Q1), la
 * majorite des profils sont invisibles a un inconnu — l'oracle serait donc utilisable sur
 * presque tout le monde. Une seule phrase couvre les deux cas.
 *
 * ## Le caviardage, et le piege qu'il fallait voir
 *
 * ⚠️ `redactReviews` est ecrite pour une **fiche serie** : elle ne prend qu'**une** position,
 * parce que « toutes ces critiques portent deja sur la meme serie ». Un profil melange les
 * oeuvres — l'appeler telle quelle revelerait la saison 6 de l'une parce que le lecteur en
 * est a la saison 6 de l'autre.
 *
 * D'ou {@link redactReviewsAcross}, **dans le domaine**. Ce composant ne decide donc rien :
 * il fournit une fonction qui dit ou en est le lecteur, et affiche le resultat. « Quelle
 * position s'applique a quelle critique » est une decision de spoiler, et la regle 7 exige
 * qu'elle vive dans `src/domain/`, jamais dans la couche de rendu.
 */
export function PublicProfile({ handle }: { readonly handle: string }) {
  const { t, locale } = useT();
  const { configured, ready, account } = useAuth();
  const { journal } = useJournal();

  const [profile, setProfile] = useState<Profile | undefined>(undefined);
  const [reviews, setReviews] = useState<readonly PublishedReview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followsMe, setFollowsMe] = useState(false);
  /**
   * Ai-je moi-meme reclame un nom ? **Trois etats, pas deux.**
   *
   * `undefined` = on ne sait pas encore, et c'est la meme doctrine que le reste de ce
   * fichier : le silence tant qu'on ne sait pas. Avec un booleen, la zone d'action
   * afficherait « prenez un nom » pendant le chargement puis basculerait sur « Suivre » —
   * c'est-a-dire reprocherait a quelqu'un un manque qu'il n'a pas.
   */
  const [named, setNamed] = useState<boolean | undefined>(undefined);

  const accessToken = account?.accessToken;
  const userId = account?.userId;

  const load = useCallback(async () => {
    // ⚠️ Le client est construit **meme sans compte** : un profil `public` se lit par un
    // visiteur anonyme, et c'est RLS qui tranche. Exiger une session ici fermerait la page
    // a exactement les gens qu'un lien de partage amene.
    const social = socialFrom(accessToken);
    if (social === undefined) return;
    const found = await social.findByHandle(handle.toLowerCase());
    setProfile(found);
    setLoaded(true);
    if (found === undefined) return;
    setReviews(await social.reviewsBy(found.userId));
    if (userId === undefined) return;
    // Les trois d'un coup : elles decident **ensemble** de ce que la zone d'action affiche —
    // le bouton, la mention « vous suit », ou l'invitation a prendre un nom. Les enchainer
    // ferait clignoter la reponse trois fois.
    const [mine, theirs, me] = await Promise.all([
      social.following(userId),
      social.followers(userId),
      social.myProfile(userId),
    ]);
    setFollowing(mine.some((p) => p.userId === found.userId));
    setFollowsMe(theirs.some((p) => p.userId === found.userId));
    setNamed(me !== undefined);
  }, [handle, accessToken, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = useCallback(async () => {
    if (userId === undefined || profile === undefined) return;
    const social = socialFrom(accessToken);
    if (social === undefined) return;
    const ok = following
      ? await social.unfollow(userId, profile.userId)
      : await social.follow(userId, profile.userId);
    if (ok) setFollowing(!following);
  }, [following, profile, userId, accessToken]);

  if (!configured) return <p className="prose-note">{t('account.unavailable.body')}</p>;
  // Le silence tant qu'on ne sait pas : annoncer « profil introuvable » avant d'avoir lu
  // serait le meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  if (!ready || !loaded) return <div className="h-64" aria-hidden="true" />;
  if (profile === undefined) return <p className="prose-note">{t('profile.unknown')}</p>;

  const isSelf = userId !== undefined && userId === profile.userId;

  // Le domaine tranche, avec la position du lecteur sur **chaque** oeuvre. Ce composant ne
  // fait que repondre a la question « ou en est-il sur celle-ci ? ».
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {/* ⚠️ La face n'est PAS posee en surimpression ici, alors que `Avatar` sait le faire :
              elle est deja dite en toutes lettres deux lignes plus bas. La repeter en pastille
              ferait annoncer la meme chose deux fois au meme endroit — c'est utile dans une
              liste dense, ou le mot ne tient pas, et redondant sur une page qui a la place. */}
          <Avatar handle={profile.handle} large />
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="page-title">@{profile.handle}</h1>
          {/* ⚠️ Le **mot**, pas la pastille. Ailleurs c'est l'inverse : dans le fil et dans
              « des gens a decouvrir », une ligne par personne ne supporte pas un mot de plus.
              Ici il y a la place, et une couleur seule n'apprend rien a qui la voit pour la
              premiere fois. La pastille l'accompagne pour faire le lien avec les listes. */}
            {profile.face !== undefined ? (
              <span className="flex items-center gap-1.5 meta">
                <FaceDot face={profile.face} />
                {t(`face.${profile.face}`)}
              </span>
            ) : null}
          </div>
        </div>
        {isSelf ? (
          <span className="meta">{t('profile.self')}</span>
        ) : account === undefined || named === undefined ? null : (
          <div className="flex flex-wrap items-center gap-3">
            {/* La reciprocite se dit ici et nulle part ailleurs : c'est la seule page ou l'on
                regarde **une** personne. Sur `/amis` on lit une liste, et une mention par
                ligne y serait du bruit. */}
            {followsMe ? (
              <span className="meta">{t('profile.followsYou')}</span>
            ) : null}
            {/* 🔴 Le bouton « Suivre » s'affichait a tout compte connecte, y compris a qui
                n'a pas reclame de nom — et `008_followers.sql` refuse desormais ce suivi.
                *Un bouton qui ne peut pas marcher ne se degrade pas, il ne s'affiche pas*
                (2026-08-09) : on montre a la place le geste qui debloque. */}
            {named ? (
              <button type="button" className="btn" aria-pressed={following} onClick={toggleFollow}>
                {following ? t('profile.unfollow') : t('profile.follow')}
              </button>
            ) : (
              <Link className="btn" href={pathIn('/amis', locale)}>
                {t('profile.needName')}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Les listes avant les critiques : une liste se lit sans rien savoir de la personne,
          une critique suppose qu'on connaisse la serie. C'est aussi le seul contenu de cette
          page qui ne puisse rien spoiler. */}
      <section className="space-y-3" aria-label={t('profile.lists')}>
        <h2 className="section-heading">{t('profile.lists')}</h2>
        <Lists ownerId={profile.userId} />
      </section>

      <section className="space-y-3" aria-label={t('profile.reviews')}>
        <h2 className="section-heading">{t('profile.reviews')}</h2>

        {reviews.length === 0 ? (
          <p className="prose-note">{t('profile.none')}</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((shown) => {
              const review = shown;
              const parsed = parseJournalKey(review.subject);
              const id = `${review.subject}:${review.target}`;
              const title = journal.entries[review.subject]?.snapshot?.title;

              return (
                <li key={id} className="card space-y-2">
                  {parsed === undefined ? (
                    <span className="text-sm font-medium">{title ?? review.subject}</span>
                  ) : (
                    <Link
                      className="text-sm font-medium hover:text-(--color-volt)"
                      href={pathIn(`/serie/${parsed.providerId}`, locale)}
                    >
                      {title ?? review.subject}
                    </Link>
                  )}

                  <ReviewBody
                    hidden={shown.hidden === true}
                    text={shown.text}
                    hiddenText={shown.hiddenText ?? ''}
                    throughSeason={shown.throughSeason}
                  />

                  {/* ⚠️ **Sur ses propres critiques uniquement**, et cette seule condition
                      ferme trois pieges d'un coup : pas de texte masque qui redevient
                      lisible en image, pas de mots d'autrui diffuses hors contexte, et pas
                      d'image impossible a masquer alors que `/regles` promet le contraire.
                      C'est aussi le seul geste qui ait un sens : on partage ce qu'on a
                      ecrit. */}
                  {isSelf ? (
                    <ShareReview
                      title={title ?? review.subject}
                      handle={profile.handle}
                      text={shown.text}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

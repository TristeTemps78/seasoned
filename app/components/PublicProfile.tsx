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
import { EmptyState } from '@/app/components/EmptyState';
import { FaceDot } from '@/app/components/FaceDot';
import { PosterChip } from '@/app/components/PosterChip';
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
  const { t, tn, locale } = useT();
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
      {/* 🔴 **L'identite etait une ligne de texte flottante.** Un avatar, un `<h1>` et un mot,
          poses sur le fond de la page — la seule page du produit dont le sujet est *quelqu'un*
          n'avait aucun bloc d'identite. `.panel` en fait un objet, comme une affiche est un
          objet : c'est le meme raisonnement qu'`editorial-voice` applique aux visuels. */}
      <header className="panel flex flex-wrap items-center gap-5 p-5">
        {/* ⚠️ La face n'est PAS posee en surimpression sur l'avatar, alors qu'`Avatar` sait le
            faire : elle est dite en toutes lettres juste a cote. La repeter en pastille ferait
            annoncer la meme chose deux fois au meme endroit — c'est utile dans une liste
            dense, ou le mot ne tient pas, et redondant sur une page qui a la place. */}
        <Avatar handle={profile.handle} large />

        <div className="min-w-0 space-y-1">
          <h1 className="page-title">@{profile.handle}</h1>
          {/* La ligne qui dit **qui** c'est en deux mesures : sa face, et ce qu'il y a a lire.
              ⚠️ Le **mot** de la face, pas la pastille seule. Ailleurs c'est l'inverse : dans
              le fil et dans « des gens a decouvrir », une ligne par personne ne supporte pas un
              mot de plus. Ici il y a la place, et une couleur seule n'apprend rien a qui la
              voit pour la premiere fois. La pastille l'accompagne pour faire le lien. */}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 meta">
            {profile.face !== undefined ? (
              <span className="flex items-center gap-1.5">
                <FaceDot face={profile.face} />
                {t(`face.${profile.face}`)}
              </span>
            ) : null}
            {/* ⚠️ **Rien a zero, et c'est une exception assumee a la regle 4.** Sur `/bilan`,
                « 0 critique » est une porte : c'est votre ecran, et l'etiquette nomme un geste
                que vous pouvez faire. Ici, le lecteur ne peut rien pour les critiques que
                quelqu'un d'autre n'a pas ecrites — et la section plus bas le dit deja. */}
            {reviews.length > 0 ? <span>{tn('profile.count', reviews.length)}</span> : null}
          </p>
        </div>

        {/* `ms-auto` : l'action se colle a droite quel que soit le contenu de gauche. Un
            `justify-between` sur le conteneur casserait des que le bloc d'identite passe a la
            ligne sur un telephone. */}
        {isSelf ? (
          <span className="ms-auto meta">{t('profile.self')}</span>
        ) : account === undefined || named === undefined ? null : (
          <div className="ms-auto flex flex-wrap items-center gap-3">
            {/* La reciprocite se dit ici et nulle part ailleurs : c'est la seule page ou l'on
                regarde **une** personne. Sur `/amis` on lit une liste, et une mention par
                ligne y serait du bruit. */}
            {followsMe ? (
              <span className="meta">{t('profile.followsYou')}</span>
            ) : null}
            {/* 🔴 Le bouton « Suivre » s'affichait a tout compte connecte, y compris a qui
                n'a pas reclame de nom — et `008_followers.sql` refuse desormais ce suivi.
                *Un bouton qui ne peut pas marcher ne se degrade pas, il ne s'affiche pas*
                (2026-08-09) : on montre a la place le geste qui debloque.
                ⚠️ `btn-primary` seulement pour **suivre** : c'est l'action de la page. « Ne
                plus suivre » est un retrait, et une action de retrait qui brille invite au
                geste qu'on ne cherche pas a provoquer. */}
            {named ? (
              <button
                type="button"
                className={`btn ${following ? '' : 'btn-primary'}`}
                aria-pressed={following}
                onClick={toggleFollow}
              >
                {following ? t('profile.unfollow') : t('profile.follow')}
              </button>
            ) : (
              <Link className="btn" href={pathIn('/amis', locale)}>
                {t('profile.needName')}
              </Link>
            )}
          </div>
        )}
      </header>

      {/* =============================================================================
          🔴 LES CRITIQUES PASSENT DEVANT — et la decision qu'on renverse etait fondee
             sur le defaut qu'on vient de corriger
          =============================================================================

          Les listes venaient en premier, avec cet argument : *« une liste se lit sans rien
          savoir de la personne, une critique suppose qu'on connaisse la serie »*. Il etait
          vrai — parce que les critiques n'affichaient **ni titre ni affiche** (voir plus bas).
          Une fois qu'elles portent les deux, elles se lisent aussi froid qu'une liste, et
          mieux : ce sont des phrases ecrites par quelqu'un, c'est-a-dire la seule chose de
          cette page qui dise **qui** il est.

          ⚠️ Le second argument — *« le seul contenu qui ne puisse rien spoiler »* — ne tenait
          deja plus : `redactReviewsAcross` caviarde, oeuvre par oeuvre, tout ce que le lecteur
          n'a pas atteint. Le spoiler est traite en amont, pas par l'ordre des sections.

          Consequence pratique mesuree : sur un profil sans liste — le cas de tous les profils
          aujourd'hui —, la page s'ouvrait sur « Rien a lire ici pour l'instant » avant de
          montrer ce que la personne avait ecrit. */}
      <section className="space-y-3" aria-label={t('profile.reviews')}>
        <h2 className="section-heading">{t('profile.reviews')}</h2>

        {reviews.length === 0 ? (
          <EmptyState>{t('profile.none')}</EmptyState>
        ) : (
          // ⚠️ **Deux colonnes**, et non une pile pleine largeur. Mesure au DOM le
          // 2026-08-11 : une critique de deux mots occupait une carte de 1120 px de large et
          // 87 px de haut. Une opinion courte est le cas le plus frequent, et elle ne merite
          // pas la largeur d'un article.
          <ul className="grid gap-3 sm:grid-cols-2">
            {visible.map((shown) => {
              const review = shown;
              const parsed = parseJournalKey(review.subject);
              const id = `${review.subject}:${review.target}`;
              /* 🔴 **La page affichait `tmdb:94605`.** Constate a l'ecran le 2026-08-11 sur
                 `/u/tristetemps78` : deux critiques, deux cles brutes, zero image sur toute
                 la page.

                 La cause : le titre n'etait lu que dans le journal du **lecteur**
                 (`journal.entries[…]?.snapshot?.title`), donc jamais pour une serie qu'il ne
                 suit pas — c'est-a-dire jamais dans le seul cas ou un profil sert a
                 decouvrir quelqu'un.

                 `PublishedReview` porte pourtant `title` et `posterPath` **depuis 018**, et
                 la documentation du type decrit mot pour mot ce defaut : *« sans eux, le fil
                 affichait "@test wrote about tmdb:94997" »*. Le correctif avait ete applique
                 au fil et **oublie ici**, sur la page qui est la destination de tous les
                 liens `@nom` du produit. L'ordre est le meme que dans `FriendsFeed` :
                 l'instantane publie d'abord, le journal du lecteur en repli. */
              const title = review.title ?? journal.entries[review.subject]?.snapshot?.title;
              const posterPath =
                review.posterPath ?? journal.entries[review.subject]?.snapshot?.posterPath;
              const shownTitle = title ?? review.subject;
              const href = parsed === undefined
                ? undefined
                : pathIn(`/serie/${parsed.providerId}`, locale);

              return (
                <li key={id} className="card flex gap-4">
                  {/* L'affiche a gauche, le texte a droite : c'est ce qui fait qu'on
                      reconnait la serie **avant** de lire, comme partout ailleurs dans le
                      produit. `PosterChip` rend son monogramme quand l'affiche manque —
                      jamais un trou. */}
                  {href === undefined ? (
                    <PosterChip path={posterPath} title={shownTitle} wide />
                  ) : (
                    <Link href={href} className="shrink-0">
                      <PosterChip path={posterPath} title={shownTitle} wide />
                    </Link>
                  )}

                  <div className="min-w-0 flex-1 space-y-2">
                    {href === undefined ? (
                      <span className="text-sm font-medium">{shownTitle}</span>
                    ) : (
                      <Link
                        className="block text-sm font-medium hover:text-(--color-volt)"
                        href={href}
                      >
                        {shownTitle}
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
                        title={shownTitle}
                        handle={profile.handle}
                        text={shown.text}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-label={t('profile.lists')}>
        <h2 className="section-heading">{t('profile.lists')}</h2>
        <Lists ownerId={profile.userId} />
      </section>
    </div>
  );
}

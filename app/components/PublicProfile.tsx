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
import { formatDate } from '@/lib/format';
import {
  type FeedItem,
  type Profile,
  type PublishedReview,
  type SeriesRef,
} from '@/src/social/client';
import { resolveSeriesRef } from '@/app/components/seriesRef';
import { Lists } from '@/app/components/Lists';
import { Avatar } from '@/app/components/Avatar';
import { ReviewHeart } from '@/app/components/ReviewHeart';
import { ReviewSortMenu } from '@/app/components/ReviewSortMenu';
import { useReviewHearts } from '@/app/social/useReviewHearts';
import { CONTROLS_FROM, orderReviews, type ReviewSort } from '@/src/domain/review-order';
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
/**
 * « season:3 » → 3.
 *
 * ⚠️ Le repli est `0` et non une exception : une cible malformee vient de la base, donc
 * d'ailleurs, et une page de profil ne doit pas se casser parce qu'une ligne est bizarre.
 * Le libelle dira « saison 0 », ce qui est visiblement faux — donc lisible comme un defaut,
 * ce qu'un ecran blanc n'est pas.
 */
function seasonOf(target: string): number {
  const n = Number(target.split(':')[1]);
  return Number.isFinite(n) ? n : 0;
}

export function PublicProfile({ handle }: { readonly handle: string }) {
  const { t, tn, locale } = useT();
  const { configured, ready, account } = useAuth();
  const { journal } = useJournal();

  const [profile, setProfile] = useState<Profile | undefined>(undefined);
  const [reviews, setReviews] = useState<readonly PublishedReview[]>([]);
  const [loved, setLoved] = useState<readonly FeedItem[]>([]);
  const [pinned, setPinned] = useState<readonly SeriesRef[]>([]);
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

  /**
   * L'onglet lu. Dans l'etat React et **pas dans l'adresse** : les trois panneaux sont deja
   * tous charges quand la page a repondu (une seule requete les rend ensemble), donc changer
   * d'onglet ne redemande rien. Mettre la question dans l'URL obligerait `/u/<nom>` a devenir
   * dynamique — c'est-a-dire un rendu par visiteur, le cout qui a tue TV Time.
   *
   * Le defaut est « ce qu'il aime », et c'est l'ordre d'avant les onglets : *une affiche se
   * lit sans rien savoir de quelqu'un, une phrase suppose qu'on connaisse la serie*.
   */
  const [tab, setTab] = useState<Tab>('loves');
  /**
   * L'ordre des critiques — M3.
   *
   * « Les plus recentes / les plus aimees » existait sur la fiche serie et **nulle part
   * ailleurs** : cette page rendait ce que la base avait renvoye. Sur un profil fourni,
   * c'est la seule commande qui reponde a « par quoi commencer ? ».
   *
   * ⚠️ Pas de filtre d'audience ici, et ce n'est pas un oubli : toutes ces critiques sont
   * de la meme personne. « Les gens que je suis » y rendrait tout ou rien.
   */
  const [sort, setSort] = useState<ReviewSort>('recent');

  const accessToken = account?.accessToken;
  const userId = account?.userId;

  /**
   * ⚠️ Sur la liste BRUTE, et avant les retours anticipes : un crochet ne se met pas
   * derriere une condition. Le caviardage ne touche que le texte, jamais l'identite d'une
   * critique — les coeurs se comptent donc sur les memes lignes.
   */
  const { hearts, mine: heartedByMe, canHeart, toggle } = useReviewHearts(reviews);

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
    // Les deux ensemble : c'est ce que la page montre l'un sous l'autre, et les enchainer
    // ferait apparaitre le gout apres les mots, dans une page qui commence par le gout.
    const [written, hearts, favorites] = await Promise.all([
      social.reviewsBy(found.userId),
      social.lovedBy(found.userId),
      // Les epinglees dans le meme paquet que les deux autres : elles s'affichent au-dessus,
      // donc les enchainer ferait arriver la carte de visite apres ce qu'elle presente.
      social.favoritesBy(found.userId),
    ]);
    setReviews(written);
    setLoved(hearts);
    setPinned(favorites);
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

  // ⚠️ Le seuil se compte sur **tout ce qui est charge**, jamais sur la liste rendue : c'est
  // la meme regle que sur la fiche serie, et la meme raison — une commande qui disparait
  // parce qu'elle a filtre fabrique un cul-de-sac dont on ne peut plus sortir.
  const listed = orderReviews(visible, { sort, audience: 'everyone' }, { hearts });
  const withControls = reviews.length >= CONTROLS_FROM;

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
      {/* =============================================================================
          🔴 LE GESTE S'APPELLE « EPINGLER SUR SON PROFIL », ET LE PROFIL NE MONTRAIT RIEN
          =============================================================================

          Mesure a l'ecran le 2026-08-15 : cette page portait un avatar, un nom, les critiques
          et les listes — rien du gout de la personne. `favorites.pin` s'intitule pourtant
          « Pin to profile », et `<Favorites />` n'est monte qu'a un endroit du depot : `/moi`.

          ⚠️ **Ce sont les coeurs, pas les quatre epinglees**, et l'ecart est assume : les
          epinglees vivent dans le journal, donc dans le navigateur, et les faire voyager
          demande une colonne sur `profiles` plus un chemin de publication — comme `face` en a
          un. Les coeurs sont deja publies depuis `005_liked.sql` et n'etaient lus que serie
          par serie (`watchersOf`), jamais par personne. C'est donc la meme reponse — *ce que
          cette personne aime* — pour zero migration.

          En tete, et avant les mots : une affiche se lit sans rien savoir de quelqu'un, une
          phrase suppose qu'on connaisse la serie. C'est l'argument qui rangeait les listes en
          premier avant le 2026-08-11 ; il etait faux pour du texte, il reste vrai pour des
          images. */}
      {/* =============================================================================
          LES TROIS FACES DE QUELQU'UN — et pourquoi elles cessent d'etre empilees
          =============================================================================

          Les trois sections vivaient l'une sous l'autre. Sur un profil fourni — quarante
          coeurs, trente critiques a deux colonnes, dix listes — lire ce que la personne
          **range** demandait de traverser tout ce qu'elle aime et tout ce qu'elle ecrit. Le
          seul ecran du produit dont le sujet est *quelqu'un* se parcourait au defilement.

          ⚠️ **Les trois onglets sont toujours la, meme vides**, et ce n'est pas un oubli de la
          regle 4 : « cette personne ne tient aucune liste » est une information **sur elle**,
          au meme titre que dix listes. C'est la difference avec une porte fermee — rien n'est
          conditionne a un compte ici, chaque panneau dit ce qu'il en est. Les cacher ferait en
          plus varier la navigation d'un profil a l'autre, ce qui est la pire facon d'apprendre
          une interface.

          ⚠️ Le motif ARIA complet (`tablist`/`tab`/`tabpanel`, focus tournant, fleches) et non
          trois boutons `aria-pressed` : ce sont bien des panneaux qui se remplacent, et c'est
          la seule forme qui l'annonce. Les fleches sont **obligatoires** dans ce motif — les
          onglets sortent du parcours de tabulation sauf celui qui est actif, donc sans elles
          on ne peut plus atteindre les autres au clavier. */}
      {/* 🔴 **Les quatre epinglees, et c'est ici qu'elles manquaient.** Le bouton s'appelle
          « Pin to profile » depuis toujours, et elles vivaient dans le journal — donc dans le
          navigateur de celui qui epingle, visibles nulle part ailleurs que sur `/moi`. Voir
          `021_profile_favorites.sql`.

          ⚠️ **Au-dessus des onglets et non dans un quatrieme** : c'est une carte de visite,
          quatre affiches qu'on lit d'un coup d'oeil avant de choisir quoi ouvrir. Un onglet
          les mettrait au meme rang que « toutes ses critiques », et surtout les cacherait
          derriere un clic. */}
      <PinnedSeries entries={pinned} mine={profile.userId === userId} />

      <Tabs current={tab} onSelect={setTab} />

      {tab === 'loves' ? (
        <section
          id="panneau-loves"
          role="tabpanel"
          aria-labelledby="onglet-loves"
          tabIndex={0}
          className="space-y-3"
          aria-label={t('profile.loves')}
        >
          {loved.length === 0 ? (
            // ⚠️ Sans action : le lecteur ne peut rien pour les series que quelqu'un d'autre
            // n'a pas aimees. Meme raison que `profile.none` juste a cote.
            <EmptyState>{t('profile.noLoves')}</EmptyState>
          ) : (
          <ul className="flex flex-wrap gap-3">
            {loved.map((one) => {
              const parsed = parseJournalKey(one.subject);
              const title =
                one.title ?? journal.entries[one.subject]?.snapshot?.title ?? t('feed.someSeries');
              const posterPath =
                one.posterPath ?? journal.entries[one.subject]?.snapshot?.posterPath;
              if (parsed === undefined) return null;
              return (
                <li key={`${one.subject}:${one.happenedOn}`}>
                  <Link href={pathIn(`/serie/${parsed.providerId}`, locale)} className="block">
                    <PosterChip path={posterPath} title={title} wide />
                  </Link>
                </li>
              );
            })}
          </ul>
          )}
        </section>
      ) : null}

      {tab === 'reviews' ? (
      <section
        id="panneau-reviews"
        role="tabpanel"
        aria-labelledby="onglet-reviews"
        tabIndex={0}
        className="space-y-3"
        aria-label={t('profile.reviews')}
      >
        {/* M3 — le tri n'existait que sur la fiche serie. Meme seuil qu'elle, importe du
            domaine plutot que recopie : sous cinq critiques, trier ne repond a aucune
            question qu'on se pose. */}
        {withControls ? (
          <ReviewSortMenu id="profile-reviews-sort" value={sort} onChange={setSort} />
        ) : null}

        {reviews.length === 0 ? (
          <EmptyState>{t('profile.none')}</EmptyState>
        ) : (
          // ⚠️ **Deux colonnes**, et non une pile pleine largeur. Mesure au DOM le
          // 2026-08-11 : une critique de deux mots occupait une carte de 1120 px de large et
          // 87 px de haut. Une opinion courte est le cas le plus frequent, et elle ne merite
          // pas la largeur d'un article.
          <ul className="grid gap-3 sm:grid-cols-2">
            {listed.map((shown) => {
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
              // 🔴 Jamais la cle. Le commentaire vingt lignes plus haut raconte deja que cette
              // page a affiche « tmdb:94605 » ; le repli qui restait la ramenait des qu'aucune
              // des deux sources ne connaissait le titre.
              const shownTitle = title ?? t('feed.someSeries');
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

                    {/* 🔴 **Deux critiques d'*Arcane*, le meme lien, et rien pour les
                        distinguer.** Constate a l'ecran le 2026-08-15 sur `/u/tristetemps78` :
                        « even better » et « insane », toutes deux vers `/serie/94605`, sans
                        qu'on sache laquelle porte sur la serie et laquelle sur une saison.

                        `target` porte la reponse depuis `006_reviews.sql` et `publishedAt`
                        aussi — c'est le meme defaut que la fiche serie a corrige pour la date
                        le 2026-08-15 : une colonne lue, triee par la base, jamais montree. Une
                        critique sans date et sans cible ne se situe ni dans le temps ni dans
                        l'oeuvre, et c'est tout ce qu'on veut savoir d'un avis qu'on decouvre. */}
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 meta-sm">
                      <span>
                        {review.target === 'series'
                          ? t('review.onSeries')
                          : t('review.onSeason', { n: seasonOf(review.target) })}
                      </span>
                      <time dateTime={review.publishedAt}>
                        {formatDate(new Date(review.publishedAt), locale)}
                      </time>
                    </p>

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
                    {/* 🔴 Le coeur, absent de cette page jusqu'au 2026-08-17 : on lisait
                        quelqu'un sans pouvoir le lui dire, sur la page **faite** pour lire
                        quelqu'un. `likeReview` existait depuis `015` et n'etait branche qu'a
                        la fiche serie.

                        ⚠️ Les deux gestes ne se croisent jamais : `canHeart` est faux sur
                        ses propres critiques (un compteur qu'on s'incremente soi-meme),
                        `isSelf` n'est vrai que la. Sur son propre profil, on partage ; sur
                        celui d'un autre, on aime. */}
                    {canHeart(shown) ? (
                      <ReviewHeart
                        count={hearts(shown)}
                        mine={heartedByMe(shown)}
                        onToggle={(next) => toggle(shown, next)}
                      />
                    ) : null}

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
      ) : null}

      {tab === 'lists' ? (
        <section
          id="panneau-lists"
          role="tabpanel"
          aria-labelledby="onglet-lists"
          tabIndex={0}
          className="space-y-3"
          aria-label={t('profile.lists')}
        >
          {/* `Lists` porte deja son propre vide de visiteur (`lists.noneOther`) : lui en
              ajouter un ici ferait dire deux fois la meme chose. */}
          {/* Le nom part avec l'identifiant : il est deja la, et sans lui chaque titre de
              liste resterait du texte au lieu de mener a son adresse. */}
          <Lists ownerId={profile.userId} ownerHandle={profile.handle} />
        </section>
      ) : null}
    </div>
  );
}

/** Les trois panneaux d'un profil. L'ordre est celui d'avant les onglets, et il a sa raison. */
const TABS = ['loves', 'reviews', 'lists'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Readonly<Record<Tab, 'profile.loves' | 'profile.reviews' | 'profile.lists'>> = {
  loves: 'profile.loves',
  reviews: 'profile.reviews',
  lists: 'profile.lists',
};

/**
 * La barre d'onglets.
 *
 * ⚠️ **Le focus tourne** : un seul onglet est atteignable au `Tab` (celui qui est actif), les
 * autres se rejoignent aux fleches. C'est le motif ARIA, et ce n'est pas une preference — sans
 * les fleches, les onglets non actifs deviendraient **inatteignables au clavier**, puisque le
 * motif les sort lui-meme du parcours de tabulation. Les deux moities vont ensemble ou pas du
 * tout.
 *
 * ⚠️ `Home`/`End` en plus des fleches : trois onglets ne les rendent pas indispensables, mais
 * c'est la meme boucle de code, et la barre grandira le jour ou un profil aura un journal
 * public.
 */
function Tabs({ current, onSelect }: {
  readonly current: Tab;
  readonly onSelect: (tab: Tab) => void;
}) {
  const { t } = useT();

  return (
    <div role="tablist" aria-label={t('profile.tabs')} className="flex gap-1 border-b border-(--color-edge)">
      {TABS.map((tab) => {
        const active = tab === current;
        return (
          <button
            key={tab}
            id={`onglet-${tab}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`panneau-${tab}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tab)}
            onKeyDown={(event) => {
              const step =
                event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : undefined;
              const to =
                step !== undefined
                  ? TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length]
                  : event.key === 'Home'
                    ? TABS[0]
                    : event.key === 'End'
                      ? TABS[TABS.length - 1]
                      : undefined;
              if (to === undefined) return;
              event.preventDefault();
              onSelect(to);
              // Le focus suit la selection : c'est ce que le motif appelle « automatic
              // activation », et c'est le comportement attendu quand changer d'onglet ne
              // coute rien — ici tout est deja charge.
              document.getElementById(`onglet-${to}`)?.focus();
            }}
            // Meme dessin que le ruban des faces : capitales serrees, trait volt **sur** le
            // libelle et sous lui. Deux signaux dont un non colore — la lecon du 2026-08-12.
            className={`inline-block border-b-2 px-3 py-3 text-xs font-bold tracking-[0.08em] whitespace-nowrap uppercase transition-colors ${
              active
                ? 'border-(--color-volt) text-(--color-bright)'
                : 'border-transparent text-(--color-muted) hover:text-(--color-bright)'
            }`}
          >
            {t(TAB_LABEL[tab])}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Les quatre epinglees de quelqu'un — sa carte de visite.
 *
 * ## 🔴 Ce qu'elles ne faisaient pas jusqu'au 2026-08-16
 *
 * Le bouton s'intitule *« Pin to profile »* depuis toujours. Les epinglees vivaient dans
 * `journal.favorites` — c'est-a-dire dans le navigateur de la personne — et `<Favorites />`
 * n'etait monte que sur `/moi`. On epinglait donc « sur son profil » quatre series qu'aucun
 * lecteur ne pouvait voir. `021_profile_favorites.sql` leur donne un chemin.
 *
 * ## Deux silences, et ils ne disent pas la meme chose
 *
 * - **Chez quelqu'un d'autre**, sans epinglee : rien. Il n'y a litteralement rien derriere,
 *   sur une page par ailleurs pleine — c'est le silence que `CLAUDE.md` garde explicitement
 *   (`FaceDot`, le compteur de coeurs a zero). Le lecteur ne peut rien y faire.
 * - **Chez soi**, sans epinglee : une phrase et un chemin. La, il y a un geste a faire et il
 *   se fait ailleurs (`/moi`) — c'est exactement le cas que la regle 4 vise, et le taire
 *   laisserait un bouton nomme « epingler sur son profil » sans que le profil n'en parle
 *   jamais.
 */
function PinnedSeries({
  entries,
  mine,
}: {
  readonly entries: readonly SeriesRef[];
  readonly mine: boolean;
}) {
  const { t, locale } = useT();
  const { journal } = useJournal();

  if (entries.length === 0) {
    if (!mine) return null;
    return (
      <p className="meta">
        {t('profile.pinned.none')}{' '}
        <Link className="tap-line underline hover:text-(--color-volt)" href={pathIn('/moi', locale)}>
          {t('profile.pinned.where')}
        </Link>
      </p>
    );
  }

  return (
    <section className="space-y-3" aria-label={t('profile.pinned')}>
      <h2 className="section-heading">{t('profile.pinned')}</h2>
      <ul className="flex flex-wrap gap-3">
        {entries.map((entry) => {
          const parsed = parseJournalKey(entry.subject);
          // ⚠️ Meme resolution que les listes, et par la meme fonction : l'instantane de la
          // ligne d'abord, le journal du lecteur ensuite. Un profil est justement lu par des
          // gens qui ne suivent pas les memes series.
          const { title, posterPath } = resolveSeriesRef(entry, journal, t('feed.someSeries'));
          const chip = <PosterChip path={posterPath} title={title} wide />;
          return (
            <li key={entry.subject}>
              {parsed === undefined ? (
                chip
              ) : (
                <Link
                  href={pathIn(`/serie/${parsed.providerId}`, locale)}
                  className="block"
                  aria-label={title}
                >
                  {chip}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

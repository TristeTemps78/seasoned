'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { projectActivity, redactActivity } from '@/src/domain/activity';
import { faceOf } from '@/src/domain/face';
import { mergeFeed } from '@/src/domain/feed';
import { checkHandle } from '@/src/domain/handles';
import { parseJournalKey, seriesEntries, type JournalKey } from '@/src/domain/journal';
import { redactReviewsAcross } from '@/src/domain/spoiler';
import {
  type SocialClient,
  type FeedItem,
  type Profile,
  type PublishedReview,
} from '@/src/social/client';
import { ReportButton } from '@/app/components/ReportButton';
import { AccountGate } from '@/app/components/AccountGate';
import { Discover } from '@/app/components/Discover';
import { DailyRound } from '@/app/components/DailyRound';
import { FriendQuiz } from '@/app/components/FriendQuiz';
import { Avatar } from '@/app/components/Avatar';
import { FriendsFeed } from '@/app/components/FriendsFeed';
import { pathIn } from '@/lib/routes';
import { useSocial } from '@/app/social/useSocial';

/**
 * La face « Mes amis » : reclamer un nom, suivre quelqu'un, lire le fil.
 *
 * ## Ce qui n'existe pas ici, et c'est voulu
 *
 * **Aucune recherche approchante.** On ne trouve quelqu'un qu'en connaissant son nom exact.
 * Une recherche partielle sur les profils est un annuaire, c'est-a-dire un moyen de
 * parcourir des gens qui ne l'ont pas demande — et le premier outil de qui veut en harceler
 * un. Le cout de cette absence est une friction a l'invitation ; le cout de sa presence est
 * irrattrapable.
 *
 * ## Le caviardage se fait ici, avec MON journal
 *
 * Le serveur ne sait pas ou j'en suis — c'est justement ce qui garantit que ma position ne
 * peut pas fuir. Le fil arrive donc entier et c'est le navigateur qui masque les notes de
 * saisons que je n'ai pas atteintes (`redactActivity`).
 */
export function Friends() {
  const { t, locale } = useT();
  const { configured, ready, account } = useAuth();
  const { journal } = useJournal();

  const [profile, setProfile] = useState<Profile | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [handle, setHandle] = useState('');
  const [claimError, setClaimError] = useState<'taken' | 'shape' | 'failed' | undefined>(undefined);
  const [friends, setFriends] = useState<readonly Profile[]>([]);
  const [fans, setFans] = useState<readonly Profile[]>([]);
  const [feed, setFeed] = useState<readonly FeedItem[]>([]);
  const [written, setWritten] = useState<readonly PublishedReview[]>([]);
  const [lookup, setLookup] = useState('');
  const [notFound, setNotFound] = useState(false);
  /**
   * 🔴 **La distinction que ce produit n'avait pas.** `SocialClient` rend `[]` quand une
   * lecture echoue : un fil vide et un fil qui n'a **pas pu** etre lu donnaient exactement
   * le meme ecran. C'est ce qui a laisse 10.0 invisible pendant trois sessions — trois
   * lectures sociales repondaient 400 depuis toujours, et l'ecran disait « rien a lire ».
   */
  const [unreadable, setUnreadable] = useState(false);

  const userId = account?.userId;
  const client = useSocial(useCallback(() => setUnreadable(true), []));

  const refresh = useCallback(
    async (social: SocialClient, id: string) => {
      // ⚠️ Remis a zero **avant** la lecture : sans ca, une panne passagere marquerait
      // l'ecran jusqu'au rechargement de la page, y compris apres un retour du reseau.
      setUnreadable(false);
      const mine = await social.myProfile(id);
      setProfile(mine);
      setLoaded(true);
      if (mine === undefined) return;

      // La face (9.4). ⚠️ **Seulement si elle a change**, contrairement a l'activite et aux
      // critiques juste dessous : celles-la sont des faits, dont la cle naturelle absorbe les
      // republications ; une face est un **etat**, et le reecrire a l'identique serait une
      // requete pour rien a chaque ouverture de page.
      const face = faceOf(journal)?.id;
      if (face !== mine.face) {
        void social.setFace(id, face);
        setProfile({ ...mine, ...(face !== undefined ? { face } : {}) });
      }
      // ⚠️ Publier a **chaque** ouverture, et republier tout : la cle naturelle de la table
      // absorbe les doublons. Tenir la liste de ce qui a deja ete envoye serait un etat de
      // plus a synchroniser, donc un etat de plus a desynchroniser.
      await social.publish(id, projectActivity(journal, new Date()));

      // Les critiques partent par le meme chemin, et pour la meme raison : la cle naturelle
      // `(user_id, subject, target)` absorbe les republications, donc renvoyer tout est plus
      // sur que tenir la liste de ce qui a deja ete envoye.
      //
      // 🔴 **Et c'est ce qui rendait un retrait impossible, jusqu'au 2026-08-17.** Le
      // commentaire qui vivait ici affirmait qu'*« une critique effacee du journal disparait
      // du serveur au passage suivant »* : c'etait faux, et personne ne l'avait mesure. Ne
      // plus publier ne supprime rien — la ligne reste, avec ses coeurs et ses reponses,
      // pour toujours. Le retrait est un **geste**, il vit dans `Reviews` et il appelle
      // `unpublishReview()` ; le drapeau relu ci-dessous est l'autre moitie, sans laquelle
      // cette boucle le defairait a la page suivante. Voir `JournalReview.unpublished`.
      await Promise.all(
        seriesEntries(journal).flatMap(([subject, entry]) =>
          Object.entries(entry.reviews ?? {})
            .filter(([, review]) => review.unpublished !== true)
            .map(([target, review]) =>
              social.publishReview(id, subject, target, {
                text: review.text,
                throughSeason: review.throughSeason,
                lang: review.lang ?? 'fr',
                // ⚠️ L'instantane part **avec** la critique (018) : sans lui, le fil affichait
                // « a ecrit sur tmdb:94997 » a quiconque n'avait pas deja la serie dans son
                // propre journal — c'est-a-dire a tous ceux pour qui le fil sert a decouvrir.
                ...(entry.snapshot?.title !== undefined ? { title: entry.snapshot.title } : {}),
                ...(entry.snapshot?.posterPath !== undefined
                  ? { posterPath: entry.snapshot.posterPath }
                  : {}),
              }),
            ),
        ),
      );

      // ⚠️ Les deux ensemble, et jamais l'un sans l'autre : « suivre en retour » se decide en
      // comparant les deux listes, donc une seule des deux rendrait le bouton faux.
      const [followed, following] = await Promise.all([
        social.following(id),
        social.followers(id),
      ]);
      setFriends(followed);
      setFans(following);
      // Les deux moities du fil, en parallele : ce sont deux tables, donc deux lectures, et
      // les enchainer doublerait l'attente pour rien.
      // ⚠️ `id` en second argument : sans lui le fil rendait **ses propres** lignes sous un
      // titre qui dit « eux » — 4 faits de `@test` sur 13, mesures le 2026-08-16. RLS laisse
      // passer ce qu'on a soi-meme ecrit, et c'est juste ; c'est au fil des autres de s'en
      // retirer.
      const [facts, texts] = await Promise.all([social.feed(50, id), social.feedReviews(30, id)]);
      setFeed(facts);
      setWritten(texts);
    },
    [journal],
  );

  useEffect(() => {
    if (client === undefined || userId === undefined) return;
    void refresh(client, userId);
  }, [client, userId, refresh]);

  if (!configured) return <p className="text-(--color-muted)">{t('account.unavailable.body')}</p>;
  if (!ready) return <div className="h-64" aria-hidden="true" />;
  // 🔴 **C'etait une phrase grise, seule sur la page.** Un des six onglets de la navigation
  // menait donc, pour tout visiteur sans compte — c'est-a-dire tout le monde a la premiere
  // visite —, a un cul-de-sac sans un seul bouton. Voir `AccountGate` pour la regle qui saute.
  if (account === undefined) {
    return (
      <div className="space-y-8">
        <AccountGate
          title={t('friends.gate.title')}
          body={t('friends.gate.body')}
          secondaryHref="/recherche"
          secondaryLabel={t('gate.search')}
        />
        {/* 🔴 Et `Discover` vivait 250 lignes plus bas, donc **derriere ce retour anticipe**.
            Or il lit les profils publics SANS compte — c'est RLS qui tranche, et son propre
            commentaire le revendique : *« construit meme sans compte »*. La seule chose de
            cette face qui marchait sans compte etait donc inatteignable sans compte. C'est le
            meme motif que `unfollow()` et `setVisibility()` : du code juste, sans chemin. */}
        <Discover />
      </div>
    );
  }
  if (!loaded) return <div className="h-64" aria-hidden="true" />;

  async function onClaim(event: React.FormEvent) {
    event.preventDefault();
    setClaimError(undefined);
    // ⚠️ La verification vient du **domaine**, jamais d'un motif recopie ici : la liste des
    // noms reserves y vit aussi, et c'est elle que la base applique. Deux copies d'une
    // regle de nommage finissent par diverger — c'est arrive entre le domaine et le SQL.
    const checked = checkHandle(handle);
    if (!checked.ok) {
      setClaimError(checked.reason === 'reserved' ? 'taken' : 'shape');
      return;
    }
    if (client === undefined || userId === undefined) return;
    const outcome = await client.claim(userId, checked.handle, 'followers');
    if (outcome.kind === 'claimed') {
      setProfile(outcome.profile);
      void refresh(client, userId);
    } else {
      setClaimError(outcome.kind === 'taken' ? 'taken' : 'failed');
    }
  }

  async function onFollow(event: React.FormEvent) {
    event.preventDefault();
    setNotFound(false);
    if (client === undefined || userId === undefined) return;
    const found = await client.findByHandle(lookup.trim().toLowerCase());
    if (found === undefined) {
      setNotFound(true);
      return;
    }
    // 🔴 **Le resultat etait ignore, et le champ se vidait quand meme.** Un echec — et il y
    // en avait un a chaque second suivi, en 42501 — ressemblait donc trait pour trait a un
    // succes : le nom disparaissait, la liste se rechargeait sans la personne, et rien
    // n'expliquait pourquoi. C'est le seul endroit du produit ou l'ecran **affirmait** le
    // contraire de ce qui s'etait passe ; ailleurs il se contentait de ne rien faire.
    if (!(await client.follow(userId, found.userId))) return;
    setLookup('');
    void refresh(client, userId);
  }

  if (profile === undefined) {
    return (
      <section className="card max-w-md space-y-4">
        <h2 className="card-title">{t('friends.claim.title')}</h2>
        <p className="prose-note">
          {t('friends.claim.body')}
        </p>
        <form onSubmit={onClaim} className="flex flex-wrap items-center gap-2">
          <span className="text-(--color-muted)">@</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder={t('friends.claim.placeholder')}
            className="field w-48 text-sm"
          />
          <button
            type="submit"
            className="btn btn-primary"
          >
            {t('friends.claim.submit')}
          </button>
        </form>
        <p aria-live="polite" className="text-sm text-(--color-warn)">
          {claimError === undefined ? '' : t(`friends.claim.${claimError}`)}
        </p>
      </section>
    );
  }

  // La position du lecteur, serie par serie — elle ne sort jamais de ce navigateur.
  const reachedIn = (subject: JournalKey): number | undefined =>
    journal.entries[subject]?.position?.seasonNumber;

  const visible = redactActivity(feed, reachedIn);

  // ⚠️ Les critiques se caviardent avec **une position par oeuvre**, pas avec une seule :
  // un fil parle de vingt series a la fois. C'est exactement ce pour quoi
  // `redactReviewsAcross` a ete ecrite (page de profil, meme situation) — la refaire ici
  // donnerait deux regles de spoiler, et c'est la copie qui se perime qui spoile.
  const readable = redactReviewsAcross(written, (subject) => {
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

  // Le domaine range les deux sources ; ce composant ne decide d'aucun ordre.
  const timeline = mergeFeed(visible, readable);

  return (
    <div className="space-y-8">
      <section className="card max-w-md space-y-3">
        <p className="text-(--color-muted)">{t('friends.you', { handle: profile.handle })}</p>
        <form onSubmit={onFollow} className="flex flex-wrap items-center gap-2">
          <span className="text-(--color-muted)">@</span>
          <input
            value={lookup}
            onChange={(event) => setLookup(event.target.value)}
            placeholder={t('friends.follow.placeholder')}
            className="field w-48 text-sm"
          />
          <button
            type="submit"
            className="btn btn-primary"
          >
            {t('friends.follow.submit')}
          </button>
        </form>
        <p aria-live="polite" className="text-sm text-(--color-warn)">
          {notFound ? t('friends.follow.notFound') : ''}
        </p>
        {friends.length > 0 ? (
          <div className="space-y-1 text-sm">
            <p className="text-(--color-muted)">{t('friends.followingLabel')}</p>
            <ul className="flex flex-wrap gap-2">
              {friends.map((friend) => (
                <li key={friend.userId} className="flex items-center gap-1">
                  {/* ⚠️ Le nom devient un lien vers sa page — sans quoi 8.12 serait une page
                      que personne n'atteint, c'est-a-dire le defaut que ce depot a deja
                      commis deux fois avec `unfollow` et `setVisibility`. C'est ici que la
                      question « et sa page ? » se pose naturellement : on lit un nom. */}
                  <Avatar handle={friend.handle} />
                  <Link
                    href={pathIn(`/u/${friend.handle}`, locale)}
                    className="font-medium hover:text-(--color-volt)"
                  >
                    @{friend.handle}
                  </Link>
                  {/* `unfollow()` existait depuis le lot 6 et n'avait AUCUN appelant : on
                      pouvait suivre quelqu'un sans jamais pouvoir arreter. */}
                  <button
                    type="button"
                    onClick={() => {
                      if (client === undefined || userId === undefined) return;
                      void client.unfollow(userId, friend.userId).then(() => {
                        void refresh(client, userId);
                      });
                    }}
                    className="quiet-action"
                  >
                    {t('friends.unfollow')}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 🔴 Le pendant manquant du lot 6 : on voyait qui l'on suit, jamais qui nous suit.
            ⚠️ Ce bloc **depend d'une politique**, pas seulement de ce code : sans
            `008_followers.sql`, `followers()` rend des identifiants dont aucun profil n'est
            lisible, donc une liste vide — et rien ne le signalerait.
            ⚠️ **Muet quand il n'y a personne, et c'est l'exception la mieux fondee** a la
            regle 4 (2026-08-11) : ecrire « personne ne vous suit » serait **faux**. Un compte
            sans nom peut suivre et n'apparait dans aucune de ces listes — le meme fait qui
            interdit deja tout compteur ici. Une regle qui exige de parler ne peut pas exiger
            de dire une chose fausse ; c'est le seul silence de ce fichier qui ne se discute
            meme pas. */}
        {fans.length > 0 ? (
          <div className="space-y-1 text-sm">
            <p className="text-(--color-muted)">{t('friends.followersLabel')}</p>
            <ul className="flex flex-wrap gap-3">
              {fans.map((fan) => {
                const mutual = friends.some((friend) => friend.userId === fan.userId);
                return (
                  <li key={fan.userId} className="flex items-center gap-1">
                    <Avatar handle={fan.handle} />
                    <Link
                      href={pathIn(`/u/${fan.handle}`, locale)}
                      className="font-medium hover:text-(--color-volt)"
                    >
                      @{fan.handle}
                    </Link>
                    {/* Le bouton ne s'affiche que quand il a un sens : « suivre en retour »
                        quelqu'un qu'on suit deja ne veut rien dire, et un bouton sans effet
                        apprend a ne plus lire les boutons. */}
                    {mutual ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          if (client === undefined || userId === undefined) return;
                          void client.follow(userId, fan.userId).then(() => {
                            void refresh(client, userId);
                          });
                        }}
                        className="quiet-action"
                      >
                        {t('friends.followBack')}
                      </button>
                    )}
                    {/* ⚠️ Ici et pas seulement dans le fil : quelqu'un qui vous suit sans rien
                        publier n'apparait sur **aucune** autre surface. Sans ce bouton, le
                        seul abonne qu'on ne peut pas signaler serait le plus silencieux. */}
                    <ReportButton
                      onReport={(ground) =>
                        client === undefined || userId === undefined
                          ? Promise.resolve(false)
                          : client.report(userId, fan.userId, ground)
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {/* 🔴 La bascule de visibilite **etait ici**, et c'etait le defaut : le reglage le
            plus engageant du produit vivait sur la page ou l'on va regarder les autres,
            pendant que « Mon compte » n'en disait rien.

            ⚠️ **Une ligne, pas un second controle.** Copier la bascule donnerait deux
            copies du meme profil chargees separement : celle qu'on ne regarde pas afficherait
            l'ancienne valeur jusqu'au rechargement, et rien ne dirait laquelle ment. Ici on
            **nomme** l'etat courant — la question se pose naturellement a cote de ses
            abonnes — et le chemin est cliquable. */}
        <p className="text-sm text-(--color-muted)">
          {t('friends.visibility.now')}{' '}
          <span className="font-medium text-(--color-text)">
            {t(`friends.visibility.${profile.visibility}`)}
          </span>{' '}
          <Link
            className="tap-line underline hover:text-(--color-volt)"
            href={pathIn('/compte', locale)}
          >
            {t('friends.visibility.change')}
          </Link>
        </p>
      </section>

      {/* Avant le fil : quand on n'a suivi personne, le fil est vide et c'est justement
          la qu'il faut proposer quelqu'un. Se tait tout seul s'il n'y a personne. */}
      <Discover />

      {/* La manche du jour vit ici et non sur une septieme face : le cube en a six, et en
          ajouter une pour un jeu quotidien couterait plus a la navigation qu'elle ne
          rapporte. Elle est sociale — un classement — donc elle est chez les amis. */}
      <DailyRound />

      {/* ⚠️ On lui passe `visible`, c'est-a-dire le fil **deja caviarde** — jamais `feed`.
          Lui donner la matiere brute ferait tomber la regle du spoiler ici, en silence. */}
      <FriendQuiz
        redactedFacts={visible}
        titleOf={(subject) => journal.entries[subject as JournalKey]?.snapshot?.title}
      />

      {/* Le fil vit dans son propre fichier depuis le 2026-08-11 : il pesait 139 des 557
          lignes de ce composant, qui en portait cinq sujets sans rapport. */}
      <FriendsFeed
        timeline={timeline}
        unreadable={unreadable}
        journal={journal}
        onReport={(authorId, ground) =>
          client === undefined || userId === undefined
            ? Promise.resolve(false)
            : client.report(userId, authorId, ground)
        }
      />
    </div>
  );
}

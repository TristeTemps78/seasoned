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
import { ReviewBody } from '@/app/components/ReviewBody';
import { Discover } from '@/app/components/Discover';
import { DailyRound } from '@/app/components/DailyRound';
import { FriendQuiz } from '@/app/components/FriendQuiz';
import { Avatar } from '@/app/components/Avatar';
import { PosterChip } from '@/app/components/PosterChip';
import { pathIn } from '@/lib/routes';
import { socialFrom } from '@/app/social/socialFrom';

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

  const [client, setClient] = useState<SocialClient | undefined>(undefined);
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
  const accessToken = account?.accessToken;

  useEffect(() => {
    if (userId === undefined) return;
    setClient(socialFrom(accessToken, () => setUnreadable(true)));
  }, [userId, accessToken]);

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
      // ⚠️ Ce qui n'a PAS de texte n'est pas publie — et une critique effacee du journal
      // disparait donc du serveur au passage suivant. C'est la seule facon de depublier
      // sans inventer un second etat qu'il faudrait garder d'accord avec le premier.
      await Promise.all(
        seriesEntries(journal).flatMap(([subject, entry]) =>
          Object.entries(entry.reviews ?? {}).map(([target, review]) =>
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
      const [facts, texts] = await Promise.all([social.feed(), social.feedReviews()]);
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
  if (account === undefined) return <p className="text-(--color-muted)">{t('friends.signedOut')}</p>;
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
            Muet quand il n'y a personne : *mieux vaut se taire que compter zero*. Et aucun
            compteur nulle part, parce qu'il ne collerait pas aux noms (un compte sans handle
            suit sans rien avoir a montrer). */}
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

        {/* 🔴 La visibilite du profil, qui n'etait reglable NULLE PART.
            `setVisibility()` existait sans appelant, et la valeur etait codee en dur a
            `followers` a la creation — donc aucune critique, aucun fait, n'aurait jamais pu
            etre lu par quelqu'un qui ne vous suit pas deja. Le social etait bati et aveugle. */}
        <div className="space-y-1 text-sm">
          <p className="text-(--color-muted)">{t('friends.visibility')}</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['private', 'friends.visibility.private'],
                ['followers', 'friends.visibility.followers'],
                ['public', 'friends.visibility.public'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={profile.visibility === value}
                onClick={() => {
                  if (client === undefined || userId === undefined) return;
                  void client.setVisibility(userId, value).then((ok) => {
                    if (ok) setProfile({ ...profile, visibility: value });
                  });
                }}
                className="btn rounded-full"
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>
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

      <section className="space-y-3">
        <h2 className="section-heading">{t('friends.feed.title')}</h2>
        {timeline.length === 0 ? (
          // ⚠️ Mieux vaut se taire que compter zero : un fil vide dit quoi faire, il
          // n'affiche pas « 0 activite ». Mais il ne doit pas dire « rien a lire » quand
          // la verite est « je n'ai pas pu lire » — c'est le defaut de 10.0, et la seule
          // facon de ne pas le refaire est que l'ecran connaisse la difference.
          <div className="empty-state" role={unreadable ? 'status' : undefined}>
            <p className="empty-state-body">
              {t(unreadable ? 'friends.feed.unreadable' : 'friends.feed.empty')}
            </p>
          </div>
        ) : (
          <ul>
            {timeline.map((entry, index) => {
              if (entry.of === 'review') {
                const review = entry.review;
                const parsed = parseJournalKey(review.subject);
                // Le titre vient de **mon** instantane local, jamais d'un appel catalogue :
                // une requete par ligne de fil est le cout par utilisateur que ce produit
                // refuse. Sans instantane on montre la cle — le lien, lui, marche toujours.
                // ⚠️ L'instantane publie **d'abord**, le journal du lecteur ensuite. L'ordre
                // inverse laissait « tmdb:94997 » a l'ecran pour toute serie que le lecteur
                // n'avait pas deja — c'est-a-dire dans le seul cas ou un fil sert a decouvrir.
                const title = review.title ?? journal.entries[review.subject]?.snapshot?.title;
                const poster =
                  review.posterPath ?? journal.entries[review.subject]?.snapshot?.posterPath;

                return (
                  <li
                    key={`review-${review.authorId}-${review.subject}-${review.target}-${index}`}
                    className="feed-row space-y-2 text-sm"
                  >
                    {/* ⚠️ `flex-wrap` et non une colonne : la ligne porte le pseudo, le verbe et
                        le titre de la serie, qui doivent rester **une phrase**. Une colonne les
                        empilerait en trois fragments qui ne se lisent plus ensemble. Les `{' '}`
                        qui suivent deviennent des elements de flex vides — la specification dit
                        qu'un element anonyme fait de blanc seul n'est pas rendu, donc ils ne
                        creusent aucun trou. */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {poster === undefined ? null : (
                        <PosterChip path={poster} title={title ?? review.subject} />
                      )}
                      <Avatar handle={review.handle} face={review.face} />
                      <Link
                        href={pathIn(`/u/${review.handle}`, locale)}
                        className="font-medium hover:text-(--color-volt)"
                      >
                        @{review.handle}
                      </Link>{' '}
                      {t('friends.item.reviewed')}{' '}
                      {parsed === undefined ? (
                        <span className="font-medium">{title ?? review.subject}</span>
                      ) : (
                        <Link
                          href={pathIn(`/serie/${parsed.providerId}`, locale)}
                          className="font-medium hover:text-(--color-volt)"
                        >
                          {title ?? review.subject}
                        </Link>
                      )}
                      <ReportButton
                        onReport={(ground) =>
                          client === undefined || userId === undefined
                            ? Promise.resolve(false)
                            : client.report(userId, review.authorId, ground)
                        }
                      />
                    </div>
                    <ReviewBody
                      hidden={review.hidden === true}
                      text={review.text}
                      hiddenText={review.hiddenText ?? ''}
                      throughSeason={review.throughSeason}
                    />
                  </li>
                );
              }

              const item = entry.fact;
              // 🔴 Le bloc « fait » ne nommait **pas du tout** la serie : la ligne disait
              // « @x a note la saison 1 — 4,5 ★ » sans jamais dire de quelle serie. Pire que
              // la cle brute des critiques, et invisible au HTML — il faut le lire a l'ecran.
              const factTitle = item.title ?? journal.entries[item.subject]?.snapshot?.title;
              const factPoster =
                item.posterPath ?? journal.entries[item.subject]?.snapshot?.posterPath;
              const factParsed = parseJournalKey(item.subject);
              return (
                <li
                  key={`${item.handle}-${item.subject}-${item.kind}-${item.happenedOn}-${index}`}
                  className="feed-row flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                >
                  {factPoster === undefined ? null : (
                    <PosterChip path={factPoster} title={factTitle ?? item.subject} />
                  )}
                  <Avatar handle={item.handle} face={item.face} />{' '}
                  <Link
                    href={pathIn(`/u/${item.handle}`, locale)}
                    className="font-medium hover:text-(--color-volt)"
                  >
                    @{item.handle}
                  </Link>{' '}
                  {t(`friends.item.${item.kind}`)}{' '}
                  {/* ⚠️ Le titre n'est rendu que s'il est **connu** : ecrire la cle a la place
                      serait revenir au defaut qu'on corrige. Sans titre, la phrase reste
                      « @x a termine » — incomplete, mais jamais absurde. */}
                  {factTitle === undefined ? null : factParsed === undefined ? (
                    <span className="font-medium">{factTitle}</span>
                  ) : (
                    <Link
                      href={pathIn(`/serie/${factParsed.providerId}`, locale)}
                      className="font-medium hover:text-(--color-volt)"
                    >
                      {factTitle}
                    </Link>
                  )}{' '}
                  {item.season !== undefined && item.stars !== undefined
                    ? t('friends.item.season', {
                        season: String(item.season),
                        stars: item.stars.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB'),
                      })
                    : null}
                  {/* ⚠️ Sur chaque ligne, et non dans un menu de profil : on signale ce qu'on
                      vient de lire, au moment ou on le lit. Une voie de signalement qui
                      demande de retrouver la personne ailleurs n'en est pas une — c'est le
                      meme raisonnement qui a mis `/regles` en pied de page de tout le site. */}
                  <ReportButton
                    onReport={(ground) =>
                      client === undefined || userId === undefined
                        ? Promise.resolve(false)
                        : client.report(userId, item.authorId, ground)
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

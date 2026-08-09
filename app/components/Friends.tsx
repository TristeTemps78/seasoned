'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { authConfigFromEnv } from '@/src/auth/client';
import { projectActivity, redactActivity } from '@/src/domain/activity';
import { checkHandle } from '@/src/domain/handles';
import { seriesEntries, type JournalKey } from '@/src/domain/journal';
import { SocialClient, type FeedItem, type Profile } from '@/src/social/client';
import { ReportButton } from '@/app/components/ReportButton';
import { Discover } from '@/app/components/Discover';
import { pathIn } from '@/lib/routes';

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
  const [lookup, setLookup] = useState('');
  const [notFound, setNotFound] = useState(false);

  const userId = account?.userId;
  const accessToken = account?.accessToken;

  useEffect(() => {
    const config = authConfigFromEnv();
    if (config === undefined || userId === undefined) return;
    setClient(
      new SocialClient({ url: config.url, anonKey: config.anonKey, accessToken: () => accessToken }),
    );
  }, [userId, accessToken]);

  const refresh = useCallback(
    async (social: SocialClient, id: string) => {
      const mine = await social.myProfile(id);
      setProfile(mine);
      setLoaded(true);
      if (mine === undefined) return;
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
      setFeed(await social.feed());
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
    await client.follow(userId, found.userId);
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
                  <Link
                    href={pathIn(`/u/${friend.handle}`, locale)}
                    className="hover:text-(--color-volt)"
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
                    className="text-xs text-(--color-muted) underline decoration-dotted underline-offset-2 hover:text-(--color-text)"
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
                    <Link
                      href={pathIn(`/u/${fan.handle}`, locale)}
                      className="hover:text-(--color-volt)"
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
                        className="text-xs text-(--color-muted) underline decoration-dotted underline-offset-2 hover:text-(--color-text)"
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

      <section className="space-y-3">
        <h2 className="section-heading">{t('friends.feed.title')}</h2>
        {visible.length === 0 ? (
          // ⚠️ Mieux vaut se taire que compter zero : un fil vide dit quoi faire, il
          // n'affiche pas « 0 activite ».
          <div className="empty-state">
            <p className="empty-state-body">{t('friends.feed.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((item, index) => (
              <li
                key={`${item.handle}-${item.subject}-${item.kind}-${item.happenedOn}-${index}`}
                className="panel bg-(--color-surface)/50 px-4 py-3 text-sm"
              >
                <Link
                  href={pathIn(`/u/${item.handle}`, locale)}
                  className="text-(--color-muted) hover:text-(--color-volt)"
                >
                  @{item.handle}
                </Link>{' '}
                {t(`friends.item.${item.kind}`)}{' '}
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
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

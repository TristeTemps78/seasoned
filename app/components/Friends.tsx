'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { authConfigFromEnv } from '@/src/auth/client';
import { projectActivity, redactActivity } from '@/src/domain/activity';
import { checkHandle } from '@/src/domain/handles';
import type { JournalKey } from '@/src/domain/journal';
import { SocialClient, type FeedItem, type Profile } from '@/src/social/client';

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
      setFriends(await social.following(id));
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
      <section className="space-y-4">
        <h2 className="font-semibold">{t('friends.claim.title')}</h2>
        <p className="max-w-prose leading-relaxed text-(--color-muted)">
          {t('friends.claim.body')}
        </p>
        <form onSubmit={onClaim} className="flex flex-wrap items-center gap-2">
          <span className="text-(--color-muted)">@</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder={t('friends.claim.placeholder')}
            className="w-48 rounded-md border border-(--color-edge) bg-(--color-surface) px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-(--color-edge) px-3 py-1.5 text-sm hover:border-(--color-muted)"
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
      <section className="space-y-3">
        <p className="text-(--color-muted)">{t('friends.you', { handle: profile.handle })}</p>
        <form onSubmit={onFollow} className="flex flex-wrap items-center gap-2">
          <span className="text-(--color-muted)">@</span>
          <input
            value={lookup}
            onChange={(event) => setLookup(event.target.value)}
            placeholder={t('friends.follow.placeholder')}
            className="w-48 rounded-md border border-(--color-edge) bg-(--color-surface) px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-(--color-edge) px-3 py-1.5 text-sm hover:border-(--color-muted)"
          >
            {t('friends.follow.submit')}
          </button>
        </form>
        <p aria-live="polite" className="text-sm text-(--color-warn)">
          {notFound ? t('friends.follow.notFound') : ''}
        </p>
        {friends.length > 0 ? (
          <p className="text-sm text-(--color-muted)">
            {t('friends.following', { list: friends.map((f) => `@${f.handle}`).join(' · ') })}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t('friends.feed.title')}</h2>
        {visible.length === 0 ? (
          // ⚠️ Mieux vaut se taire que compter zero : un fil vide dit quoi faire, il
          // n'affiche pas « 0 activite ».
          <p className="max-w-prose leading-relaxed text-(--color-muted)">
            {t('friends.feed.empty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((item, index) => (
              <li
                key={`${item.handle}-${item.subject}-${item.kind}-${item.happenedOn}-${index}`}
                className="rounded-md border border-(--color-edge) px-3 py-2 text-sm"
              >
                <span className="text-(--color-muted)">@{item.handle}</span>{' '}
                {t(`friends.item.${item.kind}`)}{' '}
                {item.season !== undefined && item.stars !== undefined
                  ? t('friends.item.season', {
                      season: String(item.season),
                      stars: item.stars.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB'),
                    })
                  : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

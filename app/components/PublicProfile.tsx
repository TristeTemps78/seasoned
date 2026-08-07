'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { authConfigFromEnv } from '@/src/auth/client';
import { redactReviewsAcross } from '@/src/domain/spoiler';
import { parseJournalKey } from '@/src/domain/journal';
import { pathIn } from '@/lib/routes';
import { SocialClient, type Profile, type PublishedReview } from '@/src/social/client';

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
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set());

  const accessToken = account?.accessToken;
  const userId = account?.userId;

  const load = useCallback(async () => {
    const config = authConfigFromEnv();
    if (config === undefined) return;
    // ⚠️ Le client est construit **meme sans compte** : un profil `public` se lit par un
    // visiteur anonyme, et c'est RLS qui tranche. Exiger une session ici fermerait la page
    // a exactement les gens qu'un lien de partage amene.
    const social = new SocialClient({
      url: config.url,
      anonKey: config.anonKey,
      accessToken: () => accessToken,
    });
    const found = await social.findByHandle(handle.toLowerCase());
    setProfile(found);
    setLoaded(true);
    if (found === undefined) return;
    setReviews(await social.reviewsBy(found.userId));
    if (userId !== undefined) {
      setFollowing((await social.following(userId)).some((p) => p.userId === found.userId));
    }
  }, [handle, accessToken, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = useCallback(async () => {
    const config = authConfigFromEnv();
    if (config === undefined || userId === undefined || profile === undefined) return;
    const social = new SocialClient({
      url: config.url,
      anonKey: config.anonKey,
      accessToken: () => accessToken,
    });
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
        <h1 className="page-title">@{profile.handle}</h1>
        {isSelf ? (
          <span className="text-sm text-(--color-muted)">{t('profile.self')}</span>
        ) : account !== undefined ? (
          <button type="button" className="btn" aria-pressed={following} onClick={toggleFollow}>
            {following ? t('profile.unfollow') : t('profile.follow')}
          </button>
        ) : null}
      </div>

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
              const open = revealed.has(id);
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

                  {shown.hidden === true && !open ? (
                    <div className="space-y-2">
                      <p className="text-sm text-(--color-muted)">
                        {shown.throughSeason > 0
                          ? t('review.hidden', { n: shown.throughSeason })
                          : t('review.hiddenSeries')}
                      </p>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => setRevealed(new Set([...revealed, id]))}
                      >
                        {t('review.reveal')}
                      </button>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">
                      {shown.hidden === true ? shown.hiddenText : shown.text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

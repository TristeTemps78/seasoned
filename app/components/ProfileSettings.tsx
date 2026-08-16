'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { socialFrom } from '@/app/social/socialFrom';
import type { Visibility } from '@/src/social/client';

/**
 * Qui je suis ici, et qui voit ce que je publie.
 *
 * ## 🔴 Le defaut, mesure le 2026-08-16
 *
 * Les deux reglages les plus engageants du produit — **son nom public** et **qui peut lire
 * ce qu'on ecrit** — vivaient sur `/amis`, la page ou l'on va pour regarder les autres.
 * « Mon compte » n'en disait rien : il affichait une adresse e-mail, un bouton pour se
 * deconnecter et un pour tout supprimer. On pouvait donc publier sous un nom sans jamais
 * trouver ou le lire, et laisser sa visibilite sur la valeur posee a l'inscription sans
 * savoir qu'elle existait.
 *
 * ## ⚠️ Un seul controle, ici — pas deux
 *
 * La bascule de visibilite a ete **retiree** de `Friends.tsx`, pas copiee. Deux controles
 * sur le meme etat, c'est deux copies d'un profil charge separement : celle qu'on ne
 * regarde pas affiche l'ancienne valeur jusqu'au rechargement, et personne ne sait laquelle
 * ment. `/amis` garde une ligne qui **nomme** le reglage et mene ici.
 *
 * ⚠️ Le formulaire de reclamation reste sur `/amis`, et ce n'est pas un oubli : sans nom on
 * ne peut ni suivre ni etre suivi, donc il y est **bloquant** et se presente comme la porte
 * d'entree. Ici, quand il n'y a pas encore de nom, on dit la condition et on donne le
 * chemin — jamais un second formulaire a tenir d'accord avec le premier.
 */
export function ProfileSettings() {
  const { t, locale } = useT();
  const { account, ready } = useAuth();

  const [profile, setProfile] = useState<{
    readonly handle?: string;
    readonly visibility: Visibility;
  }>();
  const [loaded, setLoaded] = useState(false);

  const userId = account?.userId;
  const accessToken = account?.accessToken;

  useEffect(() => {
    if (userId === undefined) return;
    const social = socialFrom(accessToken);
    if (social === undefined) return;

    let alive = true;
    void social.myProfile(userId).then((found) => {
      if (!alive) return;
      setProfile(
        found === undefined
          ? undefined
          : { handle: found.handle, visibility: found.visibility },
      );
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [userId, accessToken]);

  const choose = useCallback(
    (value: Visibility) => {
      if (userId === undefined || profile === undefined) return;
      const social = socialFrom(accessToken);
      if (social === undefined) return;
      // ⚠️ L'etat local ne bouge **qu'apres** un succes. L'inverse — l'optimisme — est
      // exactement ce qui a fait qu'un suivi refuse en 42501 ressemblait a un suivi reussi
      // pendant trois lots. Un echec, lui, remonte maintenant a la banniere commune.
      void social.setVisibility(userId, value).then((ok) => {
        if (ok) setProfile({ ...profile, visibility: value });
      });
    },
    [userId, accessToken, profile],
  );

  // Tant qu'on ne sait pas, on ne dit rien : afficher « vous n'avez pas de nom » a quelqu'un
  // qui en a un, une demi-seconde, serait pire que d'attendre.
  if (!ready || account === undefined || !loaded) return null;

  return (
    <section className="card max-w-md space-y-4">
      <h2 className="card-title">{t('account.profile.title')}</h2>

      {profile?.handle === undefined ? (
        // Rule 4 : la condition est dite, le chemin est cliquable. Pas de second formulaire.
        <p className="prose-note">
          {t('account.profile.noHandle')}{' '}
          <Link className="tap-line underline hover:text-(--color-volt)" href={pathIn('/amis', locale)}>
            {t('account.profile.claimThere')}
          </Link>
        </p>
      ) : (
        <>
          <p className="text-sm">
            {t('account.profile.youAre')}{' '}
            <Link
              className="tap-line font-medium underline hover:text-(--color-volt)"
              href={pathIn(`/u/${profile.handle}`, locale)}
            >
              @{profile.handle}
            </Link>
          </p>

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
                  onClick={() => choose(value)}
                  className="btn rounded-full"
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

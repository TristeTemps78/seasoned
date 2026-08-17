'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { BIO_MAX, DISPLAY_NAME_MAX, checkBio, checkDisplayName } from '@/src/domain/handles';
import { useSocial } from '@/app/social/useSocial';
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
  /**
   * Le nom lisible et la phrase — 030.
   *
   * ⚠️ Deux brouillons locaux, enregistres par un bouton : un envoi a chaque frappe ferait
   * une ecriture par caractere. C'est la difference avec la visibilite juste dessous, qui est
   * un choix parmi trois et part au clic.
   */
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [saved, setSaved] = useState<'ok' | 'too_long' | 'failed' | undefined>(undefined);
  /**
   * Les gens qu'on a bloques — 031.
   *
   * ⚠️ Ils viennent d'une fonction `security definer` et non de la table : bloquer rend le
   * profil illisible (c'est le point), donc une lecture ordinaire ne rendrait que des
   * identifiants. Debloquer demanderait alors de reconnaitre quelqu'un a son UUID.
   */
  const [blocks, setBlocks] = useState<readonly { readonly userId: string; readonly handle: string }[]>([]);

  const userId = account?.userId;
  const social = useSocial();

  useEffect(() => {
    if (userId === undefined) return;
    if (social === undefined) return;

    let alive = true;
    void social.myBlocks().then((rows) => {
      if (alive) setBlocks(rows);
    });
    void social.myProfile(userId).then((found) => {
      if (!alive) return;
      setProfile(
        found === undefined
          ? undefined
          : { handle: found.handle, visibility: found.visibility },
      );
      // ⚠️ Les champs sont remplis avec ce qui est **deja publie**, jamais laisses vides :
      // un formulaire vide devant un nom existant fait croire qu'il n'y en a pas, et
      // l'enregistrer l'effacerait sans que personne ne l'ait demande.
      setName(found?.displayName ?? '');
      setBio(found?.bio ?? '');
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [userId, social]);

  const choose = useCallback(
    (value: Visibility) => {
      if (userId === undefined || profile === undefined) return;
      if (social === undefined) return;
      // ⚠️ L'etat local ne bouge **qu'apres** un succes. L'inverse — l'optimisme — est
      // exactement ce qui a fait qu'un suivi refuse en 42501 ressemblait a un suivi reussi
      // pendant trois lots. Un echec, lui, remonte maintenant a la banniere commune.
      void social.setVisibility(userId, value).then((ok) => {
        if (ok) setProfile({ ...profile, visibility: value });
      });
    },
    [userId, social, profile],
  );

  /**
   * Enregistre le nom et la phrase.
   *
   * ⚠️ La verification vient du **domaine** : la base porte la meme borne (`030`), et deux
   * copies d'une regle finissent par diverger — c'est deja arrive entre le domaine et le SQL
   * pour les handles. Ici, elle sert a le dire avant plutot qu'a subir un 23514 muet.
   */
  const saveWords = useCallback(async () => {
    if (userId === undefined || social === undefined) return;
    const checkedName = checkDisplayName(name);
    const checkedBio = checkBio(bio);
    if (!checkedName.ok || !checkedBio.ok) {
      setSaved('too_long');
      return;
    }
    const ok = await social.setProfileWords(userId, {
      ...(checkedName.value !== undefined ? { displayName: checkedName.value } : {}),
      ...(checkedBio.value !== undefined ? { bio: checkedBio.value } : {}),
    });
    setSaved(ok ? 'ok' : 'failed');
  }, [userId, social, name, bio]);

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

          {/* 🔴 **`display_name` existait dans le schema depuis `003` et n'avait aucun
              chemin d'ecriture.** Le produit affichait `@test` partout, alors que
              `handles.ts` promettait qu'*« un nom d'affichage libre porte le reste »* — les
              accents, les espaces, les majuscules qu'un handle interdit. C'est ici que le
              chemin manquait, et la phrase (`bio`) l'accompagne parce que les deux repondent
              a la meme question : qui etes-vous, au-dela d'un pseudo.

              ⚠️ Les deux champs sont facultatifs et le restent : un profil sans nom lisible
              s'affiche sous son handle, comme avant. */}
          <div className="space-y-2 text-sm">
            <label className="block text-(--color-muted)" htmlFor="profile-name">
              {t('account.profile.name')}
            </label>
            <input
              id="profile-name"
              className="field w-full"
              value={name}
              maxLength={DISPLAY_NAME_MAX}
              placeholder={t('account.profile.namePlaceholder')}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(undefined);
              }}
            />
            <label className="block text-(--color-muted)" htmlFor="profile-bio">
              {t('account.profile.bio')}
            </label>
            <input
              id="profile-bio"
              className="field w-full"
              value={bio}
              maxLength={BIO_MAX}
              placeholder={t('account.profile.bioPlaceholder')}
              onChange={(e) => {
                setBio(e.target.value);
                setSaved(undefined);
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn" onClick={() => void saveWords()}>
                {t('account.profile.save')}
              </button>
              {/* Une ecriture qui rate n'a aucun ecran par elle-meme : le geste a l'air
                  d'avoir marche. On dit les trois issues. */}
              {saved !== undefined ? (
                <span
                  aria-live="polite"
                  className={saved === 'ok' ? 'meta' : 'text-sm text-(--color-warn)'}
                >
                  {t(`account.profile.${saved}`)}
                </span>
              ) : null}
            </div>
          </div>

          {/* 🔴 **Un blocage qu'on ne peut pas defaire serait une porte sans retour**, et
              personne ne pose une porte sans retour. C'est le seul endroit du produit ou la
              liste existe : le profil bloque, lui, n'est plus lisible — c'est exactement ce
              qu'on a demande.

              ⚠️ Toujours affichee, meme vide, contrairement au reste de cette page : une
              personne qui vient chercher « ai-je bloque quelqu'un ? » doit obtenir une
              reponse, et l'absence de section n'en est pas une (regle 4). */}
          <div className="space-y-2 text-sm">
            <p className="text-(--color-muted)">{t('account.blocks.title')}</p>
            {blocks.length === 0 ? (
              <p className="meta-sm">{t('account.blocks.none')}</p>
            ) : (
              <ul className="space-y-1">
                {blocks.map((one) => (
                  <li key={one.userId} className="flex flex-wrap items-center gap-3">
                    <span className="font-medium">@{one.handle}</span>
                    <button
                      type="button"
                      className="quiet-action"
                      onClick={async () => {
                        if (userId === undefined || social === undefined) return;
                        const ok = await social.unblock(userId, one.userId);
                        if (ok) setBlocks((current) => current.filter((x) => x.userId !== one.userId));
                      }}
                    >
                      {t('account.blocks.undo')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import type { CallbackOutcome } from '@/src/auth/client';

/**
 * Le retour du lien de connexion.
 *
 * ## Pourquoi cette page reste statique, alors que « tout le monde » fait une route
 *
 * Le reflexe est un `route.ts` qui recoit le `code`, appelle Supabase et pose un cookie.
 * C'est le conseil par defaut, et il coute **une invocation serveur par connexion** plus,
 * avec `@supabase/ssr`, un `middleware` sur **chaque requete du site**. Le depot a mesure
 * ce que ca fait au cache de bord (`app/(site)/serie/[id]/page.tsx` : `MISS` +
 * `no-store` contre `PRERENDER`).
 *
 * Ici le navigateur a tout ce qu'il faut : le `code` est dans son URL, le verificateur
 * PKCE dans son `localStorage`. **Le serveur n'a rien a apporter, donc on ne le derange
 * pas.** La page reste `force-static`, servie par le CDN comme les autres.
 *
 * ## L'URL est nettoyee, et ce n'est pas cosmetique
 *
 * Un `code` qui reste dans la barre d'adresse part dans l'historique, dans le presse-papier
 * de qui partage le lien, et dans le `Referer` de la navigation suivante. `replaceState`
 * l'efface **sans** ajouter d'entree d'historique — donc le bouton « precedent » ne ramene
 * pas sur une URL qui contient un jeton.
 *
 * =============================================================================
 * 🔴 SE CONNECTER NE MARCHAIT PAS — l'effet tournait deux fois, et la seconde
 *    lisait une URL que la premiere venait de vider
 * =============================================================================
 *
 * Reproduit au navigateur le 2026-08-12, en ouvrant `/fr/compte/retour?code=<au hasard>`
 * deux fois de suite. **Meme entree, deux resultats differents** :
 *
 *     essai 1   1 appel a /auth/v1/token?grant_type=pkce   message « rien a valider »
 *     essai 2   0 appel                                    message « rien a valider »
 *
 * Zero appel : le code recu par courriel n'etait tout simplement **jamais echange**. Et
 * « rien a valider » est le message reserve a *« la page a ete ouverte a la main »* — donc
 * quelqu'un qui clique son lien de connexion voit le produit lui dire qu'il n'a rien
 * demande. C'est exactement le symptome rapporte : *« j'ai recu un lien et ensuite ca
 * marche plus »*.
 *
 * ## La cause
 *
 * L'ancien effet dependait de `completeCallback`, dont l'identite change des que
 * `AuthProvider` recalcule son `value` — ce qui arrive **pendant** le retour, parce que la
 * lecture des fournisseurs externes (`/auth/v1/settings`) repond a ce moment-la et pose un
 * `setProviders`. L'effet est donc rejoue, et il relit `window.location.href` :
 *
 *   - si la premiere passe avait deja nettoye l'URL → la seconde n'y trouve plus de `code`
 *     et ecrase l'issue par `nothing_to_do` ;
 *   - si elle ne l'avait pas encore nettoyee → la seconde rejoue l'echange avec un code
 *     **deja brule**, et l'issue devient un echec.
 *
 * Les deux ordres sont mauvais, et lequel se produit depend d'une course reseau.
 *
 * ## La correction
 *
 * L'URL est lue **une fois**, au montage, avant que quoi que ce soit puisse la modifier ; et
 * l'echange n'a lieu **qu'une fois**, garde par une reference. La fonction, elle, est lue
 * dans une reference : son identite n'a plus a etre stable, ce que l'ancien commentaire
 * supposait a tort (*« stable tant que la configuration ne change pas »* — elle depend aussi
 * du compte, de `ready` et des fournisseurs).
 */
export function AuthCallback() {
  const { t, locale } = useT();
  const { completeCallback, configured } = useAuth();
  const [outcome, setOutcome] = useState<CallbackOutcome | undefined>(undefined);

  /**
   * L'URL d'arrivee, figee au premier rendu.
   *
   * ⚠️ Un `useState` a initialisateur et non une lecture dans l'effet : entre le montage et
   * l'effet, `replaceState` a pu passer. C'est la seule valeur de cette page qui ne se
   * relit jamais.
   */
  const [href] = useState(() => (typeof window === 'undefined' ? '' : window.location.href));

  /** L'echange a-t-il deja eu lieu ? Une reference survit au double montage de React. */
  const started = useRef(false);
  /** La fonction courante, sans la mettre en dependance de l'effet. */
  const complete = useRef(completeCallback);
  complete.current = completeCallback;

  useEffect(() => {
    if (!configured || started.current) return;
    started.current = true;

    void (async () => {
      const result = await complete.current(href);
      // Nettoye dans tous les cas, y compris en echec : un code brule reste un secret.
      window.history.replaceState(null, '', window.location.pathname);
      setOutcome(result);
    })();
  }, [configured, href]);

  const message =
    outcome === undefined
      ? t('account.callback.working')
      : outcome.kind === 'signed_in'
        ? t('account.callback.done')
        : outcome.kind === 'wrong_browser'
          ? // ⚠️ Le seul echec **normal** de PKCE, et le nommer est tout l'interet de cet
            // ecran : rendu comme « lien invalide », il pousse a redemander un lien qui
            // echouera exactement pareil.
            t('account.callback.wrongBrowser')
          : outcome.kind === 'expired'
            ? t('account.callback.expired')
            : t('account.callback.nothing');

  return (
    <div className="space-y-4">
      <p aria-live="polite" className="leading-relaxed">
        {message}
      </p>
      <Link
        href={pathIn('/compte', locale)}
        className="inline-block rounded-md border border-(--color-edge) px-3 py-1.5 text-sm hover:border-(--color-muted)"
      >
        {t('account.callback.back')}
      </Link>
    </div>
  );
}

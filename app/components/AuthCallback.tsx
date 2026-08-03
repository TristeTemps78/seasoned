'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
 */
export function AuthCallback() {
  const { t, locale } = useT();
  const { completeCallback, configured } = useAuth();
  const [outcome, setOutcome] = useState<CallbackOutcome | undefined>(undefined);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;

    void (async () => {
      const result = await completeCallback(window.location.href);
      if (cancelled) return;
      // Nettoye dans tous les cas, y compris en echec : un code brule reste un secret.
      window.history.replaceState(null, '', window.location.pathname);
      setOutcome(result);
    })();

    return () => {
      cancelled = true;
    };
    // `completeCallback` est stable tant que la configuration ne change pas.
  }, [completeCallback, configured]);

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

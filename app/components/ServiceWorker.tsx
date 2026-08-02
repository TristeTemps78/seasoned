'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker.
 *
 * Un composant plutot qu'un script en dur : l'enregistrement doit attendre le
 * chargement complet, sinon il entre en concurrence avec le rendu de la page pour la
 * bande passante — et ce qu'il apporte ne sert qu'a la **visite suivante**.
 *
 * Ne rend rien, ne bloque rien, et echoue en silence : un navigateur sans service
 * worker (Safari en navigation privee, contexte non securise) doit continuer a servir
 * le site normalement. C'est un supplement, jamais une dependance.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // ⚠️ Jamais en developpement, et ce n'est pas une preference.
    //
    // Le service worker sert `/_next/static/` depuis le cache sans jamais le
    // revalider, parce qu'en production ces fichiers portent leur empreinte dans leur
    // nom : ils ne changent pas a URL constante. **En developpement, si.** Constate
    // au navigateur pendant l'ecriture de ce bloc : la page affichait obstinement du
    // code d'il y a deux minutes, rechargement compris, et le rendu a chaud ne
    // remontait plus. On debogue alors un site qui n'existe plus.
    if (process.env.NODE_ENV !== 'production') {
      // Nettoyer derriere soi : quiconque a lance le site une fois avant cette
      // correction porte encore un service worker actif dans son navigateur.
      void navigator.serviceWorker
        .getRegistrations()
        .then((all) => Promise.all(all.map((r) => r.unregister())))
        .catch(() => undefined);
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Enregistrement refuse : le site marche, simplement sans hors-ligne.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}

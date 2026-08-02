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

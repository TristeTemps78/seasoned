'use client';

import { useEffect, useRef } from 'react';

import { useAuth } from '@/app/auth/AuthProvider';
import { useJournal } from '@/app/journal/useJournal';
import { authConfigFromEnv } from '@/src/auth/client';
import { projectActivity } from '@/src/domain/activity';
import { SocialClient } from '@/src/social/client';

/**
 * Pousse l'activite publiable, **depuis n'importe quelle page**.
 *
 * ## 🔴 Le defaut que ce composant repare
 *
 * La projection ne partait que depuis `/amis` : c'est la, et nulle part ailleurs, que
 * `publish` etait appele. Terminer une serie depuis sa fiche, puis ne pas retourner chez
 * ses amis, laissait donc le fait **dans le navigateur pour toujours** — le fil des autres
 * ne l'apprenait jamais.
 *
 * Constate le 2026-08-10 sur la vraie base : deux comptes, trois critiques ecrites… et
 * **zero activite**. Rien ne pouvait le signaler, parce qu'un fil vide et un fil qui n'a
 * jamais rien recu donnent exactement le meme ecran. C'est le defaut de 10.0, sur un autre
 * chemin.
 *
 * ## Pourquoi ici, et pas dans la couche de synchronisation
 *
 * Le journal ne connait pas le social, et il ne doit pas : `src/journal/` sait sauvegarder
 * un document, pas ce qu'un produit social en tire. Brancher la projection la-bas
 * melangerait deux couches que le depot tient separees depuis le lot 6.
 *
 * On le fait donc dans le chrome du site — monte sur toutes les pages, invisible, sans
 * rendu.
 *
 * ⚠️ **Debattu, et une seule fois par contenu.** Le journal change a chaque frappe ; sans
 * garde, chaque demi-etoile posee declencherait un envoi. On attend que ca se calme, et on
 * n'envoie que si la projection a **reellement** change depuis le dernier envoi.
 */
export function PublishActivity() {
  const { configured, account } = useAuth();
  const { journal, ready } = useJournal();
  const lastSent = useRef<string | undefined>(undefined);

  const accessToken = account?.accessToken;
  const userId = account?.userId;

  useEffect(() => {
    if (!configured || !ready || userId === undefined) return;
    const config = authConfigFromEnv();
    if (config === undefined) return;

    const items = projectActivity(journal, new Date());
    if (items.length === 0) return;

    // La signature de ce qu'on s'apprete a envoyer. Identique au dernier envoi = rien a
    // faire : `publish` est idempotent, mais un appel reseau inutile reste un appel.
    const shape = JSON.stringify(items);
    if (shape === lastSent.current) return;

    const timer = setTimeout(() => {
      const social = new SocialClient({
        url: config.url,
        anonKey: config.anonKey,
        accessToken: () => accessToken,
      });
      void social.publish(userId, items).then((ok) => {
        // On ne memorise que ce qui est **parti** : sinon un echec reseau serait pris pour
        // un envoi reussi, et le fait ne repartirait jamais.
        if (ok) lastSent.current = shape;
      });
    }, 4_000);

    return () => clearTimeout(timer);
  }, [configured, ready, journal, userId, accessToken]);

  return null;
}

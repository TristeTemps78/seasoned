'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { connectJournal, disconnectJournal, flushJournal } from '@/app/journal/journalStore';
import { authConfigFromEnv } from '@/src/auth/client';
import { adopt, adoptionFor, decline } from '@/src/journal/account';

/**
 * Ce qui relie un compte a son journal — et la seule question qu'on pose en le faisant.
 *
 * Rend `null` la plupart du temps : sans compte, ou quand il n'y a rien a arbitrer, ce
 * composant n'affiche rien. Il vit dans le chassis parce que la connexion peut arriver de
 * n'importe ou et que la synchronisation ne doit pas dependre de l'ecran affiche.
 *
 * ## La question, et pourquoi elle est posee
 *
 * Un journal existe sur cet appareil ; quelqu'un s'y connecte. **Fusionner en silence
 * verserait le journal du proprietaire dans le compte du visiteur** — sur un ordinateur
 * familial, un poste de bibliotheque, un telephone prete cinq minutes. Le defaut est donc
 * **non** : garder un journal hors d'un compte se repare (il est toujours la), l'y avoir
 * verse par erreur ne se repare pas.
 */
export function JournalSync() {
  const { t, tn } = useT();
  const { account } = useAuth();
  const [ask, setAsk] = useState<number | undefined>(undefined);

  const userId = account?.userId;
  const accessToken = account?.accessToken;

  useEffect(() => {
    const config = authConfigFromEnv();
    if (config === undefined) return;

    if (userId === undefined || accessToken === undefined) {
      disconnectJournal();
      setAsk(undefined);
      return;
    }

    let alive = true;
    void adoptionFor(window.localStorage, userId).then(async (decision) => {
      if (!alive) return;
      // ⚠️ On attend la reponse : brancher maintenant pousserait vers le serveur le
      // journal qu'on est en train de demander s'il faut adopter.
      if (decision.kind === 'ask') {
        setAsk(decision.entries);
        return;
      }
      if (decision.kind === 'adopt') await adopt(window.localStorage, userId);
      if (alive) connectJournal(config, userId, accessToken);
    });

    return () => {
      alive = false;
    };
  }, [userId, accessToken]);

  // La poussee est debattue de deux secondes : sans ceci, le dernier geste d'une session
  // part avec l'onglet qu'on ferme.
  useEffect(() => {
    const onHide = () => flushJournal();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  if (ask === undefined) return null;

  const answer = (yes: boolean) => {
    if (userId === undefined || accessToken === undefined) return;
    const config = authConfigFromEnv();
    if (config === undefined) return;

    const done = yes ? adopt(window.localStorage, userId) : Promise.resolve(decline(window.localStorage, userId));
    void done.then(() => {
      setAsk(undefined);
      connectJournal(config, userId, accessToken);
    });
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-3">
      <div className="card space-y-3 border-(--color-warn)/40">
        <h2 className="font-semibold">{t('sync.adopt.title')}</h2>
        <p className="max-w-prose leading-relaxed text-(--color-muted)">
          {tn('sync.adopt.body', ask)}
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Le « non » vient en premier et porte le style neutre : c'est le defaut. */}
          <button
            type="button"
            onClick={() => answer(false)}
            className="btn"
          >
            {t('sync.adopt.no')}
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className="btn"
          >
            {t('sync.adopt.yes')}
          </button>
        </div>
      </div>
    </section>
  );
}

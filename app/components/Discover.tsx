'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { authConfigFromEnv } from '@/src/auth/client';
import { pathIn } from '@/lib/routes';
import { SocialClient, type Profile } from '@/src/social/client';

/**
 * « Des gens a decouvrir » — la reponse au demarrage a froid du social.
 *
 * ## Le probleme, et il est structurel
 *
 * On ne pouvait suivre quelqu'un **qu'en connaissant son nom exact**. Pour une famille qui
 * se passe les noms de vive voix, ca suffit ; pour tout le reste, le social ne demarre
 * jamais. C'est le vrai trou, et il n'est pas technique.
 *
 * ## ⚠️ Ce que ce composant n'est PAS, et c'est la decision
 *
 * **Pas un annuaire.** `Friends.tsx` s'interdit la recherche approchante sur les profils
 * parce que parcourir des gens qui ne l'ont pas demande est le premier outil de qui veut en
 * harceler un — et cette regle ne bouge pas. Ce qui est montre ici est l'**exception
 * exacte** : les profils `public`, c'est-a-dire ceux dont le proprietaire a explicitement
 * demande a etre trouve. La visibilite par defaut etant `followers` (Q1), personne n'y
 * arrive par inadvertance.
 *
 * ## La deuxieme porte de decouverte n'est pas ici
 *
 * Elle est sur la **fiche serie** : le nom de l'auteur d'une critique est desormais un lien
 * vers son profil. C'est meme la porte principale — on croise quelqu'un parce que son avis
 * sur une serie nous interesse, pas parce qu'on cherchait des gens. Ce composant ne fait que
 * couvrir le cas ou l'on n'a encore croise personne.
 *
 * **Se tait quand il n'y a personne** : « 0 profil » est pire que rien
 * (*mieux vaut se taire que compter zero*).
 */
export function Discover() {
  const { t, locale } = useT();
  const { configured, account } = useAuth();

  const [people, setPeople] = useState<readonly Profile[]>([]);

  const accessToken = account?.accessToken;
  const myId = account?.userId;

  useEffect(() => {
    let alive = true;
    const config = authConfigFromEnv();
    if (config === undefined) return;
    // Construit meme sans compte : un profil `public` se lit par un visiteur anonyme, et
    // c'est RLS qui tranche.
    const social = new SocialClient({
      url: config.url,
      anonKey: config.anonKey,
      accessToken: () => accessToken,
    });
    void social.discoverable().then((rows) => {
      if (alive) setPeople(rows);
    });
    return () => {
      alive = false;
    };
  }, [accessToken]);

  // Se soi-meme n'est pas une decouverte.
  const others = people.filter((p) => p.userId !== myId);
  if (!configured || others.length === 0) return null;

  return (
    <section className="panel space-y-3 px-4 py-4" aria-label={t('discover.aria')}>
      <h2 className="card-title">{t('discover.title')}</h2>
      <p className="text-sm text-(--color-muted)">{t('discover.why')}</p>
      <ul className="flex flex-wrap gap-2">
        {others.map((person) => (
          <li key={person.userId}>
            <Link className="btn" href={pathIn(`/u/${person.handle}`, locale)}>
              @{person.handle}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

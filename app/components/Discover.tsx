'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { Avatar } from '@/app/components/Avatar';
import { type Discoverable } from '@/src/social/client';
import { socialFrom } from '@/app/social/socialFrom';

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
  const { t, tn, locale } = useT();
  const { configured, account } = useAuth();

  const [people, setPeople] = useState<readonly Discoverable[]>([]);

  const accessToken = account?.accessToken;
  const myId = account?.userId;

  useEffect(() => {
    let alive = true;
    // Construit meme sans compte : un profil `public` se lit par un visiteur anonyme, et
    // c'est RLS qui tranche.
    const social = socialFrom(accessToken);
    if (social === undefined) return;
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
    <section className="band" aria-label={t('discover.aria')}>
      <h2 className="row-title">{t('discover.title')}</h2>
      <p className="meta">{t('discover.why')}</p>
      <ul className="flex flex-wrap gap-2">
        {others.map((person) => (
          <li key={person.userId} className="flex items-center gap-1">
            {/* ⚠️ Le rembourrage gauche se resserre a `0.25rem` : l'avatar fait 2 rem, donc le
                rembourrage standard de `.btn` lui laissait un blanc deux fois plus large a
                gauche qu'a droite. Une pastille de personne se lit comme un jeton, pas comme
                un bouton avec une image dedans. */}
            <Link
              className="btn py-1 pl-1"
              href={pathIn(`/u/${person.handle}`, locale)}
            >
              <Avatar handle={person.handle} face={person.face} />
              @{person.handle}
            </Link>
            {/* La raison de cliquer, dite a cote du nom. ⚠️ **Rien pour ceux qui n'ont rien
                publie** : « 0 à lire » annoncerait le vide au lieu de se taire, et ce sont
                justement eux que le tri a deja renvoyes en fin de liste. */}
            {person.wrote > 0 ? (
              <span className="meta-sm">{tn('discover.wrote', person.wrote)}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

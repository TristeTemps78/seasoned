'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { type DiscoverableList } from '@/src/social/client';
import { socialFrom } from '@/app/social/socialFrom';
import { FaceDot } from '@/app/components/FaceDot';

/**
 * Les listes, dans les resultats de recherche — **le dernier index qui manquait**.
 *
 * ## Ce qui restait fermé
 *
 * La recherche rendait des series, puis des personnes depuis le 2026-08-15. Chez la
 * reference elle separe films, critiques, listes, membres, mots et journal. Les listes sont
 * pourtant la seule partie du produit qui **exige un compte pour exister et vit sur le
 * serveur** : ecrites, lisibles, deja montrees en vitrine sur `/listes` — et introuvables
 * autrement qu'en tombant dessus. « Series a montrer a ma mere » ne se cherchait nulle part.
 *
 * ## ⚠️ Une ligne, pas une carte
 *
 * `DiscoverLists` rend une carte par liste, avec quatre affiches en apercu. Ici non, et ce
 * n'est pas une economie : la page porte deja vingt affiches de series au-dessus, et repeter
 * la meme matiere ferait lire les listes comme des series. Un titre, son auteur, son compte —
 * c'est ce qui distingue une liste d'un titre, donc c'est ce qu'on montre.
 *
 * ## ⚠️ Le lien mene au profil, pas a la liste
 *
 * Il n'existe pas de page par liste : `/u/<nom>` les porte toutes, sous son onglet. Inventer
 * une route par liste ajouterait une surface pour montrer ce qu'une page existante montre
 * deja — c'est le raisonnement de `DiscoverLists`, et il n'a pas change.
 */
export function ListResults({ query }: { readonly query: string }) {
  const { account } = useAuth();
  const { t, tn, locale } = useT();
  const [lists, setLists] = useState<readonly DiscoverableList[]>([]);

  const accessToken = account?.accessToken;

  useEffect(() => {
    const social = socialFrom(accessToken);
    if (social === undefined) return;

    let alive = true;
    void social.searchLists(query).then((rows) => {
      if (alive) setLists(rows);
    });
    return () => {
      alive = false;
    };
  }, [accessToken, query]);

  // Silencieux quand il n'y a rien : la page porte deja son propre « aucun resultat », et
  // « aucune liste ne s'appelle comme ca » sous chaque recherche de titre serait du bruit sur
  // toutes les recherches. Meme raisonnement que `PeopleResults`.
  if (lists.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={t('search.lists')}>
      <h2 className="section-heading">{t('search.lists')}</h2>
      <ul className="space-y-2">
        {lists.map((list) => (
          <li key={`${list.authorId}:${list.slug}`}>
            <Link
              href={pathIn(`/u/${list.handle}`, locale)}
              className="card flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2"
            >
              <span className="text-sm font-medium hover:text-(--color-volt)">{list.title}</span>
              <span className="flex items-center gap-1.5 meta-sm">
                <FaceDot face={list.face} />@{list.handle}
              </span>
              <span className="meta-sm">{tn('lists.count', list.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

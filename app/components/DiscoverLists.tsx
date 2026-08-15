'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/auth/AuthProvider';
import { useT } from '@/app/i18n/LocaleProvider';
import { useJournal } from '@/app/journal/useJournal';
import { parseJournalKey } from '@/src/domain/journal';
import { pathIn } from '@/lib/routes';
import { type DiscoverableList } from '@/src/social/client';
import { socialFrom } from '@/app/social/socialFrom';
import { EmptyState } from '@/app/components/EmptyState';
import { FaceDot } from '@/app/components/FaceDot';
import { PosterChip } from '@/app/components/PosterChip';

/**
 * Les listes des autres — **la seule surface du produit dont le contenu existait deja et
 * n'etait montre nulle part**.
 *
 * ## Ce qui manquait
 *
 * `/listes` ne rendait que les siennes. Or c'est la seule partie qui **exige un compte pour
 * exister et vit sur le serveur** : les listes des profils publics etaient donc deja
 * ecrites, deja lisibles par un visiteur anonyme (`lists_select` porte `can_see`, et
 * `can_see` rend vrai des `visibility = 'public'`), deja signalables — et invisibles. Un
 * visiteur sans compte arrivait sur une page qui ne lui parlait que de ce qu'il n'avait pas.
 *
 * Chez Letterboxd, `/lists/` est une vraie porte d'entree : on y entre par le gout de
 * quelqu'un plutot que par un titre qu'on connait deja.
 *
 * ## ⚠️ Sans compte, et c'est le point
 *
 * Le composant ne demande **aucune session** : `socialFrom(undefined)` construit un client
 * anonyme et RLS decide. Exiger un compte ici fermerait la page a exactement les gens qu'un
 * lien de partage amene — le defaut que la regle 4 a fait retirer de `/amis` et `/listes`.
 *
 * ## Le lien va au profil, pas a la liste
 *
 * Il n'existe pas de page par liste : `/u/<nom>` les porte toutes, et c'est la qu'on lit
 * celle qui nous a attire **plus le reste de ce que la personne range**. Inventer une route
 * par liste ajouterait une surface pour montrer ce qu'une page existante montre deja.
 */
export function DiscoverLists() {
  const { account } = useAuth();
  const { t, tn, locale } = useT();
  const { journal } = useJournal();
  const [lists, setLists] = useState<readonly DiscoverableList[] | undefined>(undefined);

  const accessToken = account?.accessToken;

  useEffect(() => {
    const social = socialFrom(accessToken);
    if (social === undefined) return;

    let alive = true;
    void social.discoverLists().then((rows) => {
      if (alive) setLists(rows);
    });
    return () => {
      alive = false;
    };
  }, [accessToken]);

  // Rien tant qu'on ne sait pas : annoncer « personne n'a rien range » avant d'avoir lu
  // serait le meme mensonge que le bandeau qui parlait avant d'avoir lu le journal.
  // ⚠️ Couvre aussi l'installation sans base — `socialFrom` rend `undefined`, l'etat ne
  // bouge jamais, et la section reste absente, ce qui est juste.
  if (lists === undefined) return null;

  return (
    <section className="space-y-3" aria-label={t('lists.discover.title')}>
      <h2 className="section-heading">{t('lists.discover.title')}</h2>

      {lists.length === 0 ? (
        /* ⚠️ Sans actions : le geste est deja sur cette page — le formulaire de creation est
           quelques centaines de pixels au-dessus. Un bouton menerait hors de l'ecran ou
           l'action se trouve (`EmptyState`, `actions` facultatif). */
        <EmptyState>{t('lists.discover.none')}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {lists.map((list) => (
            <li key={`${list.authorId}:${list.slug}`} className="card space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="card-title">{list.title}</h3>
                <span className="meta-sm">{tn('lists.count', list.count)}</span>
              </div>

              {/* ⚠️ L'auteur est **sous** le titre et non a cote : on choisit une liste par ce
                  qu'elle range, puis on regarde qui la tient. Et c'est un lien — croiser le
                  gout de quelqu'un sans pouvoir ouvrir son profil etait exactement le defaut
                  corrige sur les critiques de la fiche serie. */}
              <span className="flex items-center gap-1.5">
                <FaceDot face={list.face} />
                <Link
                  href={pathIn(`/u/${list.handle}`, locale)}
                  className="text-sm font-medium hover:text-(--color-volt)"
                >
                  @{list.handle}
                </Link>
              </span>

              {list.note !== undefined ? <p className="meta">{list.note}</p> : null}

              {/* Les quatre vignettes arrivent dans la meme reponse que le compte
                  (`SeriesList.preview`) : zero requete de plus, quel que soit le nombre de
                  listes. L'affiche vient de l'instantane du **lecteur** — chez quelqu'un
                  qu'on ne suit pas on ne l'a presque jamais, et `PosterChip` rend alors son
                  monogramme. C'est le prix de la regle 1 : le catalogue est loue. */}
              {list.preview.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {list.preview.map((subject) => {
                    const parsed = parseJournalKey(subject);
                    const snapshot = journal.entries[subject]?.snapshot;
                    const seriesTitle = snapshot?.title ?? t('library.card.tracked');
                    const chip = <PosterChip path={snapshot?.posterPath} title={seriesTitle} wide />;
                    return (
                      <li key={subject}>
                        {parsed === undefined ? (
                          chip
                        ) : (
                          <Link
                            href={pathIn(`/serie/${parsed.providerId}`, locale)}
                            aria-label={seriesTitle}
                          >
                            {chip}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

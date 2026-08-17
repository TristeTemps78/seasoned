'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useT } from '@/app/i18n/LocaleProvider';
import { pathIn } from '@/lib/routes';
import { type Profile } from '@/src/social/client';
import { useSocial } from '@/app/social/useSocial';
import { Avatar } from '@/app/components/Avatar';
import { FaceDot } from '@/app/components/FaceDot';

/**
 * Les gens, dans les resultats de recherche.
 *
 * ## 🔴 Le defaut
 *
 * `/recherche` ne trouvait que des series, et `/amis` demandait de **taper un nom exact**
 * pour suivre quelqu'un — donc de le connaitre d'avance. Il n'existait aucun chemin depuis
 * « je ne connais personne ici » vers « je suis quelqu'un ». Un produit social sans annuaire
 * ne se peuple pas, et c'est la moitie de ce que le compte sert a faire.
 *
 * ## Pourquoi c'est un composant client sur une page serveur
 *
 * Ce que chacun voit depend de **qui demande** : `profiles_select_visible` porte `can_see`.
 * Un rendu serveur devrait donc etre refait par visiteur — c'est-a-dire le cout par
 * utilisateur qui a tue TV Time, et la raison exacte pour laquelle `/u/<nom>` est deja une
 * coquille remplie par le navigateur. La liste des series, elle, est la meme pour tout le
 * monde et reste rendue au serveur.
 *
 * ## ⚠️ Silencieux, et ce n'est pas la doctrine abattue
 *
 * Rien ne s'affiche tant qu'on ne sait pas, et rien ne s'affiche s'il n'y a personne. La
 * regle 4 exige qu'un ecran vide dise quoi faire — mais cet ecran n'est pas vide : la page
 * porte deja ses vingt series et son propre « aucun resultat ». Ajouter « personne ne
 * s'appelle comme ca » sous chaque recherche de titre serait du bruit sur toutes les
 * recherches, pour une question que presque personne ne posait.
 */
export function PeopleResults({ query }: { readonly query: string }) {
  const { t, locale } = useT();
  const [people, setPeople] = useState<readonly Profile[]>([]);

  const social = useSocial();

  useEffect(() => {
    if (social === undefined) return;

    let alive = true;
    void social.searchProfiles(query).then((rows) => {
      if (alive) setPeople(rows);
    });
    return () => {
      alive = false;
    };
  }, [social, query]);

  if (people.length === 0) return null;

  return (
    <section className="space-y-3" aria-label={t('search.people')}>
      <h2 className="section-heading">{t('search.people')}</h2>
      <ul className="flex flex-wrap gap-3">
        {people.map((one) => (
          <li key={one.userId}>
            {/* La face en pastille et non en toutes lettres : une ligne par personne dans
                une liste dense ne supporte pas un mot de plus — c'est le raisonnement inverse
                de `/u/<nom>`, ou il y a la place et ou le mot apprend quelque chose. */}
            <Link
              href={pathIn(`/u/${one.handle}`, locale)}
              className="card flex items-center gap-3 px-3 py-2 hover:text-(--color-volt)"
            >
              <Avatar handle={one.handle} />
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <FaceDot face={one.face} />@{one.handle}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

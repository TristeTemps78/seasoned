'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RowHeader } from '@/app/components/RowHeader';
import { Icon } from '@/app/components/Icon';
import { useT } from '@/app/i18n/LocaleProvider';

/**
 * La coquille cliente d'une rangee d'affiches : le fondu de bord, et deux fleches.
 *
 * ## Le defaut, mesure au navigateur le 2026-08-13
 *
 * En 1280 px, sur l'accueil : `scrollWidth - clientWidth` valait **1112 px** sur la rangee
 * « En attente » et **1176 px** sur les deux suivantes. Soit, a chaque fois, a peu pres autant
 * de contenu cache que de contenu visible — sans barre de defilement (`scrollbar-width: none`,
 * assume), sans fleche, et sans le moindre signal a la souris.
 *
 * `PosterRail` documente le debordement au bord droit comme etant *l'*affordance : « une
 * rangee coupee dit qu'il y en a plus, sans un mot ». C'est vrai, et ca reste vrai — mais ca
 * dit **qu'il y a une suite**, pas **comment y aller**. Au trackpad le geste horizontal est
 * naturel ; a la souris a molette verticale, il n'existe pas. C'est exactement la distinction
 * que le ruban des faces avait deja tranchee le 2026-08-12 en se dotant d'un fondu : ce qui
 * etait fautif n'etait pas de masquer la barre, c'etait de n'avoir rien mis a la place.
 *
 * ## Pourquoi les fleches sont dans l'en-tete et non sur les bords
 *
 * `.rail` porte `margin-inline: calc(50% - 50vw)` : il sort de la colonne de lecture et va
 * jusqu'aux deux bords de l'ecran, avec une gouttiere de depart calee au pixel sur le texte
 * (`--rail-gutter`, corrige le 2026-08-12). Poser des boutons en absolu sur ses bords
 * demanderait de refaire ce calcul une seconde fois, ailleurs, et de le tenir a jour — pour
 * finir par des fleches flottant **sur** les affiches. Dans la ligne du titre, elles ne
 * touchent pas a une seule valeur de la feuille, et elles se lisent comme ce qu'elles sont :
 * la commande de cette rangee-la.
 *
 * ⚠️ **Sur pointeur fin seulement** (`.rail-arrows`, `controls.css`). Un telephone n'a pas
 * besoin d'un bouton pour faire glisser une rangee, et deux cibles de plus par rangee y
 * couteraient de la largeur a ce qui compte. Le fondu, lui, sert les deux.
 */
export function Rail({ title, subtitle, lead = false, children }: {
  readonly title: string;
  readonly subtitle: string;
  readonly lead?: boolean;
  /**
   * Les vignettes, **rendues par le serveur**.
   *
   * Meme patron que `Messages` dans `SiteChrome` : un composant client qui recoit ses enfants
   * en prop laisse Next les rendre sur le serveur et les inserer tels quels. La rangee garde
   * donc son cout de rendu et sa staticite — `/serie/[id]` doit rester `○ Static`, et c'est
   * l'invariant de cout du projet.
   */
  readonly children: React.ReactNode;
}) {
  const { t } = useT();
  const rail = useRef<HTMLUListElement>(null);
  const [fade, setFade] = useState<'none' | 'left' | 'right' | 'both'>('none');

  /**
   * De quel cote il reste des affiches hors du champ.
   *
   * ⚠️ **Mesure et non point de rupture**, pour la meme raison que `Faces` : le nombre
   * d'affiches d'une rangee varie (le catalogue en rend 8, 12, parfois 3), et leur largeur
   * change a 40 rem. Une media query annoncerait une suite qui n'existe pas sur les rangees
   * courtes. `scrollWidth > clientWidth` ne ment sur aucune des deux.
   */
  const measure = useCallback(() => {
    const list = rail.current;
    if (list === null) return;

    // La marge d'un pixel : les largeurs sont fractionnaires et `scrollWidth` arrondit. Sans
    // elle, une rangee qui rentre pile porte un fondu permanent d'un cote.
    const left = list.scrollLeft > 1;
    const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1;
    setFade(left && right ? 'both' : left ? 'left' : right ? 'right' : 'none');
  }, []);

  useEffect(() => {
    const list = rail.current;
    if (list === null) return;

    measure();
    list.addEventListener('scroll', measure, { passive: true });

    // ⚠️ Meme garde que `Faces` : `ResizeObserver` n'existe pas dans jsdom, ou tournent les
    // tests. Le fondu est un confort — il ne doit faire tomber ni un test ni un navigateur qui
    // ne connait pas l'API. La largeur change aussi sans que la fenetre bouge : l'arrivee des
    // polices elargit les titres sous les affiches.
    const observer =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(list);

    return () => {
      list.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure]);

  /**
   * Un saut d'un peu moins qu'un ecran.
   *
   * ⚠️ 80 % et non 100 : garder une affiche en commun entre l'avant et l'apres est ce qui
   * fait qu'on lit un deplacement plutot qu'un remplacement. Le magnetisme (`scroll-snap`)
   * ramene ensuite sur une bordure d'affiche, donc la valeur n'a pas a etre exacte.
   */
  const nudge = (direction: 1 | -1) => {
    const list = rail.current;
    if (list === null) return;
    list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: 'smooth' });
  };

  const canLeft = fade === 'left' || fade === 'both';
  const canRight = fade === 'right' || fade === 'both';

  return (
    <>
      <div className="flex items-end justify-between gap-4">
        <RowHeader title={title} subtitle={subtitle} />

        {/* ⚠️ La rangee entiere disparait quand rien ne depasse, plutot que deux boutons
            desactives : un bouton grise demande de comprendre pourquoi il l'est, alors qu'ici
            il n'y a rien a comprendre — il n'y a simplement rien de plus a voir. C'est la
            troisieme precision de la regle 4 : ce qui n'a litteralement rien derriere se tait.
            Les deux fleches, elles, restent affichees ensemble une fois qu'il y a de quoi
            defiler : une commande qui apparait et disparait sous le curseur est pire que
            desactivee. */}
        {fade === 'none' ? null : (
          <div className="rail-arrows">
            <button
              type="button"
              onClick={() => nudge(-1)}
              disabled={!canLeft}
              aria-label={t('rail.prev', { row: title })}
              className="rail-arrow"
            >
              <Icon name="chevronLeft" />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              disabled={!canRight}
              aria-label={t('rail.next', { row: title })}
              className="rail-arrow"
            >
              <Icon name="chevronRight" />
            </button>
          </div>
        )}
      </div>

      <ul ref={rail} data-fade={fade} className={`rail ${lead ? 'rail-lead' : ''}`}>
        {children}
      </ul>
    </>
  );
}

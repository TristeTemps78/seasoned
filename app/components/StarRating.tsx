'use client';

import { useId } from 'react';
import { useT } from '@/app/i18n/LocaleProvider';
import type { Stars } from '@/src/domain/types';

/**
 * Dix demi-etoiles, un geste.
 *
 * Le modele de notation pose que la note de saison doit couter **un tap, pas un
 * formulaire** — la saisie manuelle est la cause n°1 d'abandon des trackers.
 * La premiere version utilisait pourtant une liste deroulante a onze
 * options : ouvrir, faire defiler, choisir. La friction avait ete construite
 * exactement la ou le modele l'interdit, et sur le geste le plus frequent du produit.
 *
 * Le demi-cran se prend sur la moitie gauche de chaque etoile, comme chez Letterboxd :
 * c'est le geste que les gens connaissent deja.
 *
 * **L'accessibilite n'est pas un supplement ici.** Une note posee a la souris sur une
 * rangee d'icones est intestable au clavier si on n'y prend pas garde : d'ou un vrai
 * groupe de boutons radio, chacun etiquete de sa valeur, navigable a la tabulation.
 */
export function StarRating({ value, onChange, label, size = 'md' }: {
  readonly value: Stars | undefined;
  readonly onChange: (stars: Stars | undefined) => void;
  /** Ce que l'on note, pour les lecteurs d'ecran : « la saison 3 », « S3E7 ». */
  readonly label: string;
  readonly size?: 'sm' | 'md';
}) {
  const { t, n } = useT();
  const box = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <div
      role="radiogroup"
      aria-label={t('rating.of', { what: label })}
      className="inline-flex items-center gap-1"
    >
      <div className="flex">
        {[1, 2, 3, 4, 5].map((position) => (
          <div key={position} className={`relative ${box}`}>
            <Star filled={fillOf(value, position)} className={box} />
            {/* Deux zones invisibles par etoile : la moitie gauche pose le demi-cran.
                Ce sont de vrais boutons radio — la navigation clavier et le lecteur
                d'ecran passent par eux, pas par le dessin. */}
            {[position - 0.5, position].map((stars) => (
              <button
                key={stars}
                type="button"
                role="radio"
                aria-checked={value === stars}
                aria-label={t('rating.stars', { n: n(stars) })}
                // Re-cliquer la note posee la retire : sans cela, une note donnee par
                // erreur ne peut plus etre reprise.
                onClick={() => onChange(value === stars ? undefined : (stars as Stars))}
                className={`absolute inset-y-0 w-1/2 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-(--color-live) ${
                  stars === position ? 'right-0' : 'left-0'
                }`}
              />
            ))}
          </div>
        ))}
      </div>

      <span
        className={`ml-1 tabular-nums text-(--color-muted) ${
          size === 'sm' ? 'text-[11px]' : 'text-xs'
        }`}
      >
        {value !== undefined ? n(value, 1) : '—'}
      </span>
    </div>
  );
}

/** Part remplie d'une etoile : vide, moitie, pleine. */
function fillOf(value: Stars | undefined, position: number): 0 | 0.5 | 1 {
  if (value === undefined || value < position - 0.5) return 0;
  return value >= position ? 1 : 0.5;
}

function Star({ filled, className }: { readonly filled: 0 | 0.5 | 1; readonly className: string }) {
  // `useId` et non un identifiant tire au hasard : un degrade SVG a besoin d'un
  // identifiant unique dans le document, et un tirage aleatoire donnerait deux valeurs
  // differentes au serveur et au client.
  const id = useId();
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      {filled === 0.5 ? (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="var(--color-rating)" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      ) : null}
      <path
        d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"
        fill={
          // ⚠️ `--color-rating` et non `--color-warn` : les etoiles etaient peintes dans la
          // couleur qui signifie « anomalie » partout ailleurs. Voir le jeton dans
          // `globals.css`.
          filled === 1 ? 'var(--color-rating)' : filled === 0.5 ? `url(#${id})` : 'transparent'
        }
        stroke="var(--color-edge)"
        strokeWidth="1"
      />
    </svg>
  );
}

'use client';

import Link from 'next/link';
import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { Poster } from '@/app/components/Poster';
import { favoritesOf, MAX_FAVORITES, parseJournalKey } from '@/src/domain/journal';
import { pathIn, seriesPath } from '@/lib/routes';

/**
 * La carte de visite — quatre series epinglees.
 *
 * ## Pourquoi quatre affiches valent mieux qu'une liste de plus
 *
 * C'est la premiere chose qu'on voit d'un profil Letterboxd, et ce n'est pas decoratif :
 * une bibliotheque dit ce que quelqu'un a regarde, quatre affiches choisies disent **qui il
 * est**. Le produit savait deja tout ranger — par serie, par date, par agregat — et n'avait
 * nulle part ou quelqu'un se presente.
 *
 * La contrainte **est** la fonctionnalite. Devoir en retirer une pour en mettre une autre
 * est ce qui fait que le choix veut dire quelque chose ; a trente, ce serait une seconde
 * bibliotheque, et la bibliotheque existe deja (regle 3).
 *
 * ## Les emplacements vides s'affichent, et disent quoi y mettre
 *
 * Regle 4, et le cas est net : un bloc qui disparaitrait tant qu'on n'a rien epingle
 * n'apprendrait a personne que la chose existe. Le geste, lui, n'est pas ici — il est sur
 * la fiche serie, la ou l'on decide — donc l'emplacement vide **nomme** l'endroit au lieu
 * de poser un bouton qui menerait ailleurs (`EmptyState`, sur `actions` facultatif).
 */
export function Favorites() {
  const { journal, ready, toggleFavorite } = useJournal();
  const { t, locale } = useT();

  // ⚠️ Aucune reserve `!ready` avec un bloc vide ici, contrairement a `Agenda` : cette
  // section a une hauteur fixe (quatre cadres 2:3) et son etat vide est **legitime**, pas
  // une affirmation prematuree. Sauter le rendu ferait sauter la page au chargement.
  const keys = ready ? favoritesOf(journal) : [];
  const slots = Array.from({ length: MAX_FAVORITES }, (_, i) => keys[i]);

  return (
    <section className="band" aria-label={t('favorites.title')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="row-title">{t('favorites.title')}</h2>
        <p className="meta-sm">{t('favorites.why')}</p>
      </div>

      <ul className="grid grid-cols-4 gap-3 sm:max-w-xl">
        {slots.map((key, i) => {
          if (key === undefined) {
            return (
              <li key={`vide-${i}`}>
                {/* Un cadre au meme rapport que les autres : quatre emplacements de la meme
                    taille disent « il en manque trois », la ou trois cases et un vide
                    diraient « il y a un trou ». */}
                <div className="poster-frame aspect-2/3 grid place-items-center border border-dashed border-(--color-edge)">
                  <span className="meta-sm px-2 text-center" aria-hidden="true">
                    {t('favorites.slot')}
                  </span>
                </div>
              </li>
            );
          }

          const entry = journal.entries[key];
          const title = entry?.snapshot?.title ?? key;
          const parsed = parseJournalKey(key);
          const path = entry?.poster ?? entry?.snapshot?.posterPath;

          return (
            <li key={key} className="space-y-1">
              {parsed === undefined ? (
                <span className="poster-frame block aspect-2/3">
                  <Poster path={path} title={title} size="w342" />
                </span>
              ) : (
                <Link
                  href={seriesPath(parsed.providerId, locale)}
                  className="poster-frame block aspect-2/3"
                >
                  <Poster path={path} title={title} size="w342" />
                </Link>
              )}
              <p className="truncate meta-sm">{title}</p>
              {/* ⚠️ `w-full` : la colonne fait environ 140 px et `.btn` porte un
                  rembourrage horizontal — sans contrainte de largeur, quatre boutons
                  cote a cote debordent la grille. La hauteur, elle, reste celle de `.btn`
                  (44 px sous 640 px), donc la cible tactile n'est pas rognee. */}
              <button
                type="button"
                onClick={() => toggleFavorite(key)}
                className="btn w-full rounded-full text-xs"
              >
                {t('favorites.unpin')}
              </button>
            </li>
          );
        })}
      </ul>

      {keys.length === 0 ? (
        <p className="prose-note">
          {t('favorites.empty')}{' '}
          <Link href={pathIn('/recherche', locale)} className="tap-line underline hover:text-(--color-text)">
            {t('favorites.find')}
          </Link>
        </p>
      ) : null}
    </section>
  );
}

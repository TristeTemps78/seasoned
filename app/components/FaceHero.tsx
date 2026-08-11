'use client';

import { useMemo } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { Poster } from '@/app/components/Poster';
import { seriesEntries } from '@/src/domain/journal';

/**
 * Une bande faite de **vos** affiches, derriere le titre de la face.
 *
 * ## 🔴 Ce qu'elle repare, mesure le 2026-08-12
 *
 * Densite d'image sur la surface rendue :
 *
 *     /bilan   0,5 %    une affiche de 64 x 96 px, sur 1090 px de haut
 *     /moi     1,3 %
 *
 * Les deux ecrans qui ont une banniere — l'accueil et la fiche serie — sont ceux qui parlent
 * des series **des autres**. Celui qui dit qui vous etes, avec vos heures, votre annee et la
 * saison que vous avez le mieux notee, le disait en texte gris.
 *
 * ## Rien n'est invente, et rien ne coute
 *
 * Les affiches viennent des instantanes deja deposes dans le journal en visitant les fiches.
 * **Aucun appel reseau** — c'est la meme contrainte que la bibliotheque, et elle vaut ici
 * pour la meme raison : rafraichir des vignettes a chaque ouverture serait un cout par
 * utilisateur, et c'est ce qui a tue TV Time.
 *
 * ## ⚠️ Pourquoi elle ne s'affiche pas partout
 *
 * Une bande identique sur les six faces redonnerait exactement le defaut qu'on corrige depuis
 * trois jours — *« toutes mes pages se ressemblent »*. Elle appartient a `/bilan`, qui est la
 * seule face sans aucune matiere visuelle et la seule dont le sujet soit vous.
 *
 * ## ⚠️ Et pas sous quatre affiches
 *
 * Une bande de deux vignettes n'est pas une bande, c'est un accident : les images s'etirent,
 * la rangee se lit comme une grille ratee. Sous le seuil, la face reprend sa forme d'avant —
 * un repli, pas un trou. Un journal vide, lui, a deja son ecran vide, et il parle.
 */
export const MIN_POSTERS_FOR_HERO = 4;

/** Combien d'affiches la bande montre au plus. Au-dela, chacune devient une lamelle. */
const MAX_POSTERS = 7;

export function FaceHero({ children }: { readonly children: React.ReactNode }) {
  const { journal, ready } = useJournal();

  const posters = useMemo(() => {
    if (!ready) return [];
    return seriesEntries(journal)
      .flatMap(([, entry]) => {
        // L'affiche **choisie** passe devant celle du catalogue, comme dans la bibliotheque :
        // c'est tout l'interet de la fonctionnalite qu'elle se voie ailleurs que la ou on l'a
        // choisie.
        const path = entry.poster ?? entry.snapshot?.posterPath;
        const title = entry.snapshot?.title;
        return path === undefined || title === undefined ? [] : [{ path, title }];
      })
      .slice(0, MAX_POSTERS);
  }, [journal, ready]);

  // ⚠️ Le repli rend les enfants **tels quels**, sans conteneur : sans bande, la face doit
  // retrouver sa mise en page exacte d'avant, pas une version decalee de quelques pixels.
  if (posters.length < MIN_POSTERS_FOR_HERO) return <>{children}</>;

  return (
    <div className="face-hero-wrap">
      {/* `aria-hidden` : ces affiches ne portent aucune information que la page ne dise pas
          en toutes lettres plus bas. Les annoncer ferait lire sept titres avant le premier
          mot du contenu. */}
      <div className="face-hero" aria-hidden="true">
        <div className="face-hero-strip">
          {posters.map((one) => (
            // ⚠️ `w342` et non `w500` : chaque affiche est rendue sur environ un septieme de
            // la largeur, sous un filtre qui la desature et l'assombrit. Demander plus gros
            // ferait payer des pixels que le voile efface.
            <div key={one.path}>
              <Poster path={one.path} title={one.title} size="w342" />
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useJournal } from '@/app/journal/useJournal';
import { seriesEntries } from '@/src/domain/journal';

/**
 * La decouverte qui remplit une face que le visiteur n'a pas encore remplie.
 *
 * ## 🔴 Ce qu'elle repare, mesure en ligne le 2026-08-12
 *
 * Hauteur des faces, chargees sans journal, sur une fenetre de 1440 x 900 :
 *
 *     /moi          900 px      0 % d'image
 *     /calendrier   900 px      0 %
 *     /bilan        900 px      0 %
 *     /listes       900 px      0 %
 *
 * Soit **exactement une hauteur de fenetre** : un titre, un cartouche gris de 512 px centre,
 * et 450 px de noir jusqu'au pied de page. Quatre fois de suite, avec le meme cartouche, la
 * meme largeur et la meme paire de boutons. La regle 4 etait bien respectee — chaque ecran
 * disait quoi faire — mais elle avait mis **le meme meuble dans quatre pieces vides**, et un
 * visiteur qui clique sur quatre faces d'affilee en conclut que le produit est vide.
 *
 * La reponse tenait dans l'accueil, qui lui n'a jamais eu ce probleme : 73 % d'image et trois
 * rails. Les faces empruntent donc le meme objet — un `PosterRail` du catalogue, oriente vers
 * ce que la face sait faire.
 *
 * ## ⚠️ Ce composant ne decide QUE de la visibilite
 *
 * Il ne fabrique aucune rangee : elle lui arrive en `children`, **rendue sur le serveur**.
 * C'est ce qui garde `SeriesCard`, `Poster` et le catalogue hors du paquet du navigateur, et
 * ce qui permet aux faces de rester statiques. Meme forme que `FaceHero`, pour la meme
 * raison.
 *
 * ## Pourquoi « journal vide » et pas « ecran vide »
 *
 * La condition est **le journal entier**, pas le vide de la face qui l'affiche. Un visiteur
 * qui suit quinze series et dont le calendrier est vide — parce qu'aucune n'a de date
 * annoncee, ce qui est le cas courant — n'a pas besoin qu'on lui propose des series : il en a
 * quinze. Son ecran vide a une phrase qui explique pourquoi, et c'est la bonne reponse.
 *
 * Le vide qu'on remplit ici est celui du **premier jour**, le seul ou le produit doit
 * prouver ce qu'il est avant qu'on lui donne quoi que ce soit.
 */
export function FaceDiscovery({ children }: { readonly children: ReactNode }) {
  const { journal, ready } = useJournal();

  // ⚠️ Rien tant que le journal n'est pas lu. Le HTML de ces pages est **statique et partage
  // entre tous les visiteurs** : servir la rangee puis la retirer ferait clignoter une
  // proposition de series devant quelqu'un qui a deja sa bibliotheque. L'ordre inverse — rien,
  // puis la rangee — n'est visible que par ceux a qui elle est destinee.
  if (!ready || seriesEntries(journal).length > 0) return null;

  return <div className="space-y-10 pt-4">{children}</div>;
}

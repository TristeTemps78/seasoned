'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/app/auth/AuthProvider';
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
 * La condition par defaut est **le journal entier**, pas le vide de la face qui l'affiche. Un
 * visiteur qui suit quinze series et dont le calendrier est vide — parce qu'aucune n'a de date
 * annoncee, ce qui est le cas courant — n'a pas besoin qu'on lui propose des series : il en a
 * quinze. Son ecran vide a une phrase qui explique pourquoi, et c'est la bonne reponse.
 *
 * Le vide qu'on remplit ici est celui du **premier jour**, le seul ou le produit doit
 * prouver ce qu'il est avant qu'on lui donne quoi que ce soit.
 *
 * ## 🔴 …sauf sur les deux faces dont le vide ne vient PAS du journal
 *
 * Remesure le 2026-08-12, **avec** un journal de cinq series et sans compte — c'est-a-dire
 * l'etat courant de ce produit, ou tout marche sans compte sauf deux choses :
 *
 *     /amis      0 %   d'image      1 028 px de haut, une seule pastille de 32 px
 *     /listes    0,9 % d'image      1 082 px de haut, cinq vignettes de 40 x 60 px
 *
 * Soit exactement le cartouche gris dans du vide que la passe precedente avait mesure a 0 % et
 * cru corrige : la rangee etait bien posee sur ces deux faces, mais **derriere la condition du
 * journal**, donc elle disparaissait des la premiere serie suivie. Le releve « 0 % → 30 % » du
 * commit precedent ne valait que pour un journal vide.
 *
 * ⚠️ Ce qui rend ces deux faces vides n'est pas le journal, c'est **l'absence de compte** —
 * les seules deux fonctionnalites du produit qui en demandent un. Un visiteur qui suit trente
 * series voit ces deux portes fermees exactement comme celui du premier jour, et pour lui la
 * condition du journal ne se declenchera plus jamais. La rangee ne remplit donc pas le vide du
 * journal ici : elle montre ce que la face fera, ce qui est le role que `AccountGate` tient
 * deja en mots.
 */
export function FaceDiscovery({ children, gate = 'journal' }: {
  readonly children: ReactNode;
  /**
   * Ce dont le vide de la face depend.
   *
   * `journal` — la face se remplit de ce que le visiteur suit (`/moi`, `/calendrier`,
   * `/bilan`). `account` — la face est fermee a clef tant qu'il n'y a pas de compte
   * (`/amis`, `/listes`), et le journal n'y change rien.
   */
  readonly gate?: 'journal' | 'account';
}) {
  const { journal, ready } = useJournal();
  const { ready: authReady, account } = useAuth();

  // ⚠️ Rien tant que la source n'est pas lue. Le HTML de ces pages est **statique et partage
  // entre tous les visiteurs** : servir la rangee puis la retirer ferait clignoter une
  // proposition de series devant quelqu'un qui a deja sa bibliotheque. L'ordre inverse — rien,
  // puis la rangee — n'est visible que par ceux a qui elle est destinee.
  const vide =
    gate === 'account'
      ? authReady && account === undefined
      : ready && seriesEntries(journal).length === 0;

  if (!vide) return null;

  return <div className="space-y-10 pt-4">{children}</div>;
}

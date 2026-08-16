'use client';

import { useJournal } from '@/app/journal/useJournal';
import { useT } from '@/app/i18n/LocaleProvider';
import { journalKey } from '@/src/domain/journal';
import { PosterToggle } from '@/app/components/PosterToggle';

/**
 * « Je veux la voir », **depuis n'importe quelle affiche du catalogue**.
 *
 * ## Le geste que Letterboxd met partout, et qui n'existait qu'au bout d'un clic
 *
 * Sur Letterboxd, la watchlist se remplit depuis la grille : on parcourt, on ajoute, on
 * continue de parcourir. Ici le meme geste vivait uniquement sur la fiche
 * (`ProgressSummary`) — donc parcourir dix series et en retenir trois demandait dix
 * ouvertures de page et dix retours. C'est le contraire de ce que fait un catalogue.
 *
 * ## ⚠️ Un ilot client dans une carte **serveur**
 *
 * `SeriesCard` n'a pas de `'use client'`, et ne doit pas en gagner un : elle est rendue une
 * douzaine de fois par rangee sur des pages statiques, et la faire basculer entierement
 * cote client enverrait au navigateur le formatage des statuts, l'echelle de notes et le
 * reste, pour un bouton. Seul le bouton est client ; la carte reste rendue par le serveur.
 *
 * C'est aussi pourquoi ce composant ne recoit **pas** un `SeriesSummary** : le type porte
 * `overview`, un paragraphe entier, qui serait alors serialise dans la charge RSC de chaque
 * vignette. Il recoit les trois champs dont l'instantane a besoin, et rien d'autre.
 *
 * ## 🔴 Sans l'instantane, la bibliotheque afficherait « Serie suivie » sans titre
 *
 * `setWanted` cree l'entree, et rien de plus : le titre et l'affiche vivent dans
 * `snapshot`, que la fiche pose dans un effet parce qu'elle les a sous la main. Ajouter
 * depuis le catalogue sans les ecrire produirait une vignette anonyme dans `/moi` — le
 * repli `library.card.tracked`, qui existe pour un instantane **expire** et non pour une
 * serie qu'on vient d'ajouter.
 *
 * ⚠️ Les deux ecritures se suivent dans le meme geste, et l'ordre n'est pas negociable :
 * `rememberSnapshot` **n'ecrit que si l'entree existe deja** (c'est ce qui l'empeche de
 * constituer une base de metadonnees en passant sur une page). Elle doit donc venir apres
 * `setWanted`. Cela marche parce que `update()` pose `latest.current` **synchroniquement** —
 * la seconde ecriture voit la premiere sans attendre un rendu.
 */
export function WantButton({ providerId, title, posterPath }: {
  readonly providerId: string;
  readonly title: string;
  readonly posterPath?: string;
}) {
  const { journal, ready, setWanted, rememberSnapshot } = useJournal();
  const { t } = useT();

  const key = journalKey(providerId);
  const entry = journal.entries[key];
  const wanted = entry?.wanted?.at !== undefined;

  /**
   * ⚠️ **Rien tant que le journal n'est pas lu**, et ce n'est pas un chargement decoratif :
   * afficher « Je veux la voir » sur une serie qui est deja dans la liste, une demi-seconde,
   * ferait cliquer pour l'en retirer. Le premier rendu client est alors identique au HTML
   * servi, ce qui est aussi la condition pour que ces pages restent statiques.
   */
  if (!ready) return null;

  return (
    <PosterToggle
      pressed={wanted}
      // Le titre entre dans le nom : sur une rangee de douze vignettes, douze boutons qui
      // s'annoncent « Je veux la voir » sont douze fois le meme mot sans dire de quoi.
      label={t(wanted ? 'want.remove' : 'want.add', { title })}
      icon={wanted ? 'check' : 'plus'}
      onToggle={() => {
        setWanted(key, !wanted);
        if (!wanted) {
          rememberSnapshot(key, { title, ...(posterPath !== undefined ? { posterPath } : {}) });
        }
      }}
    />
  );
}

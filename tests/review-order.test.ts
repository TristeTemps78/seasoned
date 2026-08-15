import { describe, expect, it } from 'vitest';

import { orderReviews, type ReviewAudience, type ReviewSort } from '../src/domain/review-order';

const critique = (authorId: string, publishedAt: string) => ({ authorId, publishedAt });

/** Les coeurs par auteur, pour lire les tests d'un coup d'oeil. */
const coeurs = (par: Readonly<Record<string, number>>) => (review: { readonly authorId: string }) =>
  par[review.authorId] ?? 0;

const vue = (sort: ReviewSort, audience: ReviewAudience) => ({ sort, audience });

/**
 * ⚠️ Ancrage. Sans lui, tous les tests qui suivent compareraient des listes vides et
 * passeraient — le faux negatif de fixture que ce depot a attrape quatre fois.
 */
describe('ancrage', () => {
  it('rend les critiques, et rien de plus', () => {
    const liste = orderReviews(
      [critique('a', '2026-08-01T10:00:00Z'), critique('b', '2026-08-02T10:00:00Z')],
      vue('recent', 'everyone'),
      { hearts: coeurs({}) },
    );
    expect(liste).toHaveLength(2);
    expect(liste.map((one) => one.authorId).sort()).toEqual(['a', 'b']);
  });
});

/**
 * Le tri par date est **refait** ici alors que `#reviews` demande deja
 * `order=published_at.desc`. Ce test est ce qui rend la duplication legitime : il entre une
 * liste dans le desordre, ce qu'aucune lecture de la base ne produit aujourd'hui — mais que
 * toute fusion de deux sources produirait, comme `mergeFeed` le fait pour le fil.
 */
it('range du plus recent au plus ancien, meme si la source ne l’etait pas', () => {
  const liste = orderReviews(
    [
      critique('vieux', '2026-01-01T10:00:00Z'),
      critique('neuf', '2026-08-14T10:00:00Z'),
      critique('milieu', '2026-05-05T10:00:00Z'),
    ],
    vue('recent', 'everyone'),
    { hearts: coeurs({}) },
  );

  expect(liste.map((one) => one.authorId)).toEqual(['neuf', 'milieu', 'vieux']);
});

it('« les plus aimees » classe par coeurs decroissants', () => {
  const liste = orderReviews(
    [
      critique('deux', '2026-08-01T10:00:00Z'),
      critique('zero', '2026-08-02T10:00:00Z'),
      critique('neuf', '2026-08-03T10:00:00Z'),
    ],
    vue('liked', 'everyone'),
    { hearts: coeurs({ deux: 2, zero: 0, neuf: 9 }) },
  );

  expect(liste.map((one) => one.authorId)).toEqual(['neuf', 'deux', 'zero']);
});

/**
 * Le cas courant, et celui qui casse en silence : **presque toutes les critiques sont a zero
 * coeur**. Sans le socle date, elles changeraient de place a chaque rendu — un tri qui
 * remue la liste sous les yeux du lecteur sans qu'il ait rien demande.
 */
it('a egalite de coeurs, on retombe sur la date', () => {
  const liste = orderReviews(
    [
      critique('ancienne', '2026-08-01T10:00:00Z'),
      critique('recente', '2026-08-10T10:00:00Z'),
      critique('moyenne', '2026-08-05T10:00:00Z'),
    ],
    vue('liked', 'everyone'),
    { hearts: coeurs({}) },
  );

  expect(liste.map((one) => one.authorId)).toEqual(['recente', 'moyenne', 'ancienne']);
});

describe('l’audience', () => {
  const trois = [
    critique('moi', '2026-08-03T10:00:00Z'),
    critique('suivi', '2026-08-02T10:00:00Z'),
    critique('inconnu', '2026-08-01T10:00:00Z'),
  ];

  it('« tout le monde » ne retire personne', () => {
    const liste = orderReviews(trois, vue('recent', 'everyone'), { hearts: coeurs({}) });
    expect(liste).toHaveLength(3);
  });

  it('« les miennes » ne garde que les miennes', () => {
    const liste = orderReviews(trois, vue('recent', 'mine'), { me: 'moi', hearts: coeurs({}) });
    expect(liste.map((one) => one.authorId)).toEqual(['moi']);
  });

  /**
   * Sans compte il n'y a pas de « miennes ». Le filtre ne s'affiche pas sans compte, donc le
   * cas ne se presente pas a l'ecran — mais un domaine qui rendrait TOUT ici afficherait la
   * liste entiere sous le libelle « Les miennes », c'est-a-dire le mensonge exact que ce lot
   * retire de `review.title`.
   */
  it('« les miennes » sans compte ne garde rien', () => {
    const liste = orderReviews(trois, vue('recent', 'mine'), { hearts: coeurs({}) });
    expect(liste).toEqual([]);
  });

  it('« les gens que je suis » ne garde que ceux-la', () => {
    const liste = orderReviews(trois, vue('recent', 'following'), {
      me: 'moi',
      followed: new Set(['suivi']),
      hearts: coeurs({}),
    });
    expect(liste.map((one) => one.authorId)).toEqual(['suivi']);
  });

  /**
   * ⚠️ Le contrat le plus important du module : **`followed` absent veut dire « on ne sait
   * pas encore », et se lit comme un ensemble vide**. Rendre la liste entiere serait
   * annoncer un filtre qui n'a pas eu lieu. C'est au composant d'attendre la liste avant de
   * conclure — ce qu'il fait avec `waiting`.
   */
  it('« les gens que je suis » ne devine rien tant qu’on ne les connait pas', () => {
    const liste = orderReviews(trois, vue('recent', 'following'), { me: 'moi', hearts: coeurs({}) });
    expect(liste).toEqual([]);
  });

  it('ne se suit pas soi-meme par accident', () => {
    const liste = orderReviews(trois, vue('recent', 'following'), {
      me: 'moi',
      followed: new Set(['suivi']),
      hearts: coeurs({}),
    });
    expect(liste.map((one) => one.authorId)).not.toContain('moi');
  });
});

/** Le tri s'applique **apres** le filtre, jamais l'inverse : trier puis jeter perdrait le rang. */
it('classe par coeurs a l’interieur de l’audience choisie', () => {
  const liste = orderReviews(
    [
      critique('suiviA', '2026-08-01T10:00:00Z'),
      critique('star', '2026-08-02T10:00:00Z'),
      critique('suiviB', '2026-08-03T10:00:00Z'),
    ],
    vue('liked', 'following'),
    {
      followed: new Set(['suiviA', 'suiviB']),
      hearts: coeurs({ suiviA: 5, star: 999, suiviB: 1 }),
    },
  );

  expect(liste.map((one) => one.authorId)).toEqual(['suiviA', 'suiviB']);
});

/** Le module ne modifie pas la liste qu'on lui donne — `sort` mute en place, `[...]` protege. */
it('ne remue pas la liste d’origine', () => {
  const source = [critique('a', '2026-01-01T10:00:00Z'), critique('b', '2026-08-01T10:00:00Z')];
  orderReviews(source, vue('recent', 'everyone'), { hearts: coeurs({}) });
  expect(source.map((one) => one.authorId)).toEqual(['a', 'b']);
});

import { describe, expect, it } from 'vitest';
import { nextAfter, type SeasonSize } from '../src/domain/remaining';

/**
 * L'episode juste apres la position.
 *
 * Ce que ces cas gardent n'est pas « ca ajoute un » — ca se voit — mais les trois endroits
 * ou un tracker se trompe, et ou l'erreur est **ecrite dans le journal de quelqu'un** :
 * la bascule de saison, la fin de serie, et un decoupage revise chez le fournisseur.
 */

const BREAKING_BAD: readonly SeasonSize[] = [
  { seasonNumber: 1, episodeCount: 7 },
  { seasonNumber: 2, episodeCount: 13 },
  { seasonNumber: 3, episodeCount: 13 },
];

describe('avancer d un episode', () => {
  it('reste dans la saison tant qu il en reste', () => {
    expect(nextAfter(BREAKING_BAD, { seasonNumber: 1, episodeNumber: 3 })).toEqual({
      seasonNumber: 1,
      episodeNumber: 4,
    });
  });

  it('🔴 bascule sur la saison suivante au dernier episode', () => {
    // La saison 1 en compte 7 : apres le 7, c'est S2E1 et non S1E8. C'est l'endroit ou un
    // « +1 » naif ecrit un episode qui n'existe pas.
    expect(nextAfter(BREAKING_BAD, { seasonNumber: 1, episodeNumber: 7 })).toEqual({
      seasonNumber: 2,
      episodeNumber: 1,
    });
  });

  it('saute une saison absente du decoupage connu', () => {
    // Les hors-serie ne sont pas des saisons notables : la suivante est la suivante
    // **connue**, pas le numero d'apres.
    const trous = [
      { seasonNumber: 1, episodeCount: 4 },
      { seasonNumber: 4, episodeCount: 6 },
    ];
    expect(nextAfter(trous, { seasonNumber: 1, episodeNumber: 4 })).toEqual({
      seasonNumber: 4,
      episodeNumber: 1,
    });
  });

  it('ne range pas les saisons dans l ordre recu', () => {
    const desordre = [...BREAKING_BAD].reverse();
    expect(nextAfter(desordre, { seasonNumber: 1, episodeNumber: 7 })).toEqual({
      seasonNumber: 2,
      episodeNumber: 1,
    });
  });
});

describe('quand il n y a rien a proposer', () => {
  it('🔴 se tait au dernier episode connu', () => {
    // Rien devant : l'appelant n'affiche alors aucun bouton. Proposer S3E14 serait ecrire
    // dans le journal un episode qui n'existe pas.
    expect(nextAfter(BREAKING_BAD, { seasonNumber: 3, episodeNumber: 13 })).toBeUndefined();
  });

  it('se tait sans position — commencer est un autre geste', () => {
    expect(nextAfter(BREAKING_BAD, undefined)).toBeUndefined();
  });

  it('se tait sans decoupage connu', () => {
    // Le cas d'un journal ancien, ou d'un instantane pose avant que `seasonSizes` existe :
    // on ne sait pas si S1E7 finit sa saison, donc on ne propose rien.
    expect(nextAfter([], { seasonNumber: 1, episodeNumber: 3 })).toBeUndefined();
    expect(
      nextAfter([{ seasonNumber: 1, episodeCount: 0 }], { seasonNumber: 1, episodeNumber: 3 }),
    ).toBeUndefined();
  });
});

describe('🔴 un decoupage revise chez le fournisseur', () => {
  it('passe a la saison suivante quand la position depasse le compte connu', () => {
    // Une position peut etre plus loin que ce que l'instantane sait : saison remontee, ou
    // episode declare a la main. Rendre S1E9 sur une saison de 7 ecrirait un episode qui
    // n'existe pas ; on passe a la suivante.
    expect(nextAfter(BREAKING_BAD, { seasonNumber: 1, episodeNumber: 9 })).toEqual({
      seasonNumber: 2,
      episodeNumber: 1,
    });
  });

  it('se tait quand la position depasse la derniere saison connue', () => {
    expect(nextAfter(BREAKING_BAD, { seasonNumber: 9, episodeNumber: 1 })).toBeUndefined();
  });

  it('rend le premier episode d une saison inconnue mais suivie d une autre', () => {
    // La position est sur une saison que l'instantane ignore — elle a ete ajoutee depuis.
    expect(nextAfter(BREAKING_BAD, { seasonNumber: 2.5, episodeNumber: 1 })).toEqual({
      seasonNumber: 3,
      episodeNumber: 1,
    });
  });
});

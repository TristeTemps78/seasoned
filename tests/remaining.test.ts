import { describe, expect, it } from 'vitest';
import { remainingAfter } from '../src/domain/remaining';

/** Une serie de trois saisons de 10, 12 et 8 episodes. */
const SEASONS = [
  { seasonNumber: 1, episodeCount: 10 },
  { seasonNumber: 2, episodeCount: 12 },
  { seasonNumber: 3, episodeCount: 8 },
];

describe('remainingAfter', () => {
  it('ne repond pas quand la position est inconnue', () => {
    // Rendre le total serait repondre a une autre question — et cette autre reponse
    // est deja affichee en tete de page sous « Engagement ».
    expect(remainingAfter(SEASONS, undefined)).toBeUndefined();
  });

  it('compte la fin de la saison en cours, puis les suivantes', () => {
    // S2E5 vu → 7 restants en S2, plus les 8 de S3.
    expect(remainingAfter(SEASONS, { seasonNumber: 2, episodeNumber: 5 })?.episodes).toBe(15);
  });

  it('traite la position comme INCLUSIVE', () => {
    // Le contrat du modele de notation : l'episode declare est vu. Le compter comme
    // restant decalerait tous les chiffres du produit d'une unite.
    expect(remainingAfter(SEASONS, { seasonNumber: 3, episodeNumber: 8 })?.episodes).toBe(0);
    expect(remainingAfter(SEASONS, { seasonNumber: 3, episodeNumber: 7 })?.episodes).toBe(1);
  });

  it('signale explicitement qu’il ne reste rien', () => {
    const done = remainingAfter(SEASONS, { seasonNumber: 3, episodeNumber: 8 });
    expect(done?.done).toBe(true);
    // Distinguer « fini » de « 0 par accident » permet a l'interface de dire autre
    // chose qu'un zero, qui se lit comme une erreur.
    expect(remainingAfter(SEASONS, { seasonNumber: 1, episodeNumber: 1 })?.done).toBe(false);
  });

  it('estime la duree quand on connait celle d’un episode', () => {
    const left = remainingAfter(SEASONS, { seasonNumber: 3, episodeNumber: 3 }, 42);
    expect(left?.episodes).toBe(5);
    expect(left?.minutes).toBe(210);
  });

  it('rend le compte sans la duree plutot qu’une duree inventee', () => {
    // `episode_run_time` est de facto abandonne par TMDB : le cas
    // « on ne sait pas » est le cas courant, pas l'exception.
    const left = remainingAfter(SEASONS, { seasonNumber: 1, episodeNumber: 1 });
    expect(left?.episodes).toBe(29);
    expect(left?.minutes).toBeUndefined();
  });

  it('ignore une duree nulle ou negative au lieu de la propager', () => {
    expect(remainingAfter(SEASONS, { seasonNumber: 1, episodeNumber: 1 }, 0)?.minutes)
      .toBeUndefined();
  });

  it('survit a une position au-dela du compte connu', () => {
    // Arrive pour de vrai : le fournisseur revise un decoupage, et la position pointe
    // un episode qui n'existe plus. Un compte negatif se propagerait en « il vous
    // reste -3 episodes ».
    const left = remainingAfter(SEASONS, { seasonNumber: 2, episodeNumber: 99 });
    expect(left?.episodes).toBe(8);
  });

  it('survit a une saison disparue du catalogue', () => {
    // Position en S9 sur une serie qui n'en compte plus que 3 : rien devant, et
    // surtout pas une exception.
    expect(remainingAfter(SEASONS, { seasonNumber: 9, episodeNumber: 1 })?.episodes).toBe(0);
  });

  it('compte les saisons dans l’ordre, quel que soit celui d’entree', () => {
    const shuffled = [SEASONS[2]!, SEASONS[0]!, SEASONS[1]!];
    expect(remainingAfter(shuffled, { seasonNumber: 2, episodeNumber: 5 })?.episodes).toBe(15);
  });

  it('ecarte les saisons vides sans fausser le total', () => {
    const withHole = [...SEASONS, { seasonNumber: 4, episodeCount: 0 }];
    expect(remainingAfter(withHole, { seasonNumber: 3, episodeNumber: 8 })?.done).toBe(true);
  });

  it('ne repond pas quand aucune saison n’est exploitable', () => {
    expect(remainingAfter([], { seasonNumber: 1, episodeNumber: 1 })).toBeUndefined();
    expect(
      remainingAfter([{ seasonNumber: Number.NaN, episodeCount: 5 }], {
        seasonNumber: 1,
        episodeNumber: 1,
      }),
    ).toBeUndefined();
  });
});

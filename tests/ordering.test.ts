/**
 * Les decoupages concurrents.
 *
 * ⚠️ **Tous les chiffres de ce fichier sont captures depuis l'API TMDB reelle le
 * 2026-08-03**, pas ecrits de memoire. C'est la dette **D10**, dont la cause etait exactement
 * une fixture inventee : `episode_run_time` avait ete decrit tel qu'on s'en souvenait, et le
 * temps annonce etait faux du simple au double.
 *
 * Commande utilisee : `GET /3/tv/{id}/episode_groups` et `GET /3/tv/{id}`.
 */

import { describe, expect, it } from 'vitest';
import {
  AIRED_ORDER_KIND,
  findDivergentOrderings,
  MAX_NAMED_ORDERINGS,
  MIN_EPISODE_DIVERGENCE,
  type CandidateOrdering,
} from '../src/domain/ordering';
import { mapEpisodeGroups } from '../src/catalog/tmdb';

// ---------------------------------------------------------------------------
// Captures reelles
// ---------------------------------------------------------------------------

/** *Money Heist* (71446) — le cas d'ecole, et il est pire que sa reputation. */
const MONEY_HEIST_DEFAULT = { seasonCount: 3, episodeCount: 41 };
const MONEY_HEIST_GROUPS: readonly CandidateOrdering[] = [
  { id: 'a', name: 'Original Parts', kind: 4, kindName: 'digital', groupCount: 5, episodeCount: 41 },
  { id: 'b', name: 'Parts (edited version)', kind: 4, kindName: 'digital', groupCount: 5, episodeCount: 48 },
  { id: 'c', name: 'Seasons (edited version)', kind: 4, kindName: 'digital', groupCount: 3, episodeCount: 48 },
  { id: 'd', name: 'Italian Parts', kind: 4, kindName: 'digital', groupCount: 5, episodeCount: 48 },
];

/** *One Piece* (37854) — 23 saisons par defaut, dont une de 197 episodes. */
const ONE_PIECE_DEFAULT = { seasonCount: 23, episodeCount: 1181 };
const ONE_PIECE_GROUPS: readonly CandidateOrdering[] = [
  { id: 'a', name: 'TVDB Order', kind: 1, kindName: 'original air date', groupCount: 24, episodeCount: 1210 },
  { id: 'b', name: 'Absolute (No Specials)', kind: 2, kindName: 'absolute', groupCount: 1, episodeCount: 1181 },
  { id: 'c', name: 'German DVD Release', kind: 3, kindName: 'DVD', groupCount: 36, episodeCount: 1047 },
];

/** *Breaking Bad* (1396) — 62 episodes des deux cotes, 5 saisons contre 6. */
const BREAKING_BAD_DEFAULT = { seasonCount: 5, episodeCount: 62 };
const BREAKING_BAD_GROUPS: readonly CandidateOrdering[] = [
  { id: 'a', name: 'DVD / PVOD', kind: 3, kindName: 'DVD', groupCount: 6, episodeCount: 62 },
];

describe('findDivergentOrderings — sur des series reelles', () => {
  it('signale Money Heist, et dit de combien', () => {
    // 🔴 Le cas qui justifie tout le module. Defaut TMDB : 3 saisons / 41 episodes.
    // Netflix — la ou tout le monde la regarde — : 5 parts / 48. Quelqu'un qui dit « je suis
    // saison 4 » designe une saison qui n'existe pas chez nous, et « il vous reste X
    // episodes » se trompe de 17 %.
    const found = findDivergentOrderings(MONEY_HEIST_DEFAULT, MONEY_HEIST_GROUPS)!;
    expect(found).not.toBeUndefined();

    // Les quatre divergent : trois sur les episodes, et « Original Parts » sur le seul
    // decoupage (5 groupes contre 3 saisons) tout en ayant le meme total.
    expect(found.total).toBe(4);
    // Mais trois seulement sont nommes — voir MAX_NAMED_ORDERINGS.
    expect(found.named).toHaveLength(MAX_NAMED_ORDERINGS);

    const worst = found.named[0]!;
    expect(worst.episodeGap).toBe(7);
    expect(Math.abs(worst.episodeGap) / 41).toBeGreaterThan(MIN_EPISODE_DIVERGENCE);
  });

  it('retient un decoupage qui a le MEME nombre d’episodes', () => {
    // Breaking Bad : 62 episodes des deux cotes. Un module qui ne comparerait que les
    // totaux se tairait — alors que 5 saisons contre 6 rend « arrete-toi apres la saison 5 »
    // ambigu. C'est l'axe des conseils par saison qui casse, pas les totaux.
    const found = findDivergentOrderings(BREAKING_BAD_DEFAULT, BREAKING_BAD_GROUPS)!;
    expect(found.total).toBe(1);
    expect(found.named[0]?.episodeGap).toBe(0);
    expect(found.named[0]?.groupGap).toBe(1);
  });

  it('signale One Piece, du plus gros ecart au plus petit', () => {
    const found = findDivergentOrderings(ONE_PIECE_DEFAULT, ONE_PIECE_GROUPS)!;
    // « TVDB Order » est de nature 1 (ordre de diffusion) : exclu, meme axe que le defaut.
    // Restent le DVD allemand (-134 episodes) et l'ordre absolu (meme total, 1 groupe
    // contre 23).
    expect(found.named.map((o) => o.name)).toEqual([
      'German DVD Release',
      'Absolute (No Specials)',
    ]);
    expect(found.total).toBe(2);
    expect(found.named[0]?.episodeGap).toBe(-134);
    expect(found.named[1]?.episodeGap).toBe(0);
    expect(found.named[1]?.groupGap).toBe(-22);
  });

  it('🔴 se tait sur Game of Thrones — le faux positif trouve en conditions reelles', () => {
    // Capture reelle : le seul groupe de GoT est « Aired Order », nature 1, 9 groupes /
    // 102 episodes contre 8 saisons / 73 par defaut. Un module qui ne regarderait que les
    // chiffres crierait « +29 episodes ! » — alors que c'est l'ordre de diffusion qu'on
    // affiche deja, avec les speciaux comptes. Annoncer un « autre decoupage » a quelqu'un
    // qui regarde Game of Thrones serait faux.
    //
    // ⚠️ Ce test n'existait pas dans la premiere version, et la premiere version etait
    // verte. Il vient d'avoir fait tourner la vraie chaine sur quatre series.
    expect(
      findDivergentOrderings(
        { seasonCount: 8, episodeCount: 73 },
        [{ id: 'got', name: 'Aired Order', kind: AIRED_ORDER_KIND, groupCount: 9, episodeCount: 102 }],
      ),
    ).toBeUndefined();
  });

  it('ne nomme jamais plus de MAX_NAMED_ORDERINGS, mais compte tout', () => {
    // One Piece remonte DIX-HUIT decoupages en vrai. Un bandeau qui les liste tous
    // n'apprend rien — et l'anime est precisement la categorie ou l'avertissement sert le
    // plus. `total` permet de dire « et onze autres » sans mentir.
    const many: CandidateOrdering[] = Array.from({ length: 14 }, (_, i) => ({
      id: `g${i}`,
      name: `Decoupage ${i}`,
      kind: 3,
      groupCount: 5 + i,
      episodeCount: 1181 - (i + 1) * 20,
    }));
    const found = findDivergentOrderings(ONE_PIECE_DEFAULT, many)!;
    expect(found.named).toHaveLength(MAX_NAMED_ORDERINGS);
    expect(found.total).toBe(14);
  });

  it('se tait quand un decoupage dit exactement la meme chose', () => {
    // Le cas courant, et le plus important : un avertissement qui s'affiche partout
    // n'apprend plus rien. Meme regle que le point d'arret et le bilan.
    expect(
      findDivergentOrderings(BREAKING_BAD_DEFAULT, [
        { id: 'x', name: 'Aired Order', groupCount: 5, episodeCount: 62 },
      ]),
    ).toBeUndefined();
  });

  it('se tait sur un ecart d’episodes sous le seuil, a decoupage egal', () => {
    // 2 episodes sur 62 = 3,2 % : presque toujours un special compte d'un cote et pas de
    // l'autre. Ca ne change aucun conseil.
    expect(
      findDivergentOrderings(BREAKING_BAD_DEFAULT, [
        { id: 'x', name: 'Avec un recap', groupCount: 5, episodeCount: 64 },
      ]),
    ).toBeUndefined();
  });

  it('se tait faute de reference plutot que de faire diverger tout le monde', () => {
    // Sans forme par defaut connue, tout candidat aurait l'air divergent. Inventer une base
    // produirait un avertissement sur chaque serie dont le catalogue est indisponible.
    expect(findDivergentOrderings({ seasonCount: 0, episodeCount: 0 }, MONEY_HEIST_GROUPS)).toBeUndefined();
    expect(
      findDivergentOrderings({ seasonCount: 3, episodeCount: Number.NaN }, MONEY_HEIST_GROUPS),
    ).toBeUndefined();
  });

  it('rend undefined et jamais une liste vide', () => {
    // « Rien a signaler » et « voici une liste vide » se traitent differemment a l'appel :
    // le premier fait disparaitre le bandeau, le second pourrait en afficher un vide.
    expect(findDivergentOrderings(BREAKING_BAD_DEFAULT, [])).toBeUndefined();
  });

  it('ecarte un candidat aux chiffres absurdes sans perdre les autres', () => {
    const found = findDivergentOrderings(MONEY_HEIST_DEFAULT, [
      { id: 'vide', name: 'Jamais rempli', groupCount: 0, episodeCount: 0 },
      { id: 'b', name: 'Parts (edited version)', groupCount: 5, episodeCount: 48 },
    ])!;
    expect(found.named.map((o) => o.id)).toEqual(['b']);
  });

  it('est stable d’un appel a l’autre', () => {
    // Deux candidats a ecart identique doivent sortir dans le meme ordre a chaque rendu,
    // sinon le bandeau change de contenu sans raison entre deux navigations.
    const a = findDivergentOrderings(MONEY_HEIST_DEFAULT, MONEY_HEIST_GROUPS);
    const b = findDivergentOrderings(MONEY_HEIST_DEFAULT, [...MONEY_HEIST_GROUPS].reverse());
    expect(a?.named.map((o) => o.id)).toEqual(b?.named.map((o) => o.id));
  });
});

describe('mapEpisodeGroups — la reponse TMDB, telle qu’elle arrive', () => {
  /** Capture abregee de `GET /3/tv/71446/episode_groups` le 2026-08-03. */
  const RAW = {
    id: 71446,
    results: [
      {
        description: '',
        episode_count: 48,
        group_count: 5,
        id: '5e8b1e0a8b1a2c001d5f0a11',
        name: 'Parts (edited version)',
        network: { id: 213, name: 'Netflix', origin_country: '' },
        type: 4,
      },
      {
        description: '',
        episode_count: 41,
        group_count: 5,
        id: '5d9c0e1f9251411d4b0a3e77',
        name: 'Original Parts',
        network: null,
        type: 4,
      },
    ],
  };

  it('lit les deux decoupages et nomme leur nature', () => {
    const groups = mapEpisodeGroups(RAW);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.name).toBe('Parts (edited version)');
    expect(groups[0]?.episodeCount).toBe(48);
    expect(groups[0]?.groupCount).toBe(5);
    // `type: 4` = digital. Nom capture depuis l'API, pas devine (D10).
    expect(groups[0]?.kind).toBe(4);
    expect(groups[0]?.kindName).toBe('digital');
  });

  it('garde le numero brut d’une nature inconnue, sans le nommer', () => {
    // Le bareme appartient au fournisseur et peut s'etendre. Se taire sur le nom vaut mieux
    // que d'en inventer un — et le numero reste, donc l'information n'est pas perdue.
    const groups = mapEpisodeGroups({ results: [{ ...RAW.results[0], type: 99 }] });
    expect(groups[0]?.kind).toBe(99);
    expect(groups[0]?.kindName).toBeUndefined();
  });

  it('ecarte une entree inexploitable sans perdre la liste', () => {
    // Regle 4 : un catalogue tiers change sans prevenir. Un decoupage perdu vaut mieux
    // qu'une page perdue — et le cout est nul ici, puisque la liste ne sert qu'a signaler.
    const groups = mapEpisodeGroups({
      results: [
        { id: 'x' }, // ni nom ni chiffres
        { id: 'y', name: 'Vide', group_count: 0, episode_count: 0 },
        { name: 'Sans id', group_count: 5, episode_count: 48 },
        { id: 'z', name: 'Mal type', group_count: '5', episode_count: 48 },
        ...RAW.results,
      ],
    });
    expect(groups.map((g) => g.name)).toEqual(['Parts (edited version)', 'Original Parts']);
  });

  it('ne casse pas sur une reponse qui n’a pas la forme attendue', () => {
    expect(mapEpisodeGroups(undefined)).toEqual([]);
    expect(mapEpisodeGroups({})).toEqual([]);
    expect(mapEpisodeGroups({ results: 'pas un tableau' })).toEqual([]);
    expect(mapEpisodeGroups([])).toEqual([]);
  });
});

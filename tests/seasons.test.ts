import { describe, expect, it } from 'vitest';
import {
  SPECIALS_SEASON_NUMBER,
  episodesThrough,
  normalizeSeasons,
  type RawSeason,
  type SeasonWarningCode,
} from '../src/domain/seasons';

const NOW = new Date('2026-07-31T00:00:00Z');

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function codes(warnings: readonly { code: SeasonWarningCode }[]): SeasonWarningCode[] {
  return warnings.map((w) => w.code);
}

/** Une serie ordinaire de trois saisons diffusees. */
const THREE_SEASONS: RawSeason[] = [
  { seasonNumber: 1, episodeCount: 10, airDate: d('2020-01-01') },
  { seasonNumber: 2, episodeCount: 10, airDate: d('2021-06-01') },
  { seasonNumber: 3, episodeCount: 10, airDate: d('2023-01-01') },
];

describe('normalizeSeasons — cas nominal', () => {
  it('rend les saisons triees et toutes notables', () => {
    const result = normalizeSeasons('s', THREE_SEASONS, { now: NOW });

    expect(result.rateable).toHaveLength(3);
    expect(result.rateable.map((s) => s.ref.seasonNumber)).toEqual([1, 2, 3]);
    expect(result.shape).toBe('multi_season');
    expect(result.warnings).toHaveLength(0);
  });

  it('trie des saisons donnees dans le desordre', () => {
    const shuffled = [THREE_SEASONS[2]!, THREE_SEASONS[0]!, THREE_SEASONS[1]!];
    const result = normalizeSeasons('s', shuffled, { now: NOW });
    expect(result.all.map((s) => s.ref.seasonNumber)).toEqual([1, 2, 3]);
  });
});

describe('normalizeSeasons — episodes speciaux', () => {
  it('isole la saison 0 et l exclut du canon notable', () => {
    const result = normalizeSeasons(
      's',
      [
        { seasonNumber: SPECIALS_SEASON_NUMBER, episodeCount: 4, airDate: d('2020-12-01') },
        ...THREE_SEASONS,
      ],
      { now: NOW },
    );

    expect(result.specials).toHaveLength(1);
    expect(result.rateable.map((s) => s.ref.seasonNumber)).toEqual([1, 2, 3]);
    expect(result.all).toHaveLength(4);
    expect(codes(result.warnings)).toContain('specials_present');
  });
});

describe('normalizeSeasons — saisons non diffusees', () => {
  it('ecarte une saison future de la notation', () => {
    const result = normalizeSeasons(
      's',
      [...THREE_SEASONS, { seasonNumber: 4, episodeCount: 8, airDate: d('2027-03-01') }],
      { now: NOW },
    );

    expect(result.rateable).toHaveLength(3);
    expect(codes(result.warnings)).toContain('unaired_season');
  });

  it('traite une saison sans date comme non diffusee', () => {
    // Mieux vaut ne pas proposer de noter que proposer de noter du vide.
    const result = normalizeSeasons(
      's',
      [...THREE_SEASONS, { seasonNumber: 4, episodeCount: 0 }],
      { now: NOW },
    );

    expect(result.rateable).toHaveLength(3);
    expect(codes(result.warnings)).toContain('unaired_season');
    expect(codes(result.warnings)).toContain('empty_season');
  });
});

describe('normalizeSeasons — mini-series', () => {
  it('reconnait une mini-serie terminee', () => {
    const result = normalizeSeasons(
      's',
      [{ seasonNumber: 1, episodeCount: 6, airDate: d('2024-01-01') }],
      { now: NOW, productionEnded: true },
    );

    expect(result.shape).toBe('miniseries');
    expect(codes(result.warnings)).toContain('single_season');
  });

  it('ne prend pas une serie jeune pour une mini-serie', () => {
    // Une seule saison diffusee mais la production continue : ce n'est pas fini.
    const result = normalizeSeasons(
      's',
      [{ seasonNumber: 1, episodeCount: 8, airDate: d('2025-09-01') }],
      { now: NOW, productionEnded: false },
    );

    expect(result.shape).toBe('multi_season');
    expect(codes(result.warnings)).not.toContain('single_season');
  });

  it('ne conclut pas a une mini-serie si une saison est annoncee', () => {
    const result = normalizeSeasons(
      's',
      [
        { seasonNumber: 1, episodeCount: 6, airDate: d('2024-01-01') },
        { seasonNumber: 2, episodeCount: 6, airDate: d('2027-01-01') },
      ],
      { now: NOW, productionEnded: true },
    );

    expect(result.shape).toBe('multi_season');
  });
});

describe('normalizeSeasons — saisons scindees', () => {
  it('detecte une scission annoncee par le nom', () => {
    const result = normalizeSeasons(
      's',
      [
        { seasonNumber: 1, episodeCount: 10, airDate: d('2022-01-01') },
        { seasonNumber: 2, name: 'Season 2 Part 1', episodeCount: 5, airDate: d('2023-05-01') },
        { seasonNumber: 3, name: 'Season 2 Part 2', episodeCount: 4, airDate: d('2024-07-01') },
      ],
      { now: NOW },
    );

    expect(codes(result.warnings)).toContain('possible_split_season');
    const warning = result.warnings.find((w) => w.code === 'possible_split_season');
    expect(warning?.seasonNumbers).toEqual([2, 3]);
  });

  it('detecte une scission par proximite des dates', () => {
    const result = normalizeSeasons(
      's',
      [
        { seasonNumber: 1, episodeCount: 8, airDate: d('2024-01-01') },
        { seasonNumber: 2, episodeCount: 8, airDate: d('2024-02-15') },
      ],
      { now: NOW },
    );

    expect(codes(result.warnings)).toContain('possible_split_season');
  });

  it('ne signale rien pour un rythme de production normal', () => {
    const result = normalizeSeasons('s', THREE_SEASONS, { now: NOW });
    expect(codes(result.warnings)).not.toContain('possible_split_season');
  });

  it('signale sans jamais fusionner', () => {
    // Regle du module : on signale, on ne repare pas en silence. Une fusion
    // erronee casserait des notes deja posees.
    const result = normalizeSeasons(
      's',
      [
        { seasonNumber: 1, name: 'Season 1 Part 1', episodeCount: 5, airDate: d('2024-01-01') },
        { seasonNumber: 2, name: 'Season 1 Part 2', episodeCount: 5, airDate: d('2024-02-01') },
      ],
      { now: NOW },
    );

    expect(result.rateable).toHaveLength(2);
  });
});

describe('normalizeSeasons — numerotation', () => {
  it('signale un trou dans la numerotation', () => {
    const result = normalizeSeasons(
      's',
      [
        { seasonNumber: 1, episodeCount: 10, airDate: d('2020-01-01') },
        { seasonNumber: 2, episodeCount: 10, airDate: d('2021-01-01') },
        { seasonNumber: 4, episodeCount: 10, airDate: d('2023-01-01') },
      ],
      { now: NOW },
    );

    expect(codes(result.warnings)).toContain('non_contiguous_numbering');
  });

  it('ne compte pas la saison 0 comme un trou', () => {
    const result = normalizeSeasons(
      's',
      [{ seasonNumber: SPECIALS_SEASON_NUMBER, episodeCount: 2, airDate: d('2019-12-01') }, ...THREE_SEASONS],
      { now: NOW },
    );

    expect(codes(result.warnings)).not.toContain('non_contiguous_numbering');
  });
});

describe('episodesThrough — chiffrer « arrete-toi apres la saison N »', () => {
  const seasons = normalizeSeasons(
    's',
    [
      { seasonNumber: SPECIALS_SEASON_NUMBER, episodeCount: 5, airDate: d('2019-12-01') },
      { seasonNumber: 1, episodeCount: 12, airDate: d('2020-01-01') },
      { seasonNumber: 2, episodeCount: 12, airDate: d('2021-01-01') },
      { seasonNumber: 3, episodeCount: 10, airDate: d('2022-01-01') },
      { seasonNumber: 4, episodeCount: 8, airDate: d('2027-01-01') },
    ],
    { now: NOW },
  ).rateable;

  it('additionne jusqu a la saison demandee incluse', () => {
    expect(episodesThrough(seasons, 1)).toBe(12);
    expect(episodesThrough(seasons, 2)).toBe(24);
    expect(episodesThrough(seasons, 3)).toBe(34);
  });

  it('ignore les speciaux et les saisons non diffusees', () => {
    // La saison 4 est annoncee pour 2027 : elle ne compte pas, pas plus que les
    // cinq episodes speciaux.
    expect(episodesThrough(seasons, 99)).toBe(34);
  });

  it('rend zero avant la premiere saison', () => {
    expect(episodesThrough(seasons, 0)).toBe(0);
    expect(episodesThrough([], 5)).toBe(0);
  });
});

describe('normalizeSeasons — cas degeneres', () => {
  it('accepte une serie sans aucune saison', () => {
    const result = normalizeSeasons('s', [], { now: NOW });
    expect(result.shape).toBe('unknown');
    expect(result.rateable).toHaveLength(0);
    expect(result.all).toHaveLength(0);
  });

  it('accepte une serie qui n a que des speciaux', () => {
    const result = normalizeSeasons(
      's',
      [{ seasonNumber: SPECIALS_SEASON_NUMBER, episodeCount: 3, airDate: d('2020-01-01') }],
      { now: NOW },
    );
    expect(result.shape).toBe('unknown');
    expect(result.specials).toHaveLength(1);
  });
});

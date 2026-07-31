import { describe, expect, it } from 'vitest';
import {
  TmdbProvider,
  mapSearchResults,
  mapSeasonDetail,
  mapSeriesDetail,
} from '../src/catalog/tmdb';

/**
 * Fiche serie reduite mais fidele a la forme reelle de TMDB, y compris ses
 * bizarreries : `air_date` a la chaine vide, `poster_path` a `null`.
 */
const SERIES_FIXTURE = {
  id: 1396,
  name: 'Breaking Bad',
  original_name: 'Breaking Bad',
  first_air_date: '2008-01-20',
  poster_path: '/poster.jpg',
  overview: 'Un professeur de chimie...',
  status: 'Ended',
  episode_run_time: [45, 47],
  external_ids: { imdb_id: 'tt0903747', tvdb_id: 81189 },
  last_episode_to_air: { air_date: '2013-09-29', season_number: 5, episode_number: 16 },
  next_episode_to_air: null,
  seasons: [
    { season_number: 0, name: 'Specials', episode_count: 6, air_date: '' },
    { season_number: 1, name: 'Season 1', episode_count: 7, air_date: '2008-01-20' },
    { season_number: 2, name: 'Season 2', episode_count: 13, air_date: '2009-03-08' },
  ],
  // Cle inconnue : doit etre ignoree sans bruit.
  some_new_field_added_by_tmdb: { nested: true },
};

describe('mapSeriesDetail — cas nominal', () => {
  it('extrait les champs utiles', () => {
    const detail = mapSeriesDetail(SERIES_FIXTURE);

    expect(detail?.providerId).toBe('1396');
    expect(detail?.title).toBe('Breaking Bad');
    expect(detail?.production).toBe('ended');
    expect(detail?.externalIds).toEqual({ tmdb: 1396, tvdb: 81189, imdb: 'tt0903747' });
    expect(detail?.seasons).toHaveLength(3);
    expect(detail?.episodeRunTimeMinutes).toBe(45);
  });

  it('lit les dates de diffusion', () => {
    const detail = mapSeriesDetail(SERIES_FIXTURE);
    expect(detail?.lastAiredAt?.toISOString()).toBe('2013-09-29T00:00:00.000Z');
    expect(detail?.nextAiringAt).toBeUndefined();
  });

  it('traite une date vide comme absente', () => {
    // TMDB rend `""` et non `null` pour une saison sans date annoncee.
    const detail = mapSeriesDetail(SERIES_FIXTURE);
    const specials = detail?.seasons.find((s) => s.seasonNumber === 0);
    expect(specials?.airDate).toBeUndefined();
    expect(specials?.episodeCount).toBe(6);
  });
});

describe('mapSeriesDetail — parsing tolerant', () => {
  it('ignore une cle inconnue sans broncher', () => {
    expect(mapSeriesDetail(SERIES_FIXTURE)).toBeDefined();
  });

  it('ne tombe sur aucune entree malformee', () => {
    for (const input of [null, undefined, 42, 'texte', [], {}, { id: 1 }, { name: 'x' }]) {
      expect(() => mapSeriesDetail(input)).not.toThrow();
    }
  });

  it('rejette une fiche sans identifiant ou sans titre', () => {
    expect(mapSeriesDetail({ name: 'Sans id' })).toBeUndefined();
    expect(mapSeriesDetail({ id: 1 })).toBeUndefined();
  });

  it('se rabat sur le titre original si le titre localise manque', () => {
    const detail = mapSeriesDetail({ id: 7, original_name: 'Titre original' });
    expect(detail?.title).toBe('Titre original');
  });

  it('rend « unknown » pour un statut inconnu plutot que de deviner', () => {
    expect(mapSeriesDetail({ id: 1, name: 'x', status: 'Brand New Status' })?.production).toBe('unknown');
    expect(mapSeriesDetail({ id: 1, name: 'x' })?.production).toBe('unknown');
  });

  it('accepte les deux orthographes de « annulee »', () => {
    expect(mapSeriesDetail({ id: 1, name: 'x', status: 'Canceled' })?.production).toBe('canceled');
    expect(mapSeriesDetail({ id: 1, name: 'x', status: 'Cancelled' })?.production).toBe('canceled');
  });

  it('ecarte les saisons inexploitables sans perdre les autres', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      seasons: [{ season_number: 1, episode_count: 5 }, { name: 'sans numero' }, null, 'texte'],
    });
    expect(detail?.seasons).toHaveLength(1);
  });

  it('ignore une date invalide', () => {
    const detail = mapSeriesDetail({ id: 1, name: 'x', first_air_date: 'pas-une-date' });
    expect(detail?.firstAirDate).toBeUndefined();
  });
});

describe('mapSeasonDetail', () => {
  it('extrait les episodes', () => {
    const season = mapSeasonDetail(
      {
        season_number: 1,
        name: 'Season 1',
        air_date: '2008-01-20',
        episodes: [
          { season_number: 1, episode_number: 1, name: 'Pilot', air_date: '2008-01-20', runtime: 58 },
          { season_number: 1, episode_number: 2, name: 'Cat in the Bag...', air_date: '2008-01-27' },
        ],
      },
      1,
    );

    expect(season.seasonNumber).toBe(1);
    expect(season.episodes).toHaveLength(2);
    expect(season.episodes[0]?.runtimeMinutes).toBe(58);
    expect(season.episodes[1]?.runtimeMinutes).toBeUndefined();
  });

  it('se rabat sur le numero demande si la reponse ne le porte pas', () => {
    expect(mapSeasonDetail({}, 4).seasonNumber).toBe(4);
  });

  it('rend une saison vide plutot que de casser', () => {
    expect(mapSeasonDetail(null, 1).episodes).toEqual([]);
  });
});

describe('mapSearchResults', () => {
  it('extrait les resultats exploitables', () => {
    const results = mapSearchResults({
      results: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { name: 'sans id' },
        null,
      ],
    });
    expect(results.map((r) => r.title)).toEqual(['A', 'B']);
  });

  it('rend une liste vide pour une reponse malformee', () => {
    expect(mapSearchResults(null)).toEqual([]);
    expect(mapSearchResults({})).toEqual([]);
    expect(mapSearchResults({ results: 'pas un tableau' })).toEqual([]);
  });
});

describe('TmdbProvider', () => {
  it('refuse de se construire sans jeton', () => {
    expect(() => new TmdbProvider({ accessToken: '' })).toThrow();
    expect(() => new TmdbProvider({ accessToken: '   ' })).toThrow();
  });

  it('envoie le jeton en en-tete et la langue en parametre', async () => {
    let captured: { url: URL; init?: RequestInit } | undefined;
    const provider = new TmdbProvider({
      accessToken: 'jeton-de-test',
      language: 'fr-FR',
      fetchImpl: (async (url: URL, init?: RequestInit) => {
        captured = { url, ...(init !== undefined ? { init } : {}) };
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    await provider.search('breaking bad');

    expect(captured?.url.pathname).toBe('/3/search/tv');
    expect(captured?.url.searchParams.get('query')).toBe('breaking bad');
    expect(captured?.url.searchParams.get('language')).toBe('fr-FR');
    const headers = captured?.init?.headers as Record<string, string> | undefined;
    expect(headers?.['authorization']).toBe('Bearer jeton-de-test');
  });

  it('n appelle pas le reseau pour une recherche vide', async () => {
    let called = false;
    const provider = new TmdbProvider({
      accessToken: 'x',
      fetchImpl: (async () => {
        called = true;
        return new Response('{}', { status: 200 });
      }) as unknown as typeof fetch,
    });

    expect(await provider.search('   ')).toEqual([]);
    expect(called).toBe(false);
  });

  it('leve une erreur portant le statut et l endpoint, sans le jeton', async () => {
    const provider = new TmdbProvider({
      accessToken: 'jeton-secret',
      fetchImpl: (async () => new Response('{"status_message":"..."}', { status: 401 })) as unknown as typeof fetch,
    });

    await expect(provider.getSeries('1396')).rejects.toMatchObject({
      name: 'TmdbError',
      status: 401,
      endpoint: '/tv/1396',
    });

    // Regle du projet : jamais de secret dans un message d'erreur ni un journal.
    await provider.getSeries('1396').catch((error: unknown) => {
      expect(String(error)).not.toContain('jeton-secret');
    });
  });

  it('leve plutot que de rendre une fiche inexploitable', async () => {
    const provider = new TmdbProvider({
      accessToken: 'x',
      fetchImpl: (async () => new Response('{"nothing":true}', { status: 200 })) as unknown as typeof fetch,
    });

    await expect(provider.getSeries('999')).rejects.toThrow(/inexploitable/);
  });
});

import { describe, expect, it } from 'vitest';
import {
  TmdbProvider,
  mapPersonSeriesCredits,
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

describe('note du public de la serie', () => {
  it('la lit quand elle existe', () => {
    // Presente dans la meme reponse, donc gratuite — et c'est le seul moyen de dire
    // « vous notez plus severement que le public » dans une bibliotheque qui ne fait
    // aucun appel.
    expect(mapSeriesDetail({ id: 1, name: 'x', vote_average: 8.4 })?.voteAverage).toBe(8.4);
  });

  it('ignore un zero, qui signifie « pas encore note » et non « nul »', () => {
    expect(mapSeriesDetail({ id: 1, name: 'x', vote_average: 0 })?.voteAverage).toBeUndefined();
    expect(mapSeriesDetail({ id: 1, name: 'x' })?.voteAverage).toBeUndefined();
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

describe('prochain episode — la seule raison de revenir a une date precise', () => {
  it('extrait le numero, le titre et la date', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      next_episode_to_air: {
        air_date: '2026-09-04',
        season_number: 3,
        episode_number: 7,
        name: 'Le Retour',
      },
    });

    expect(detail?.nextEpisode).toEqual({
      seasonNumber: 3,
      episodeNumber: 7,
      title: 'Le Retour',
      airsOn: new Date('2026-09-04T00:00:00.000Z'),
    });
  });

  it('se passe du titre, souvent absent pour un episode a venir', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      next_episode_to_air: { air_date: '2026-09-04', season_number: 1, episode_number: 2 },
    });
    expect(detail?.nextEpisode?.title).toBeUndefined();
    expect(detail?.nextEpisode?.episodeNumber).toBe(2);
  });

  it('n annonce rien sans date — un episode sans date n est pas une promesse', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      next_episode_to_air: { season_number: 3, episode_number: 7, name: 'x' },
    });
    expect(detail?.nextEpisode).toBeUndefined();
  });

  it('n annonce rien sans numero d episode', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      next_episode_to_air: { air_date: '2026-09-04' },
    });
    expect(detail?.nextEpisode).toBeUndefined();
    // La date reste exploitable pour le statut, elle.
    expect(detail?.nextAiringAt).toBeDefined();
  });
});

describe('duree d episode — le champ que TMDB a abandonne', () => {
  // Constate en production le 2026-08-01 : `episode_run_time` revient vide sur la
  // grande majorite des series, y compris Breaking Bad. Aucun test hors ligne ne
  // pouvait l'attraper, puisque nos fixtures le contenaient encore.
  it('se rabat sur le dernier episode quand episode_run_time est vide', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      episode_run_time: [],
      last_episode_to_air: { air_date: '2013-09-29', runtime: 55 },
    });
    expect(detail?.episodeRunTimeMinutes).toBe(55);
  });

  it('se rabat sur le prochain episode si aucun n est encore paru', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      next_episode_to_air: { air_date: '2026-09-01', runtime: 42 },
    });
    expect(detail?.episodeRunTimeMinutes).toBe(42);
  });

  it('prefere la valeur declaree quand elle existe', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      episode_run_time: [45],
      last_episode_to_air: { runtime: 90 },
    });
    expect(detail?.episodeRunTimeMinutes).toBe(45);
  });

  it('ignore une duree nulle plutot que de l afficher', () => {
    // TMDB rend parfois 0, ce qui produirait « moins d'une heure » pour 60 episodes.
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      episode_run_time: [0],
      last_episode_to_air: { runtime: 0 },
    });
    expect(detail?.episodeRunTimeMinutes).toBeUndefined();
  });

  it('rend undefined quand aucune source ne donne de duree', () => {
    expect(mapSeriesDetail({ id: 1, name: 'x' })?.episodeRunTimeMinutes).toBeUndefined();
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

describe('createurs — le seul maillage interne, et il est factuel', () => {
  it('lit les credits de creation', () => {
    const detail = mapSeriesDetail({
      id: 1396,
      name: 'Breaking Bad',
      created_by: [{ id: 66633, name: 'Vince Gilligan', credit_id: 'x' }],
    });
    expect(detail?.creators).toEqual([{ providerId: '66633', name: 'Vince Gilligan' }]);
  });

  it('omet le champ quand personne n est credite', () => {
    // Frequent hors des series americaines : degrader sans bruit.
    expect(mapSeriesDetail({ id: 1, name: 'x' })?.creators).toBeUndefined();
    expect(mapSeriesDetail({ id: 1, name: 'x', created_by: [] })?.creators).toBeUndefined();
  });

  it('ecarte les credits inexploitables sans perdre les autres', () => {
    const detail = mapSeriesDetail({
      id: 1,
      name: 'x',
      created_by: [{ id: 1, name: 'A' }, { name: 'sans id' }, null, { id: 2 }],
    });
    expect(detail?.creators).toHaveLength(1);
  });

  it('fusionne crew et cast sans doublon dans les credits d une personne', () => {
    const series = mapPersonSeriesCredits({
      crew: [
        { id: 1, name: 'A', genre_ids: [18] },
        { id: 2, name: 'B', genre_ids: [18] },
      ],
      // La meme serie peut apparaitre des deux cotes : creee et jouee.
      cast: [{ id: 2, name: 'B', genre_ids: [18] }, { id: 3, name: 'C', genre_ids: [18] }],
    });
    expect(series.map((s) => s.providerId)).toEqual(['1', '2', '3']);
  });

  it('rend une liste vide pour une reponse malformee', () => {
    expect(mapPersonSeriesCredits(null)).toEqual([]);
    expect(mapPersonSeriesCredits({})).toEqual([]);
    expect(mapPersonSeriesCredits({ crew: 'pas un tableau' })).toEqual([]);
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

  it('mappe chaque liste de decouverte sur le bon endpoint', async () => {
    // Ces listes ne sont pas un ornement : sans elles, aucune page serie n'est
    // atteignable depuis une page indexable (audit du 2026-08-01).
    const seen: string[] = [];
    const provider = new TmdbProvider({
      accessToken: 'x',
      fetchImpl: (async (url: URL) => {
        seen.push(url.pathname);
        return new Response('{"results":[]}', { status: 200 });
      }) as unknown as typeof fetch,
    });

    await provider.discover('trending');
    await provider.discover('popular');
    await provider.discover('on_the_air');

    expect(seen).toEqual(['/3/trending/tv/week', '/3/tv/popular', '/3/tv/on_the_air']);
  });

  it('normalise le numero de page', async () => {
    let captured: URL | undefined;
    const provider = new TmdbProvider({
      accessToken: 'x',
      fetchImpl: (async (url: URL) => {
        captured = url;
        return new Response('{"results":[]}', { status: 200 });
      }) as unknown as typeof fetch,
    });

    await provider.discover('popular', 0);
    expect(captured?.searchParams.get('page')).toBe('1');

    await provider.discover('popular', 3.7);
    expect(captured?.searchParams.get('page')).toBe('3');
  });

  it('transmet les options de requete de l hote a chaque appel', async () => {
    // C'est ce qui branche le cache de donnees de Next. Sans lui, chaque visite
    // rejouait tous les appels TMDB — constate en production le 2026-08-02.
    const seen: RequestInit[] = [];
    const provider = new TmdbProvider({
      accessToken: 'x',
      requestInit: { next: { revalidate: 86_400 } } as RequestInit,
      fetchImpl: (async (_url: URL, init: RequestInit) => {
        seen.push(init);
        return new Response('{"results":[]}', { status: 200 });
      }) as unknown as typeof fetch,
    });

    await provider.search('x');
    await provider.discover('popular');

    expect(seen).toHaveLength(2);
    for (const init of seen) {
      expect((init as { next?: unknown }).next).toEqual({ revalidate: 86_400 });
      // Les en-tetes ne doivent pas avoir ete ecrasees au passage.
      expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer x');
    }
  });

  it('leve plutot que de rendre une fiche inexploitable', async () => {
    const provider = new TmdbProvider({
      accessToken: 'x',
      fetchImpl: (async () => new Response('{"nothing":true}', { status: 200 })) as unknown as typeof fetch,
    });

    await expect(provider.getSeries('999')).rejects.toThrow(/inexploitable/);
  });
});

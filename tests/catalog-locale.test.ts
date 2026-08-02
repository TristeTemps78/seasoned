import { afterEach, describe, expect, it } from 'vitest';
import {
  discover,
  getSeriesDetail,
  searchSeries,
  setProvider,
} from '../lib/catalog';
import type { CatalogProvider, SeriesDetail, SeriesSummary } from '../src/catalog/provider';

/**
 * La langue du catalogue suit celle de la page — verifie sur le **cache**, pas sur
 * l'intention.
 *
 * ## Ce que ce fichier attrape, et que rien d'autre ne pouvait voir
 *
 * `lib/catalog.ts` portait ce commentaire depuis le premier jour :
 *
 * > « La langue du catalogue doit suivre celle du site : servir une page anglaise avec
 * > des synopsis francais serait pire que ne pas traduire du tout. »
 *
 * Et le code lisait une variable d'environnement **globale**. Une seule langue de
 * metadonnees etait donc servie a tout le site : avec un `TMDB_LANGUAGE=fr-FR` oublie —
 * ce qui etait le cas — les pages **anglaises**, celles que les moteurs indexent,
 * recevaient des synopsis francais.
 *
 * Le typage ne pouvait rien voir : la valeur par defaut etait legale. Les tests non
 * plus : aucun ne demandait deux langues. C'est la quatrieme occurrence de la meme forme
 * d'echec dans ce projet — **le code peut etre juste et l'effet nul**.
 *
 * ## Pourquoi tester le cache et non la requete
 *
 * Le defaut le plus vicieux n'est pas la langue envoyee, c'est la **cle de cache**. Sans
 * la locale dedans, la premiere requete d'une serie fixe la langue de son synopsis pour
 * toutes les suivantes : `/serie/1396` et `/fr/serie/1396` se servent mutuellement leur
 * contenu **selon qui arrive en premier**. Un tel defaut ne se reproduit pas a la
 * demande, ne se voit pas en relisant le code, et disparait a chaque redemarrage.
 *
 * Compter les appels le rend visible en une ligne.
 */

function fake(): { provider: CatalogProvider; calls: string[] } {
  const calls: string[] = [];
  const summary = (id: string): SeriesSummary => ({ providerId: id, title: `S${id}` });
  const provider: CatalogProvider = {
    name: 'fake',
    async search(query) {
      calls.push(`search:${query}`);
      return [summary('1')];
    },
    async getSeries(providerId) {
      calls.push(`series:${providerId}`);
      return { providerId, title: 'X', seasons: [] } as unknown as SeriesDetail;
    },
    async getSeason(providerId, seasonNumber) {
      calls.push(`season:${providerId}:${seasonNumber}`);
      return { seasonNumber, episodes: [] } as never;
    },
    async discover(kind, page = 1) {
      calls.push(`discover:${kind}:${page}`);
      return [summary('1')];
    },
    async seriesByCreator(personId) {
      calls.push(`creator:${personId}`);
      return [];
    },
    async watchOptions() {
      return [];
    },
  } as CatalogProvider;
  return { provider, calls };
}

describe('la langue fait partie de la cle de cache', () => {
  afterEach(() => setProvider(undefined));

  it('une fiche serie est demandee une fois PAR LANGUE', async () => {
    const { provider, calls } = fake();
    setProvider(provider);

    await getSeriesDetail('1396', 'en');
    await getSeriesDetail('1396', 'fr');
    // Deux appels : sans la locale dans la cle, le second rendrait le contenu anglais
    // au lecteur francais — ou l'inverse, selon l'ordre des visites.
    expect(calls).toEqual(['series:1396', 'series:1396']);
  });

  it('la meme langue reste mise en cache', async () => {
    const { provider, calls } = fake();
    setProvider(provider);

    await getSeriesDetail('1396', 'fr');
    await getSeriesDetail('1396', 'fr');
    // Un seul appel : le cache est ce qui tient le budget, la separation par langue ne
    // doit pas le desactiver.
    expect(calls).toHaveLength(1);
  });

  it('vaut aussi pour la recherche et les listes de decouverte', async () => {
    const { provider, calls } = fake();
    setProvider(provider);

    await searchSeries('breaking bad', 'en');
    await searchSeries('breaking bad', 'fr');
    await discover('trending', 1, 'en');
    await discover('trending', 1, 'fr');
    expect(calls.filter((c) => c.startsWith('search'))).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith('discover'))).toHaveLength(2);
  });

  it('la langue par defaut du site est celle utilisee sans precision', async () => {
    const { provider, calls } = fake();
    setProvider(provider);

    await getSeriesDetail('1396');
    await getSeriesDetail('1396', 'en');
    // Un seul appel : omettre la locale doit viser la meme entree que `en`, sinon le
    // cache se dedouble silencieusement et le budget double avec lui.
    expect(calls).toHaveLength(1);
  });
});

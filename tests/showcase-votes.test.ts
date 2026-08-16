import { afterEach, describe, expect, it } from 'vitest';
import { discover, setProvider } from '../lib/catalog';
import type { CatalogProvider, SeriesSummary } from '../src/catalog/provider';

/**
 * La vitrine a un plancher d'assise — et il ne doit pas se defaire en silence.
 *
 * ## Le defaut, mesure contre la vraie API le 2026-08-13
 *
 * `tv/popular` chez TMDB classe par le trafic sur *leur* site, pas par la notoriete. Sur les
 * trois pages que ce produit sert, **la moitie des entrees avaient moins de 50 votes** :
 * « Hockey Psychology » (0) en page 1, « Capitao Furacao » (0) en page 3, « CITV Breakfast »
 * (0) en page 4 — des feuilletons regionaux, des journaux televises, de la telerealite.
 *
 * Ca se lisait le mieux sur la 404, seule page ou la promesse est ecrite : sous « celles que
 * tout le monde a vues » s'affichait « Caresser les tetons de mon ours hibernant », 7 votes.
 *
 * ## Pourquoi un test, alors que le filtre tient en une ligne
 *
 * Parce que la ligne est **invisible a l'usage** : sans elle, les rangees se remplissent
 * quand meme — d'autre chose. Aucun typage, aucun build et aucune capture ne distinguent une
 * vitrine choisie d'une vitrine subie ; il faut nommer le seuil quelque part pour que le
 * retirer coute un test rouge plutot qu'un haussement d'epaules.
 *
 * ⚠️ Le pendant du plancher est teste aussi : **une entree sans compte de votes passe**. Une
 * source qui ne porte pas le champ doit degrader vers « on montre », jamais vers « on vide » —
 * un ecran noir pour une donnee manquante est le patron de panne que ce depot traque depuis
 * `kind === undefined`.
 */

function providerOf(items: readonly SeriesSummary[]): CatalogProvider {
  return {
    name: 'fake',
    async search() {
      return [];
    },
    async getSeries(providerId) {
      return { providerId, title: 'X', seasons: [] } as never;
    },
    async getSeason(_id, seasonNumber) {
      return { seasonNumber, episodes: [] } as never;
    },
    async discover() {
      return items;
    },
    async browse() {
      return items;
    },
    async personName() {
      return undefined;
    },
    // ⚠️ Ajoutee au faux le 2026-08-16 avec la page de personne : un faux exhaustif est ce
    // qui garantit qu'une methode nouvelle ne passe pas inapercue dans les six autres.
    async personCredits() {
      return { cast: [], crew: [] };
    },
    async seriesByCreator() {
      return [];
    },
    async watchOptions() {
      return {};
    },
    async artwork() {
      return { posters: [], backdrops: [] };
    },
    async episodeGroups() {
      return [];
    },
  } as CatalogProvider;
}

const serie = (id: string, voteCount?: number): SeriesSummary => ({
  providerId: id,
  title: `S${id}`,
  // `scripted` et non « series » : c'est le vocabulaire de `ProgramKind`, et c'est la seule
  // valeur qui traverse `isShowcased` — sinon ce fichier testerait l'autre filtre.
  kind: 'scripted',
  ...(voteCount !== undefined ? { voteCount } : {}),
});

afterEach(() => {
  setProvider(undefined);
});

describe('le plancher d’assise de la vitrine', () => {
  it('ecarte ce que presque personne n’a note', async () => {
    setProvider(
      providerOf([
        serie('zero', 0),
        serie('sept', 7),
        serie('trenteHuit', 38),
        serie('cinquante', 50),
        serie('mille', 1000),
      ]),
    );

    // ⚠️ Les identifiants disent les valeurs mesurees sur la vraie API : 0 et 7 sont
    // « Hockey Psychology » et « Caresser les tetons de mon ours hibernant », 38 est
    // « Malhacao ». 50 est le seuil lui-meme, et il passe — la comparaison est inclusive.
    const kept = (await discover('popular', 1, 'fr')).map((s) => s.providerId);
    expect(kept).toEqual(['cinquante', 'mille']);
  });

  it('laisse passer une entree dont la source ne dit pas le compte', async () => {
    setProvider(providerOf([serie('sansCompte'), serie('faible', 3)]));

    const kept = (await discover('popular', 2, 'fr')).map((s) => s.providerId);
    expect(kept).toEqual(['sansCompte']);
  });

  it('ne vide pas une rangee : une page reelle en garde de quoi remplir un ecran', async () => {
    // La distribution mesuree en page 1 le 2026-08-13 : 10 entrees sous 50 sur 20. Les ecrans
    // qui consomment ces rangees en demandent 12 — d'ou trois pages, et d'ou ce garde-fou.
    // Si quelqu'un monte le seuil un jour, c'est ici qu'il verra ce que ca coute.
    const page = [
      ...Array.from({ length: 10 }, (_, i) => serie(`bruit${i}`, i * 4)),
      ...Array.from({ length: 10 }, (_, i) => serie(`connue${i}`, 200 + i)),
    ];
    setProvider(providerOf(page));

    expect((await discover('popular', 3, 'fr')).length).toBe(10);
  });
});

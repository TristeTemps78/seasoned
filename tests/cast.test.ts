import { expect, it } from 'vitest';
import { mapSeriesDetail } from '@/src/catalog/tmdb';

/**
 * Le generique, tel que TMDB le rend — et tel qu'il degrade.
 *
 * Ce que ces cas protegent n'est pas « le champ est lu » : c'est que **la forme
 * d'`aggregate_credits` n'est pas celle de `credits`**. Le personnage y vit sous `roles[]`,
 * pas dans un champ `character`. Une lecture ecrite pour `credits` rend douze visages sans un
 * seul nom de role, sans erreur et sans test rouge.
 */

/** Le minimum qu'exige `toSummary` — sans quoi `mapSeriesDetail` rend `undefined`. */
function serie(extra: Record<string, unknown>): Record<string, unknown> {
  return { id: 1396, name: 'Breaking Bad', ...extra };
}

function acteur(n: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: n,
    name: `Acteur ${n}`,
    profile_path: `/p${n}.jpg`,
    roles: [{ character: `Role ${n}` }],
    ...extra,
  };
}

it('lit le personnage sous roles[], la forme d aggregate_credits', () => {
  const detail = mapSeriesDetail(
    serie({ aggregate_credits: { cast: [acteur(1)] } }),
  );
  expect(detail?.cast?.[0]).toEqual({
    providerId: '1',
    name: 'Acteur 1',
    character: 'Role 1',
    profilePath: '/p1.jpg',
  });
});

it('garde le premier role quand un acteur en a joue plusieurs', () => {
  // Dix saisons, deux personnages : TMDB place le principal en tete. Les concatener rendrait
  // « Untel / Untel » sous un visage de 80 px.
  const detail = mapSeriesDetail(
    serie({
      aggregate_credits: {
        cast: [acteur(1, { roles: [{ character: 'Principal' }, { character: 'Jumeau' }] })],
      },
    }),
  );
  expect(detail?.cast?.[0]?.character).toBe('Principal');
});

it('borne a douze, quel que soit le generique servi', () => {
  // ⚠️ Le vrai cout : `aggregate_credits` rend le generique de toutes les saisons reunies,
  // soit plusieurs centaines de lignes sur un feuilleton. Sans borne, la fiche les porte
  // toutes dans son HTML.
  const cast = Array.from({ length: 400 }, (_, i) => acteur(i + 1));
  const detail = mapSeriesDetail(serie({ aggregate_credits: { cast } }));
  expect(detail?.cast).toHaveLength(12);
  expect(detail?.cast?.[0]?.providerId).toBe('1');
});

it('degrade sans bruit quand le personnage ou la photo manquent', () => {
  // Hors des series americaines, c'est le cas courant — pas l'exception. Refuser la ligne
  // viderait le generique des series qu'on connait le moins.
  const detail = mapSeriesDetail(
    serie({
      aggregate_credits: { cast: [{ id: 7, name: 'Sans rien' }] },
    }),
  );
  expect(detail?.cast?.[0]).toEqual({ providerId: '7', name: 'Sans rien' });
  expect(detail?.cast?.[0]).not.toHaveProperty('character');
  expect(detail?.cast?.[0]).not.toHaveProperty('profilePath');
});

it('ecarte les lignes sans identifiant ou sans nom', () => {
  const detail = mapSeriesDetail(
    serie({
      aggregate_credits: { cast: [{ name: 'Sans id' }, { id: 9 }, acteur(3)] },
    }),
  );
  expect(detail?.cast).toHaveLength(1);
  expect(detail?.cast?.[0]?.providerId).toBe('3');
});

it('n expose aucune cle cast quand il n y a pas de generique', () => {
  // Le composant se tait sur un tableau vide ; encore faut-il que la fiche n'affirme pas
  // posseder un generique vide — c'est la meme regle que `creators`.
  expect(mapSeriesDetail(serie({}))).not.toHaveProperty('cast');
  expect(mapSeriesDetail(serie({ aggregate_credits: { cast: [] } }))).not.toHaveProperty('cast');
});

it('ignore `credits`, qui ne porte que la derniere saison', () => {
  // ⚠️ Si cette garde tombe, le generique se met a oublier tout acteur parti avant la fin :
  // sur une serie de dix ans, on montre les arrivants et on cache les personnages
  // principaux. Le defaut est invisible — la page reste pleine de visages.
  const detail = mapSeriesDetail(
    serie({ credits: { cast: [{ id: 42, name: 'Derniere saison', character: 'X' }] } }),
  );
  expect(detail).not.toHaveProperty('cast');
});

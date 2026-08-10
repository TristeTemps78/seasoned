import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { artwork as lireArtwork, setProvider } from '../lib/catalog';
import type { CatalogProvider, SeriesArtwork } from '../src/catalog/provider';

/**
 * 🔴 **Huit caches declares, sept vides par `setProvider`.**
 *
 * Le commentaire de `setProvider` racontait deja deux oublis (`creatorCache`, `watchCache`)
 * et un troisieme evite de justesse (`groupingCache`), en prevenant :
 *
 * > *« Un cache oublie ici survit au changement de fournisseur : le double injecte par un
 * > test recoit alors la reponse du fournisseur PRECEDENT, ce qui fait passer un test qui
 * > devrait echouer — ou echouer un test selon l'ordre d'execution des fichiers, le pire
 * > des deux. »*
 *
 * Mesure du 2026-08-11 : `artworkCache`, ajoute le 2026-08-10 avec le choix d'affiche,
 * etait le **quatrieme** oubli. Celui-la meme que le commentaire annoncait.
 *
 * ⚠️ **La lecon n'est pas « il fallait mieux relire ».** Un avertissement, meme excellent,
 * ne tient pas une invariante — celui-ci a echoue une fois de plus apres l'avoir enoncee.
 * `enrole()` la tient : un cache non inscrit n'existe pas. Ce fichier verifie les deux
 * bouts — que le registre est reellement vide, et que personne ne contourne `enrole`.
 */

function fake(chemin: string): CatalogProvider {
  const rendu: SeriesArtwork = { posters: [chemin], backdrops: [] };
  return { artwork: async () => rendu } as unknown as CatalogProvider;
}

describe('changer de fournisseur vide TOUS les caches', () => {
  afterEach(() => setProvider(undefined));

  /**
   * Le scenario exact que le commentaire decrit : deux fournisseurs de suite, et le second
   * doit etre entendu. Sans `artworkCache.clear()`, la seconde lecture rendait l'affiche du
   * **premier** — un test vert pour la pire des raisons.
   */
  it('y compris celui des affiches, qui manquait', async () => {
    setProvider(fake('/premier.jpg'));
    const avant = await lireArtwork('1396');

    setProvider(fake('/second.jpg'));
    const apres = await lireArtwork('1396');

    expect(avant.posters[0]).toBe('/premier.jpg');
    expect(apres.posters[0]).toBe('/second.jpg');
  });

  /**
   * ⚠️ Le garde structurel. Le test ci-dessus prouve **le cache d'aujourd'hui** ; celui-ci
   * prouve **ceux de demain** — c'est-a-dire le seul des deux qui aurait evite les quatre
   * oublis. Un neuvieme cache cree sans `enrole` echoue ici, au moment ou on l'ecrit.
   */
  it('et aucun cache n echappe au registre', () => {
    const source = readFileSync('lib/catalog.ts', 'utf8');
    const crees = source.match(/new ExpiringCache</g) ?? [];
    const enroles = source.match(/enrole\(new ExpiringCache</g) ?? [];

    expect(crees.length).toBeGreaterThan(5);
    expect(enroles.length, 'un cache cree hors de `enrole` ne sera pas vide').toBe(
      crees.length,
    );
  });

  /** Et `setProvider` doit passer par le registre, pas par une liste recopiee. */
  it('setProvider vide le registre et non une enumeration', () => {
    const bloc = readFileSync('lib/catalog.ts', 'utf8')
      .split('export function setProvider')[1]
      ?.split('\n}')[0];

    expect(bloc).toContain('for (const cache of CACHES)');
    expect(bloc).not.toMatch(/\w+Cache\.clear\(\)/);
  });
});

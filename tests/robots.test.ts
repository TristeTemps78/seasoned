import { describe, expect, it } from 'vitest';
import robots from '../app/robots';
import { SUPPORTED_LOCALES } from '../lib/i18n';
import { pathIn } from '../lib/routes';

/**
 * Le fichier qui dirige le budget de crawl.
 *
 * Il avait l'air juste et ne couvrait que la moitie du site : la liste des chemins
 * interdits etait ecrite en dur, donc les declinaisons `/fr/…` restaient explorables
 * apres le routage par locale. Ce test existe pour qu'ajouter une troisieme langue ne
 * puisse pas rouvrir le trou en silence — c'est la seule facon de tenir une regle qui
 * depend d'une liste qui grandit.
 */
describe('robots.txt', () => {
  const rules = robots().rules;
  const disallow = Array.isArray(rules) ? [] : ((rules.disallow ?? []) as string[]);

  it.each(SUPPORTED_LOCALES)('exclut les pages vides en %s', (locale) => {
    for (const path of ['/recherche', '/moi', '/hors-ligne']) {
      expect(disallow).toContain(pathIn(path, locale));
    }
  });

  it('n’exclut PAS la page de reprise d’historique', () => {
    // C'est du contenu, et la seule page non-serie qui reponde a une intention de
    // recherche reelle — 26,4 millions de personnes ont perdu leur historique.
    for (const locale of SUPPORTED_LOCALES) {
      expect(disallow).not.toContain(pathIn('/convertir', locale));
    }
  });

  it('annonce le sitemap', () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

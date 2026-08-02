/**
 * Les adresses par langue.
 *
 * Ce fichier existe parce que `hreflang` echoue **en silence** : une declaration non
 * reciproque est ignoree par Google sans qu'aucune page ne casse, sans qu'aucun test de
 * rendu ne rougisse, et sans que rien ne se voie a l'ecran. C'est la troisieme fois que
 * le projet rencontre cette forme d'echec — le SEO en cul-de-sac, le cache inoperant — et
 * la lecon est ecrite : **auditer le resultat, jamais l'intention**.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localeTag } from '../lib/i18n';
import { alternatesFor, languageLinks, localePrefix, pathIn, seriesPath } from '../lib/routes';

describe('les prefixes', () => {
  it('ne prefixe pas la langue par defaut : les URL deja indexees ne bougent pas', () => {
    // C'est **la** contrainte de ce module. Si ce test tombe, toutes les adresses
    // publiees depuis le 2026-08-01 changent d'un coup.
    expect(localePrefix(DEFAULT_LOCALE)).toBe('');
    expect(seriesPath('1396')).toBe('/serie/1396');
    expect(seriesPath('1396', DEFAULT_LOCALE)).toBe('/serie/1396');
  });

  it('prefixe toutes les autres langues', () => {
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === DEFAULT_LOCALE) continue;
      expect(seriesPath('1396', locale)).toBe(`/${locale}/serie/1396`);
    }
  });

  it('ne fabrique jamais deux adresses pour la racine', () => {
    // `/fr` et `/fr/` sont deux URL pour une meme page, et un moteur peut les compter
    // deux fois — donc diluer le signal entre elles.
    expect(pathIn('/', DEFAULT_LOCALE)).toBe('/');
    for (const locale of SUPPORTED_LOCALES) {
      const home = pathIn('/', locale);
      expect(home.endsWith('/')).toBe(locale === DEFAULT_LOCALE);
    }
  });

  it('tolere un chemin sans barre initiale plutot que de coller les segments', () => {
    expect(pathIn('serie/42', DEFAULT_LOCALE)).toBe('/serie/42');
  });
});

describe('alternates — la reciprocite, qui est la seule chose qui compte', () => {
  it('chaque langue se declare elle-meme', () => {
    // L'auto-reference est ce qu'on oublie, parce qu'elle semble redondante. Sans elle,
    // Google ignore tout le bloc.
    for (const locale of SUPPORTED_LOCALES) {
      const { languages } = alternatesFor('/serie/1396', locale);
      expect(languages[localeTag(locale)]).toBe(seriesPath('1396', locale));
    }
  });

  it('chaque langue declare toutes les autres, dans les deux sens', () => {
    for (const from of SUPPORTED_LOCALES) {
      const { languages } = alternatesFor('/serie/1396', from);
      for (const to of SUPPORTED_LOCALES) {
        expect(languages[localeTag(to)], `${from} doit pointer vers ${to}`).toBe(
          seriesPath('1396', to),
        );
      }
    }
  });

  it('la reciprocite est vraie au sens strict : A→B implique B→A, avec la meme adresse', () => {
    // La formulation qui attrape le vrai defaut : deux blocs peuvent chacun contenir la
    // bonne cle et pointer vers deux adresses differentes.
    for (const a of SUPPORTED_LOCALES) {
      for (const b of SUPPORTED_LOCALES) {
        const fromA = alternatesFor('/serie/1396', a).languages[localeTag(b)];
        const fromB = alternatesFor('/serie/1396', b).languages[localeTag(b)];
        expect(fromA).toBe(fromB);
      }
    }
  });

  it('declare un x-default, et c est la langue par defaut', () => {
    const { languages } = alternatesFor('/serie/1396', 'fr');
    expect(languages['x-default']).toBe(seriesPath('1396', DEFAULT_LOCALE));
  });

  it('la canonique est celle de la page servie, pas celle du defaut', () => {
    // Erreur classique et couteuse : pointer toutes les canoniques vers l'anglais
    // reviendrait a demander la desindexation de toutes les pages francaises.
    expect(alternatesFor('/serie/1396', 'fr').canonical).toBe('/fr/serie/1396');
    expect(alternatesFor('/serie/1396', DEFAULT_LOCALE).canonical).toBe('/serie/1396');
  });

  it('marche aussi pour l accueil', () => {
    const { canonical, languages } = alternatesFor('/', 'fr');
    expect(canonical).toBe('/fr');
    expect(languages['x-default']).toBe('/');
  });
});

describe('languageLinks — le selecteur', () => {
  it('montre toutes les langues, la courante comprise', () => {
    // Un selecteur qui masque la langue en cours ne dit pas dans quelle langue on est.
    const links = languageLinks('/serie/1396', 'fr');
    expect(links).toHaveLength(SUPPORTED_LOCALES.length);
    expect(links.filter((l) => l.current)).toHaveLength(1);
    expect(links.find((l) => l.current)?.locale).toBe('fr');
  });

  it('garde la page : changer de langue ne renvoie pas a l accueil', () => {
    // Perdre la page en changeant de langue est la petite trahison la plus courante des
    // sites multilingues.
    for (const link of languageLinks('/serie/1396', DEFAULT_LOCALE)) {
      expect(link.href).toContain('/serie/1396');
    }
  });
});

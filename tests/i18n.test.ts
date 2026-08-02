import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  formatDateIn,
  isLocale,
  localeTag,
  negotiateLocale,
  t,
  watchRegion,
} from '../lib/i18n';

describe('negotiateLocale — tolerant par principe', () => {
  it('rend la langue par defaut sur une entree absente ou vide', () => {
    expect(negotiateLocale(null)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('')).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('   ')).toBe(DEFAULT_LOCALE);
  });

  it('rend la langue par defaut plutot qu une erreur sur une entree exotique', () => {
    expect(negotiateLocale('nawak;;;q=')).toBe(DEFAULT_LOCALE);
    expect(negotiateLocale('*')).toBe(DEFAULT_LOCALE);
  });

  it('ignore le pays : ce qui compte est la langue', () => {
    expect(negotiateLocale('fr-CA')).toBe('fr');
    expect(negotiateLocale('en-GB,en;q=0.9')).toBe('en');
  });

  it('respecte l ordre de preference plutot que l ordre d apparition', () => {
    expect(negotiateLocale('de;q=1.0,en;q=0.8,fr;q=0.9')).toBe('fr');
  });

  it('saute les langues qu on ne sert pas au lieu de s y arreter', () => {
    expect(negotiateLocale('ja,ko,en')).toBe('en');
  });

  it('ignore une langue explicitement refusee (q=0)', () => {
    expect(negotiateLocale('en;q=0,fr;q=0.5')).toBe('fr');
  });
});

describe('les tables de langue sont completes', () => {
  it('chaque langue servie a une etiquette et une region de repli', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(localeTag(locale)).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(watchRegion(locale)).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('reconnait les langues servies, et rejette les autres', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('kl')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('t — une traduction manquante ne casse jamais l affichage', () => {
  it('traduit dans chaque langue servie, sans jamais rendre la cle nue', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const text = t(locale, 'safety.title');
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('safety.');
    }
  });

  it('dit bien deux choses differentes dans deux langues differentes', () => {
    expect(t('fr', 'safety.later')).not.toBe(t('en', 'safety.later'));
  });
});

describe('formatDateIn — la date suit la langue, jamais le fuseau du serveur', () => {
  const DATE = new Date('2026-03-09T23:30:00Z');

  it('formate dans la langue demandee', () => {
    expect(formatDateIn(DATE, 'fr')).toContain('mars');
    expect(formatDateIn(DATE, 'en')).toContain('March');
  });

  it('reste en UTC : la meme date ne change pas de jour selon la machine', () => {
    // 23h30 UTC est deja le lendemain a Tokyo. Un formatage en heure locale ferait
    // afficher deux dates differentes pour un meme fait, selon qui rend la page.
    expect(formatDateIn(DATE, 'fr')).toContain('9');
    expect(formatDateIn(DATE, 'en')).toContain('9');
  });
});

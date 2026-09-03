import { afterEach, describe, expect, it } from 'vitest';
import { shareInk } from '@/app/components/shareInk';

const variables = [
  '--color-ink',
  '--color-text',
  '--color-muted',
  '--color-surface',
  '--color-volt',
  '--color-warn',
] as const;

afterEach(() => {
  for (const variable of variables) {
    document.documentElement.style.removeProperty(variable);
  }
});

describe('la charte des images partagees', () => {
  it('lit les six encres depuis les variables CSS', () => {
    const values = ['#010101', '#020202', '#030303', '#040404', '#050505', '#060606'];

    variables.forEach((variable, index) => {
      document.documentElement.style.setProperty(variable, values[index] ?? '');
    });

    expect(shareInk()).toEqual({
      ink: '#010101',
      text: '#020202',
      muted: '#030303',
      surface: '#040404',
      volt: '#050505',
      warn: '#060606',
    });
  });

  it('garde un repli lisible quand la feuille ne fournit aucune valeur', () => {
    expect(shareInk()).toEqual({
      ink: '#14181c',
      text: '#ddeeff',
      muted: '#99aabb',
      surface: '#2c3440',
      volt: '#00e054',
      warn: '#fbbf24',
    });
  });
});

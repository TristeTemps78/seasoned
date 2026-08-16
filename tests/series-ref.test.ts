import { describe, expect, it } from 'vitest';
import { resolveSeriesRef } from '@/app/components/seriesRef';
import { EMPTY_JOURNAL, journalKey } from '@/src/domain/journal';
import type { Journal } from '@/src/domain/journal';

/**
 * Sous quel nom une serie rangee dans une liste s'affiche.
 *
 * ## 🔴 Le defaut que ce fichier garde, mesure au navigateur le 2026-08-16
 *
 * Les trois rendus de listes resolvaient le titre depuis le journal **du lecteur**. Une
 * liste faite de series qu'il ne suit pas — *c'est-a-dire toute liste qu'on decouvre* —
 * s'affichait donc comme quatre fois « Tracked series » et quatre monogrammes, sur la
 * surface dont la decouverte est la seule raison d'etre.
 *
 * ⚠️ Ce sont trois cas, pas trois variantes du meme : **l'ordre** entre eux est la
 * correction. Un test qui ne verifierait que le premier laisserait revenir exactement le
 * defaut d'origine le jour ou quelqu'un remettrait le journal devant.
 */

const BB = journalKey('1396');

function journalWith(title: string, posterPath?: string): Journal {
  return {
    ...EMPTY_JOURNAL,
    entries: {
      [BB]: {
        ...EMPTY_JOURNAL.entries[BB],
        snapshot: {
          title,
          ...(posterPath !== undefined ? { posterPath } : {}),
          cachedAt: '2026-08-16T10:00:00Z',
        },
      },
    },
  } as Journal;
}

describe('le titre d une serie rangee dans une liste', () => {
  it('🔴 vient de la ligne, meme quand le lecteur ne connait pas la serie', () => {
    // Le cas exact du defaut : journal vide, liste de quelqu'un d'autre.
    const { title, posterPath } = resolveSeriesRef(
      { subject: BB, title: 'Breaking Bad', posterPath: '/bb.jpg' },
      EMPTY_JOURNAL,
      'Tracked series',
    );

    expect(title).toBe('Breaking Bad');
    expect(posterPath).toBe('/bb.jpg');
  });

  it('l instantane de la ligne passe DEVANT celui du lecteur', () => {
    // Ce n'est pas un detail d'ordre : la ligne porte le titre tel que la personne l'avait
    // sous les yeux en rangeant la serie, et c'est ce qu'une liste montre. Le journal du
    // lecteur peut porter un titre plus recent, ou dans une autre langue.
    const { title } = resolveSeriesRef(
      { subject: BB, title: 'Breaking Bad' },
      journalWith('Breaking Bad (2008)'),
      'Tracked series',
    );

    expect(title).toBe('Breaking Bad');
  });

  it('retombe sur le journal du lecteur pour le fond d avant 020', () => {
    // `addToList` ecrit en `ignore-duplicates` : les elements ranges avant le 2026-08-16
    // n'ont pas d'instantane et n'en auront jamais. Chez soi, le journal comble.
    const { title, posterPath } = resolveSeriesRef(
      { subject: BB },
      journalWith('Breaking Bad', '/local.jpg'),
      'Tracked series',
    );

    expect(title).toBe('Breaking Bad');
    expect(posterPath).toBe('/local.jpg');
  });

  it('ne nomme rien quand personne ne sait', () => {
    const { title, posterPath } = resolveSeriesRef({ subject: BB }, EMPTY_JOURNAL, 'Tracked series');

    expect(title).toBe('Tracked series');
    expect(posterPath).toBeUndefined();
  });

  it('le titre et l affiche se replient separement', () => {
    // Une ligne peut porter un titre sans affiche (`poster_path` est nullable), et le
    // lecteur peut avoir l'affiche d'une serie dont la ligne ne porte que le nom.
    const { title, posterPath } = resolveSeriesRef(
      { subject: BB, title: 'Breaking Bad' },
      journalWith('Autre chose', '/local.jpg'),
      'Tracked series',
    );

    expect(title).toBe('Breaking Bad');
    expect(posterPath).toBe('/local.jpg');
  });
});

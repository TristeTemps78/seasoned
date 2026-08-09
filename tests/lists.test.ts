import { describe, expect, it } from 'vitest';
import { checkList, listSlug, LIST_TITLE_MAX, uniqueSlug } from '../src/domain/lists';

/** Le motif exact de `supabase/007_lists.sql`. Ce que le domaine rend doit le satisfaire. */
const SQL_SLUG = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;

describe('listSlug', () => {
  it('depose les accents au lieu de les jeter', () => {
    // Sans NFD, « Séries françaises » donnerait `sries-franaises` : un titre francais sur
    // deux produirait une URL illisible. C'est aussi ce test qui prouve que la classe de
    // diacritiques a survecu a l'encodage du fichier source.
    expect(listSlug('Séries françaises')).toBe('series-francaises');
    expect(listSlug('À revoir — l’été')).toBe('a-revoir-l-ete');
  });

  it('rend toujours quelque chose que la base accepte', () => {
    for (const title of [
      'Mes favoris',
      '  espaces  autour  ',
      'Ponctuation !!! ??? ...',
      'a'.repeat(LIST_TITLE_MAX),
      // Une coupe a 60 qui tomberait sur un tiret : le motif SQL refuse un tiret final.
      `${'x'.repeat(59)} suite`,
    ]) {
      expect(listSlug(title)).toMatch(SQL_SLUG);
    }
  });
});

describe('checkList', () => {
  it('refuse un titre dont il ne reste rien', () => {
    // 🔴 Le cas qui casserait l'insertion sans ce refus : un titre entierement fait
    // d'emoji rend un slug vide, que le `check` SQL rejette avec une erreur de contrainte
    // que l'interface ne saurait pas expliquer. On signale, on ne rafistole pas.
    expect(checkList('🎬🎬🎬')).toEqual({ ok: false, reason: 'unusable_title' });
    expect(checkList('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkList('a'.repeat(LIST_TITLE_MAX + 1))).toEqual({ ok: false, reason: 'too_long' });
  });

  it('garde le titre tel quel et n’en derive que l’URL', () => {
    const out = checkList('  Les séries qui font pleurer  ');
    expect(out).toEqual({
      ok: true,
      title: 'Les séries qui font pleurer',
      slug: 'les-series-qui-font-pleurer',
    });
  });

  it('ignore une note vide plutot que d’ecrire une chaine vide', () => {
    // Le `check` SQL exige `length(note) between 1 and 500` : une chaine vide serait
    // refusee par la base alors que l'utilisateur n'a simplement rien ecrit.
    expect(checkList('Titre', '   ')).toEqual({ ok: true, title: 'Titre', slug: 'titre' });
  });
});

describe('uniqueSlug', () => {
  it('suffixe plutot que d’ecraser une liste existante', () => {
    // La cle naturelle est `(user_id, slug)` : sans suffixe, une deuxieme « Mes favoris »
    // entrerait en conflit avec la premiere — ou pire, l'ecraserait par un upsert.
    expect(uniqueSlug('mes-favoris', new Set())).toBe('mes-favoris');
    expect(uniqueSlug('mes-favoris', new Set(['mes-favoris']))).toBe('mes-favoris-2');
    expect(uniqueSlug('mes-favoris', new Set(['mes-favoris', 'mes-favoris-2']))).toBe(
      'mes-favoris-3',
    );
  });

  it('reste dans les bornes de la base meme sur un titre long', () => {
    const long = listSlug('x'.repeat(80));
    expect(uniqueSlug(long, new Set([long]))).toMatch(SQL_SLUG);
  });
});

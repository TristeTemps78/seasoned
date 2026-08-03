import { describe, expect, it } from 'vitest';
import {
  checkHandle,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  MINIMUM_AGE,
  RESERVED_HANDLES,
} from '../src/domain/handles';

describe('checkHandle — ce qu on accepte', () => {
  it('accepte un handle ordinaire et le canonise', () => {
    expect(checkHandle('  Marie_78  ')).toEqual({ ok: true, handle: 'marie_78' });
  });

  it('deux ecritures qui se lisent pareil donnent le meme handle', () => {
    // Sans cela, `Marie` et `marie` seraient deux comptes distincts et
    // indistinguables a l'oeil — la definition meme de l'usurpation.
    const a = checkHandle('Marie');
    const b = checkHandle('mArIe ');
    expect(a).toEqual(b);
  });
});

describe('checkHandle — ce qu on refuse, et pourquoi', () => {
  it('refuse trop court et trop long', () => {
    expect(checkHandle('ab')).toEqual({ ok: false, reason: 'too_short' });
    expect(checkHandle('a'.repeat(HANDLE_MAX_LENGTH + 1))).toEqual({
      ok: false,
      reason: 'too_long',
    });
    expect(checkHandle('a'.repeat(HANDLE_MIN_LENGTH)).ok).toBe(true);
    expect(checkHandle('a'.repeat(HANDLE_MAX_LENGTH)).ok).toBe(true);
  });

  it('⚠️ refuse les homoglyphes, qui rendent l usurpation invisible', () => {
    // `а` cyrillique et `a` latin sont indiscernables a l'ecran. Autoriser l'Unicode
    // rendrait `@nеtflix` impossible a distinguer de `@netflix` pour un humain.
    expect(checkHandle('nеtflix')).toEqual({ ok: false, reason: 'invalid_characters' });
    expect(checkHandle('mariе')).toEqual({ ok: false, reason: 'invalid_characters' });
  });

  it('refuse les separateurs et la ponctuation', () => {
    for (const bad of ['ma rie', 'marie-78', 'marie.78', 'marie/78', 'marie@x', '../etc']) {
      expect(checkHandle(bad).ok).toBe(false);
    }
  });

  it('dit « trop court » avant « caracteres invalides »', () => {
    // L'ordre des controles est un choix d'ergonomie : a quelqu'un qui a tape deux
    // caracteres, la longueur est l'information utile.
    expect(checkHandle('é')).toEqual({ ok: false, reason: 'too_short' });
  });

  it('refuse les mots reserves, quelle que soit la casse', () => {
    for (const reserved of ['admin', 'ADMIN', 'Support', 'netflix', 'moi', 'voltface']) {
      expect(checkHandle(reserved)).toEqual({ ok: false, reason: 'reserved' });
    }
  });

  it('refuse un handle deja pris, ou libere', () => {
    // Libere n'est pas disponible : son repreneur heriterait des liens partages de son
    // ancien proprietaire.
    expect(checkHandle('marie', new Set(['marie']))).toEqual({
      ok: false,
      reason: 'reserved',
    });
  });
});

describe('la liste de reserves couvre ce qui casserait quelque chose', () => {
  it('contient toutes les routes existantes du site', () => {
    // Un profil qui masque une page — ou l'inverse — est un defaut qu'on ne peut plus
    // reparer une fois le handle attribue.
    // `hors-ligne` est volontairement absent : son tiret le rend impossible comme
    // handle, donc le reserver serait du bruit — voir le test « entrees valides ».
    for (const route of [
      'moi', 'serie', 'recherche', 'convertir', 'calendrier', 'bilan',
    ]) {
      expect(RESERVED_HANDLES.has(route)).toBe(true);
    }
  });

  it('contient les faces a venir, avant qu elles existent', () => {
    // C'est tout l'interet d'ecrire cette liste maintenant : `listes` et `amis` n'ont
    // pas encore d'ecran, et doivent deja etre indisponibles.
    for (const future of ['listes', 'amis', 'lists', 'friends']) {
      expect(RESERVED_HANDLES.has(future)).toBe(true);
    }
  });

  it('contient les mots d autorite', () => {
    for (const authority of ['admin', 'support', 'staff', 'official', 'moderation']) {
      expect(RESERVED_HANDLES.has(authority)).toBe(true);
    }
  });

  it('ne contient que des entrees valides selon ses propres regles', () => {
    // Une reserve qu'aucun handle ne pourrait prendre de toute facon est du bruit :
    // elle laisse croire a une protection qui n'a jamais servi.
    for (const reserved of RESERVED_HANDLES) {
      expect(reserved).toBe(reserved.toLowerCase().trim());
      expect(reserved.length).toBeGreaterThanOrEqual(HANDLE_MIN_LENGTH);
    }
  });
});

describe('l age minimum', () => {
  it('retient le seuil le plus eleve du RGPD', () => {
    // Seize ans vaut partout ou le produit est servi ; quinze (France) ne vaudrait que
    // la ou l'Etat l'a abaisse. Pour un produit international, le plus eleve est le
    // seul qui ne demande pas de logique par pays.
    expect(MINIMUM_AGE).toBe(16);
  });
});

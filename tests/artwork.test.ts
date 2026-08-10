import { describe, expect, it } from 'vitest';

import { mapArtwork } from '../src/catalog/tmdb';
import {
  EMPTY_JOURNAL,
  journalKey,
  mergeJournals,
  parseJournal,
  serializeJournal,
  setArtwork,
} from '../src/domain/journal';

const BB = journalKey('1396');

/** Forme reelle de `/tv/{id}/images`. */
const FIXTURE = {
  posters: [{ file_path: '/a.jpg' }, { file_path: '/b.jpg' }, { file_path: null }, {}],
  backdrops: [{ file_path: '/wide.jpg' }],
};

describe('mapArtwork', () => {
  it('ancrage — lit les deux listes', () => {
    const out = mapArtwork(FIXTURE);
    expect(out.posters).toEqual(['/a.jpg', '/b.jpg']);
    expect(out.backdrops).toEqual(['/wide.jpg']);
  });

  it('ecarte les entrees sans chemin plutot que de lever', () => {
    expect(mapArtwork({ posters: [{}, { file_path: 42 }] }).posters).toEqual([]);
  });

  it('degrade en listes vides sur n importe quoi', () => {
    expect(mapArtwork(undefined)).toEqual({ posters: [], backdrops: [] });
    expect(mapArtwork('bonjour')).toEqual({ posters: [], backdrops: [] });
  });

  it('dedoublonne', () => {
    const out = mapArtwork({ posters: [{ file_path: '/a.jpg' }, { file_path: '/a.jpg' }] });
    expect(out.posters).toEqual(['/a.jpg']);
  });

  /** TMDB en rend parfois plusieurs centaines : les servir toutes alourdirait la page. */
  it('borne a douze', () => {
    const many = { posters: Array.from({ length: 40 }, (_, i) => ({ file_path: `/${i}.jpg` })) };
    expect(mapArtwork(many).posters).toHaveLength(12);
  });
});

describe('setArtwork', () => {
  it('ancrage — pose l affiche choisie', () => {
    expect(setArtwork(EMPTY_JOURNAL, BB, 'poster', '/choisie.jpg').entries[BB]?.poster).toBe(
      '/choisie.jpg',
    );
  });

  /**
   * ⚠️ Contrairement a `setSnapshot`, il CREE l'entree : choisir une affiche est un geste
   * explicite, et preparer sa bibliotheque avant de regarder est un usage.
   */
  it('cree l entree si elle n existe pas', () => {
    expect(Object.keys(setArtwork(EMPTY_JOURNAL, BB, 'poster', '/x.jpg').entries)).toEqual([BB]);
  });

  it('retire le choix avec `undefined`', () => {
    const avec = setArtwork(EMPTY_JOURNAL, BB, 'poster', '/x.jpg');
    expect(setArtwork(avec, BB, 'poster', undefined).entries[BB]?.poster).toBeUndefined();
  });

  /** Une URL complete vieillirait mal : le CDN peut changer de forme. */
  it('refuse ce qui n est pas un chemin TMDB', () => {
    const out = setArtwork(EMPTY_JOURNAL, BB, 'poster', 'https://ailleurs.example/x.jpg');
    expect(out.entries[BB]?.poster).toBeUndefined();
  });

  it('affiche et banniere ne se marchent pas dessus', () => {
    let j = setArtwork(EMPTY_JOURNAL, BB, 'poster', '/p.jpg');
    j = setArtwork(j, BB, 'backdrop', '/b.jpg');
    expect(j.entries[BB]?.poster).toBe('/p.jpg');
    expect(j.entries[BB]?.backdrop).toBe('/b.jpg');
  });
});

/** 🔴 Sans relecture dans `parseJournal`, le choix disparait a la sauvegarde suivante. */
describe('le choix survit a un aller-retour', () => {
  it('serialise puis relit', () => {
    let j = setArtwork(EMPTY_JOURNAL, BB, 'poster', '/p.jpg');
    j = setArtwork(j, BB, 'backdrop', '/b.jpg');
    const relu = parseJournal(serializeJournal(j)).entries[BB];
    expect(relu?.poster).toBe('/p.jpg');
    expect(relu?.backdrop).toBe('/b.jpg');
  });

  it('ecarte a la lecture ce qui n est pas un chemin', () => {
    const brut = JSON.stringify({
      version: 4,
      entries: { [BB]: { poster: 'https://ailleurs.example/x.jpg', liked: { at: '2026-01-01' } } },
    });
    expect(parseJournal(brut).entries[BB]?.poster).toBeUndefined();
  });
});

/** ⚠️ Sans union a la fusion, un second appareil effacerait une affiche choisie a la main. */
describe('la fusion garde le choix', () => {
  it('garde celui qui existe', () => {
    const a = setArtwork(EMPTY_JOURNAL, BB, 'poster', '/p.jpg');
    const vide = setArtwork(EMPTY_JOURNAL, BB, 'backdrop', '/autre.jpg');
    expect(mergeJournals(a, vide).entries[BB]?.poster).toBe('/p.jpg');
    expect(mergeJournals(vide, a).entries[BB]?.poster).toBe('/p.jpg');
  });

  it('a egalite, le journal local gagne — comme pour deviceId', () => {
    const a = setArtwork(EMPTY_JOURNAL, BB, 'poster', '/local.jpg');
    const b = setArtwork(EMPTY_JOURNAL, BB, 'poster', '/distant.jpg');
    expect(mergeJournals(a, b).entries[BB]?.poster).toBe('/local.jpg');
  });
});

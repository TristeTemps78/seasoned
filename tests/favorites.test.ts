import { describe, expect, it } from 'vitest';
import {
  EMPTY_JOURNAL,
  JOURNAL_VERSION,
  MAX_FAVORITES,
  favoritesOf,
  mergeJournals,
  parseJournal,
  serializeJournal,
  setFavorites,
  setWanted,
  toggleFavorite,
} from '../src/domain/journal';

/**
 * La carte de visite — quatre series epinglees.
 *
 * ## Ce que ces tests protegent
 *
 * Deux choses, et la seconde est la seule qui ne se rattrape pas :
 *
 *   1. **le plafond et l'ordre.** L'ordre est celui de la personne : c'est sa carte de
 *      visite, la premiere affiche est la premiere. `setPlatforms`, juste a cote dans
 *      `write.ts`, trie — et recopier ce tri ici reordonnerait le choix de quelqu'un a
 *      chaque sauvegarde, en silence ;
 *   2. **la fusion, qui n'est PAS une union.** Les deux autres listes du document
 *      (`platforms`, `regions`) fusionnent par union, et c'est correct pour elles. Ici
 *      l'union ferait revenir la serie qu'on vient de decrocher sur l'autre appareil, et
 *      depasserait quatre. Le defaut serait invisible sur un seul appareil.
 */

const BB = 'tmdb:1396';
const GOT = 'tmdb:1399';
const DEXTER = 'tmdb:1405';
const FRIENDS = 'tmdb:1668';
const OFFICE = 'tmdb:2316';

const TOT = new Date('2026-01-01T10:00:00.000Z');
const TARD = new Date('2026-06-01T10:00:00.000Z');

describe('setFavorites', () => {
  it('un journal vierge n en porte aucune', () => {
    expect(favoritesOf(EMPTY_JOURNAL)).toEqual([]);
  });

  it('preserve l ordre demande, sans le trier', () => {
    // 🔴 L'ancrage principal : `setPlatforms` trie, et ce test echoue si quelqu'un recopie
    // ce reflexe ici. Trois cles dont l'ordre alphabetique differe de l'ordre demande.
    const j = setFavorites(EMPTY_JOURNAL, [GOT, BB, DEXTER], TOT);

    expect(favoritesOf(j)).toEqual([GOT, BB, DEXTER]);
  });

  it('deduplique — la meme serie deux fois volerait un emplacement', () => {
    const j = setFavorites(EMPTY_JOURNAL, [BB, GOT, BB], TOT);

    expect(favoritesOf(j)).toEqual([BB, GOT]);
  });

  it('tronque au plafond, en gardant les premieres', () => {
    const j = setFavorites(EMPTY_JOURNAL, [BB, GOT, DEXTER, FRIENDS, OFFICE], TOT);

    expect(favoritesOf(j)).toHaveLength(MAX_FAVORITES);
    expect(favoritesOf(j)).toEqual([BB, GOT, DEXTER, FRIENDS]);
  });

  it('une liste vide retire le champ au lieu d ecrire un choix vide', () => {
    const j = setFavorites(setFavorites(EMPTY_JOURNAL, [BB], TOT), [], TARD);

    expect(j.favorites).toBeUndefined();
    expect(favoritesOf(j)).toEqual([]);
  });

  it('date le choix — c est ce qui rend la fusion possible', () => {
    const j = setFavorites(EMPTY_JOURNAL, [BB], TOT);

    expect(j.favorites?.at).toBe(TOT.toISOString());
  });
});

describe('toggleFavorite', () => {
  it('epingle une serie absente', () => {
    expect(favoritesOf(toggleFavorite(EMPTY_JOURNAL, BB, TOT))).toEqual([BB]);
  });

  it('decroche une serie deja epinglee, sans deranger les autres', () => {
    let j = setFavorites(EMPTY_JOURNAL, [BB, GOT, DEXTER], TOT);
    j = toggleFavorite(j, GOT, TARD);

    expect(favoritesOf(j)).toEqual([BB, DEXTER]);
  });

  it('ajoute a la fin', () => {
    let j = setFavorites(EMPTY_JOURNAL, [BB], TOT);
    j = toggleFavorite(j, GOT, TARD);

    expect(favoritesOf(j)).toEqual([BB, GOT]);
  });

  it('rend le journal INCHANGE au-dela du plafond', () => {
    // ⚠️ Inchange par identite, pas seulement equivalent : c'est ce qui permet a
    // l'interface de savoir qu'elle doit avoir cesse de proposer le geste, et c'est ce
    // qu'un rendu React lit pour ne pas se relancer pour rien.
    const plein = setFavorites(EMPTY_JOURNAL, [BB, GOT, DEXTER, FRIENDS], TOT);

    expect(toggleFavorite(plein, OFFICE, TARD)).toBe(plein);
  });

  it('l ancrage : sous le plafond, la cinquieme entrerait bien', () => {
    const troisSeulement = setFavorites(EMPTY_JOURNAL, [BB, GOT, DEXTER], TOT);

    expect(favoritesOf(toggleFavorite(troisSeulement, OFFICE, TARD))).toHaveLength(4);
  });

  it('decrocher la derniere retire le champ', () => {
    const j = toggleFavorite(setFavorites(EMPTY_JOURNAL, [BB], TOT), BB, TARD);

    expect(j.favorites).toBeUndefined();
  });
});

describe('la fusion', () => {
  it('le choix le plus recent gagne EN ENTIER', () => {
    const ancien = setFavorites(EMPTY_JOURNAL, [BB, GOT, DEXTER], TOT);
    const recent = setFavorites(EMPTY_JOURNAL, [FRIENDS], TARD);

    expect(favoritesOf(mergeJournals(ancien, recent))).toEqual([FRIENDS]);
  });

  it('n est PAS une union — decrocher sur un appareil ne revient pas par l autre', () => {
    // 🔴 Le defaut que ce test existe pour empecher. `platforms` et `regions` fusionnent
    // par union, et copier cette regle ici ressusciterait la serie qu'on vient de retirer.
    const avant = setFavorites(EMPTY_JOURNAL, [BB, GOT], TOT);
    const apresRetrait = setFavorites(EMPTY_JOURNAL, [BB], TARD);

    expect(favoritesOf(mergeJournals(avant, apresRetrait))).toEqual([BB]);
  });

  it('est commutative', () => {
    const a = setFavorites(EMPTY_JOURNAL, [BB, GOT], TOT);
    const b = setFavorites(EMPTY_JOURNAL, [DEXTER], TARD);

    expect(favoritesOf(mergeJournals(a, b))).toEqual(favoritesOf(mergeJournals(b, a)));
  });

  it('a egalite de date, tranche par le contenu et non par l ordre des arguments', () => {
    // Le battement infini que `merge.ts` raconte pour `announcedFace` : deux appareils qui
    // se renvoient leurs journaux sans jamais converger. Le verdict doit etre le meme des
    // deux cotes, quel que soit le sens de l'appel.
    const a = setFavorites(EMPTY_JOURNAL, [BB], TOT);
    const b = setFavorites(EMPTY_JOURNAL, [GOT], TOT);

    expect(favoritesOf(mergeJournals(a, b))).toEqual(favoritesOf(mergeJournals(b, a)));
  });

  it('un cote sans favoris laisse ceux de l autre', () => {
    const avec = setFavorites(EMPTY_JOURNAL, [BB], TOT);
    const sans = setWanted(EMPTY_JOURNAL, GOT, true, TARD);

    expect(favoritesOf(mergeJournals(avec, sans))).toEqual([BB]);
    expect(favoritesOf(mergeJournals(sans, avec))).toEqual([BB]);
  });
});

describe('la lecture et l ecriture du document', () => {
  it('survit a un aller-retour', () => {
    const j = setFavorites(EMPTY_JOURNAL, [GOT, BB], TOT);

    expect(favoritesOf(parseJournal(serializeJournal(j)))).toEqual([GOT, BB]);
  });

  it('🔴 est RELU — sans quoi le champ serait efface a la premiere sauvegarde', () => {
    // Le defaut de 10.4bis, mot pour mot : un champ ecrit mais non relu disparait au
    // premier enregistrement. La personne verrait sa carte de visite se vider seule.
    const raw = serializeJournal(setFavorites(EMPTY_JOURNAL, [BB, GOT], TOT));
    const relu = parseJournal(raw);

    expect(favoritesOf(parseJournal(serializeJournal(relu)))).toEqual([BB, GOT]);
  });

  it('ecarte un choix sans date lisible', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      favorites: { keys: [BB], at: 'pas-une-date' },
      entries: {},
    });

    expect(favoritesOf(parseJournal(raw))).toEqual([]);
  });

  it('ecarte un choix dont les cles ne sont pas un tableau', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      favorites: { keys: BB, at: TOT.toISOString() },
      entries: {},
    });

    expect(favoritesOf(parseJournal(raw))).toEqual([]);
  });

  it('tronque un document ecrit par une version plus permissive', () => {
    // Une version future qui en accepterait six ne doit pas faire deborder la rangee ici.
    const raw = JSON.stringify({
      version: JOURNAL_VERSION + 1,
      favorites: { keys: [BB, GOT, DEXTER, FRIENDS, OFFICE, 'tmdb:9'], at: TOT.toISOString() },
      entries: {},
    });

    expect(favoritesOf(parseJournal(raw))).toHaveLength(MAX_FAVORITES);
  });

  it('ignore les cles vides sans jeter le reste', () => {
    const raw = JSON.stringify({
      version: JOURNAL_VERSION,
      favorites: { keys: [BB, '', GOT], at: TOT.toISOString() },
      entries: {},
    });

    expect(favoritesOf(parseJournal(raw))).toEqual([BB, GOT]);
  });
});

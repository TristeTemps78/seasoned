import { describe, expect, it } from 'vitest';

import { csvRowCount, listsToCsv, toPortableCsv } from '../src/domain/export';
import {
  EMPTY_JOURNAL,
  journalKey,
  setDecision,
  setLiked,
  setPosition,
  setReview,
  setSeasonRating,
  setSnapshot,
  setTag,
  setWanted,
  type Journal,
} from '../src/domain/journal';
// ⚠️ Le lecteur vient du module d'import : c'est LUI qui doit savoir relire ce qu'on ecrit.
// La porte de sortie est aussi une porte d'entree, et ce test est ce qui le prouve.
import { parseCsvLine } from '../src/domain/import';

/**
 * **F6 — partir avec ce qu'on a ecrit.**
 *
 * Le releve du 2026-08-17 : *« `/convertir` sait lire un export TV Time, Trakt ou Simkl.
 * L'export interne est un fichier a soi. Un produit dont on ne peut pas partir est un
 * produit dans lequel on hesite a entrer. »*
 *
 * Ce que ces tests gardent, dans l'ordre d'importance :
 *
 * 1. **Le format ne casse pas sur du texte libre.** Une critique fait 2000 caracteres et
 *    contient virgules, guillemets et sauts de ligne — c'est la colonne qu'un export naif
 *    casse, et un fichier casse est pire qu'aucun fichier : il se decouvre chez l'importeur.
 * 2. **La granularite tient la promesse du produit** : la note et le texte **de chaque
 *    saison**, qui sont la moitie du differenciateur.
 * 3. **Il se relit ici** — notre propre lecteur de CSV doit savoir redecouper nos lignes.
 */

/** Un journal avec une serie complete : etat, position, mots, textes, notes de saison. */
function fourni(): Journal {
  const key = journalKey('1396');
  // ⚠️ La position d'abord : `setSnapshot` ne cree pas d'entree, il en decore une — un
  // instantane sans fait a decorer est un instantane sur une serie qu'on ne suit pas.
  let journal = setPosition(EMPTY_JOURNAL, key, 2, 4);
  journal = setSnapshot(journal, key, {
    title: 'Breaking Bad',
  });
  journal = setSeasonRating(journal, key, 1, 4.5);
  journal = setReview(journal, key, 'season:1', { text: 'La premiere pose tout.', throughSeason: 1 });
  journal = setReview(journal, key, 'series', { text: 'Un sommet.', throughSeason: 0 });
  journal = setTag(journal, key, 'le dimanche', true);
  return journal;
}

describe('le tableau que tout importeur sait mapper', () => {
  it('ouvre par les colonnes, avec l identifiant TMDB en tete', () => {
    const csv = toPortableCsv(fourni());
    expect(csv.split('\r\n')[0]).toBe(
      'tmdb_id,title,season,status,rating,position,review,liked,tags,updated_on',
    );
  });

  it('rend une ligne par serie, plus une par saison qui porte quelque chose', () => {
    // Une ligne de serie, une ligne pour la saison 1 (note **et** texte). La saison 2 n'a
    // ni note ni texte : elle n'occupe aucune ligne, alors qu'on la regarde.
    expect(csvRowCount(fourni())).toBe(2);
  });

  it('porte la position en clair et l etat en un mot', () => {
    const lignes = toPortableCsv(fourni()).trimEnd().split('\r\n');
    const serie = parseCsvLine(lignes[1] ?? '');
    expect(serie[0]).toBe('1396');
    expect(serie[3]).toBe('watching');
    expect(serie[5]).toBe('S2E4');
    expect(serie[8]).toBe('le dimanche');
  });

  it('porte la note de saison et son texte sur la ligne de la saison', () => {
    const lignes = toPortableCsv(fourni()).trimEnd().split('\r\n');
    const saison = parseCsvLine(lignes[2] ?? '');
    expect(saison[2]).toBe('1');
    expect(saison[4]).toBe('4.5');
    expect(saison[6]).toBe('La premiere pose tout.');
  });

  it('un abandon se dit `abandoned`, un envie `wanted`', () => {
    const key = journalKey('1399');
    const abandonne = setDecision(EMPTY_JOURNAL, key, 'abandoned');
    const voulu = setWanted(EMPTY_JOURNAL, key, true);

    expect(parseCsvLine(toPortableCsv(abandonne).split('\r\n')[1] ?? '')[3]).toBe('abandoned');
    expect(parseCsvLine(toPortableCsv(voulu).split('\r\n')[1] ?? '')[3]).toBe('wanted');
  });
});

describe('le texte libre ne casse pas le fichier', () => {
  /**
   * 🔴 Le defaut qu'un export naif produit, et qui ne se decouvre que chez l'importeur :
   * une critique contient **les trois** caracteres qui structurent un CSV.
   */
  const mechant = 'Il dit : "non, jamais", puis part.\nEt la fin, elle, arrive.';

  it('double les guillemets et entoure le champ', () => {
    const key = journalKey('1396');
    const journal = setReview(EMPTY_JOURNAL, key, 'series', { text: mechant, throughSeason: 0 });
    const csv = toPortableCsv(journal);

    expect(csv).toContain('""non, jamais""');
    // Et le fichier reste redecoupable : c'est la seule preuve qui compte.
    const corps = csv.slice(csv.indexOf('\r\n') + 2);
    expect(parseCsvLine(corps.replaceAll('\r\n', '\n'))[6]).toBe(mechant);
  });

  it('le coeur voyage dans sa propre colonne', () => {
    // ⚠️ Aimer et regarder sont deux faits independants : on peut aimer une serie qu'on a
    // abandonnee, et c'est meme un cas frequent. Les fondre dans `status` perdrait l'un des
    // deux — c'est la seule raison d'une colonne de plus.
    const key = journalKey('1396');
    let journal = setDecision(EMPTY_JOURNAL, key, 'abandoned');
    journal = setLiked(journal, key, true);
    const ligne = parseCsvLine(toPortableCsv(journal).split('\r\n')[1] ?? '');

    expect(ligne[3]).toBe('abandoned');
    expect(ligne[7]).toBe('yes');
  });

  it('un titre a virgule ne decale pas les colonnes', () => {
    const key = journalKey('1396');
    let journal = setWanted(EMPTY_JOURNAL, key, true);
    journal = setSnapshot(journal, key, {
      title: 'Alien, la serie',
    });

    const ligne = parseCsvLine(toPortableCsv(journal).split('\r\n')[1] ?? '');
    expect(ligne[1]).toBe('Alien, la serie');
    expect(ligne[3]).toBe('wanted');
  });
});

describe('ce qu on n exporte pas', () => {
  it('un journal vide rend les colonnes, et rien d autre', () => {
    expect(toPortableCsv(EMPTY_JOURNAL).trimEnd().split('\r\n')).toHaveLength(1);
    expect(csvRowCount(EMPTY_JOURNAL)).toBe(0);
  });

  it('une cle qui ne vient pas de TMDB est ecartee, comme a l import', () => {
    // Le cas n'existe pas aujourd'hui : ce test est ce qui rend la phrase vraie demain.
    const journal: Journal = {
      ...EMPTY_JOURNAL,
      entries: { 'imdb:tt0903747': { wanted: { at: '2026-08-17T10:00:00.000Z' } } },
    };
    expect(csvRowCount(journal)).toBe(0);
  });
});

/**
 * **Les listes, la seconde moitie de la porte de sortie.**
 *
 * 🔴 L'export du journal tient la regle 9 pour ce que le journal contient. Les listes vivent
 * sur le serveur — c'est la seule partie du produit qui **exige un compte pour exister** — et
 * elles ne partaient dans aucun fichier : quelqu'un qui s'en va perdait exactement ce qu'il
 * avait fabrique pour quelqu'un d'autre.
 */
describe('les listes s emportent aussi', () => {
  const listes = [
    { slug: 'a-voir', title: 'À voir cet hiver' },
    { slug: 'vide', title: 'Rien dedans, pour l’instant' },
  ];

  it('rend une ligne par (liste, serie), avec le rang', () => {
    const csv = listsToCsv(listes, [
      { slug: 'a-voir', subject: 'tmdb:1396', title: 'Breaking Bad', ordinal: 1 },
      { slug: 'a-voir', subject: 'tmdb:94605', title: 'Arcane', ordinal: 2 },
    ]);
    const lignes = csv.trimEnd().split('\r\n');

    expect(lignes[0]).toBe('list_slug,list_title,rank,tmdb_id,title');
    expect(parseCsvLine(lignes[1] ?? '')).toEqual(['a-voir', 'À voir cet hiver', '1', '1396', 'Breaking Bad']);
    expect(parseCsvLine(lignes[2] ?? '')[2]).toBe('2');
  });

  it('🔴 une liste vide occupe quand meme une ligne', () => {
    // Elle existe, elle a un titre, et un export qui l'oublierait ferait disparaitre le
    // travail de la nommer — c'est-a-dire la seule chose qu'elle porte encore.
    const csv = listsToCsv(listes, []);
    const lignes = csv.trimEnd().split('\r\n');

    expect(lignes).toHaveLength(3);
    expect(parseCsvLine(lignes[2] ?? '')).toEqual(['vide', 'Rien dedans, pour l’instant', '', '', '']);
  });

  it('un titre a virgule ne decale pas les colonnes ici non plus', () => {
    const csv = listsToCsv([{ slug: 'x', title: 'Pour Léa, et personne d’autre' }], []);
    expect(parseCsvLine(csv.trimEnd().split('\r\n')[1] ?? '')[1]).toBe('Pour Léa, et personne d’autre');
  });
});

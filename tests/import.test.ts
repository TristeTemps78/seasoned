import { describe, expect, it } from 'vitest';
import { importForeign, parseCsvLine, toStars } from '../src/domain/import';
import { EMPTY_JOURNAL, serializeJournal, setSeasonRating, setWanted } from '../src/domain/journal';

const NOW = new Date('2026-08-03T12:00:00Z');

/**
 * ⚠️ **Aucun de ces documents ne pretend etre l'export d'un service donne.**
 *
 * C'est le point du module, et il merite d'etre repete ici : ecrire une fixture
 * « format Trakt » de memoire produirait un lecteur valide contre ma propre invention
 * (dette D10). Ces documents testent donc des **formes** — identifiant imbrique, note
 * sur une echelle inconnue, colonne entre guillemets — et non des marques.
 */
describe('importForeign', () => {
  it('rend le journal inchange sur un fichier illisible', () => {
    const before = setWanted(EMPTY_JOURNAL, 'tmdb:1', true, NOW);
    const out = importForeign('n’importe quoi', before, NOW);
    expect(out.source).toBe('unreadable');
    expect(out.journal).toBe(before);
  });

  it('reconnait notre propre export et le prend en entier', () => {
    const mine = setSeasonRating(setWanted(EMPTY_JOURNAL, 'tmdb:1396', true, NOW), 'tmdb:1396', 1, 4.5, NOW);
    const out = importForeign(serializeJournal(mine), EMPTY_JOURNAL, NOW);
    expect(out.source).toBe('seasoned');
    expect(out.journal.entries['tmdb:1396']?.seasonRatings?.['1']?.stars).toBe(4.5);
  });

  it('trouve un identifiant imbrique dans un objet `ids`', () => {
    const doc = JSON.stringify([{ show: { title: 'Breaking Bad', ids: { trakt: 1, tmdb: 1396 } } }]);
    const out = importForeign(doc, EMPTY_JOURNAL, NOW);
    expect(out.source).toBe('json');
    expect(out.imported).toBe(1);
    expect(out.journal.entries['tmdb:1396']).toBeDefined();
  });

  it('compte, sans les reprendre, les series sans identifiant TMDB', () => {
    // La partie honnete du rapport. Les resoudre demanderait un appel par titre — le
    // cout par utilisateur que `ROADMAP.md` §1.4 interdit — et se tromperait sur les
    // remakes, qui portent le meme nom.
    const doc = JSON.stringify({ shows: [{ title: 'Une serie sans id' }, { title: 'X', ids: { tmdb: 7 } }] });
    const out = importForeign(doc, EMPTY_JOURNAL, NOW);
    expect(out.imported).toBe(1);
    expect(out.skipped).toBe(1);
  });

  it('n’importe pas les films, faute de pouvoir les distinguer', () => {
    // Un identifiant TMDB de film et de serie sont indistinguables. Sans indice de
    // serie, on s'abstient : deposer cinq cents films dans une bibliotheque de series
    // serait pire que ne rien importer.
    const doc = JSON.stringify({ movies: [{ title: 'Dune', ids: { tmdb: 438631 } }] });
    const out = importForeign(doc, EMPTY_JOURNAL, NOW);
    expect(out.source).toBe('unreadable');
    expect(out.imported).toBe(0);
  });

  it('garde la position la plus avancee quand une serie revient par episode', () => {
    // Ces exports listent souvent une ligne par episode vu. Prendre la derniere lue
    // ferait dependre la position de l'ordre du fichier.
    const doc = JSON.stringify({
      episodes: [
        { show: { ids: { tmdb: 1396 } }, season: 5, episode: 9 },
        { show: { ids: { tmdb: 1396 } }, season: 2, episode: 1 },
        { show: { ids: { tmdb: 1396 } }, season: 5, episode: 3 },
      ],
    });
    const out = importForeign(doc, EMPTY_JOURNAL, NOW);
    expect(out.imported).toBe(1);
    expect(out.journal.entries['tmdb:1396']?.position).toMatchObject({
      seasonNumber: 5,
      episodeNumber: 9,
    });
  });

  it('fusionne au lieu de remplacer', () => {
    // Importer sur un appareil deja utilise ne doit rien effacer de ce qu'on y a fait.
    const existing = setSeasonRating(EMPTY_JOURNAL, 'tmdb:999', 1, 5, NOW);
    const doc = JSON.stringify([{ show: { ids: { tmdb: 1396 } }, title: 'X' }]);
    const out = importForeign(doc, existing, NOW);
    expect(out.journal.entries['tmdb:999']?.seasonRatings?.['1']?.stars).toBe(5);
    expect(out.journal.entries['tmdb:1396']).toBeDefined();
  });

  it('lit un tableau a colonnes', () => {
    const csv = 'title,tmdb_id,season,episode,rating\nBreaking Bad,1396,5,9,9\n';
    const out = importForeign(csv, EMPTY_JOURNAL, NOW);
    expect(out.source).toBe('csv');
    expect(out.imported).toBe(1);
    expect(out.journal.entries['tmdb:1396']?.position?.episodeNumber).toBe(9);
    // 9/10 ramene sur cinq etoiles, au demi-cran : 4,5.
    expect(out.journal.entries['tmdb:1396']?.seasonRatings?.['5']?.stars).toBe(4.5);
  });

  it('ne se laisse pas decaler par une virgule dans un titre', () => {
    // Le cas qui casse tout analyseur naif : les colonnes suivantes glissent d'un cran
    // et l'import devient faux sans etre vide — le pire des deux mondes.
    const csv = 'title,tmdb\n"Truth, Justice",1396\n';
    const out = importForeign(csv, EMPTY_JOURNAL, NOW);
    expect(out.journal.entries['tmdb:1396']).toBeDefined();
  });
});

describe('parseCsvLine', () => {
  it('respecte les guillemets et les guillemets doubles', () => {
    expect(parseCsvLine('a,"b,c","d""e"')).toEqual(['a', 'b,c', 'd"e']);
  });

  it('accepte le point-virgule et la tabulation', () => {
    // Un tableur francais exporte en point-virgule par defaut. Ne lire que la virgule
    // ferait echouer l'import sur la moitie de l'Europe.
    expect(parseCsvLine('a;b;c')).toEqual(['a', 'b', 'c']);
    expect(parseCsvLine('a\tb')).toEqual(['a', 'b']);
  });
});

describe('toStars', () => {
  it('devine l’echelle depuis la valeur', () => {
    expect(toStars(9)).toBe(4.5); // sur 10
    expect(toStars(4.5)).toBe(4.5); // deja sur 5
    expect(toStars(80)).toBe(4); // sur 100
  });

  it('accroche au demi-cran le plus proche, sans jamais inventer un cran', () => {
    // 85/100 vaut 4,25, qui n'existe pas sur notre echelle. On monte a 4,5 plutot que
    // de garder une valeur hors echelle — mais la note reste toujours un cran valide,
    // ce que le typage `Stars` exige et que ce test verrouille.
    expect(toStars(85)).toBe(4.5);
    expect(toStars(7)).toBe(3.5);
  });

  it('ecarte ce qui ne tombe pas sur un cran valide plutot que d’inventer', () => {
    expect(toStars('bof')).toBeUndefined();
    expect(toStars(0)).toBeUndefined();
    expect(toStars(-3)).toBeUndefined();
  });
});

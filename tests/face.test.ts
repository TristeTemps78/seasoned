import { describe, expect, it } from 'vitest';
import { faceOf, FACE_WINDOW, MIN_FACTS_FOR_FACE } from '../src/domain/face';
import { importForeign } from '../src/domain/import';
import {
  asImported,
  EMPTY_JOURNAL,
  movieKey,
  parseJournal,
  serializeJournal,
  type Journal,
  type JournalEntry,
} from '../src/domain/journal';

/**
 * 9.1 — la face.
 *
 * Ce que ces tests gardent n'est pas l'arithmetique du comptage : c'est **le choix de la
 * matiere**. Les quatre pieges que Tristan a trouves avant l'ecriture disent tous la meme
 * chose — une face fondee sur ce qu'un import peut fabriquer serait fausse pour tout le
 * monde, et surtout **rouge pour tout le monde** (biais de survie).
 *
 * Les cas ci-dessous sont donc ecrits dans cet ordre : d'abord ce que la face refuse de
 * compter, ensuite ce qu'elle compte.
 */

const AT = (day: string) => `2026-${day}T12:00:00.000Z`;

/**
 * Les entrees en cours de construction — **mutables**, contrairement a `Journal['entries']`
 * qui est `Readonly`. Les batir directement dans le type final ne compile pas, et le
 * `tsc --noEmit` du `npm run check` le dit la ou `vitest` seul ne voit rien.
 */
type Entries = Record<string, JournalEntry>;

/** Un journal ecrit a la main, sans passer par douze appels d'ecriture. */
function journalOf(entries: Entries): Journal {
  return { version: 3, entries };
}

/** N series terminees, datees en ordre croissant. */
function finished(n: number, from = 1): Entries {
  const entries: Entries = {};
  for (let i = 0; i < n; i += 1) {
    const day = String(from + i).padStart(2, '0');
    entries[`tmdb:${100 + from + i}`] = { decision: { kind: 'completed', at: AT(`01-${day}`) } };
  }
  return entries;
}

describe('ce que la face refuse de compter', () => {
  it('se tait sous le seuil, et ne devine pas une face par defaut', () => {
    // *Un profil calcule sur trois series est du bruit presente comme un fait.* Annoncer
    // une identite a quelqu'un qui a fini deux series serait faux, et il le saurait.
    expect(faceOf(journalOf(finished(MIN_FACTS_FOR_FACE - 1)))).toBeUndefined();
    expect(faceOf(EMPTY_JOURNAL)).toBeUndefined();

    // L'ancrage : un fait de plus et elle parle. Sans lui, le test ci-dessus passerait
    // aussi avec une fonction qui ne rend jamais rien.
    expect(faceOf(journalOf(finished(MIN_FACTS_FOR_FACE)))?.id).toBe('finisher');
  });

  it('🔴 un historique repris d’ailleurs ne fabrique AUCUNE face', () => {
    // Le quatrieme piege, et le seul qui tue toutes les heuristiques : un export TV Time
    // produit les memes faits, dates du jour de l'import. La reponse n'est pas une regle
    // de plus, c'est la provenance (9.0) — et elle est verifiee ici, pas supposee.
    const imported = asImported(journalOf(finished(FACE_WINDOW)));
    expect(faceOf(imported)).toBeUndefined();

    // Et elle ne revient pas apres une sauvegarde : c'est tout l'objet du prelude de ce
    // lot — `parseDecision` ne relisait pas la marque, donc elle etait effacee au premier
    // `serializeJournal` et la face se serait rallumee, rouge, toute seule.
    expect(faceOf(parseJournal(serializeJournal(imported), new Date()))).toBeUndefined();
  });

  it('🔴 et un import tiers reel n’en fabrique aucune non plus', () => {
    // La ceinture ET les bretelles : au-dela de la marque, `importForeign` n'ecrit ni
    // decision ni visionnage — il n'ecrit que `wanted`, `position` et `seasonRatings`.
    // C'est **le choix de la matiere** qui ferme le biais de survie ; la provenance ne fait
    // que tenir la porte le jour ou l'import apprendra a lire un abandon.
    const shows = Array.from({ length: 30 }, (_, i) => ({
      title: `Serie ${i}`,
      ids: { tmdb: 1000 + i },
      season: 5,
      episode: 10,
      rating: 9,
    }));
    const out = importForeign(JSON.stringify({ shows }), EMPTY_JOURNAL, new Date());

    expect(out.imported).toBe(30);
    expect(faceOf(out.journal)).toBeUndefined();
  });

  it('ne compte ni les notes ni les « je veux la voir »', () => {
    // Un jugement peut porter sur quelque chose vu il y a dix ans : il date un avis, pas un
    // parcours. C'est la distinction que Letterboxd fait entre noter et consigner.
    const entries: Entries = {};
    for (let i = 0; i < 20; i += 1) {
      entries[`tmdb:${200 + i}`] = {
        seasonRatings: { '1': { stars: 5, at: AT('02-01') } },
        wanted: { at: AT('02-01') },
      };
    }
    expect(faceOf(journalOf(entries))).toBeUndefined();
  });

  it('ne compte pas les films (A13)', () => {
    const entries: Entries = {};
    for (let i = 0; i < FACE_WINDOW; i += 1) {
      entries[movieKey(String(500 + i))] = { decision: { kind: 'completed', at: AT('03-01') } };
    }
    expect(faceOf(journalOf(entries))).toBeUndefined();
  });

  it('ne compte pas le premier visionnage comme un revisionnage', () => {
    // Sinon « terminee » et « vue une fois » seraient deux faits pour un seul geste, et le
    // jaune l'emporterait sur le rouge chez quelqu'un qui ne revoit jamais rien.
    const entries: Entries = {};
    for (let i = 0; i < FACE_WINDOW; i += 1) {
      entries[`tmdb:${300 + i}`] = {
        decision: { kind: 'completed', at: AT('04-01') },
        completions: [{ at: AT('04-01') }],
      };
    }
    expect(faceOf(journalOf(entries))?.id).toBe('finisher');
    expect(faceOf(journalOf(entries))?.counts.rewatcher).toBe(0);
  });
});

describe('ce que la face compte', () => {
  it('rouge : on mene au bout', () => {
    const face = faceOf(journalOf(finished(6)));
    expect(face?.id).toBe('finisher');
    expect(face?.seen).toBe(6);
  });

  it('bleu : on coupe tot et sans regret', () => {
    const entries: Entries = {};
    for (let i = 0; i < 6; i += 1) {
      entries[`tmdb:${400 + i}`] = {
        decision: { kind: 'abandoned', at: AT(`05-0${i + 1}`), atSeason: 1 },
      };
    }
    expect(faceOf(journalOf(entries))?.id).toBe('cutter');
  });

  it('jaune : on revient', () => {
    const entries: Entries = {};
    for (let i = 0; i < 6; i += 1) {
      entries[`tmdb:${500 + i}`] = {
        completions: [{ at: AT('06-01') }, { at: AT(`06-1${i}`) }, { at: AT(`06-2${i}`) }],
      };
    }
    const face = faceOf(journalOf(entries));
    expect(face?.id).toBe('rewatcher');
    // Deux revisionnages par serie, six series, plafonnes par la fenetre.
    expect(face?.seen).toBe(FACE_WINDOW);
  });

  it('🔴 la fenetre glisse : ce sont les DERNIERS faits, jamais les premiers', () => {
    // Sans elle la face se fige, alors que **basculer est le produit** : quelqu'un qui a
    // fini trente series il y a cinq ans et qui abandonne tout depuis resterait rouge pour
    // toujours. C'est litteralement ce que « volte-face » veut dire.
    const entries: Entries = { ...finished(FACE_WINDOW, 1) };
    for (let i = 0; i < FACE_WINDOW; i += 1) {
      entries[`tmdb:${700 + i}`] = {
        decision: { kind: 'abandoned', at: AT(`12-${String(i + 1).padStart(2, '0')}`), atSeason: 1 },
      };
    }

    const face = faceOf(journalOf(entries));
    expect(face?.id).toBe('cutter');
    // La preuve que l'ancien n'a pas seulement perdu, il est **sorti** de la fenetre.
    expect(face?.counts.finisher).toBe(0);
    expect(face?.seen).toBe(FACE_WINDOW);
  });

  it('a egalite, la face est celle vers laquelle on vient de basculer', () => {
    // Et surtout pas celle qui se trouve declaree en premier dans le type : ce serait un
    // depart pris pour une decision — le defaut du `deviceId` de `sameJournal`.
    const entries: Journal['entries'] = {
      'tmdb:801': { decision: { kind: 'completed', at: AT('07-01') } },
      'tmdb:802': { decision: { kind: 'completed', at: AT('07-02') } },
      'tmdb:803': { decision: { kind: 'completed', at: AT('07-03') } },
      'tmdb:804': { decision: { kind: 'abandoned', at: AT('07-04'), atSeason: 1 } },
      'tmdb:805': { decision: { kind: 'abandoned', at: AT('07-05'), atSeason: 1 } },
      'tmdb:806': { decision: { kind: 'abandoned', at: AT('07-06'), atSeason: 1 } },
    };
    expect(faceOf(journalOf(entries))?.id).toBe('cutter');

    // Le miroir : les memes six faits, l'ordre du temps inverse.
    const inverse: Journal['entries'] = {
      'tmdb:801': { decision: { kind: 'abandoned', at: AT('07-01'), atSeason: 1 } },
      'tmdb:802': { decision: { kind: 'abandoned', at: AT('07-02'), atSeason: 1 } },
      'tmdb:803': { decision: { kind: 'abandoned', at: AT('07-03'), atSeason: 1 } },
      'tmdb:804': { decision: { kind: 'completed', at: AT('07-04') } },
      'tmdb:805': { decision: { kind: 'completed', at: AT('07-05') } },
      'tmdb:806': { decision: { kind: 'completed', at: AT('07-06') } },
    };
    expect(faceOf(journalOf(inverse))?.id).toBe('finisher');
  });

  it('une pause ne tranche rien : elle n’est comptee nulle part', () => {
    // Quelqu'un qui met en pause n'a **pas encore** decide. Compter son indecision d'un
    // cote ou de l'autre serait inventer une reponse.
    const entries: Entries = {};
    for (let i = 0; i < FACE_WINDOW; i += 1) {
      entries[`tmdb:${900 + i}`] = { decision: { kind: 'paused', at: AT('08-01') } };
    }
    expect(faceOf(journalOf(entries))).toBeUndefined();
  });
});

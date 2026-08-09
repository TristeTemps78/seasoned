import { describe, expect, it } from 'vitest';
import { importForeign } from '../src/domain/import';
import {
  asImported,
  EMPTY_JOURNAL,
  mergeJournals,
  parseJournal,
  serializeJournal,
  setPosition,
  setSeasonRating,
  setWanted,
  type Journal,
} from '../src/domain/journal';

/**
 * 9.0 — la provenance d'un fait.
 *
 * Ce que ces tests gardent tient en une phrase : **un fait repris d'ailleurs ne doit pas
 * pouvoir se faire passer pour un fait vecu**, ni aujourd'hui ni apres une sauvegarde,
 * une relecture ou une fusion. C'est irrattrapable apres coup, donc c'est ici que ca se
 * prouve et pas dans le module qui s'en servira (9.1, 8.14).
 */

const IMPORT_AT = new Date('2026-08-09T12:00:00Z');
const LATER = new Date('2026-08-10T09:00:00Z');

/** Un export tiers minimal : un identifiant, une position, une note. */
const FOREIGN = JSON.stringify({
  shows: [{ title: 'Breaking Bad', ids: { tmdb: 1396 }, season: 2, episode: 4, rating: 9 }],
});

/**
 * Tout enregistrement **date** d'un journal, avec son chemin.
 *
 * C'est la definition d'un fait dans ce format (decision n°2 de la v2), et c'est
 * volontairement la meme que celle du code : ce que ce parcours mesure n'est pas la
 * definition, c'est qu'aucun fait n'echappe au marquage. Le `describe` d'ancrage
 * ci-dessous nomme les trois faits attendus un par un, pour qu'un parcours qui ne
 * trouverait plus rien ne puisse pas passer pour un succes.
 */
function factsOf(journal: Journal): readonly (readonly [string, Record<string, unknown>])[] {
  const out: (readonly [string, Record<string, unknown>])[] = [];

  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record['at'] === 'string' || typeof record['declaredAt'] === 'string') {
      out.push([path, record]);
      return;
    }
    for (const [key, child] of Object.entries(record)) walk(child, `${path}.${key}`);
  };

  for (const [key, { unknownFields: _bucket, ...known }] of Object.entries(journal.entries)) {
    walk(known, key);
  }
  return out;
}

describe('ancrage — il y a bien quelque chose a marquer', () => {
  // Sans ce bloc, tout ce qui suit passerait sur un journal vide : « aucun fait non
  // marque » est vrai quand il n'y a aucun fait. Cinquieme fois que ce depot pose un
  // ancrage pour cette raison exacte.
  it('un import tiers ecrit les trois faits que la marque doit couvrir', () => {
    const entry = importForeign(FOREIGN, EMPTY_JOURNAL, IMPORT_AT).journal.entries['tmdb:1396'];

    expect(entry?.wanted).toBeDefined();
    expect(entry?.position?.seasonNumber).toBe(2);
    expect(entry?.seasonRatings?.['2']?.stars).toBe(4.5);
    expect(factsOf(importForeign(FOREIGN, EMPTY_JOURNAL, IMPORT_AT).journal)).toHaveLength(3);
  });

  it('et il les date TOUS de l’instant de l’import — la raison d’etre de 9.0', () => {
    // C'est le fait mesure qui justifie la tache : reprendre dix ans d'historique
    // deposerait deux cents series portant toutes la date du jour. Une fenetre glissante
    // (9.1) n'y verrait qu'un clic, un bilan annuel (8.14) y verrait dix ans en 2026.
    const dates = new Set(
      factsOf(importForeign(FOREIGN, EMPTY_JOURNAL, IMPORT_AT).journal).map(
        ([, fact]) => fact['at'] ?? fact['declaredAt'],
      ),
    );
    expect([...dates]).toEqual([IMPORT_AT.toISOString()]);
  });
});

describe('la provenance', () => {
  it('marque chaque fait repris d’un export tiers, sans exception', () => {
    const facts = factsOf(importForeign(FOREIGN, EMPTY_JOURNAL, IMPORT_AT).journal);
    const unmarked = facts.filter(([, fact]) => fact['origin'] !== 'import').map(([path]) => path);

    // Nomme les fautifs plutot que de compter : le jour ou l'import apprendra a ecrire un
    // quatrieme genre de fait, ce test dira lequel a echappe au marquage.
    expect(unmarked).toEqual([]);
  });

  it('survit a l’aller-retour — sans quoi elle serait effacee a la premiere sauvegarde', () => {
    // 🔴 Le defaut que ce test attrape est le plus discret de la tache : `parseEntry`
    // reconstruit un objet neuf champ par champ, donc une marque ecrite mais non relue
    // disparait au premier `serializeJournal`. Le pass-through de la decision n°4 ne
    // protege que les champs d'ENTREE inconnus, pas ceux niches dans un champ connu.
    const imported = importForeign(FOREIGN, EMPTY_JOURNAL, IMPORT_AT).journal;
    const relu = parseJournal(serializeJournal(imported), LATER);

    expect(relu.entries).toEqual(imported.entries);
    expect(relu.entries['tmdb:1396']?.position?.origin).toBe('import');
  });

  it('ne marque PAS notre propre export : ses dates sont les vraies', () => {
    // Reprendre sa sauvegarde n'est pas reprendre l'historique de quelqu'un d'autre.
    // Marquer ce chemin effacerait de la face et du bilan des annees reellement vecues.
    const mine = setSeasonRating(
      setWanted(EMPTY_JOURNAL, 'tmdb:1396', true, IMPORT_AT),
      'tmdb:1396',
      1,
      4.5,
      IMPORT_AT,
    );
    const out = importForeign(serializeJournal(mine), EMPTY_JOURNAL, LATER);

    expect(out.source).toBe('voltface');
    expect(factsOf(out.journal).filter(([, fact]) => fact['origin'] !== undefined)).toEqual([]);
  });

  it('laisse un geste pose a la main sans aucune marque', () => {
    // L'absence est la valeur normale : c'est ce qui rend la migration gratuite.
    const facts = factsOf(setWanted(EMPTY_JOURNAL, 'tmdb:1396', true, IMPORT_AT));
    expect(facts).toHaveLength(1);
    expect(facts[0]?.[1]['origin']).toBeUndefined();
  });

  it('se pose sur le FAIT et non sur la serie : reprendre la main n’en demarque qu’un', () => {
    // La raison d'etre de la granularite. Quelqu'un qui importe puis avance dans une
    // serie a desormais une position vecue et un « je veux la voir » repris : une marque
    // posee sur l'entree entiere devrait mentir sur l'un des deux.
    const imported = importForeign(FOREIGN, EMPTY_JOURNAL, IMPORT_AT).journal;
    const resumed = setPosition(imported, 'tmdb:1396', 3, 1, LATER);
    const entry = resumed.entries['tmdb:1396'];

    expect(entry?.position?.origin).toBeUndefined();
    expect(entry?.wanted?.origin).toBe('import');
    expect(entry?.seasonRatings?.['2']?.origin).toBe('import');
  });

  it('suit le fait gagnant a la fusion, dans les deux sens', () => {
    // ⚠️ Le conflit est **construit**, pas espere : un test qui fusionne deux journaux
    // sans la donnee qu'il pretend eprouver compare deux fois rien (lecon de 8.0).
    const imported = importForeign(FOREIGN, EMPTY_JOURNAL, IMPORT_AT).journal;
    const byHand = setPosition(EMPTY_JOURNAL, 'tmdb:1396', 3, 1, LATER);

    for (const merged of [
      mergeJournals(imported, byHand),
      mergeJournals(byHand, imported),
    ]) {
      const position = merged.entries['tmdb:1396']?.position;
      // Le plus recent gagne, et il emporte sa provenance avec lui.
      expect(position?.seasonNumber).toBe(3);
      expect(position?.origin).toBeUndefined();
      // Le fait que l'import etait seul a porter survit, marque.
      expect(merged.entries['tmdb:1396']?.wanted?.origin).toBe('import');
    }

    const olderByHand = setPosition(EMPTY_JOURNAL, 'tmdb:1396', 1, 1, new Date('2026-01-01T00:00:00Z'));
    expect(mergeJournals(olderByHand, imported).entries['tmdb:1396']?.position?.origin).toBe(
      'import',
    );
  });

  it('laisse intact le seau des champs inconnus', () => {
    // Son contrat est de traverser sans etre touche (decision n°4) : y ecrire une
    // provenance serait modifier une donnee dont on ignore la forme.
    const future = parseJournal(
      JSON.stringify({
        version: 99,
        entries: { 'tmdb:1396': { position: { seasonNumber: 1, episodeNumber: 1, declaredAt: IMPORT_AT.toISOString() }, futurField: { at: IMPORT_AT.toISOString() } } },
      }),
      IMPORT_AT,
    );
    const stamped = asImported(future);

    expect(stamped.entries['tmdb:1396']?.unknownFields).toEqual(
      future.entries['tmdb:1396']?.unknownFields,
    );
    expect(stamped.entries['tmdb:1396']?.position?.origin).toBe('import');
  });
});

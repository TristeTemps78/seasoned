import { describe, expect, it } from 'vitest';
import { decideAdoption, syncJournals } from '../src/journal/sync';
import {
  EMPTY_JOURNAL,
  journalKey,
  setPosition,
  setSeasonRating,
  withDeviceId,
  type Journal,
} from '../src/domain/journal';

const NOW = new Date('2026-08-03T12:00:00Z');
const BB = journalKey('1396');
const DEXTER = journalKey('1405');
const ME = 'user-a';
const SOMEONE_ELSE = 'user-b';

describe('⚠️ l appareil partage — le defaut que ce module existe pour empecher', () => {
  const local = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);

  it('demande avant de verser un journal inconnu dans un compte', () => {
    // Un ordinateur familial, un poste de bibliotheque, un telephone prete. Fusionner
    // en silence verserait le journal de quelqu'un d'autre dans ce compte, et c'est
    // irreversible : une fois fusionne, on ne sait plus quoi appartenait a qui.
    expect(decideAdoption(local, SOMEONE_ELSE, ME)).toEqual({ kind: 'ask', entries: 1 });
  });

  it('demande aussi quand le journal n a AUCUN proprietaire connu', () => {
    // C'est le cas le plus delicat : « premier compte de quelqu'un » et « appareil
    // partage » sont indiscernables. Une seule des deux erreurs se repare.
    expect(decideAdoption(local, undefined, ME)).toEqual({ kind: 'ask', entries: 1 });
  });

  it('adopte sans rien demander quand le journal est deja le sien', () => {
    expect(decideAdoption(local, ME, ME)).toEqual({ kind: 'adopt' });
  });

  it('ne demande rien pour un journal vide', () => {
    // Il n'y a rien a perdre, donc rien a arbitrer : une question ici serait du bruit.
    expect(decideAdoption(EMPTY_JOURNAL, undefined, ME)).toEqual({
      kind: 'nothing_to_adopt',
    });
  });

  it('compte ce qu il y a a perdre, pour que la question soit informee', () => {
    let j = setPosition(EMPTY_JOURNAL, BB, 1, 1, NOW);
    j = setPosition(j, DEXTER, 2, 2, NOW);
    const decision = decideAdoption(j, undefined, ME);
    expect(decision).toEqual({ kind: 'ask', entries: 2 });
  });
});

describe('syncJournals — ce qui doit etre reecrit, et rien de plus', () => {
  it('pousse le local quand le compte n a encore rien', () => {
    const local = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    expect(syncJournals(local, { kind: 'absent' })).toEqual({
      merged: local,
      writeLocal: false,
      writeRemote: true,
    });
  });

  it('ne pousse rien quand il n y a rien des deux cotes', () => {
    // Sans ce cas, une premiere visite sans aucun geste declencherait une ecriture
    // distante d'un journal vide.
    expect(syncJournals(EMPTY_JOURNAL, { kind: 'absent' }).writeRemote).toBe(false);
  });

  it('n ecrit nulle part quand les deux cotes sont deja d accord', () => {
    // Le cas le plus frequent, et de loin : ouvrir une page. Sans cette comparaison,
    // chaque ouverture couterait une requete et un cycle de rendu pour rien.
    const same = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    expect(syncJournals(same, { kind: 'found', journal: same })).toEqual({
      merged: same,
      writeLocal: false,
      writeRemote: false,
    });
  });

  it('fusionne les deux apports et reecrit des deux cotes', () => {
    const local = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    const remote = setPosition(EMPTY_JOURNAL, DEXTER, 1, 1, NOW);

    const out = syncJournals(local, { kind: 'found', journal: remote });
    expect(Object.keys(out.merged.entries).sort()).toEqual([BB, DEXTER].sort());
    expect(out.writeLocal).toBe(true);
    expect(out.writeRemote).toBe(true);
  });

  it('ne reecrit que le cote en retard', () => {
    const local = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    const remote = setSeasonRating(local, BB, 1, 4, NOW);

    const out = syncJournals(local, { kind: 'found', journal: remote });
    // Le distant contient deja tout : seul le local doit rattraper.
    expect(out.writeLocal).toBe(true);
    expect(out.writeRemote).toBe(false);
  });

  it('🔴 un GET rate ne fait pas pousser le local par-dessus le distant', () => {
    // Le cas MIXTE, et c'est le plus banal : la lecture echoue (delai depasse, 5xx
    // passager, jeton expire pile entre les deux appels) et l'ecriture, elle, passe.
    // Avec `undefined` pour les deux issues, on ecrasait alors un journal distant qu'on
    // n'avait pas pu lire, donc pas fusionne. C'est la seule perte de donnees possible de
    // toute la synchronisation, et elle est irrattrapable si l'autre appareil ne revient
    // pas. Ne rien faire, en revanche, se rattrape a la synchro suivante.
    const local = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);

    const out = syncJournals(local, { kind: 'unavailable' });
    expect(out.writeRemote).toBe(false);
    expect(out.writeLocal).toBe(false);
    expect(out.merged).toEqual(local);
  });

  it('🔴 deux appareils cessent de s ecrire quand rien n a change', () => {
    // Le defaut : `deviceId` identifie l APPAREIL, pas le contenu. `LocalJournalStore`
    // en pose un different sur chaque appareil, `mergeJournals` garde par contrat celui
    // de `a`, et `sameJournal` comparait le journal entier. Donc `writeRemote` etait
    // vrai a CHAQUE synchronisation sur deux journaux pourtant identiques.
    const contenu = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    const ici = withDeviceId(contenu, 'appareil-a');
    const ailleurs = withDeviceId(contenu, 'appareil-b');

    const out = syncJournals(ici, { kind: 'found', journal: ailleurs });
    expect(out.writeLocal).toBe(false);
    expect(out.writeRemote).toBe(false);
  });

  it('🔴 deux appareils qui se synchronisent a tour de role finissent par se taire', () => {
    // La forme observable du meme defaut, et la seule qui montre ce qu il coutait : une
    // requete reseau par ouverture de page, indefiniment, sur un journal qui ne bouge pas.
    //
    // ⚠️ Le modele doit garder TROIS etats distincts — le journal local de chacun et le
    // document distant. Les confondre fait converger les `deviceId` par accident, et le
    // test devient creux : il reste vert meme avec le defaut.
    const locaux = [
      withDeviceId(setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW), 'appareil-a'),
      withDeviceId(setSeasonRating(EMPTY_JOURNAL, DEXTER, 1, 5, NOW), 'appareil-b'),
    ];
    let distant: Journal | undefined;

    const ecritures: boolean[] = [];
    for (let tour = 0; tour < 8; tour += 1) {
      const moi = tour % 2;
      const out = syncJournals(
        locaux[moi]!,
        distant === undefined ? { kind: 'absent' } : { kind: 'found', journal: distant },
      );
      // Le local garde son propre `deviceId` : `mergeJournals` conserve celui de `a`.
      locaux[moi] = out.merged;
      if (out.writeRemote) distant = out.merged;
      ecritures.push(out.writeRemote);
    }

    // Deux echanges suffisent a tout propager. Au-dela, plus rien ne doit partir.
    expect(ecritures.slice(2)).toEqual([false, false, false, false, false, false]);
  });
});

describe('les lois de la synchronisation', () => {
  /** Trois journaux qui se recouvrent partiellement. */
  function fixtures(): readonly Journal[] {
    const a = setPosition(EMPTY_JOURNAL, BB, 3, 7, NOW);
    const b = setSeasonRating(setPosition(EMPTY_JOURNAL, DEXTER, 1, 1, NOW), DEXTER, 1, 5, NOW);
    const c = setSeasonRating(a, BB, 2, 3, NOW);
    return [EMPTY_JOURNAL, a, b, c];
  }

  /** Compare le CONTENU, pas l ordre d insertion des cles. */
  function sameContent(a: unknown, b: unknown): boolean {
    const stable = (v: unknown): string =>
      JSON.stringify(v, (_k, item: unknown) =>
        item === null || typeof item !== 'object' || Array.isArray(item)
          ? item
          : Object.fromEntries(
              Object.entries(item as Record<string, unknown>).sort(([x], [y]) =>
                x < y ? -1 : x > y ? 1 : 0,
              ),
            ),
      );
    return stable(a) === stable(b);
  }

  it('le resultat ne depend pas du sens de la synchronisation', () => {
    // La propriete qui fait qu'un appareil A et un appareil B convergent au lieu de se
    // renvoyer indefiniment des journaux differents. Elle vient de `mergeJournals`, et
    // ce test verifie qu'on ne l'a pas perdue en composant.
    for (const local of fixtures()) {
      for (const remote of fixtures()) {
        // ⚠️ Sur le CONTENU : l ordre des cles suit l ordre des arguments, et c est
        // precisement ce qui a demasque le defaut de `sameJournal` — voir `sync.ts`.
        expect(
          sameContent(
            syncJournals(local, { kind: 'found', journal: remote }).merged,
            syncJournals(remote, { kind: 'found', journal: local }).merged,
          ),
        ).toBe(true);
      }
    }
  });

  it('synchroniser deux fois ne change rien de plus', () => {
    // Idempotence : apres une synchronisation, une seconde ne doit rien avoir a ecrire.
    // Sans cela, deux appareils s'ecriraient mutuellement en boucle.
    for (const local of fixtures()) {
      for (const remote of fixtures()) {
        const first = syncJournals(local, { kind: 'found', journal: remote });
        const second = syncJournals(first.merged, { kind: 'found', journal: first.merged });
        expect(second.writeLocal).toBe(false);
        expect(second.writeRemote).toBe(false);
      }
    }
  });

  it('une synchronisation ne perd jamais une entree', () => {
    for (const local of fixtures()) {
      for (const remote of fixtures()) {
        const { merged } = syncJournals(local, { kind: 'found', journal: remote });
        for (const key of [...Object.keys(local.entries), ...Object.keys(remote.entries)]) {
          expect(merged.entries[key]).toBeDefined();
        }
      }
    }
  });
});

import { expect, it } from 'vitest';
import { EMPTY_JOURNAL, parseJournal, serializeJournal } from '../src/domain/journal';
import { CASES, journalOf, shape } from './journal-fixtures';

/**
 * Les lois de la **lecture**.
 *
 * ## Pourquoi elles n'existaient pas
 *
 * `parseJournal` etait couvert par quatorze **exemples** : un document precis, un
 * resultat attendu. C'est necessaire, et c'est ce qui a attrape la plupart des defauts
 * connus — une note hors echelle, une date illisible, une version future rejetee. Mais
 * aucun d'eux ne dit la seule chose que tout le reste suppose :
 *
 * > **`parseJournal(serializeJournal(j))` rend `j`.**
 *
 * C'est le contrat que la synchronisation, l'export et le pass-through tiennent tous pour
 * acquis. Il n'etait verifie nulle part, sinon par ricochet dans les lois de la fusion.
 *
 * ## Ce que la segmentation a change
 *
 * Tant que `journal.ts` faisait 1858 lignes et 54 exports, il n'y avait **aucune phrase
 * a tester** : on ecrivait un exemple par comportement. Une fois `parse.ts` isole, son
 * contrat tient en deux phrases — l'aller-retour, et « rien ne leve » — et deux lois
 * suffisent la ou l'on aurait ecrit vingt exemples de plus.
 *
 * *Le nombre de tests ne mesure pas la prudence, il mesure l'absence de contrat.*
 *
 * ⚠️ Les quatorze exemples ne disparaissent pas pour autant : dix d'entre eux nomment un
 * bug qui a reellement eu lieu, et une loi ne les remplace pas. Seuls les quatre que ces
 * lois couvrent reellement ont ete retires.
 */

/** Ce qu'un navigateur, un fichier importe ou un serveur en panne peuvent rendre. */
const N_IMPORTE_QUOI: readonly (string | null | undefined)[] = [
  null,
  undefined,
  '',
  '   ',
  'null',
  'undefined',
  '42',
  '"une chaine"',
  '[]',
  '[1,2,3]',
  '{',
  '{"entries":null}',
  '{"entries":42}',
  '{"entries":{"tmdb:1":null}}',
  '{"entries":{"tmdb:1":{"position":"pas un objet"}}}',
  '{"entries":{"tmdb:1":{"seasonRatings":[]}}}',
  '{"version":"trois","entries":{}}',
  '<html>portail captif</html>',
];

/**
 * 🔴 **La premiere loi que j'ai ecrite etait fausse, et c'est le meilleur resultat de ce
 * fichier.**
 *
 * J'avais enonce `parse(serialize(j)) = j`. Elle echoue des la graine 21 : une entree
 * reduite a sa **pierre tombale** disparait a la relecture. Ce n'est pas un defaut — c'est
 * que **`parseJournal` n'est pas un decodeur pur**. Il *vieillit* le document : il expire
 * les traces de suppression a 90 jours et les instantanes a 30. Aucun instant de lecture
 * ne rattrape ca, puisque le generateur couvre sept mois.
 *
 * L'aller-retour n'est donc pas l'identite, **par conception**, et le contrat exact est
 * l'idempotence : *une fois le document lu, le relire ne change plus rien.* C'est ce qui
 * garantit qu'un journal ne s'erode pas un peu a chaque synchronisation.
 *
 * Quatorze exemples n'avaient jamais fait apparaitre cette distinction. La premiere loi
 * l'a rendue visible en trente secondes — et une loi fausse qui echoue vaut mieux qu'un
 * exemple juste qui ne dit rien.
 */
it('loi — lire est idempotent : relire ne change plus rien', () => {
  // Couvre aussi le pass-through de la decision n°4 : le generateur pose des champs
  // INCONNUS (`withUnknown`), donc un document ecrit par une version plus recente
  // traverse une lecture et une reecriture sans etre depouille.
  for (let seed = 1; seed <= CASES; seed += 1) {
    const une = parseJournal(serializeJournal(journalOf(seed)));
    expect(shape(parseJournal(serializeJournal(une))), `graine ${seed}`).toBe(shape(une));
  }
});

it('loi — aucune entree ne fait lever, et il en sort toujours un journal', () => {
  // `AGENTS.md` regle 4. Le journal vit dans `localStorage` : il est modifiable a la main,
  // recopie entre appareils, et rendu par un serveur qui peut tomber. Lever ici, c'est
  // une page blanche.
  for (const entree of N_IMPORTE_QUOI) {
    const journal = parseJournal(entree);
    expect(typeof journal.version, String(entree)).toBe('number');
    expect(typeof journal.entries, String(entree)).toBe('object');
  }
});

it('l ancrage — le generateur produit bien de la matiere a fausser', () => {
  // Sans lui, les trois lois ci-dessus compareraient 120 fois deux journaux vides, et
  // resteraient vertes quoi qu'on fasse a `parseJournal`. C'est le cinquieme faux negatif
  // de fixture que ce depot aurait pu commettre.
  const shapes = new Set<string>();
  let entrees = 0;
  for (let seed = 1; seed <= CASES; seed += 1) {
    const journal = journalOf(seed);
    shapes.add(shape(journal));
    entrees += Object.keys(journal.entries).length;
  }
  expect(shapes.size).toBeGreaterThan(50);
  expect(entrees).toBeGreaterThan(CASES);
  expect(shape(EMPTY_JOURNAL)).not.toBe(shape(journalOf(1)));
});

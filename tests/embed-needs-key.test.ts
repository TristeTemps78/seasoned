import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './sources';

/**
 * Un embarquement PostgREST exige une cle etrangere — et c'est la SEPTIEME fois.
 *
 * ## 🔴 Ce que cette garde aurait attrape, et ce que ca a couté a chaque fois
 *
 * PostgREST ne sait embarquer (`table?select=…autre!inner(…)`) que ce qu'une **cle
 * etrangere** relie. Sans elle, il refuse la requete entiere en `400 PGRST200` — pas la
 * jointure, la requete. Et `#rows()` promet de ne jamais lever : le 400 devient `[]`, donc
 * **l'ecran d'une fonctionnalite cassee est identique a celui d'un demarrage a froid**.
 *
 *   - Lot 10.0 : `reviews` et `activity` referencaient `auth.users` et pas `profiles`. Les
 *     deux seules lectures sociales du produit rendaient 400 **depuis toujours**. Il a fallu
 *     ouvrir l'onglet reseau d'un navigateur pour l'apprendre, trois sessions plus tard.
 *   - `009_relations.sql` a pose les trois cles manquantes et ecrit la lecon.
 *   - 🔴 **Le 2026-08-17, `024` a refait exactement la meme chose** avec `review_comments` :
 *     l'ecriture rendait 201, la lecture 400, et le fil etait invisible. Trouve en ecrivant
 *     une vraie reponse depuis un vrai compte sur la production — c'est-a-dire par l'angle
 *     mort A6 du releve, pas par un test.
 *
 * ## ⚠️ Pourquoi rien ne pouvait le voir
 *
 * Les tests doublent `fetch` : ils prouvent la **forme** de l'URL, jamais que la base
 * l'accepte. Les scenarios RLS ecrivent en SQL pur, donc ne passent pas par PostgREST. Entre
 * les deux, personne ne relisait la condition qui rend l'embarquement possible.
 *
 * Cette garde la relit. Elle ne remplace pas la mesure — `009` previent qu'une cle presente
 * dans `pg_constraint` ne prouve pas que PostgREST la voie, son cache se rafraichit a part —
 * mais elle rend l'oubli **impossible a committer**.
 */

const CLIENT = readFileSync(join(ROOT, 'src/social/client.ts'), 'utf8');

const SCHEMA = readdirSync(join(ROOT, 'supabase'))
  .filter((name) => name.endsWith('.sql'))
  .map((name) => readFileSync(join(ROOT, 'supabase', name), 'utf8'))
  .join('\n');

/**
 * Les tables dont une requete embarque `profiles`.
 *
 * On lit la **source du client**, pas une liste ecrite a la main : une liste se perime au
 * premier ajout, en silence — c'est ce que `no-orphan-component` et `db-push` documentent
 * tous les deux.
 */
/**
 * ⚠️ **La premiere version cherchait la table et l'embarquement dans le MEME litteral, et
 * elle ratait exactement le cas pour lequel elle etait ecrite.** `commentsOn` compose son
 * URL en deux morceaux :
 *
 *     `review_comments?subject=eq.${…}` +
 *       `&select=…,profiles!inner(handle,user_id,face)`
 *
 * Le motif n'y voyait donc que `activity` et `lists`. Une garde qui manque son propre cas
 * est pire qu'aucune garde — elle donne une confiance imméritée, ce que ce depot a deja
 * ecrit pour `trajectory-section` et pour `codeIn`.
 *
 * On remonte donc **en arriere** depuis chaque `profiles!inner` jusqu'au dernier
 * `` `table? `` rencontre, en traversant les concatenations.
 */
function tablesEmbarquantProfiles(): readonly string[] {
  const trouvees = new Set<string>();
  const debutRequete = /`([a-z_]+)\?/g;
  for (const embed of CLIENT.matchAll(/profiles!inner/g)) {
    const avant = CLIENT.slice(Math.max(0, (embed.index ?? 0) - 600), embed.index);
    let dernier: string | undefined;
    for (const m of avant.matchAll(debutRequete)) dernier = m[1];
    if (dernier !== undefined) trouvees.add(dernier);
  }
  return [...trouvees].sort();
}

describe('un embarquement PostgREST exige une cle etrangere', () => {
  it('🔴 toute table qui embarque `profiles` en a une vers `profiles`', () => {
    const tables = tablesEmbarquantProfiles();
    // L'ancrage : si la lecture de la source ne trouve plus rien, le test ne prouve rien.
    expect(tables.length, 'aucun embarquement trouve — la lecture de la source est cassee')
      .toBeGreaterThan(0);

    const sans = tables.filter((table) => {
      const cle = new RegExp(
        `alter table public\\.${table}\\b[\\s\\S]{0,400}?references public\\.profiles`,
      );
      return !cle.test(SCHEMA);
    });

    expect(
      sans,
      'ces tables embarquent `profiles!inner` sans cle etrangere : PostgREST rendra 400 PGRST200, et `#rows` le rendra en liste vide',
    ).toEqual([]);
  });

  it('les trois cles de `009` et celle de `025` sont toujours la', () => {
    // Elles ne sont pas toutes lues par un embarquement aujourd'hui — `review_comments` l'est,
    // `reviews` ne l'est plus directement — mais les retirer casserait une lecture existante
    // ou future sans que rien ne le dise.
    for (const contrainte of [
      'reviews_author_profile',
      'activity_author_profile',
      'lists_author_profile',
      'review_comments_author_profile',
    ]) {
      expect(SCHEMA, `${contrainte} a disparu du schema`).toContain(contrainte);
    }
  });
});

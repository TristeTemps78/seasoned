import { describe, expect, it } from 'vitest';
import { SocialClient } from '../src/social/client';

/**
 * `discoverLists()` — les listes des profils publics.
 *
 * ## Ce que ce fichier garde, et pourquoi c'est l'URL
 *
 * 🔴 `#rows()` promet de **ne jamais lever** : un `select` mal forme rend donc `[]`, avec un
 * 400 que personne ne voit, et la surface entiere disparait en silence. C'est le defaut qui
 * a coute trois sessions au lot 10 — `reviews` referencait `auth.users` et pas `profiles`,
 * donc `profiles!inner(...)` repondait 400 PGRST200 sur **les deux seules lectures sociales
 * du produit**, et l'ecran d'un defaut etait identique a celui d'un demarrage a froid.
 *
 * Aucun test ne pouvait le voir : ils doublent `fetch`. Ce qu'ils peuvent verifier, c'est
 * que **l'URL demandee est bien celle qui a ete essayee contre la vraie base** — ici le
 * 2026-08-15 a la cle publique, en visiteur anonyme : 200, et la contrainte
 * `lists_author_profile` (posee par `009_relations.sql`) existe bien.
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

/** Un `fetch` qui retient l'URL demandee et sert le corps donne. */
function spying(body: unknown) {
  const seen: string[] = [];
  const fetchImpl = (async (input: string) => {
    seen.push(String(input));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { seen, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
}

const ligne = (
  slug: string,
  handle: string,
  count: number,
  updatedAt: string,
  preview: readonly string[] = [],
) => ({
  slug,
  title: `liste ${slug}`,
  note: null,
  updated_at: updatedAt,
  list_items: [{ count }],
  preview: preview.map((subject) => ({ subject })),
  profiles: { handle, user_id: `id-${handle}`, face: null },
});

describe('l URL demandee', () => {
  it('joint les profils publics, embarque le compte et l apercu', async () => {
    const { seen, client } = spying([]);
    await client.discoverLists();

    const url = seen[0] ?? '';
    // La jointure restrictive : sans `!inner`, PostgREST rend aussi les listes dont le
    // profil ne correspond pas au filtre, avec `profiles: null`.
    expect(url).toContain('profiles!inner(handle,user_id,face)');
    expect(url).toContain('profiles.visibility=eq.public');
    // Les deux embarquements de `list_items`, sous deux alias : sans alias, PostgREST les
    // fusionne et le compte se perd.
    expect(url).toContain('list_items(count)');
    expect(url).toContain('preview:list_items(subject)');
    expect(url).toContain('preview.limit=4');
  });
});

describe('ancrage', () => {
  it('rend bien les listes servies, et rien de plus', async () => {
    const { client } = spying([ligne('a', 'lea', 3, '2026-08-01T10:00:00Z')]);
    const listes = await client.discoverLists();

    expect(listes).toHaveLength(1);
    expect(listes[0]?.handle).toBe('lea');
    expect(listes[0]?.authorId).toBe('id-lea');
    expect(listes[0]?.count).toBe(3);
  });
});

it('classe par nombre de series, puis par fraicheur', async () => {
  const { client } = spying([
    ligne('petite', 'a', 1, '2026-08-10T10:00:00Z'),
    ligne('grosse', 'b', 9, '2026-01-01T10:00:00Z'),
    ligne('moyenne-vieille', 'c', 4, '2026-01-01T10:00:00Z'),
    ligne('moyenne-neuve', 'd', 4, '2026-08-14T10:00:00Z'),
  ]);

  expect((await client.discoverLists()).map((one) => one.slug)).toEqual([
    'grosse',
    'moyenne-neuve',
    'moyenne-vieille',
    'petite',
  ]);
});

/**
 * ⚠️ La lecon de `discoverable`, appliquee telle quelle : **trier, jamais filtrer**. Ecarter
 * les listes vides ferait taire cette surface exactement au demarrage a froid — le jour ou
 * elle sert. Elles passent derriere, elles ne disparaissent pas.
 */
it('ne jette pas une liste vide, elle passe derriere', async () => {
  const { client } = spying([
    ligne('vide', 'a', 0, '2026-08-14T10:00:00Z'),
    ligne('pleine', 'b', 2, '2026-01-01T10:00:00Z'),
  ]);

  expect((await client.discoverLists()).map((one) => one.slug)).toEqual(['pleine', 'vide']);
});

/**
 * Sans handle, il n'y a personne a nommer ni de profil a ouvrir — la carte serait un titre
 * qui ne mene nulle part. Le cas existe : `008` refuse desormais qu'un compte sans nom
 * suive, mais rien n'efface les lignes anterieures.
 */
it('ecarte une ligne dont l auteur n a pas de nom', async () => {
  const { client } = spying([
    { ...ligne('orpheline', 'x', 5, '2026-08-14T10:00:00Z'), profiles: { user_id: 'id-x' } },
    ligne('bonne', 'y', 1, '2026-08-14T10:00:00Z'),
  ]);

  expect((await client.discoverLists()).map((one) => one.slug)).toEqual(['bonne']);
});

it('rend les cles de l apercu, et se passe d elles quand elles manquent', async () => {
  const { client } = spying([
    ligne('avec', 'a', 2, '2026-08-14T10:00:00Z', ['tmdb:1396', 'tmdb:1399']),
    { ...ligne('sans', 'b', 2, '2026-08-13T10:00:00Z'), preview: 'pas un tableau' },
  ]);
  const listes = await client.discoverLists();

  expect(listes[0]?.preview).toEqual(['tmdb:1396', 'tmdb:1399']);
  // Une liste dont l'apercu arrive dans une forme inattendue s'affiche **sans vignettes**,
  // jamais en disparaissant : une carte vaut infiniment plus que ses quatre miniatures.
  expect(listes[1]?.preview).toEqual([]);
});

it('ne leve pas quand le corps n est pas un tableau', async () => {
  const { client } = spying({ message: 'oups' });
  await expect(client.discoverLists()).resolves.toEqual([]);
});

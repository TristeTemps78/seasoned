import { describe, expect, it } from 'vitest';
import { SocialClient } from '../src/social/client';

/**
 * 🔴 **Refaire un geste rendait 42501, sur quatre ecritures sur cinq.**
 *
 * `Prefer: resolution=merge-duplicates` **est** un `ON CONFLICT DO UPDATE`. Le chemin
 * `UPDATE` exige une politique `UPDATE` — qu'une table sans charge utile n'a pas, et n'a
 * aucune raison d'avoir. Mesure du 2026-08-11 contre la vraie base :
 *
 *   follows 2e suivi : 42501 · review_likes 2e coeur : 42501 · list_items 2e ajout : 42501
 *
 * Et rien ne le disait : `response.ok` devient `false`, aucun ecran ne compte les echecs.
 * `review_likes` portait meme un commentaire promettant que « aimer deux fois ne doit pas
 * lever ».
 *
 * La regle : **la resolution se choisit sur le contenu de la ligne.** Une charge qui peut
 * changer (une note, un texte) demande `merge-duplicates` *et* une politique `UPDATE` ; une
 * ligne dont la cle est le fait entier demande `ignore-duplicates`.
 *
 * ⚠️ Ce fichier verifie **l'en-tete emis**, pas le comportement de la base : les tests
 * doublent `fetch`. Ce que la base fait vraiment est tenu par les scenarios 46 a 48 de
 * `scripts/rls-scenarios.sql`, rejouables par `npm run db:scenarios`.
 */

function capturing() {
  const sent: { url: string; prefer: string | undefined }[] = [];
  const fetchImpl = (async (url: unknown, init?: { headers?: Record<string, string> }) => {
    sent.push({ url: String(url), prefer: init?.headers?.['Prefer'] });
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}

const client = (fetchImpl: typeof fetch) =>
  new SocialClient({
    url: 'https://exemple.test',
    anonKey: 'cle',
    accessToken: () => 'jeton',
    fetchImpl,
  });

/** Ce que la table peut avoir a mettre a jour, et donc la resolution qui lui convient. */
const CAS = [
  {
    quoi: 'suivre quelqu un — la cle EST le fait',
    table: 'follows',
    attendu: 'ignore-duplicates',
    geste: (c: SocialClient) => c.follow('moi', 'toi'),
  },
  {
    quoi: 'aimer une critique — la cle EST le fait',
    table: 'review_likes',
    attendu: 'ignore-duplicates',
    geste: (c: SocialClient) => c.likeReview('moi', 'toi', 'tmdb:1396', 'series', true),
  },
  {
    quoi: 'ajouter a une liste — la cle EST le fait, et added_at ne doit pas bouger',
    table: 'list_items',
    attendu: 'ignore-duplicates',
    geste: (c: SocialClient) => c.addToList('moi', 'ma-liste', 'tmdb:1396'),
  },
  {
    quoi: 'publier un fait — les etoiles peuvent changer',
    table: 'activity',
    attendu: 'merge-duplicates',
    geste: (c: SocialClient) =>
      c.publish('moi', [
        { kind: 'rated_season', subject: 'tmdb:1396', season: 1, stars: 4, happenedOn: '2026-08-11' },
      ]),
  },
  {
    quoi: 'contribuer a la carte — la saison atteinte peut changer',
    table: 'stops',
    attendu: 'merge-duplicates',
    geste: (c: SocialClient) => c.publishStops('moi', [{ subject: 'tmdb:1396', reachedSeason: 3 }]),
  },
] as const;

describe('la resolution se choisit sur le contenu de la ligne', () => {
  for (const { quoi, table, attendu, geste } of CAS) {
    it(`${table} — ${quoi}`, async () => {
      const { sent, fetchImpl } = capturing();

      await geste(client(fetchImpl));

      const write = sent.find((s) => s.url.includes(`/${table}`));
      expect(write?.prefer).toContain(attendu);
    });
  }

  /**
   * ⚠️ Le garde qui compte vraiment : `merge-duplicates` **implique** une politique `UPDATE`
   * en base. Une ecriture qui le demande sans que la table l'accorde est le defaut du
   * 2026-08-11, et il est invisible cote client.
   */
  it('seules activity et stops demandent merge-duplicates, et les deux ont une politique UPDATE', () => {
    const avecCharge = CAS.filter((c) => c.attendu === 'merge-duplicates').map((c) => c.table);

    expect([...avecCharge].sort()).toEqual(['activity', 'stops']);
  });
});

/**
 * 🔴 **Un echec doit pouvoir se distinguer d'un vide.**
 *
 * `SocialClient` rend `[]` quand une lecture echoue et `false` quand une ecriture echoue —
 * et il a raison de ne jamais lever. Mais ce depot a paye deux fois le prix de cette
 * promesse : *l'ecran d'un defaut est identique a celui d'un demarrage a froid.* 10.0 (trois
 * lectures en 400 depuis toujours) et 017 (quatre ecritures en 42501) sont restes invisibles
 * pour cette seule raison.
 *
 * `onFailure` ne change aucun comportement : il donne a l'appelant de quoi savoir.
 */
describe('une panne est nommee, jamais avalee', () => {
  function failing(status: number) {
    const seen: { where: string; status?: number }[] = [];
    const fetchImpl = (async () => new Response('{}', { status })) as unknown as typeof fetch;
    const c = new SocialClient({
      url: 'https://exemple.test',
      anonKey: 'cle',
      accessToken: () => undefined,
      fetchImpl,
      onFailure: (where, code) => seen.push({ where, ...(code === undefined ? {} : { status: code }) }),
    });
    return { seen, c };
  }

  it('une lecture qui repond 400 le dit, et rend quand meme une liste vide', async () => {
    const { seen, c } = failing(400);

    await expect(c.feed()).resolves.toEqual([]);
    expect(seen[0]?.status).toBe(400);
    expect(seen[0]?.where).toContain('activity');
  });

  it('une ecriture refusee par RLS le dit', async () => {
    const { seen, c } = failing(403);

    await expect(c.follow('moi', 'toi')).resolves.toBe(false);
    expect(seen).toEqual([{ where: 'follows', status: 403 }]);
  });

  /**
   * ⚠️ Un 200 de la mauvaise **forme** est un echec aussi, et c'est celui qui se voit le
   * moins : un portail captif rend du HTML en 200. C'est exactement le cas que
   * `social-client.test.ts` couvre du cote « ne leve pas » ; ici on verifie qu'il se **dit**.
   */
  it('un 200 qui n est pas un tableau est un echec, pas un vide', async () => {
    const seen: string[] = [];
    const c = new SocialClient({
      url: 'https://exemple.test',
      anonKey: 'cle',
      accessToken: () => undefined,
      fetchImpl: (async () => new Response('{"message":"oups"}', { status: 200 })) as unknown as typeof fetch,
      onFailure: (where) => seen.push(where),
    });

    await expect(c.feed()).resolves.toEqual([]);
    expect(seen).toHaveLength(1);
  });

  /** Un observateur qui leve ne doit pas faire tomber ce qu'il observe. */
  it('un rappel qui leve ne casse rien', async () => {
    const c = new SocialClient({
      url: 'https://exemple.test',
      anonKey: 'cle',
      accessToken: () => undefined,
      fetchImpl: (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch,
      onFailure: () => {
        throw new Error('un observateur maladroit');
      },
    });

    await expect(c.feed()).resolves.toEqual([]);
  });

  it('et une lecture qui reussit ne signale rien', async () => {
    const seen: string[] = [];
    const c = new SocialClient({
      url: 'https://exemple.test',
      anonKey: 'cle',
      accessToken: () => undefined,
      fetchImpl: (async () => new Response('[]', { status: 200 })) as unknown as typeof fetch,
      onFailure: (where) => seen.push(where),
    });

    await c.feed();
    expect(seen).toEqual([]);
  });
});

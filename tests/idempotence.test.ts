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

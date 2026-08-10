import { describe, expect, it } from 'vitest';
import { projectActivity } from '../src/domain/activity';
import { EMPTY_JOURNAL, journalKey, setSeasonRating } from '../src/domain/journal';
import { SocialClient } from '../src/social/client';

/**
 * 🔴 **Noter deux saisons le meme soir empechait de publier quoi que ce soit.**
 *
 * Mesure du 2026-08-11 contre la vraie base. `003_social.sql` identifiait un fait par
 * `(user_id, kind, subject, happened_on)` — **sans la saison**. Deux `rated_season` de la
 * meme serie le meme jour tombaient donc sur la meme ligne, et `publish` les envoie d'un
 * bloc en `merge-duplicates` :
 *
 *   [21000] ON CONFLICT DO UPDATE command cannot affect row a second time
 *
 * Postgres rejette alors **l'envoi entier**, pas la ligne fautive. Un journal portant une
 * seule collision ne publiait plus rien — ni coeurs, ni series terminees, ni autres notes.
 *
 * ⚠️ **Et les deux seuls comptes de la base etaient dans ce cas**, tous les deux, avec deux
 * saisons notees le 2026-08-10. `activity` : 0 ligne.
 *
 * Ce que ce fichier verrouille tient en une phrase : **l'identite d'un fait est la meme des
 * deux cotes du reseau**. La projection ne doit jamais produire deux faits de meme identite,
 * et l'envoi doit viser cette identite-la — pas celle que PostgREST devinerait.
 */

const NOW = new Date('2026-08-03T12:00:00Z');
const BB = journalKey('1396');

/** La cle que `017_activity_saison.sql` declare, telle que la base la voit. */
const identite = (row: Record<string, unknown>) =>
  [row['kind'], row['subject'], row['season'], row['happened_on']].join(' ');

function capturing() {
  const urls: string[] = [];
  const bodies: unknown[] = [];
  const fetchImpl = (async (url: unknown, init?: { body?: string }) => {
    urls.push(String(url));
    bodies.push(init?.body === undefined ? undefined : JSON.parse(init.body));
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;
  return { urls, bodies, fetchImpl };
}

describe('l identite d un fait porte la saison', () => {
  it('🔴 deux saisons notees le meme jour sont deux faits, pas un', () => {
    const journal = setSeasonRating(setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, NOW), BB, 2, 3, NOW);

    const faits = projectActivity(journal, NOW);

    expect(faits).toHaveLength(2);
    expect(faits.map((f) => f.season).sort()).toEqual([1, 2]);
  });

  /**
   * L'invariant qui rend l'envoi survivable, enonce sur la projection elle-meme : deux faits
   * de meme identite dans un seul POST, et Postgres rend 21000 pour le lot complet.
   */
  it('aucun fait ne partage l identite d un autre', () => {
    const journal = setSeasonRating(
      setSeasonRating(setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, NOW), BB, 2, 3, NOW),
      BB,
      3,
      5,
      NOW,
    );

    const cles = projectActivity(journal, NOW).map(
      (f) => `${f.kind} ${f.subject} ${f.season ?? ''} ${f.happenedOn}`,
    );

    expect(new Set(cles).size).toBe(cles.length);
  });
});

describe('publish vise cette identite, et le dit', () => {
  it('🔴 nomme la cible du conflit — sinon PostgREST retombe sur la cle primaire', async () => {
    const { urls, fetchImpl } = capturing();
    const client = new SocialClient({
      url: 'https://exemple.test',
      anonKey: 'cle',
      accessToken: () => 'jeton',
      fetchImpl,
    });

    await client.publish('moi', [
      { kind: 'rated_season', subject: BB, season: 1, stars: 4, happenedOn: '2026-08-03' },
      { kind: 'rated_season', subject: BB, season: 2, stars: 3, happenedOn: '2026-08-03' },
    ]);

    expect(urls[0]).toContain('on_conflict=user_id,kind,subject,season,happened_on');
  });

  it('n envoie jamais deux lignes de meme identite', async () => {
    const { bodies, fetchImpl } = capturing();
    const client = new SocialClient({
      url: 'https://exemple.test',
      anonKey: 'cle',
      accessToken: () => 'jeton',
      fetchImpl,
    });
    const journal = setSeasonRating(setSeasonRating(EMPTY_JOURNAL, BB, 1, 4, NOW), BB, 2, 3, NOW);

    await client.publish('moi', projectActivity(journal, NOW));

    const lignes = bodies[0] as Record<string, unknown>[];
    expect(lignes).toHaveLength(2);
    expect(new Set(lignes.map(identite)).size).toBe(2);
  });
});

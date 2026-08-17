import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialClient } from '../src/social/client';
import { EMPTY_JOURNAL, mergeJournals, setShareTags, setTag } from '../src/domain/journal';

/**
 * Les mots publies — F11, et **le consentement avant tout le reste**.
 *
 * ## 🔴 Ce que ce fichier protege
 *
 * `Tags.tsx` a promis pendant neuf lots, a l'ecran : *« vos mots, ranges par vous, pour
 * vous »*. Les publier par defaut romprait cette promesse **retroactivement**, sur du texte
 * ecrit quand il etait promis prive. Le champ `shareTags` nomme donc l'ACCORD et non le
 * refus — l'inverse exact de `keepStopsPrivate`, dont la documentation explique pourquoi
 * contribuer y est le defaut : ce qui part est anonyme et illisible.
 *
 * ⚠️ Le test qui compte est le second : **rien ne part sans accord**. C'est la seule faute de
 * ce lot qui ne se rattrape pas — une fois les mots en ligne, ils ont ete lus.
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

function spying() {
  const seen: { url: string; method: string; body: string }[] = [];
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    seen.push({
      url: String(input),
      method: String(init?.method ?? 'GET'),
      body: String(init?.body ?? ''),
    });
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { seen, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
}

describe('publishTags — un etat, ecrit par suppression puis insertion', () => {
  it('efface les siens avant de reinserer', async () => {
    const { seen, client } = spying();
    await client.publishTags('moi', [
      { subject: 'tmdb:1396', tag: 'le dimanche', title: 'Breaking Bad' },
    ]);

    expect(seen.map((one) => one.method)).toEqual(['DELETE', 'POST']);
    // ⚠️ Le `DELETE` est borne a soi dans l'URL **et** par `tags_delete` dans la base. Sans
    // la seconde borne, republier ses mots viderait la table de tout le monde.
    expect(seen[0]?.url).toContain('tags?user_id=eq.moi');
    // ⚠️ Jamais `merge-duplicates` : ce chemin emprunte `UPDATE`, que cette table n'a
    // volontairement pas — c'est ce qui a rendu 42501 en silence le 2026-08-11.
    expect(seen[1]?.body).toContain('le dimanche');
  });

  it('🔴 sans un seul mot, efface quand meme — et n’insere rien', async () => {
    // Retirer son dernier mot doit le retirer du profil. Une condition `length > 0` laisserait
    // l'ancien vocabulaire en ligne pour toujours : c'est la difference entre un fait et un
    // etat, et c'est la lecon des quatre epinglees.
    const { seen, client } = spying();
    await client.publishTags('moi', []);

    expect(seen.map((one) => one.method)).toEqual(['DELETE']);
  });
});

describe('la fusion de deux appareils', () => {
  it('🔴 le SILENCE gagne, a l’inverse du refus de la carte des abandons', async () => {
    // `keepStopsPrivate` nomme un refus : `a || b`, le refus l'emporte. `shareTags` nomme un
    // accord : `a && b`, le silence l'emporte. Recopier la premiere regle ici republierait
    // les mots qu'on vient de reprendre sur l'autre appareil.
    const accepte = setShareTags(EMPTY_JOURNAL, true);
    const muet = EMPTY_JOURNAL;

    expect(mergeJournals(accepte, muet).shareTags).toBeUndefined();
    expect(mergeJournals(muet, accepte).shareTags).toBeUndefined();
    expect(mergeJournals(accepte, accepte).shareTags).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Le cablage : rien ne part sans accord
// ---------------------------------------------------------------------------

const envois = vi.hoisted(() => ({ tags: [] as unknown[][] }));

vi.mock('@/app/auth/AuthProvider', () => ({
  useAuth: () => ({
    configured: true,
    ready: true,
    account: { userId: 'moi', accessToken: 'jeton' },
  }),
}));

vi.mock('@/app/social/socialFrom', () => ({
  socialFrom: () => ({
    publish: async () => true,
    publishStops: async () => true,
    publishFavorites: async () => true,
    publishTags: async (_id: string, items: unknown[]) => {
      envois.tags.push(items);
      return true;
    },
    forgetStops: async () => true,
  }),
}));

const { PublishActivity } = await import('@/app/components/PublishActivity');
const { serializeJournal } = await import('@/src/domain/journal');
const { STORAGE_KEY } = await import('@/src/journal/local');

/** Un journal avec un mot pose, accord donne ou non. */
function journalWithWord(share: boolean) {
  const tagged = setTag(EMPTY_JOURNAL, 'tmdb:1396', 'le dimanche', true);
  return share ? setShareTags(tagged, true) : tagged;
}

beforeEach(() => {
  envois.tags = [];
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PublishActivity et les mots', () => {
  it('🔴 n’envoie RIEN tant que l’accord n’est pas donne', async () => {
    window.localStorage.setItem(STORAGE_KEY, serializeJournal(journalWithWord(false)));
    render(<PublishActivity />);
    await vi.advanceTimersByTimeAsync(6_000);

    // ⚠️ Le tableau vide EST un envoi legitime — il retire ce qui aurait ete publie avant une
    // reprise d'accord. Ce qui ne doit jamais arriver, c'est qu'un MOT y figure.
    expect(envois.tags.flat()).toEqual([]);
  });

  it('envoie le mot une fois l’accord donne, avec son instantane', async () => {
    // L'ancrage : sans lui, le test ci-dessus passerait aussi avec un composant qui
    // n'envoie jamais rien — il comparerait deux fois la meme absence.
    window.localStorage.setItem(STORAGE_KEY, serializeJournal(journalWithWord(true)));
    render(<PublishActivity />);
    // ⚠️ Plusieurs tours, et non un seul saut de 6 s : le journal se lit d'abord (asynchrone),
    // et c'est cette lecture qui declenche l'effet qui arme le minuteur de 4 s. Un unique
    // `advanceTimersByTime` avance un minuteur qui n'est pas encore pose.
    for (let i = 0; i < 6 && envois.tags.flat().length === 0; i += 1) {
      await vi.advanceTimersByTimeAsync(5_000);
    }

    expect(envois.tags.flat()).toEqual([{ subject: 'tmdb:1396', tag: 'le dimanche' }]);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SocialClient } from '../src/social/client';
import {
  journalKey,
  parseJournal,
  serializeJournal,
  setReview,
  withholdReview,
  EMPTY_JOURNAL,
} from '../src/domain/journal';
import { ROOT } from './sources';

/**
 * **F10 — retirer une critique qu'on a ecrite.**
 *
 * ## Ce que ce fichier garde, et pourquoi les trois moities comptent
 *
 * `006_reviews.sql` portait `reviews_delete` depuis le premier jour et **rien ne
 * l'appelait** : la base autorisait le retrait, le produit ne le proposait pas. Une critique
 * publiee etait donc definitive du point de vue de la personne qui l'avait ecrite — alors
 * que « Retirer ma reponse » existe depuis `024` pour un message de 600 caracteres.
 *
 * Le geste tient en trois choses, et deux sur trois ne suffisent pas :
 *
 * 1. **La copie publiee part** — `unpublishReview()`, borne aux trois colonnes de la cle
 *    naturelle. Sans les trois, le `DELETE` emporterait plus que la critique visee.
 * 2. **Le journal cesse de la republier** — `withholdReview()`. `Friends.refresh()` renvoie
 *    tout le journal a chaque ouverture de `/amis` : sans drapeau, le retrait durerait
 *    jusqu'a la page suivante.
 * 3. **Le texte reste** — c'est la regle 9 (export integral) et c'est ce que `/regles`
 *    promet desormais noir sur blanc. Effacer aurait ete la reponse facile et elle rendait
 *    la page publique menteuse.
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

/** Un `fetch` qui note methode et URL, et repond 204 comme un `DELETE` reel. */
function recording() {
  const calls: { method: string; url: string }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', url: String(url) });
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  return { calls, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
}

describe('la copie publiee part', () => {
  it('supprime sur les TROIS colonnes de la cle naturelle', async () => {
    const { calls, client } = recording();
    await expect(client.unpublishReview('moi', 'tmdb:1396', 'season:3')).resolves.toBe(true);

    const call = calls[0];
    expect(call?.method).toBe('DELETE');
    expect(call?.url).toContain('user_id=eq.moi');
    expect(call?.url).toContain('subject=eq.tmdb%3A1396');
    expect(call?.url).toContain('target=eq.season%3A3');
  });

  it('ne rend pas `true` quand la base refuse', async () => {
    // 🔴 L'ancrage qui compte : une ecriture ratee n'a **aucun ecran par elle-meme**, le
    // geste a l'air d'avoir marche. Si cette methode rendait `true` sur un 403, l'interface
    // effacerait la ligne de l'ecran **et** poserait le drapeau — donc une critique restee
    // en ligne que plus rien ne montre a son auteur, et qu'il ne peut plus retirer.
    const fetchImpl = (async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    const client = new SocialClient({ ...OPTIONS, fetchImpl });
    await expect(client.unpublishReview('moi', 'tmdb:1396', 'series')).resolves.toBe(false);
  });
});

describe('le journal garde le texte et cesse de le publier', () => {
  const key = journalKey('1396');

  function written() {
    return setReview(EMPTY_JOURNAL, key, 'series', { text: 'Un texte', throughSeason: 0 });
  }

  it('pose le drapeau sans toucher au texte', () => {
    const after = withholdReview(written(), key, 'series');
    const review = after.entries[key]?.reviews?.['series'];

    expect(review?.text).toBe('Un texte');
    expect(review?.unpublished).toBe(true);
  });

  it('repousse la date, sinon la fusion ressusciterait la publication', () => {
    // `mergeDated` garde la version la plus recente : un appareil qui porte encore la
    // version publiable l'emporterait au prochain accord, et republierait.
    const before = setReview(EMPTY_JOURNAL, key, 'series', { text: 'Un texte', throughSeason: 0 }, new Date('2026-08-10T10:00:00Z'));
    const after = withholdReview(before, key, 'series', new Date('2026-08-17T10:00:00Z'));

    expect(after.entries[key]?.reviews?.['series']?.at).toBe('2026-08-17T10:00:00.000Z');
  });

  it('survit a l aller-retour de serialisation', () => {
    // 🔴 Le defaut de 10.4bis, mot pour mot : `parseReviews` reconstruit un objet neuf a
    // partir des seuls champs qu'il connait. Un drapeau non relu serait ecrit puis efface a
    // la premiere sauvegarde — donc la critique reviendrait au rechargement de la page.
    const after = withholdReview(written(), key, 'series');
    const round = parseJournal(serializeJournal(after));

    expect(round.entries[key]?.reviews?.['series']?.unpublished).toBe(true);
  });

  it('reecrire le texte le remet en publication', () => {
    const after = setReview(withholdReview(written(), key, 'series'), key, 'series', {
      text: 'Un autre texte',
      throughSeason: 0,
    });

    expect(after.entries[key]?.reviews?.['series']?.unpublished).toBeUndefined();
  });

  it('ne fait rien sur une critique qui n existe pas', () => {
    expect(withholdReview(EMPTY_JOURNAL, key, 'series')).toBe(EMPTY_JOURNAL);
  });
});

/**
 * La troisieme moitie, celle qu'aucun test de domaine ne peut voir : la boucle de
 * publication doit lire le drapeau. Elle vit dans un composant qui parle a la vraie base,
 * donc c'est la **source** qu'on regarde — la meme forme de garde que `no-orphan-component`.
 */
it('la boucle de publication ecarte ce qui est retire', () => {
  const source = readFileSync(join(ROOT, 'app', 'components', 'Friends.tsx'), 'utf8');
  expect(source).toContain('review.unpublished !== true');
});

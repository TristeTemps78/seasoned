import { describe, expect, it } from 'vitest';
import { SocialClient } from '../src/social/client';

/**
 * `SocialClient` promet en tete de fichier qu'il **ne leve jamais** : « une panne du
 * social ne doit pas interrompre un produit dont tout le reste est local ».
 *
 * 🔴 **La promesse etait fausse, et c'est tout l'objet de ce fichier.** Le `try/catch`
 * vivait dans le lecteur HTTP ; le post-traitement, lui, vivait chez l'appelant. Un corps
 * JSON **valide mais de la mauvaise forme** — un objet la ou l'on attend un tableau —
 * traversait le garde `rows === undefined`, puis `rows.map(...)` levait. `?? []` ne
 * rattrape que `null` et `undefined`, jamais un objet : c'est le piege du `??` que ce
 * depot documente deja pour `TMDB_LANGUAGE`.
 *
 * Et personne ne rattrapait plus loin : `Reviews.tsx` ecrit `void ...then(...)` sans
 * `.catch`, donc la promesse cassee devenait un rejet non gere.
 *
 * ⚠️ **On tient la promesse a la source plutot que de semer des `.catch`.** Un `.catch`
 * par appelant serait « rien au cas ou » — quatre endroits a maintenir pour une garantie
 * qui appartient au module. Ces tests sont ce qui rend la phrase de l'en-tete verifiable.
 *
 * ⚠️ Ce fichier ne teste **que** cette promesse. `SocialClient` n'avait aucun test ; ce
 * n'est pas ici qu'on repare ca, sous peine de melanger un correctif et une couverture.
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

/** Un `fetch` qui rend exactement le corps demande, avec un statut 200. */
function serving(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
}

const clientServing = (body: unknown) =>
  new SocialClient({ ...OPTIONS, fetchImpl: serving(body) });

describe('SocialClient ne leve jamais', () => {
  // Le cas qui levait : PostgREST rend un tableau, mais un proxy captif, une enveloppe
  // d'erreur en 200 ou un mode `vnd.pgrst.object+json` rendent un objet.
  it('un objet la ou un tableau est attendu rend une liste vide', async () => {
    const client = clientServing({ message: 'oups' });

    await expect(client.following('moi')).resolves.toEqual([]);
    await expect(client.feed()).resolves.toEqual([]);
    await expect(client.reviewsFor('tmdb:1396')).resolves.toEqual([]);
    await expect(client.myProfile('moi')).resolves.toBeUndefined();
  });

  it('un corps qui n est pas du JSON ne fait pas tomber le fil', async () => {
    const client = new SocialClient({
      ...OPTIONS,
      fetchImpl: (async () => new Response('<html>portail captif</html>')) as unknown as typeof fetch,
    });

    await expect(client.feed()).resolves.toEqual([]);
  });

  it('un reseau qui tombe ne fait pas tomber le fil', async () => {
    const client = new SocialClient({
      ...OPTIONS,
      fetchImpl: (() => Promise.reject(new Error('hors ligne'))) as unknown as typeof fetch,
    });

    await expect(client.feed()).resolves.toEqual([]);
    await expect(client.myProfile('moi')).resolves.toBeUndefined();
  });

  it('l ancrage : sur une reponse bien formee, il rend bien quelque chose', async () => {
    // Sans lui, les trois tests ci-dessus passeraient aussi avec un module qui rend `[]`
    // en toutes circonstances — ils compareraient deux fois rien.
    const client = clientServing([
      {
        kind: 'liked',
        subject: 'tmdb:1396',
        happened_on: '2026-08-06',
        profiles: { handle: 'marie', user_id: 'u1' },
      },
    ]);

    await expect(client.feed()).resolves.toHaveLength(1);
  });
});

/**
 * Les abonnes — le pendant manquant du lot 6.
 *
 * ## Pourquoi les URL sont regardees, et pas seulement le resultat
 *
 * `following` et `followers` sont **le meme code lu dans l'autre sens** : une colonne pour
 * filtrer, l'autre pour collecter. Un copier-coller qui oublie d'inverter les deux rend une
 * liste parfaitement bien formee — **celle des gens que je suis**, affichee sous le titre
 * « vous suivent ». Aucun test de forme ne verrait la difference, et a l'ecran ce serait
 * juste faux pour tout le monde sauf les abonnements reciproques.
 *
 * C'est le meme raisonnement que la mutation de signe du `VALARM` (lot 4.3) : ce qui doit
 * etre teste n'est pas que la fonction rend quelque chose, c'est **qu'elle demande la bonne
 * chose**.
 */
describe('SocialClient.followers', () => {
  /** Un `fetch` qui note ce qu'on lui demande et rend une reponse par etape. */
  function recording(bodies: readonly unknown[]) {
    const asked: string[] = [];
    let step = 0;
    const fetchImpl = (async (url: string) => {
      asked.push(String(url));
      const body = bodies[Math.min(step++, bodies.length - 1)];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    return { asked, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
  }

  it('interroge `followee_id`, la ou `following` interroge `follower_id`', async () => {
    const mine = recording([[{ follower_id: 'u2' }], [{ user_id: 'u2', handle: 'marie' }]]);
    await mine.client.followers('moi');

    expect(mine.asked[0]).toContain('followee_id=eq.moi');
    expect(mine.asked[0]).toContain('select=follower_id');

    // L'ancrage par le miroir : sans lui, les deux assertions ci-dessus passeraient encore
    // avec une methode qui interroge toujours la meme colonne dans les deux sens.
    const theirs = recording([[{ followee_id: 'u2' }], [{ user_id: 'u2', handle: 'marie' }]]);
    await theirs.client.following('moi');

    expect(theirs.asked[0]).toContain('follower_id=eq.moi');
    expect(theirs.asked[0]).toContain('select=followee_id');
  });

  it('rend les profils des abonnes, pas leurs identifiants', async () => {
    const { client } = recording([
      [{ follower_id: 'u2' }],
      [{ user_id: 'u2', handle: 'marie', visibility: 'followers' }],
    ]);

    await expect(client.followers('moi')).resolves.toEqual([
      { userId: 'u2', handle: 'marie', visibility: 'followers' },
    ]);
  });

  it('watchersOf ne demande que les genres qui ne portent pas de saison', async () => {
    // 🔴 **Le defaut que ce test attrape est un spoiler, pas une erreur d'affichage.** Sans
    // le filtre de genre, l'encart de la fiche serie recevrait des `rated_season` — donc
    // « quelqu'un a note la saison 6 » chez un lecteur qui en est a la saison 2. Le fil, lui,
    // a le droit de les recevoir : il passe par `redactActivity` avec la position du lecteur,
    // ce que cet encart ne fait pas et n'a pas a faire (`AGENTS.md` regle 7).
    const { asked, client } = recording([[]]);
    await client.watchersOf('tmdb:1396');

    expect(asked[0]).toContain('subject=eq.tmdb%3A1396');
    expect(asked[0]).toContain('kind=in.(liked,finished)');

    // L'ancrage : le fil, lui, ne doit filtrer NI par serie NI par genre — sans quoi les
    // deux assertions ci-dessus passeraient aussi avec un filtre pose au mauvais endroit,
    // c'est-a-dire sur les deux lectures.
    const fil = recording([[]]);
    await fil.client.feed();
    expect(fil.asked[0]).not.toContain('kind=in.');
    expect(fil.asked[0]).not.toContain('subject=eq.');
  });

  it('discoverable trie par ce qu il y a a lire, et n ecarte personne', async () => {
    // 🔴 **Le reflexe aurait ete de filtrer, et il aurait tue le composant** : `Discover`
    // repond au demarrage a froid, c'est-a-dire au moment ou personne n'a rien ecrit. Un
    // filtre l'aurait rendu muet precisement le jour ou il sert. Ce test dit les deux
    // choses a la fois — l'ordre change, la liste ne raccourcit pas.
    const { client } = recording([
      [
        { user_id: 'u1', handle: 'vide', visibility: 'public', reviews: [], lists: [] },
        { user_id: 'u2', handle: 'prolixe', visibility: 'public', reviews: [{ count: 3 }], lists: [{ count: 2 }] },
        { user_id: 'u3', handle: 'discret', visibility: 'public', reviews: [{ count: 1 }], lists: [] },
      ],
    ]);

    const found = await client.discoverable();

    expect(found.map((p) => p.handle)).toEqual(['prolixe', 'discret', 'vide']);
    expect(found.map((p) => p.wrote)).toEqual([5, 1, 0]);
  });

  it('personne ne me suit : aucun second appel', async () => {
    // ⚠️ Sans le garde, la seconde requete part avec `in.()` — une demande vide envoyee au
    // reseau, sur une page que tout le monde ouvre.
    const { asked, client } = recording([[]]);

    await expect(client.followers('moi')).resolves.toEqual([]);
    expect(asked).toHaveLength(1);
  });
});

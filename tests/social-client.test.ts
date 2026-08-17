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
    const mine = recording([[{ profiles: { user_id: 'u2', handle: 'marie' } }]]);
    await mine.client.followers('moi');

    expect(mine.asked[0]).toContain('followee_id=eq.moi');
    // ⚠️ **La contrainte est nommee, et c'est de l'API.** `follows` reference `profiles`
    // deux fois depuis `026` : `profiles!inner` tout court rendrait **300 PGRST201**
    // (« more than one relationship found »), mesure contre la vraie base le 2026-08-17.
    // Un test de forme est ici la seule garde possible — les tests doublent `fetch`.
    expect(mine.asked[0]).toContain('profiles!follows_follower_profile!inner');

    // L'ancrage par le miroir : sans lui, les deux assertions ci-dessus passeraient encore
    // avec une methode qui interroge toujours la meme colonne dans les deux sens.
    const theirs = recording([[{ profiles: { user_id: 'u2', handle: 'marie' } }]]);
    await theirs.client.following('moi');

    expect(theirs.asked[0]).toContain('follower_id=eq.moi');
    expect(theirs.asked[0]).toContain('profiles!follows_followee_profile!inner');
  });

  it('rend les profils des abonnes en UN seul appel', async () => {
    const { asked, client } = recording([
      [{ profiles: { user_id: 'u2', handle: 'marie', visibility: 'followers' } }],
    ]);

    await expect(client.followers('moi')).resolves.toEqual([
      { userId: 'u2', handle: 'marie', visibility: 'followers' },
    ]);

    // 🔴 L'ancrage qui compte : ces deux lectures faisaient **deux** allers-retours chacune
    // — la liste des identifiants, puis les profils —, soit quatre pour un profil. C'est le
    // dernier doublon mesure le 2026-08-17, et rien d'autre qu'un compte d'appels ne peut
    // dire qu'il est parti.
    expect(asked).toHaveLength(1);
  });

  it('watchersOf ne demande que les genres qui ne portent pas de saison', async () => {
    // 🔴 **Le defaut que ce test attrape est un spoiler, pas une erreur d'affichage.** Sans
    // le filtre de genre, l'encart de la fiche serie recevrait des `rated_season` — donc
    // « quelqu'un a note la saison 6 » chez un lecteur qui en est a la saison 2. Le fil, lui,
    // a le droit de les recevoir : il passe par `redactActivity` avec la position du lecteur,
    // ce que cet encart ne fait pas et n'a pas a faire.
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

/**
 * L'apercu d'une liste — quatre series montrees **sans requete supplementaire**.
 *
 * ## Ce que ces tests peuvent prouver, et ce qu'ils ne peuvent pas
 *
 * Ils doublent `fetch`, donc ils ne prouvent **rien** sur ce que PostgREST accepte
 * reellement : c'est la lecon que ce depot a payee trois sessions au lot 10, ou trois
 * lectures repondaient 400 depuis toujours pendant que la suite etait verte.
 *
 * La validite de la requete a donc ete verifiee **contre la vraie base**, a la cle publique,
 * avec son ancrage — une colonne inexistante rend `42703`, une relation inexistante
 * `PGRST200`, un tri embarque invalide `42703`, et la requete d'ici rend `200`.
 *
 * Ce qui suit couvre l'autre moitie, celle qu'un appel reseau ne montre pas : **la forme
 * demandee** et **la tolerance du decodage**. Un apercu casse doit couter ses vignettes,
 * jamais la liste.
 */
describe('SocialClient.listsBy — l apercu voyage avec le compte', () => {
  function recording(body: unknown) {
    const asked: string[] = [];
    const fetchImpl = (async (url: string) => {
      asked.push(String(url));
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    return { asked, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
  }

  const ROW = {
    slug: 'a-voir',
    title: 'À voir',
    updated_at: '2026-08-11T00:00:00Z',
    list_items: [{ count: 12 }],
    preview: [
      { subject: 'tmdb:1396', title: 'Breaking Bad', poster_path: '/bb.jpg' },
      // Le fond d'avant `020` : une cle sans instantane, qui doit continuer de passer.
      { subject: 'tmdb:94605' },
    ],
  };

  it('demande le compte ET l apercu dans un seul aller-retour', async () => {
    const { asked, client } = recording([ROW]);
    const lists = await client.listsBy('moi');

    // ⚠️ **Un seul appel.** C'est l'invariant qui compte : la solution evidente — un appel par
    // liste — est exactement ce que `SeriesList.count` s'interdit (« dix listes en feraient
    // sinon onze »), et rien d'autre que ce decompte ne l'empeche de revenir.
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('list_items(count)');
    // ⚠️ `title` et `poster_path` dans le meme embarquement : sans eux la carte se rabat sur
    // le journal du lecteur et annonce « Tracked series » pour toute serie qu'il ne suit
    // pas — c'est-a-dire pour toute liste qu'il decouvre. Voir `020_list_items_titre.sql`.
    expect(asked[0]).toContain('preview:list_items(subject,title,poster_path)');
    // Borne cote serveur, jamais cote client : sans `preview.limit`, une liste de 500 series
    // ferait voyager 500 cles pour en afficher quatre.
    expect(asked[0]).toContain('preview.limit=4');
    // ⚠️ Le meme ordre que le contenu de la liste depuis `032` : la vignette de tete doit
    // etre la premiere de la liste ouverte, sinon la carte annonce un ordre que l'ouverture
    // dement. `nullslast` parce que Postgres met les `null` EN TETE sur un tri ascendant.
    expect(asked[0]).toContain('preview.order=ordinal.asc.nullslast,added_at.asc');

    expect(lists[0]?.count).toBe(12);
    // L'instantane voyage avec la ligne quand elle en a un, et son absence n'ecarte rien.
    expect(lists[0]?.preview).toEqual([
      { subject: 'tmdb:1396', title: 'Breaking Bad', posterPath: '/bb.jpg' },
      { subject: 'tmdb:94605' },
    ]);
  });

  it('une liste dont l apercu manque garde sa place, sans vignettes', async () => {
    // Le cas reel : les reponses d'avant ce changement, et toute forme inattendue. Perdre
    // quatre miniatures est un defaut d'affichage ; perdre la liste serait une page blanche.
    const { client } = recording([{ ...ROW, preview: undefined }]);
    await expect(client.listsBy('moi')).resolves.toEqual([
      expect.objectContaining({ slug: 'a-voir', count: 12, preview: [] }),
    ]);

    const brise = recording([{ ...ROW, preview: 'pas un tableau' }]);
    await expect(brise.client.listsBy('moi')).resolves.toEqual([
      expect.objectContaining({ slug: 'a-voir', preview: [] }),
    ]);

    // Et une entree de la mauvaise forme ne fait pas tomber les autres.
    const partiel = recording([{ ...ROW, preview: [{ subject: 'tmdb:1396' }, { autre: 1 }, null] }]);
    await expect(partiel.client.listsBy('moi')).resolves.toEqual([
      expect.objectContaining({ preview: [{ subject: 'tmdb:1396' }] }),
    ]);
  });
});

/**
 * **Le doublon d'affiche, vu a l'ecran le 2026-08-17.**
 *
 * `/u/test` montrait **deux fois Breaking Bad** dans « ce qu'il aime ». La cle naturelle
 * d'`activity` porte `happened_on` (017), donc aimer une serie, la retirer et la reaimer un
 * autre jour pose deux lignes — toutes deux vraies, toutes deux `liked`. Une carte de visite
 * qui repete une affiche donne un gout deux fois plus etroit qu'il n'est.
 *
 * ⚠️ Aucun test ne pouvait le voir avant celui-ci : la forme de l'URL etait juste, et c'est
 * le **contenu** rendu par la base qui portait le doublon. C'est exactement la limite que ce
 * fichier documente — les tests doublent `fetch`. Ce qu'ils peuvent garder, c'est le
 * dedoublonnage lui-meme.
 */
describe('une affiche par serie, une ligne par personne', () => {
  function servingRows(rows: readonly unknown[]) {
    const fetchImpl = (async () =>
      new Response(JSON.stringify(rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as unknown as typeof fetch;
    return new SocialClient({ ...OPTIONS, fetchImpl });
  }

  const ligne = (subject: string, handle: string, when: string, kind = 'liked') => ({
    kind,
    subject,
    happened_on: when,
    profiles: { handle, user_id: `u-${handle}` },
  });

  it('`lovedBy` ne rend pas deux fois la meme serie', async () => {
    const client = servingRows([
      ligne('tmdb:1396', 'marie', '2026-08-17'),
      ligne('tmdb:1396', 'marie', '2026-08-10'),
      ligne('tmdb:94605', 'marie', '2026-08-09'),
    ]);

    const found = await client.lovedBy('u-marie');
    expect(found.map((one) => one.subject)).toEqual(['tmdb:1396', 'tmdb:94605']);
    // ⚠️ Le plus RECENT survit : les lignes arrivent triees par la base, et le premier de
    // chaque est celui qu'on garde. Sans cet ancrage, garder le dernier passerait aussi.
    expect(found[0]?.happenedOn).toBe('2026-08-17');
  });

  it('`watchersOf` ne rend pas deux fois la meme personne', async () => {
    // Quelqu'un qui a **aime et termine** la meme serie : deux genres, deux lignes, une
    // seule personne. Elle apparaissait deux fois, sous deux phrases differentes.
    const client = servingRows([
      ligne('tmdb:1396', 'marie', '2026-08-17', 'finished'),
      ligne('tmdb:1396', 'marie', '2026-08-16', 'liked'),
      ligne('tmdb:1396', 'jean', '2026-08-15', 'liked'),
    ]);

    const found = await client.watchersOf('tmdb:1396');
    expect(found.map((one) => one.handle)).toEqual(['marie', 'jean']);
  });
});

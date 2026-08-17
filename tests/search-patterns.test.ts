import { describe, expect, it } from 'vitest';
import { SocialClient } from '../src/social/client';

/**
 * **Les motifs de recherche, et le guillemet qui les rendait steriles.**
 *
 * ## 🔴 Ce que la mesure du 2026-08-17 a trouve
 *
 * `searchLists` composait `title=ilike."*motif*"` depuis le 2026-08-16, en promettant que
 * *« les guillemets doubles autour de la valeur neutralisent »* virgules et parentheses. Les
 * guillemets **entrent dans le motif** : contre la vraie base, sur une ligne dont le mot est
 * `le dimanche`,
 *
 *     tags?tag=ilike."*dimanche*"  → 200 []
 *     tags?tag=ilike.*dimanche*    → 200 [{"tag":"le dimanche"}]
 *
 * La recherche de listes ne pouvait donc rien trouver, jamais, et l'ecran etait exactement
 * celui d'« aucun resultat ». C'est le defaut 10.0 sous sa forme la plus pure.
 *
 * ## ⚠️ Ce qu'un test peut garder, et ce qu'il ne peut pas
 *
 * Il ne peut **pas** prouver qu'une requete trouve : ces tests doublent `fetch`, et c'est
 * precisement pour ca que le defaut a vecu. Ce qu'il peut faire est empecher le retour du
 * motif fautif — et exiger que les jokers soient neutralises, ce qui est verifiable sur la
 * forme.
 */

const OPTIONS = { url: 'https://exemple.test', anonKey: 'cle', accessToken: () => undefined };

/** Un `fetch` qui note l'URL demandee et rend une liste vide. */
function recording() {
  const asked: string[] = [];
  const fetchImpl = (async (url: string) => {
    asked.push(String(url));
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { asked, client: new SocialClient({ ...OPTIONS, fetchImpl }) };
}

describe('aucun guillemet dans un motif `ilike`', () => {
  it('les quatre recherches composent un motif nu', async () => {
    const { asked, client } = recording();
    await client.searchLists('dimanche');
    await client.searchReviews('dimanche');
    await client.searchTags('dimanche');
    await client.tagged('le dimanche');

    expect(asked).toHaveLength(4);
    for (const url of asked) {
      // ⚠️ La forme fautive est `ilike."` — sous n'importe quel encodage. `%22` est le
      // guillemet une fois l'URL encodee, et c'est la forme qu'aurait produite un
      // `encodeURIComponent` applique au motif entier.
      expect(url).not.toContain('ilike."');
      expect(url).not.toContain('ilike.%22');
      expect(url).toContain('ilike.');
    }
  });

  it('les jokers tapes par quelqu un sont neutralises', async () => {
    // 🔴 `_` non echappe remplace **n'importe quel caractere** : `*di_anche*` trouve
    // `le dimanche`, mesure contre la vraie base. Une recherche ou un souligne elargit
    // silencieusement le resultat n'est pas une recherche.
    const { asked, client } = recording();
    await client.searchTags('di_anche');
    await client.searchLists('100%');

    expect(asked[0]).toContain(encodeURIComponent('\\_'));
    expect(asked[1]).toContain(encodeURIComponent('\\%'));
  });

  it('le seuil de trois caracteres tient, et il n envoie aucune requete', async () => {
    // Sous trois caracteres on rendrait la moitie du corpus, ce qui est une enumeration.
    // L'ancrage est le **compte d'appels** : se taire en envoyant quand meme la requete
    // couterait un aller-retour par frappe.
    const { asked, client } = recording();
    await expect(client.searchLists('di')).resolves.toEqual([]);
    await expect(client.searchReviews('di')).resolves.toEqual([]);
    await expect(client.searchTags('di')).resolves.toEqual([]);

    expect(asked).toEqual([]);
  });

  it('un mot vide ne demande rien non plus', async () => {
    const { asked, client } = recording();
    await expect(client.tagged('   ')).resolves.toEqual([]);
    expect(asked).toEqual([]);
  });
});

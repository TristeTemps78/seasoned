import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { DICTIONARIES } from '../lib/i18n';

/**
 * Aucun ecran ne promet « rien ne sort d'ici » sans savoir s'il y a un compte.
 *
 * ## Le defaut que ce test attrape
 *
 * Trois phrases du dictionnaire disaient « rien n'est envoye ». Elles etaient vraies le
 * jour ou elles ont ete ecrites, et **le lot 6.3 les a rendues mensongeres** : avec un
 * compte, une copie du journal part sur le serveur a chaque geste.
 *
 * Les corriger une par une aurait suffi ce jour-la et rate la quatrieme, ecrite six mois
 * plus tard par quelqu'un qui se souvient de la promesse d'origine — c'est la forme
 * d'echec la plus banale d'un produit qui a change d'hypothese en cours de route.
 *
 * La promesse conditionnelle vit donc **a un seul endroit**, `WhereItLives`, qui lit la
 * session. Ce test interdit de la reecrire ailleurs.
 *
 * ⚠️ Il porte sur le **dictionnaire** et non sur les composants : c'est la que les phrases
 * vivent (`no-hardcoded-strings` garantit qu'aucune n'est ecrite en dur dans un `.tsx`).
 */

/** Les tournures absolues qui deviennent fausses des qu'un compte existe. */
const ABSOLUTE_CLAIMS = [
  /rien n[’']est envoy/i,
  /ne (sort|sortent) (pas |jamais )?(de|d[’'])\s*(ce|cet)/i,
  /nothing (is |gets )?sent/i,
  /never leaves? (this|your) (browser|device)/i,
];

/**
 * Les cles autorisees — **et chacune doit dire pourquoi**.
 *
 * C'est la valeur de ce test : il n'interdit pas la phrase, il oblige a la justifier. Une
 * exception sans raison ecrite est une exception que personne ne pourra reevaluer.
 */
const ALLOWED = new Map([
  // Rendue **uniquement** sans compte : c'est l'autre branche de `WhereItLives`.
  ['lives.local', 'la formulation locale, jamais affichee a qui synchronise'],
  // Le bandeau ne s'affiche plus des qu'un compte existe (DataSafety, garde ajoutee le
  // 2026-08-04) : sa phrase est donc vraie partout ou elle est lue.
  ['safety.body', 'bandeau masque des qu il y a un compte'],
  // La politique qualifie explicitement (« Sans compte, … ») — c'est le seul endroit ou la
  // nuance a la place d'etre expliquee au lieu d'etre contournee.
  ['privacy.now.title', 'qualifiee par « sans compte »'],
  ['privacy.now.body', 'qualifiee par « sans compte »'],
  // Narration : la phrase y est **citee entre guillemets** pour raconter son retrait.
  ['privacy.next.body', 'cite la phrase retiree, ne la promet pas'],
  // Le fichier .ics est fabrique dans le navigateur et rien n'est televerse : vrai avec ou
  // sans compte, parce que le calendrier ne passe par aucun serveur.
  ['calendar.body', 'le .ics ne transite par aucun serveur'],
  // Le bilan est **calcule** ici et n'est jamais envoye ; c'est le journal qui se
  // synchronise, pas le resultat.
  ['tallyPage.empty.body', 'le calcul reste local, seul le journal se synchronise'],
]);

function offenders(messages: Record<string, string>): string[] {
  return Object.entries(messages)
    .filter(([key, value]) => !ALLOWED.has(key) && ABSOLUTE_CLAIMS.some((re) => re.test(value)))
    .map(([key]) => key);
}

it('aucune promesse absolue de non-envoi hors des cles qui la qualifient', () => {
  expect(offenders(DICTIONARIES.fr)).toEqual([]);
  expect(offenders(DICTIONARIES.en)).toEqual([]);
});

it('le motif attrape bien ce qu il vise', () => {
  // Sans cet ancrage, une expression cassee rendrait le test vert pour toujours — le
  // defaut le plus courant des tests qui verifient une absence.
  expect(offenders({ 'faux.exemple': 'Vos notes restent ici, rien n’est envoyé.' })).toEqual([
    'faux.exemple',
  ]);
  expect(offenders({ 'faux.anglais': 'Your notes stay here, nothing is sent.' })).toEqual([
    'faux.anglais',
  ]);
});

it('le dictionnaire lu est bien celui du depot', () => {
  // Verifie que l'import n'est pas un objet vide : un test qui parcourt zero cle passe.
  expect(Object.keys(DICTIONARIES.fr).length).toBeGreaterThan(200);
  expect(readFileSync('lib/i18n.ts', 'utf8')).toContain("'lives.local'");
});

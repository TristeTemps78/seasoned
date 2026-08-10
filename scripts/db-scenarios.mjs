#!/usr/bin/env node
/**
 * Rejoue les scenarios RLS contre la **vraie** base.
 *
 *   npm run db:scenarios
 *
 * ## Ce que ce script prouve, et qu'aucun test ne peut prouver
 *
 * Les politiques RLS sont la seule couche d'autorisation du produit : PostgREST est
 * expose au navigateur avec une cle publique. Or les tests doublent `fetch` — ils
 * verifient l'URL qu'on construit, **jamais qu'elle repond**, et encore moins ce qu'elle
 * laisse voir. C'est exactement ce qui a permis au fil et aux critiques de ne rien
 * pouvoir lire depuis toujours, avec 767 tests verts (`009_relations.sql`).
 *
 * ## Rien ne persiste, et ce n'est pas une promesse mais une mecanique
 *
 * `rls-scenarios.sql` se termine par un `raise exception`, jamais par un `commit` : une
 * exception annule la transaction **entiere**, semis compris, quel que soit le chemin
 * pris. Le rapport voyage donc dans le message d'erreur — d'ou le fait que ce script
 * traite une erreur `RLSOK` comme un **succes**. C'est inhabituel, et c'est voulu :
 * l'unique sortie du SQL est celle qui n'ecrit rien.
 *
 * Le script le verifie ensuite, plutot que de le supposer.
 */

import { readFileSync } from 'node:fs';
import { DIM, GREEN, RED, RESET, YELLOW, projectRefFrom, readEnv } from './env.mjs';

const API = 'https://api.supabase.com';

const env = readEnv();
const token = env['SUPABASE_ACCESS_TOKEN'];
const ref = projectRefFrom(env['NEXT_PUBLIC_SUPABASE_URL']);

function fail(message, whatToDo) {
  console.log(`${RED}✗${RESET} ${message}`);
  if (whatToDo) console.log(`  ${YELLOW}→ ${whatToDo}${RESET}`);
  process.exit(1);
}

if (token === undefined || ref === undefined) {
  fail(
    'SUPABASE_ACCESS_TOKEN ou NEXT_PUBLIC_SUPABASE_URL manque dans `.env`',
    'Meme prerequis que `npm run db:push`.',
  );
}

/** Un appel a l'API de gestion. **Ne jamais faire figurer le jeton dans une trace.** */
async function query(sql) {
  const response = await fetch(`${API}/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text();
  let payload;
  try {
    payload = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }
  return { ok: response.ok, status: response.status, payload, text };
}

console.log('\nScenarios RLS — Voltface\n');

const before = await query(
  `select (select count(*) from public.profiles) as profiles,
          (select count(*) from public.follows)  as follows,
          (select count(*) from public.activity) as activity,
          (select count(*) from auth.users)      as users,
          (select count(*) from public.quiz_questions where on_day = current_date) as today;`,
);
if (!before.ok) fail(`Impossible de lire l'etat initial : HTTP ${before.status}`);
const avant = before.payload?.[0] ?? {};
console.log(
  `${DIM}avant  : ${avant.users} compte(s), ${avant.profiles} profil(s), ` +
    `${avant.follows} abonnement(s), ${avant.activity} activite(s)${RESET}`,
);
// La manche du jour se lit ici plutot que de se supposer : un ecran vide et une manche
// absente donnent exactement le meme ecran, et c'est ce qui a masque 10.0 pendant trois
// sessions.
console.log(`${DIM}manche : ${avant.today} question(s) pour aujourd'hui${RESET}\n`);

const result = await query(readFileSync('scripts/rls-scenarios.sql', 'utf8'));

// Le SQL sort TOUJOURS par une exception : c'est ce qui garantit l'annulation. Un succes
// est donc une erreur portant `RLSOK` — et un vrai `ok` voudrait dire que le fichier a
// commite quelque chose, ce qui serait le seul echec grave.
const message = result.payload?.message ?? result.text;

if (result.ok) {
  fail(
    "Le SQL s'est termine sans exception",
    "rls-scenarios.sql doit finir par `raise exception` : c'est ce qui annule la transaction. Verifier qu'aucun `commit` ne s'y est glisse.",
  );
}

const rapport = /RLSOK|scenario\(s\)/.test(message) ? message : undefined;
if (rapport === undefined) {
  console.log(`${RED}✗${RESET} Le SQL a echoue avant d'avoir pu mesurer :\n`);
  console.log(message.slice(0, 2000));
  process.exit(1);
}

console.log(rapport.replace(/^ERROR:\s*/, '').trim());

// On ne suppose pas que rien n'a persiste : on le mesure.
const after = await query(
  `select (select count(*) from public.profiles) as profiles,
          (select count(*) from public.follows)  as follows,
          (select count(*) from public.activity) as activity,
          (select count(*) from auth.users)      as users;`,
);
const apres = after.payload?.[0] ?? {};
const identique = ['users', 'profiles', 'follows', 'activity'].every((k) => avant[k] === apres[k]);

console.log(
  `\n${DIM}apres  : ${apres.users} compte(s), ${apres.profiles} profil(s), ` +
    `${apres.follows} abonnement(s), ${apres.activity} activite(s)${RESET}`,
);

if (!identique) {
  fail(
    '🔴 DES LIGNES ONT SURVECU — la transaction n a pas ete annulee',
    'Nettoyer a la main, et chercher un `commit` dans rls-scenarios.sql.',
  );
}
console.log(`${GREEN}✓${RESET} rien n'a persiste — les compteurs sont inchanges`);

const echecs = /(\d+) echec\(s\)/.exec(message);
if (echecs !== null && echecs[1] !== '0') {
  console.log(`\n${RED}✗${RESET} ${echecs[1]} scenario(s) en echec.\n`);
  process.exit(1);
}
console.log(`${GREEN}✓${RESET} tous les scenarios passent\n`);

#!/usr/bin/env node
/**
 * Poser UNE question a la vraie base — et rien d'autre.
 *
 *   npm run db:query -- "select count(*) from public.reviews"
 *   npm run db:query -- --fichier scripts/sql/quelque-chose.sql
 *
 * ## Pourquoi ce script existe
 *
 * Ce depot repete que *vert ne veut pas dire marche* : les tests doublent `fetch`, donc ils
 * prouvent la **forme** d'une URL, jamais que la base l'accepte. Les deux outils qui parlent
 * a la vraie base avaient jusqu'ici une portee fixe — `db:push` applique tout le schema,
 * `db:scenarios` rejoue les 72 scenarios RLS. Il manquait le geste le plus simple : *combien
 * y a-t-il de lignes, et est-ce que cette contrainte tiendrait ?*
 *
 * Le 2026-08-17, avant d'ajouter trois cles etrangeres vers `profiles`, la seule facon de
 * savoir si des lignes orphelines les feraient echouer etait d'ouvrir un tableau de bord.
 * C'est exactement l'etape manuelle que `db-push.mjs` documente comme *« placee entre du code
 * ecrit et du code qui marche, et qui finit toujours par ne pas etre faite »*.
 *
 * ## ⚠️ Ce qu'il n'est pas
 *
 * **Pas un chemin d'ecriture.** Rien ici n'empeche techniquement un `update` — le jeton de
 * gestion peut tout — mais toute modification durable du schema appartient a `supabase/*.sql`,
 * qui est rejoue, versionne et relisible. Une correction tapee ici ne survivrait pas au
 * prochain `db:push`, et personne ne saurait qu'elle a eu lieu.
 *
 * ⚠️ Le jeton (`SUPABASE_ACCESS_TOKEN`) vaut pour **tout le compte** Supabase. Il ne figure
 * jamais dans une trace, comme dans `db-push.mjs`.
 */

import { readFileSync } from 'node:fs';
import { DIM, RED, RESET, YELLOW, projectRefFrom, readEnv } from './env.mjs';

const env = readEnv();
const token = env['SUPABASE_ACCESS_TOKEN'];
const ref = projectRefFrom(env['NEXT_PUBLIC_SUPABASE_URL']);

function fail(message, whatToDo) {
  console.log(`${RED}✗${RESET} ${message}`);
  if (whatToDo) console.log(`  ${YELLOW}→ ${whatToDo}${RESET}`);
  process.exit(1);
}

if (ref === undefined) fail('NEXT_PUBLIC_SUPABASE_URL est absente ou illisible dans `.env`');
if (token === undefined) {
  fail(
    'SUPABASE_ACCESS_TOKEN est absent de `.env`',
    'Le meme jeton que `npm run db:push` — https://supabase.com/dashboard/account/tokens',
  );
}

const args = process.argv.slice(2);
const fromFile = args[0] === '--fichier' || args[0] === '-f';
const query = fromFile ? readFileSync(args[1] ?? '', 'utf8') : args.join(' ');

if (query.trim().length === 0) {
  fail(
    'Aucune requete',
    'npm run db:query -- "select count(*) from public.profiles"',
  );
}

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});

const text = await response.text();
if (!response.ok) {
  // ⚠️ Le statut et le message de l'API, jamais l'en-tete d'autorisation.
  fail(`HTTP ${response.status}`, text.slice(0, 500));
}

let rows;
try {
  rows = JSON.parse(text);
} catch {
  console.log(text);
  process.exit(0);
}

// Un tableau de lignes se lit en colonnes ; tout le reste se lit tel quel.
if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object') {
  console.table(rows);
  console.log(`${DIM}${rows.length} ligne(s)${RESET}`);
} else {
  console.log(JSON.stringify(rows, null, 2));
}

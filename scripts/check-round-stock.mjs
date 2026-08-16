#!/usr/bin/env node
/**
 * Combien de jours de quiz restent d'avance.
 *
 *   npm run db:stock          # seuil par defaut : 7 jours
 *   npm run db:stock -- 14
 *
 * ## 🔴 Le defaut, mesure le 2026-08-16 : 5 manches d'avance pour un seuil de 7
 *
 * Le stock se vide **en silence**. Rien dans le produit ne le dit — et c'est juste, un
 * joueur n'a pas a savoir combien de manches sont en reserve. Rien dans la CI non plus, et
 * c'est juste aussi : `ci.yml` refuse tout secret par principe, donc elle ne peut pas
 * interroger la base.
 *
 * Restait `db:scenarios`, dont le scenario 49 verifie exactement ca — mais il faut y penser,
 * et une reserve qui se vide est precisement ce a quoi on ne pense pas. Le jour ou elle
 * atteint zero, la manche du jour est vide pour tout le monde, sans un mot.
 *
 * ## Ce que ce script est, et ce qu'il n'est pas
 *
 * Il **ne construit rien** : `db:round` le fait deja, et bien. Il repond a une seule
 * question — *combien de jours avant que ce soit vide ?* — et il **sort en echec** sous le
 * seuil, pour pouvoir etre branche sur quelque chose qui s'execute tout seul.
 *
 * ⚠️ **Le brancher n'est pas fait ici, et c'est delibere.** Le cron de cette machine vit
 * dans Hermes, hors de ce depot ; poser une tache planifiee depuis un script de projet
 * serait une modification invisible depuis le depot qui la porte. Ce script rend la chose
 * *branchable* ; la brancher est une decision, pas un effet de bord.
 *
 * ⚠️ **Aucun `process.exit()` ici, et c'est un correctif.** La premiere version sortait par
 * `process.exit(1)` pendant que le socket d'`undici` etait encore ouvert : Node terminait sur
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`. Une alerte qui s'acheve sur une
 * trace de plantage est une alerte qu'on apprend a ignorer. `process.exitCode` laisse Node
 * fermer ce qu'il a ouvert, et le code de sortie est le meme.
 */

import { GREEN, RED, RESET, YELLOW, DIM, projectRefFrom, readEnv } from './env.mjs';

function fail(message, whatToDo) {
  console.log(`${RED}✗${RESET} ${message}`);
  if (whatToDo) console.log(`  ${YELLOW}→ ${whatToDo}${RESET}`);
  process.exitCode = 1;
}

async function main() {
  const env = readEnv();
  const token = env['SUPABASE_ACCESS_TOKEN'];
  const ref = projectRefFrom(env['NEXT_PUBLIC_SUPABASE_URL']);

  if (token === undefined || ref === undefined) {
    return fail(
      'SUPABASE_ACCESS_TOKEN ou NEXT_PUBLIC_SUPABASE_URL manquant dans `.env`',
      'Sans acces a la base, ce script ne peut rien affirmer — et il ne doit rien affirmer.',
    );
  }

  /** Le seuil, en jours. Sept par defaut : une semaine, comme `db:round` en construit une. */
  const threshold = Number.parseInt(process.argv[2] ?? '7', 10);
  if (!Number.isFinite(threshold) || threshold < 1) {
    return fail(`Seuil attendu en jours, recu « ${process.argv[2]} »`);
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // ⚠️ `>= current_date` et non `> now()` : la manche d'aujourd'hui compte, elle est encore
    // jouable. Compter les jours DISTINCTS et non les questions — une manche en porte cinq, et
    // un decompte de lignes annoncerait cinq semaines d'avance pour une seule journee.
    body: JSON.stringify({
      query:
        'select count(distinct on_day)::int as jours, max(on_day) as dernier ' +
        'from public.quiz_questions where on_day >= current_date;',
    }),
  });

  if (!response.ok) {
    return fail(
      `L'API de gestion a repondu ${response.status}`,
      'Jeton expire ? `SUPABASE_ACCESS_TOKEN` se regenere dans le tableau de bord Supabase.',
    );
  }

  const rows = await response.json();
  const days = Array.isArray(rows) ? (rows[0]?.jours ?? 0) : 0;
  const last = Array.isArray(rows) ? (rows[0]?.dernier ?? null) : null;
  const untilWhen = last === null ? '' : ` ${DIM}(jusqu'au ${String(last).slice(0, 10)})${RESET}`;

  if (days < threshold) {
    const from = new Date().toISOString().slice(0, 10);
    return fail(
      `${days} manche(s) d'avance, seuil ${threshold}${untilWhen}`,
      `npm run db:round -- ${from} ${threshold}`,
    );
  }

  console.log(`${GREEN}✓${RESET} ${days} manche(s) d'avance, seuil ${threshold}${untilWhen}`);
}

await main();

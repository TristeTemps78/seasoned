#!/usr/bin/env node
/**
 * Diagnostic Supabase — « est-ce que ca marche ? », repondu point par point.
 *
 *   node scripts/check-supabase.mjs
 *
 * ## Pourquoi ce script existe
 *
 * L'interface de Supabase montre qu'un projet **existe**. Elle ne dit pas si la table est
 * la, si RLS protege reellement quelque chose, ni si les cles rangees dans `.env` sont les
 * bonnes. Ces trois choses echouent silencieusement et de facon differente, et la plus
 * grave — **une table sans RLS est lisible par le monde entier** — n'est signalee nulle
 * part.
 *
 * Chaque verification dit donc ce qui est teste, ce qui est attendu, et quoi faire si
 * c'est rouge.
 *
 * ⚠️ N'affiche jamais les cles, meme partiellement : ce fichier peut finir colle dans une
 * conversation ou une capture d'ecran.
 */

import { readFileSync } from 'node:fs';

const RESET = '[0m';
const RED = '[31m';
const GREEN = '[32m';
const YELLOW = '[33m';
const DIM = '[2m';

let failures = 0;

function ok(message, detail) {
  console.log(`${GREEN}✓${RESET} ${message}${detail ? ` ${DIM}${detail}${RESET}` : ''}`);
}

function bad(message, whatToDo) {
  failures += 1;
  console.log(`${RED}✗${RESET} ${message}`);
  if (whatToDo) console.log(`  ${YELLOW}→ ${whatToDo}${RESET}`);
}

function info(message) {
  console.log(`${DIM}  ${message}${RESET}`);
}

/** Lit `.env` sans dependance : ce script doit tourner avant tout `npm install`. */
function readEnv() {
  const values = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (match === null) continue;
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (value.length > 0) values[match[1]] = value;
      }
    } catch {
      // Fichier absent : ce n'est pas une erreur, `.env.local` est optionnel.
    }
  }
  return values;
}

const env = readEnv();
const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

console.log('\nDiagnostic Supabase — Voltface\n');

// ---------------------------------------------------------------------------
// 1. Les deux valeurs sont-elles la ?
// ---------------------------------------------------------------------------

if (url === undefined) {
  bad(
    'NEXT_PUBLIC_SUPABASE_URL est absente',
    'Dans Supabase : Project Settings → API (ou « Data API »). Copier « Project URL ».',
  );
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url)) {
  bad(
    `NEXT_PUBLIC_SUPABASE_URL ne ressemble pas a une URL de projet : ${url}`,
    'Elle doit ressembler a https://abcdefghijkl.supabase.co — sans barre finale, sans /rest/v1.',
  );
} else {
  ok('URL du projet', url);
}

if (key === undefined) {
  bad(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY est absente',
    'Meme ecran : copier la cle « anon » / « publishable ». PAS « service_role ».',
  );
} else if (key.startsWith('eyJ') === false && key.startsWith('sb_') === false) {
  bad(
    'La cle ne ressemble ni a un JWT (eyJ…) ni a une cle recente (sb_…)',
    'Verifier qu il s agit bien de la cle publique du projet.',
  );
} else if (/service_role/.test(key)) {
  // Le JWT porte son role en clair dans la charge utile : on peut le detecter sans le
  // decoder, et il vaut mieux crier fort.
  bad(
    '⛔ CETTE CLE EST « service_role » — elle contourne RLS',
    'Elle ne doit JAMAIS etre dans une variable NEXT_PUBLIC_*, donc jamais dans le navigateur. La revoquer dans Supabase et prendre la cle « anon ».',
  );
} else {
  ok('Cle publique presente', `${key.length} caracteres`);
}

if (url === undefined || key === undefined) {
  console.log(`\n${YELLOW}Rien de plus ne peut etre teste sans ces deux valeurs.${RESET}\n`);
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

// ---------------------------------------------------------------------------
// 2. Le projet repond-il ?
// ---------------------------------------------------------------------------

// ⚠️ **Ne pas interroger `/rest/v1/` pour cela.** Cet endpoint d'introspection exige
// desormais une cle *secrete* et repond 401 a une cle publique parfaitement valide —
// « Only secret API keys can be used for this endpoint ». La premiere version de ce
// script en concluait « la cle ne correspond pas a ce projet », ce qui est faux et
// envoie chercher un probleme de cles la ou il n'y en a pas.
//
// `/auth/v1/health` repond sans authentification : il dit si le projet est **joignable
// et eveille**, ce qui est la seule question posee ici. La validite de la cle, elle, se
// lit sur la requete a la table — voir plus bas.
try {
  const response = await fetch(`${url}/auth/v1/health`, { headers });
  if (response.ok) {
    ok('Le projet repond et il est eveille');
  } else {
    bad(`Le projet repond mal : HTTP ${response.status}`);
  }
} catch (error) {
  bad(
    `Impossible de joindre le projet : ${error.message}`,
    'Projet en pause ? Supabase suspend les projets gratuits apres une semaine sans activite — le reveiller depuis le tableau de bord.',
  );
}

// ---------------------------------------------------------------------------
// 3. La table existe-t-elle ? (le SQL a-t-il ete applique ?)
// ---------------------------------------------------------------------------

let tableExists = false;
try {
  const response = await fetch(`${url}/rest/v1/journals?select=user_id&limit=1`, { headers });

  const payload = await response.clone().json().catch(() => undefined);

  if (response.status === 404) {
    // PostgREST distingue les deux cas par son code : `PGRST205` dit « table inconnue »,
    // ce qui prouve **au passage que la cle a ete acceptee** — une cle refusee ne serait
    // jamais allee jusqu'au cache de schema.
    const known = typeof payload?.code === 'string' && payload.code.startsWith('PGRST');
    bad(
      'La table « journals » n existe pas',
      'Ouvrir supabase/001_journal.sql, tout copier, et le coller dans SQL Editor → New query → Run.',
    );
    if (known) info('La cle, elle, est acceptee : il ne manque que la table.');
  } else if (response.status === 401 || response.status === 403) {
    // Refuse, donc elle existe **et** elle est protegee : c'est exactement ce qu'on veut.
    tableExists = true;
    ok('La table « journals » existe et refuse un acces anonyme');
  } else if (response.ok) {
    tableExists = true;
    const rows = await response.json();
    ok('La table « journals » existe');
    if (Array.isArray(rows) && rows.length > 0) {
      bad(
        `⛔ RLS NE PROTEGE RIEN : ${rows.length} ligne(s) lue(s) sans etre connecte`,
        'Reappliquer supabase/001_journal.sql en entier — la partie « alter table … enable row level security » manque.',
      );
    } else {
      ok('RLS filtre : aucune ligne visible sans compte');
      info('Zero ligne est le resultat attendu tant que personne ne s est connecte.');
    }
  } else {
    bad(`Reponse inattendue sur la table : HTTP ${response.status}`);
  }
} catch (error) {
  bad(`Echec en interrogeant la table : ${error.message}`);
}

// ---------------------------------------------------------------------------
// 4. Une ecriture anonyme est-elle refusee ?
// ---------------------------------------------------------------------------

if (tableExists) {
  try {
    const response = await fetch(`${url}/rest/v1/journals`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: '00000000-0000-0000-0000-000000000000',
        document: { version: 3, entries: {}, _diagnostic: true },
      }),
    });

    if (response.ok) {
      bad(
        '⛔ UNE ECRITURE ANONYME A ETE ACCEPTEE',
        'N importe qui peut ecrire dans la table. Reappliquer le SQL, et supprimer la ligne creee (user_id 00000000-…).',
      );
    } else {
      ok(`Une ecriture anonyme est refusee`, `HTTP ${response.status}`);
    }
  } catch (error) {
    bad(`Echec du test d ecriture : ${error.message}`);
  }
}

// ---------------------------------------------------------------------------

console.log('');
if (failures === 0) {
  console.log(`${GREEN}Tout est en place.${RESET} La base est prete pour l authentification.\n`);
} else {
  console.log(`${RED}${failures} point(s) a corriger${RESET} — voir les fleches ci-dessus.\n`);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Applique le schema Supabase — sans ouvrir un tableau de bord.
 *
 *   npm run db:push
 *
 * ## 🔴 Le defaut que ce script repare, et il a coute quatre sessions
 *
 * `supabase/001_journal.sql` a ete ecrit le 2026-08-03 et **n'avait jamais ete applique**
 * le 2026-08-03 au soir : `check-supabase` repondait « la table journals n'existe pas ».
 * Le code de synchronisation, lui, etait ecrit, teste, et parlait a une table absente.
 *
 * La cause n'etait ni un oubli ni une negligence : **appliquer le schema demandait d'ouvrir
 * une interface, de copier un fichier et de le coller ailleurs**. Une etape manuelle placee
 * entre du code ecrit et du code qui marche finit toujours par ne pas etre faite.
 *
 * ⚠️ **Et le malentendu vaut d'etre ecrit** : le projet Vercel et le projet Supabase
 * etaient bel et bien lies. Mais cette integration ne synchronise que des **variables
 * d'environnement** — elle n'execute jamais de SQL. La liaison etait juste ; elle ne
 * pouvait simplement pas creer une table.
 *
 * ## Ce qu'il faut, une fois
 *
 * Un **jeton d'acces personnel** dans `.env` (`SUPABASE_ACCESS_TOKEN`), cree sur
 * https://supabase.com/dashboard/account/tokens.
 *
 * Cette etape est **irreductible** : la cle `anon` ne peut pas creer une table — c'est
 * exactement ce qui la rend publiable. Il faut donc un identifiant qui, lui, le peut.
 *
 * ⚠️ Ce jeton vaut pour **tout le compte** Supabase : il peut creer et detruire des
 * projets. Il reste dans `.env` (ignore par git, le depot est public) et **ne va pas** en
 * secret d'integration continue — un jeton Supabase ne se limite pas a un projet, donc
 * tout workflow ajoute plus tard pourrait le lire.
 *
 * ## Pourquoi aucun registre de migrations
 *
 * Les fichiers de `supabase/` sont **idempotents** et le declarent (`create table if not
 * exists`, `create or replace function`, `drop policy if exists`). Les rejouer ne coute
 * rien. Un registre de versions serait de la mecanique ecrite avant d'avoir quelque chose a
 * mecaniser — precisement ce que ce depot s'est fait la remarque de ne plus faire.
 *
 * Le jour ou une migration cessera d'etre rejouable (un `alter table` destructif), il
 * faudra le registre. Pas avant.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { DIM, GREEN, RED, RESET, YELLOW, projectRefFrom, readEnv } from './env.mjs';

const API = 'https://api.supabase.com';

const env = readEnv();
const token = env['SUPABASE_ACCESS_TOKEN'];
const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const ref = projectRefFrom(url);

function ok(message, detail) {
  console.log(`${GREEN}✓${RESET} ${message}${detail ? ` ${DIM}${detail}${RESET}` : ''}`);
}

function fail(message, whatToDo) {
  console.log(`${RED}✗${RESET} ${message}`);
  if (whatToDo) console.log(`  ${YELLOW}→ ${whatToDo}${RESET}`);
  process.exit(1);
}

console.log('\nApplication du schema Supabase — Voltface\n');

if (url === undefined) {
  fail(
    'NEXT_PUBLIC_SUPABASE_URL est absente de `.env`',
    'Supabase → Project Settings → API → « Project URL ».',
  );
}

if (ref === undefined) {
  fail(
    `NEXT_PUBLIC_SUPABASE_URL ne ressemble pas a une URL de projet : ${url}`,
    'Attendu : https://abcdefghijkl.supabase.co — sans barre finale, sans /rest/v1.',
  );
}

if (token === undefined) {
  console.log(`${RED}✗${RESET} SUPABASE_ACCESS_TOKEN est absent de \`.env\`.\n`);
  console.log('  Une seule chose a faire, une fois :\n');
  console.log(`  ${YELLOW}1.${RESET} https://supabase.com/dashboard/account/tokens → Generate new token`);
  console.log(`  ${YELLOW}2.${RESET} coller la valeur dans \`.env\` :\n`);
  console.log(`       ${DIM}SUPABASE_ACCESS_TOKEN=sbp_...${RESET}\n`);
  console.log(`  ${DIM}\`.env\` est ignore par git. Le jeton ne quitte pas cette machine.${RESET}`);
  console.log(
    `  ${DIM}La cle « anon » ne peut pas creer de table : c'est ce qui la rend publiable.${RESET}\n`,
  );
  process.exit(1);
}

/** Un appel a l'API de gestion. **Ne jamais faire figurer le jeton dans une trace.** */
async function api(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let payload;
  try {
    payload = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    // ⚠️ On consigne le statut et le message de l'API, jamais l'en-tete d'autorisation
    // (`AGENTS.md` regle 6).
    const detail = payload?.message ?? text.slice(0, 300);
    return { ok: false, status: response.status, message: detail };
  }
  return { ok: true, status: response.status, payload };
}

// ---------------------------------------------------------------------------
// 1. Le projet, et sa region — le seul point non rattrapable
// ---------------------------------------------------------------------------

const projects = await api('GET', '/v1/projects');
if (!projects.ok) {
  if (projects.status === 401) {
    fail(
      'Le jeton est refuse (HTTP 401)',
      'Jeton expire ou mal copie. En regenerer un sur https://supabase.com/dashboard/account/tokens',
    );
  }
  fail(`Impossible de lister les projets : HTTP ${projects.status} — ${projects.message}`);
}

const project = (projects.payload ?? []).find((candidate) => candidate.id === ref);
if (project === undefined) {
  fail(
    `Le jeton ne donne pas acces au projet « ${ref} »`,
    'Le jeton appartient peut-etre a un autre compte que celui qui heberge ce projet.',
  );
}

// 🔴 Le garde-fou qui manquait, et il a coute une application de schema au mauvais endroit.
// Ce compte porte plusieurs projets ; `.env` en designait un (« cerveau »), la production en
// utilisait un autre. Tout etait vert des deux cotes — la table etait simplement creee la ou
// personne ne la lirait. Comparer le **nom** au produit rend l'erreur impossible a repeter.
if (!project.name.toLowerCase().includes('voltface')) {
  fail(
    `Ce projet s'appelle « ${project.name} » et non « voltface »`,
    'NEXT_PUBLIC_SUPABASE_URL designe-t-elle le bon projet ? Un compte peut en porter plusieurs, et appliquer le schema au mauvais ne produit aucune erreur : la table existe, simplement la ou rien ne la lit.',
  );
}

ok('Projet', `${project.name} ${DIM}(${ref})${RESET}`);
// Q3 : la region ne se change pas apres coup. On l'affiche en fait plutot que de demander
// une confirmation de memoire — et on le dit si elle n'est pas dans l'Union.
const EU = /^eu-/;
if (EU.test(project.region ?? '')) {
  ok('Region', `${project.region} — dans l'Union europeenne (Q3)`);
} else {
  console.log(
    `${YELLOW}⚠${RESET} Region ${project.region} — ${YELLOW}hors Union europeenne${RESET}`,
  );
  console.log(
    `  ${DIM}Q3 demandait l'UE. Une region ne se change pas : il faudrait recreer le projet,`,
  );
  console.log(`  ${DIM}ce qui est encore sans consequence tant qu'aucun compte n'existe.${RESET}`);
}
if (project.status !== undefined && project.status !== 'ACTIVE_HEALTHY') {
  console.log(`${YELLOW}⚠${RESET} Etat du projet : ${project.status}`);
}

// ---------------------------------------------------------------------------
// 2. Le SQL, dans l'ordre des noms de fichier
// ---------------------------------------------------------------------------

const files = readdirSync('supabase')
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) fail('Aucun fichier .sql dans `supabase/`');

for (const name of files) {
  const query = readFileSync(join('supabase', name), 'utf8');
  const result = await api('POST', `/v1/projects/${ref}/database/query`, { query });
  if (!result.ok) {
    fail(
      `${name} — HTTP ${result.status} : ${result.message}`,
      'Le fichier est rejoue depuis le debut a chaque fois : corriger le SQL puis relancer.',
    );
  }
  ok(`${name} applique`);
}

// ---------------------------------------------------------------------------
// 2bis. Les handles reserves, semes depuis le domaine
// ---------------------------------------------------------------------------
//
// Q7 : la reserve doit exister **avant la premiere inscription**. Un handle attribue ne se
// retire plus sans casser une URL, et `@admin` ou `@compte` entrerait en collision avec une
// route.
//
// La liste vit dans `src/domain/handles.ts` et **n'est pas recopiee ici** : le domaine
// reste la source de verite, la table n'en est que la forme executable. Le fichier
// TypeScript est importe directement — Node retire les annotations de type depuis la 22.

const { RESERVED_HANDLES } = await import('../src/domain/handles.ts');
const handles = [...RESERVED_HANDLES];
const values = handles.map((handle) => `('${handle.replace(/'/g, "''")}', 'reserved')`).join(',');
const seeded = await api('POST', `/v1/projects/${ref}/database/query`, {
  query: `insert into public.reserved_handles (handle, reason) values ${values}
          on conflict (handle) do nothing;`,
});
if (!seeded.ok) fail(`Semis des handles reserves : HTTP ${seeded.status} — ${seeded.message}`);
ok('Handles reserves', `${handles.length}, semes depuis src/domain/handles.ts`);

// ---------------------------------------------------------------------------
// 3. Ce que la cle publique ne peut PAS verifier
// ---------------------------------------------------------------------------
//
// `check-supabase.mjs` verifie ce qu'on voit depuis le navigateur : la table repond, RLS
// filtre, une ecriture anonyme est refusee. Il ne peut rien dire de la fonction de
// suppression — elle n'est appelable que par un compte connecte, et son **reglage** n'est
// lisible que par un acces d'administration. Or c'est la que se cache le defaut silencieux
// que `002_account.sql` documente : une fonction `security definer` sans `search_path` fixe
// est **detournable**.

const audit = await api('POST', `/v1/projects/${ref}/database/query`, {
  query: `select p.proname, p.prosecdef, p.proconfig,
            (select array_agg(distinct grantee::text)
             from information_schema.routine_privileges r
             where r.routine_name = p.proname) as grantees
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'delete_me';`,
  read_only: true,
});

if (!audit.ok) {
  fail(`Verification de delete_me impossible : HTTP ${audit.status} — ${audit.message}`);
}

const fn = (audit.payload ?? [])[0];
if (fn === undefined) {
  fail('La fonction delete_me n existe pas apres application', 'Relire supabase/002_account.sql.');
}
if (fn.prosecdef !== true) {
  fail('delete_me n est pas `security definer` : elle ne pourra pas supprimer le compte');
}
// ⚠️ Le motif accepte `search_path=` **et** `search_path=""` : Postgres normalise
// `set search_path = ''` avec des guillemets, et la premiere version de ce test cherchait la
// forme sans. Il criait donc « fonction detournable » sur une fonction parfaitement reglee —
// un outil de diagnostic qui ment est pire qu'aucun outil, et c'est la deuxieme fois ici.
// Ce qui est verifie est bien le seul point qui compte : que le `search_path` soit **fixe**.
if (!Array.isArray(fn.proconfig) || !fn.proconfig.some((set) => /^search_path=/.test(set))) {
  fail(
    'delete_me n a pas de `search_path` fixe — elle est detournable',
    'Ajouter `set search_path = \'\'` dans supabase/002_account.sql, puis relancer.',
  );
}
const grantees = (fn.grantees ?? []).filter((name) => name === 'anon' || name === 'PUBLIC');
if (grantees.length > 0) {
  fail(`delete_me est appelable par ${grantees.join(', ')}`, 'Rejouer les `revoke` du fichier.');
}
ok('delete_me : security definer, search_path fixe, reservee aux comptes connectes');

// ---------------------------------------------------------------------------
// 4. Les URLs de retour — sans elles, le lien magique revient sur une porte fermee
// ---------------------------------------------------------------------------
//
// Supabase refuse toute redirection qui n'est pas dans cette liste, et l'erreur ne nomme
// pas l'URL refusee. Les deux langues y figurent : `lib/routes.ts` fait revenir le lien
// dans la langue de la page, donc `/fr/compte/retour` est une adresse aussi reelle que
// `/compte/retour`.

// ⚠️ `NEXT_PUBLIC_SITE_URL` est vide en local **a dessein** (`lib/site.ts` : Vercel la
// fournit au deploiement). S'en contenter laissait donc la liste sans l'adresse de
// production — c'est-a-dire un lien magique qui revient sur une porte fermee **partout sauf
// sur la machine du developpeur**, le genre de defaut qu'on ne voit qu'en ligne.
// D'ou `SITE_URLS`, lue seulement par cet outil, qui ne change rien a l'application.
const declared = [env['NEXT_PUBLIC_SITE_URL'], ...(env['SITE_URLS'] ?? '').split(',')]
  .map((value) => (value ?? '').trim().replace(/\/$/, ''))
  .filter((value) => value.length > 0);
const origins = ['http://localhost:3000', ...declared];
const allowList = origins.flatMap((origin) => [
  `${origin}/compte/retour`,
  `${origin}/fr/compte/retour`,
]);

const config = await api('PATCH', `/v1/projects/${ref}/config/auth`, {
  site_url: origins[origins.length - 1],
  uri_allow_list: allowList.join(','),
});

if (!config.ok) {
  fail(`Reglage des URLs de retour : HTTP ${config.status} — ${config.message}`);
}
ok('URLs de retour autorisees', allowList.join(' · '));

if (config.payload?.external_email_enabled === false) {
  console.log(`${YELLOW}⚠${RESET} La connexion par e-mail est desactivee sur ce projet.`);
}
if (config.payload?.smtp_host === null || config.payload?.smtp_host === undefined) {
  console.log(
    `${DIM}  Pas de SMTP personnalise : le service integre ne livre qu'aux membres de`,
  );
  console.log(`${DIM}  l'equipe du projet, 2 envois par heure. Suffisant pour verifier.${RESET}`);
}

// ---------------------------------------------------------------------------
// 5. Et on verifie depuis le navigateur, avec la cle publique
// ---------------------------------------------------------------------------
//
// Un script qui applique sans verifier ne vaut rien — et la verification qui compte est
// celle qui passe par le meme chemin que l'application : la cle publique, RLS, PostgREST.

console.log(`\n${DIM}— Verification par la cle publique —${RESET}`);
execFileSync(process.execPath, ['scripts/check-supabase.mjs'], { stdio: 'inherit' });

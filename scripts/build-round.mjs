#!/usr/bin/env node
/**
 * Construit la manche du jour depuis TMDB.
 *
 *   npm run db:round            # aujourd'hui
 *   npm run db:round -- 2026-08-11
 *
 * ## Pourquoi ce script existe avant le cron
 *
 * La manche a besoin d'un corpus, et le corpus vient de TMDB. Deux chemins etaient
 * possibles :
 *
 *   1. **`pg_cron` + `pg_net`**, tout dans Supabase — rien a heberger, aucun secret hors
 *      de la base. C'est le chemin voulu, et il reste le but.
 *   2. **Un script**, qui appelle TMDB et ecrit par l'API de gestion.
 *
 * 🔴 **Le premier ne peut pas etre PROUVE par le harnais de ce depot, et c'est ce qui
 * tranche l'ordre.** `pg_net` n'envoie ses requetes qu'**apres le commit** : dans la
 * transaction annulee de `rls-scenarios.sql`, aucune requete ne partirait jamais. Livrer
 * ce SQL d'abord, ce serait livrer une mecanique nocturne que rien ne verifie — la faute
 * exacte que ce depot raconte sept fois.
 *
 * On construit donc d'abord une manche **reelle et verifiable**, on la joue, et le cron
 * viendra rejouer ce meme travail quand il aura son propre moyen d'etre mesure.
 *
 * ## Regle 1 : le catalogue est loue
 *
 * Chaque question porte de la metadonnee TMDB, donc elle **expire**. `expires_at` est pose
 * ici a 7 jours : une manche n'a aucune raison de survivre a sa semaine, et le plafond
 * contractuel de six mois n'est meme pas approche.
 */

import { DIM, GREEN, RED, RESET, YELLOW, projectRefFrom, readEnv } from './env.mjs';
// Le tirage vient du domaine, comme la liste des handles reserves vient de `handles.ts`
// pour `db-push` : le domaine tranche, l'outillage execute. Une troisieme copie du melange
// et du generateur vivait ici, et elle n'avait aucune raison d'exister.
import { drawFrom, pickOne, seedOf, shuffle, takeSome } from '../src/domain/draw.ts';
// Et la meme raison pour le corpus : qui a le droit d'entrer dans une manche est une
// regle de produit, pas un `filter` de trois lignes au milieu d'un script sans test.
import { eligible } from '../src/domain/corpus.ts';

const env = readEnv();
const tmdbToken = env['TMDB_ACCESS_TOKEN'];
const supabaseToken = env['SUPABASE_ACCESS_TOKEN'];
const ref = projectRefFrom(env['NEXT_PUBLIC_SUPABASE_URL']);

function fail(message, whatToDo) {
  console.log(`${RED}✗${RESET} ${message}`);
  if (whatToDo) console.log(`  ${YELLOW}→ ${whatToDo}${RESET}`);
  process.exit(1);
}

if (tmdbToken === undefined) fail('TMDB_ACCESS_TOKEN manquant dans `.env`');
if (supabaseToken === undefined || ref === undefined) {
  fail('SUPABASE_ACCESS_TOKEN ou NEXT_PUBLIC_SUPABASE_URL manquant dans `.env`');
}

const from = process.argv[2] ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) fail(`Date attendue au format AAAA-MM-JJ, recu « ${from} »`);

/**
 * Combien de manches d'affilee.
 *
 * ⚠️ C'est ce qui rend le cron nocturne inutile pour la construction : on batit une
 * semaine d'avance en une commande, et la nuit ne s'occupe plus que d'**oublier**
 * (`014_quiz_cron.sql`). Une tache qui appelle une API tierce chaque nuit est une tache
 * qui echoue un jour sans que personne ne regarde.
 */
const days = Number(process.argv[3] ?? '1');
if (!Number.isInteger(days) || days < 1 || days > 30) {
  fail(`Nombre de jours attendu entre 1 et 30, recu « ${process.argv[3]} »`);
}

/** Un appel TMDB. **Le jeton ne doit apparaitre dans aucune trace** (regle 6). */
async function tmdb(path) {
  const response = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`TMDB ${path} → HTTP ${response.status}`);
  return response.json();
}

async function query(sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${supabaseToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text();
  if (!response.ok) fail(`Ecriture refusee : HTTP ${response.status} — ${text.slice(0, 300)}`);
  return text.length > 0 ? JSON.parse(text) : undefined;
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;

console.log(`\nManches a partir du ${from} (${days}) — Voltface\n`);

// Un vivier large, pour que les leurres soient credibles et varies — et `eligible` est ce
// qui rend la seconde moitie de cette phrase vraie. Voir `src/domain/corpus.ts` : les
// journaux et la tele-realite d'un cote, ce que personne n'a vu de l'autre.
const pool = [];
for (const page of [1, 2, 3]) {
  const { results = [] } = await tmdb(`/tv/popular?page=${page}`);
  pool.push(...results.filter(eligible));
}
if (pool.length < 8) fail('TMDB a rendu trop peu de series pour construire une manche');

/**
 * Construit UNE manche.
 *
 * Le vivier (`pool`) est charge une seule fois et partage : c'est la meme liste de series
 * populaires pour toute la plage, et il n'y a aucune raison de la redemander sept fois.
 * Le tirage, lui, repart du jour — deux manches consecutives ne doivent pas se ressembler.
 */
async function buildFor(day) {
// Deux lancements le meme jour doivent produire la meme manche : sinon relancer le script
// changerait les questions sous les joueurs qui ont deja commence.
const draw = drawFrom(seedOf(day));
const pick = (list) => pickOne(list, draw);

/** Trois leurres pris ailleurs que sur la bonne reponse, puis melange. */
function choicesAround(answer) {
  const unique = [...new Set(pool.filter((one) => one.id !== answer.id).map((one) => one.name))];
  const all = shuffle([answer.name, ...takeSome(unique, 3, draw)], draw);
  return { choices: all, answer: all.indexOf(answer.name) };
}

const questions = [];
const alreadyAsked = new Set();

/**
 * Ajoute une question si sa matiere existe. Une famille sans matiere se tait.
 *
 * 🔴 **Une serie ne repond qu'a UNE question de la manche.** La premiere manche construite
 * posait trois questions sur *The Rookie* : la deviner une fois donnait deux points
 * gratuits, et le classement aurait recompense la chance plutot que la connaissance. Le
 * defaut ne se voyait pas dans le schema — il se voyait dans la sortie du script.
 *
 * ⚠️ La regle est tenue par {@link untouched}, au **tirage**. Elle etait aussi ici, en
 * refus silencieux, et c'est ce refus qui perdait des questions : voir l'en-tete de
 * `untouched`. Une regle appliquee a deux endroits n'est pas deux fois plus sure — le
 * second endroit sert d'excuse au premier pour tirer n'importe ou.
 */
function add(kind, subject, prompt) {
  const { choices, answer } = choicesAround(subject);
  if (choices.length < 4 || answer < 0) return;
  alreadyAsked.add(subject.id);
  questions.push({ kind, prompt, choices, answer });
}

/**
 * Ce qui n'a pas encore servi.
 *
 * 🔴 **Toutes les familles tirent ici, et c'est ce qui manquait.** Les trois premieres
 * tiraient dans le vivier entier, et `add` refusait ensuite une serie deja interrogee —
 * silencieusement. Une collision ne decalait donc pas le tirage : elle **perdait la
 * question**. Mesure du 2026-08-30 sur les 21 manches construites : deux d'entre elles
 * (2026-09-14 et 2026-09-15) n'avaient que cinq questions, et les deux avaient perdu la
 * meme famille — `poster`, la troisieme a tirer, donc celle qui a deux occasions de tomber
 * sur une serie deja prise.
 *
 * La regle « une serie ne repond qu'a UNE question » n'a pas change ; elle s'applique
 * maintenant **au tirage** plutot qu'au depot, ou elle ne pouvait que faire disparaitre du
 * travail deja paye en appels TMDB.
 */
const untouched = () => pool.filter((one) => !alreadyAsked.has(one.id));

// 1 — les acteurs
//
// ⚠️ `takeSome` et non trois `pick` : trois tirages independants peuvent rendre deux fois
// la meme serie, donc deux appels TMDB identiques pour une seule chance de plus.
for (const candidate of takeSome(untouched(), 3, draw)) {
  const credits = await tmdb(`/tv/${candidate.id}/credits`);
  const cast = (credits.cast ?? []).slice(0, 3).map((one) => one.name).filter(Boolean);
  if (cast.length >= 2) {
    add('cast', candidate, { cast });
    break;
  }
}

// 2 — la note globale
const rated = pick(untouched());
if (rated !== undefined && typeof rated.vote_average === 'number' && rated.vote_average > 0) {
  add('rating', rated, { score: Number(rated.vote_average.toFixed(1)) });
}

// 3 — l'affiche
//
// ⚠️ Un tirage, pas un `find`. La premiere version prenait la premiere serie du vivier qui
// portait une affiche : le tirage etant deterministe par jour, elle aurait pose **la meme
// affiche tous les jours**. Le defaut ne se voit pas sur une manche — il se voit en en
// construisant quatre.
const postered = pick(untouched().filter((one) => typeof one.poster_path === 'string'));
if (postered !== undefined) {
  add('poster', postered, { url: `https://image.tmdb.org/t/p/w342${postered.poster_path}` });
}

// 4, 5 et 6 — les notes de saison, les notes d'episode, les dates de diffusion.
//
// Chacune sur une serie DIFFERENTE, donc chacune coute ses propres appels. C'est le prix
// du garde-fou ci-dessus, et il est paye une fois par jour pour tout le monde — jamais par
// visiteur, ce que ce produit refuse partout.

for (const family of ['seasons', 'episodes', 'dates']) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const left = untouched();
    if (left.length === 0) break;
    const candidate = pick(left);

    const detail = await tmdb(`/tv/${candidate.id}`);
    const seasons = (detail.seasons ?? []).filter((one) => one.season_number > 0);
    if (seasons.length === 0) continue;

    if (family === 'seasons') {
      if (seasons.length < 3) continue;
      const scores = [];
      for (const season of seasons.slice(0, 4)) {
        const full = await tmdb(`/tv/${candidate.id}/season/${season.season_number}`);
        const rated = (full.episodes ?? []).filter((one) => one.vote_average > 0);
        if (rated.length === 0) continue;
        scores.push(
          Number((rated.reduce((sum, one) => sum + one.vote_average, 0) / rated.length).toFixed(1)),
        );
      }
      if (scores.length >= 3) {
        add('seasons', candidate, { scores });
        break;
      }
      continue;
    }

    const first = seasons[0];
    const full = await tmdb(`/tv/${candidate.id}/season/${first.season_number}`);
    const episodes = (full.episodes ?? []).filter((one) => one.vote_average > 0);

    if (family === 'episodes') {
      if (episodes.length < 5) continue;
      add('episodes', candidate, { scores: episodes.slice(0, 8).map((one) => one.vote_average) });
      break;
    }

    const dates = (full.episodes ?? []).map((one) => one.air_date).filter(Boolean).slice(0, 5);
    if (dates.length < 3) continue;
    add('dates', candidate, { dates });
    break;
  }
}

if (questions.length === 0) fail(`Aucune question construite pour le ${day} — TMDB a-t-il repondu ?`);

// ⚠️ On remplace la manche du jour plutot que d'en empiler une seconde. Les reponses
// deja donnees, elles, ne sont pas touchees : elles sont ce que NOUS produisons.
//
// ⚠️ `expires_at` court a partir du JOUR DE LA MANCHE et non d'aujourd'hui : en batissant
// une semaine d'avance, un delai calcule depuis maintenant ferait expirer la derniere
// manche avant qu'elle ne soit jouee.
const values = questions
  .map(
    (one, index) =>
      `(${quote(day)}, ${index + 1}, ${quote(one.kind)}, ${quote(JSON.stringify(one.prompt))}::jsonb, ` +
      `${quote(JSON.stringify(one.choices))}::jsonb, ${one.answer}, ${quote(day)}::timestamptz + interval '8 days')`,
  )
  .join(',\n  ');

await query(`
  delete from public.quiz_questions where on_day = ${quote(day)};
  insert into public.quiz_questions (on_day, ordinal, kind, prompt, choices, answer, expires_at)
  values
  ${values};
`);

// On affiche les REPONSES et pas seulement les familles : deux manches qui se ressemblent
// se voient d'un coup d'oeil, et c'est ainsi que le `find` de l'affiche a ete attrape.
console.log(
  `${GREEN}✓${RESET} ${day} ${DIM}: ${questions.map((one) => one.choices[one.answer]).join(' · ')}${RESET}`,
);
return questions.length;
}

let built = 0;
for (let offset = 0; offset < days; offset += 1) {
  const day = new Date(`${from}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  built += await buildFor(day.toISOString().slice(0, 10));
}
console.log(`\n${GREEN}✓${RESET} ${days} manche(s), ${built} question(s)\n`);

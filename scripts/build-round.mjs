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

const day = process.argv[2] ?? new Date().toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(`Date attendue au format AAAA-MM-JJ, recu « ${day} »`);

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

/**
 * Un tirage **deterministe** a partir du jour.
 *
 * Deux lancements le meme jour doivent produire la meme manche : sinon relancer le script
 * changerait les questions sous les joueurs qui ont deja commence.
 */
function randomFrom(text) {
  let state = 0;
  for (const character of text) state = (state * 31 + character.charCodeAt(0)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

console.log(`\nManche du ${day} — Voltface\n`);

/**
 * Ce que `/tv/popular` rend et qui n'est pas une serie.
 *
 * 🔴 **Constate a la premiere manche construite** : elle portait sur *Secret Story*,
 * *Paradise Hotel* et *The Late Show*. TMDB range la tele-realite, les talk-shows et les
 * journaux televises parmi les « TV shows » — ce produit, lui, parle de **series**
 * (arbitrage A13). Un quiz sur un jeu de tele-realite n'est pas un quiz sur des series, et
 * il donne surtout l'impression que le produit ne sait pas de quoi il parle.
 */
const NOT_A_SERIES = new Set([10763 /* news */, 10764 /* reality */, 10767 /* talk */]);

// Un vivier large, pour que les leurres soient credibles et varies.
const pool = [];
for (const page of [1, 2, 3]) {
  const { results = [] } = await tmdb(`/tv/popular?page=${page}`);
  pool.push(
    ...results.filter(
      (one) =>
        typeof one.name === 'string' &&
        one.id !== undefined &&
        !(one.genre_ids ?? []).some((genre) => NOT_A_SERIES.has(genre)),
    ),
  );
}
if (pool.length < 8) fail('TMDB a rendu trop peu de series pour construire une manche');

const random = randomFrom(day);
const pick = (list) => list[Math.floor(random() * list.length)];

/** Trois leurres pris ailleurs que sur la bonne reponse, puis melange. */
function choicesAround(answer) {
  const others = pool.filter((one) => one.id !== answer.id).map((one) => one.name);
  const unique = [...new Set(others)];
  const decoys = [];
  while (decoys.length < 3 && unique.length > 0) {
    decoys.push(...unique.splice(Math.floor(random() * unique.length), 1));
  }
  const all = [answer.name, ...decoys];
  for (let index = all.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [all[index], all[swap]] = [all[swap], all[index]];
  }
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
 */
function add(kind, subject, prompt) {
  if (alreadyAsked.has(subject.id)) return;
  const { choices, answer } = choicesAround(subject);
  if (choices.length < 4 || answer < 0) return;
  alreadyAsked.add(subject.id);
  questions.push({ kind, prompt, choices, answer });
}

// 1 — les acteurs
for (const candidate of [pick(pool), pick(pool), pick(pool)]) {
  const credits = await tmdb(`/tv/${candidate.id}/credits`);
  const cast = (credits.cast ?? []).slice(0, 3).map((one) => one.name).filter(Boolean);
  if (cast.length >= 2) {
    add('cast', candidate, { cast });
    break;
  }
}

// 2 — la note globale
const rated = pick(pool);
if (typeof rated.vote_average === 'number' && rated.vote_average > 0) {
  add('rating', rated, { score: Number(rated.vote_average.toFixed(1)) });
}

// 3 — l'affiche
const postered = pool.find((one) => typeof one.poster_path === 'string');
if (postered !== undefined) {
  add('poster', postered, { url: `https://image.tmdb.org/t/p/w342${postered.poster_path}` });
}

// 4, 5 et 6 — les notes de saison, les notes d'episode, les dates de diffusion.
//
// Chacune sur une serie DIFFERENTE, donc chacune coute ses propres appels. C'est le prix
// du garde-fou ci-dessus, et il est paye une fois par jour pour tout le monde — jamais par
// visiteur, ce que ce produit refuse partout.
const untouched = () => pool.filter((one) => !alreadyAsked.has(one.id));

for (const family of ['seasons', 'episodes', 'dates']) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const left = untouched();
    if (left.length === 0) break;
    const candidate = left[Math.floor(random() * left.length)];

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

if (questions.length === 0) fail('Aucune question construite — TMDB a-t-il repondu ?');

// ⚠️ On remplace la manche du jour plutot que d'en empiler une seconde. Les reponses
// deja donnees, elles, ne sont pas touchees : elles sont ce que NOUS produisons.
const values = questions
  .map(
    (one, index) =>
      `(${quote(day)}, ${index + 1}, ${quote(one.kind)}, ${quote(JSON.stringify(one.prompt))}::jsonb, ` +
      `${quote(JSON.stringify(one.choices))}::jsonb, ${one.answer}, now() + interval '7 days')`,
  )
  .join(',\n  ');

await query(`
  delete from public.quiz_questions where on_day = ${quote(day)};
  insert into public.quiz_questions (on_day, ordinal, kind, prompt, choices, answer, expires_at)
  values
  ${values};
`);

for (const [index, one] of questions.entries()) {
  console.log(`${GREEN}✓${RESET} ${index + 1}. ${one.kind} ${DIM}→ ${one.choices[one.answer]}${RESET}`);
}
console.log(`\n${GREEN}✓${RESET} manche du ${day} : ${questions.length} question(s)\n`);

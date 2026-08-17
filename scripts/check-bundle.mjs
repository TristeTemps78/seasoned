#!/usr/bin/env node
/**
 * Ce que la production envoie vraiment au navigateur.
 *
 *   npm run check:bundle
 *   npm run check:bundle -- https://une-preview.vercel.app
 *
 * ## Pourquoi cet outil existe
 *
 * Le 2026-08-18, il a fallu repondre a une question simple — *« est-ce qu'un secret traine
 * dans ce qui est servi ? »* — et il n'existait aucun moyen de le savoir sans lire a la main
 * quinze fichiers de JavaScript minifie. La question se repose a chaque fois qu'une variable
 * d'environnement est ajoutee : le prefixe `NEXT_PUBLIC_` **inline la valeur dans le paquet**,
 * donc une variable mal nommee publie son contenu a tout le monde, en silence et pour de bon.
 *
 * ⚠️ **Il lit la production, pas le dossier `.next`.** Un build local peut etre fait avec
 * d'autres variables que celles de Vercel : ce qui compte est ce que le serveur sert.
 *
 * ## Ce qu'il verifie, et pourquoi ces motifs-la
 *
 * - une URL Postgres — c'est la forme qu'ont les variables semees par l'integration Supabase ;
 * - `service_role` — la cle qui **contourne RLS**, donc celle dont la fuite annule tout le
 *   modele de securite du produit ;
 * - un secret JWT — il permet de signer un jeton pour n'importe quel compte ;
 * - un jeton personnel `sbp_` — il vaut pour **tout le compte** Supabase, pas pour un projet ;
 * - un jeton TMDB — il n'est pas critique, mais il est facturable et il n'a rien a faire la.
 *
 * ⚠️ **Ce qui n'est PAS un defaut** : `NEXT_PUBLIC_SUPABASE_ANON_KEY` et l'URL du projet sont
 * dans le paquet **par conception** — c'est ce qui permet au navigateur de parler a la base, et
 * c'est RLS qui protege. Les chercher ici serait crier au feu a chaque chargement.
 *
 * ## Il verifie aussi que le site n'est pas casse
 *
 * Une variable **retiree** ne fuit rien et casse tout : sans `TMDB_ACCESS_TOKEN` une fiche
 * serie rend « catalogue indisponible », sans `LEGAL_CONTACT_EMAIL` le verrou legal ferme la
 * publication. Les deux se lisent depuis l'exterieur, donc ils sont ici : le meme outil
 * repond a « est-ce que quelque chose a fui » et a « est-ce que quelque chose manque ».
 */

import { GREEN, RED, RESET, DIM, YELLOW } from './env.mjs';

const base = (process.argv[2] ?? 'https://seasoned-two.vercel.app').replace(/\/$/, '');

/** Ce qui ne doit jamais quitter le serveur. */
const INTERDITS = [
  ['une URL Postgres', /postgres(ql)?:\/\/[^"'\s]+/i],
  ['la cle service_role', /service_role/],
  ['un secret JWT', /jwt[_-]?secret/i],
  ['un jeton personnel Supabase', /\bsbp_[A-Za-z0-9]{20,}/],
  ['un jeton TMDB', /Bearer eyJ[A-Za-z0-9_-]{30,}/],
];

function ok(message, detail) {
  console.log(`${GREEN}✓${RESET} ${message}${detail ? ` ${DIM}${detail}${RESET}` : ''}`);
}

function ko(message, detail) {
  console.log(`${RED}✗${RESET} ${message}${detail ? `\n  ${YELLOW}${detail}${RESET}` : ''}`);
}

console.log(`\nCe que ${base} envoie au navigateur\n`);

const accueil = await fetch(`${base}/fr`);
if (!accueil.ok) {
  ko(`La page d'accueil repond ${accueil.status}`, 'Rien d\'autre ne peut etre verifie.');
  process.exit(1);
}
const html = await accueil.text();

// ⚠️ `new Set` : Next repete le meme script dans plusieurs balises, et le telecharger deux
// fois doublerait le temps de la verification sans rien apprendre.
const scripts = [...new Set([...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]))];

let paquet = html;
for (const src of scripts) {
  const url = src.startsWith('http') ? src : `${base}${src}`;
  const reponse = await fetch(url);
  if (reponse.ok) paquet += await reponse.text();
}

ok('Paquet lu', `${scripts.length} script(s), ${Math.round(paquet.length / 1024)} Ko`);

let fautes = 0;
for (const [nom, motif] of INTERDITS) {
  const trouve = motif.exec(paquet);
  if (trouve === null) continue;
  fautes += 1;
  // ⚠️ On montre le **debut** de ce qui a ete trouve, jamais la valeur entiere : un rapport
  // qui recopie un secret le republie une fois de plus, dans une trace qui traine.
  ko(`${nom} est dans le paquet`, `${trouve[0].slice(0, 12)}… — retirer la variable de Vercel PUIS la faire tourner.`);
}
if (fautes === 0) ok('Aucun secret dans le paquet');

// --- ce qui manque casse autant que ce qui fuit ----------------------------

const config = /supabase\.co/.test(paquet) && /sb_(publishable|[a-z]+)_/.test(paquet);
if (config) ok('Configuration Supabase presente', 'URL et cle publique — normal, c\'est RLS qui protege');
else {
  fautes += 1;
  ko(
    'La configuration Supabase manque au paquet',
    'NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY absente au moment du build : comptes, critiques et listes sont muets.',
  );
}

const fiche = await (await fetch(`${base}/fr/serie/1396`)).text();
if (/catalogue indisponible/i.test(fiche)) {
  fautes += 1;
  ko('Une fiche serie rend « catalogue indisponible »', 'TMDB_ACCESS_TOKEN absente ou refusee.');
} else if (/Breaking Bad/.test(fiche)) {
  ok('Le catalogue repond', 'la fiche de test porte son titre');
} else {
  console.log(`${YELLOW}⚠${RESET} Fiche serie illisible — verifier a la main.`);
}

const regles = await (await fetch(`${base}/fr/regles`)).text();
if (/pas encore renseign/i.test(regles)) {
  fautes += 1;
  ko(
    'Le point de contact manque',
    'LEGAL_CONTACT_EMAIL absente : le verrou legal ferme la publication des critiques.',
  );
} else {
  ok('Le verrou legal est ouvert', 'point de contact publie');
}

console.log(
  fautes === 0
    ? `\n${GREEN}Rien ne fuit, rien ne manque.${RESET}\n`
    : `\n${RED}${fautes} probleme(s).${RESET}\n`,
);
process.exit(fautes === 0 ? 0 : 1);

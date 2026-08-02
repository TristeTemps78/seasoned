/**
 * Genere les icones de l'application installable.
 *
 * Script a usage unique : les PNG produits sont versionnes dans `public/icons/`, et
 * ce fichier n'est pas appele par le build. Il existe pour que les icones soient
 * **reproductibles** — un PNG binaire commite sans sa recette est un actif que
 * personne ne peut plus modifier.
 *
 * Aucune dependance : `zlib` suffit a ecrire un PNG, et ajouter une bibliotheque
 * d'images pour dessiner neuf carres serait disproportionne.
 *
 *   node scripts/make-icons.mjs
 *
 * Le motif est la **grille d'episodes** — l'ecran signature du produit, celui qui
 * montre d'un coup d'oeil la saison qui s'effondre. Une icone qui dit ce que fait
 * l'application vaut mieux qu'une lettre dans un cercle.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** Charte de `app/globals.css` : l'icone appartient au meme systeme que le site. */
const INK = [0x0f, 0x11, 0x15];
const EDGE = [0x26, 0x2b, 0x36];

/** Les trois tons de la grille : rouge sombre, ambre, vert — comme `EpisodeGrid`. */
const LOW = [0x7f, 0x1d, 0x1d];
const MID = [0xb4, 0x82, 0x1e];
const HIGH = [0x4a, 0xde, 0x80];

/**
 * Une trajectoire, en quatre colonnes : ca monte, ca tient, ca decroche.
 *
 * C'est litteralement le propos du produit — « on ne demande pas a une serie si elle
 * est bien, on demande si elle le reste ».
 */
const GRID = [
  [MID, HIGH, HIGH, LOW],
  [HIGH, HIGH, MID, LOW],
  [MID, HIGH, MID, EDGE],
];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** Ecrit un PNG 8 bits RGB sans transparence. */
function png(size, pixelAt) {
  // Chaque ligne est prefixee de son octet de filtre — 0, aucun filtre.
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let at = 0;
  for (let y = 0; y < size; y += 1) {
    raw[at] = 0;
    at += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
      at += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // couleur vraie
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param size cote de l'image
 * @param safe part du cote laissee libre autour du motif. Les icones « maskable »
 *   sont rognees en cercle par Android : sans marge, la grille se fait couper.
 */
function drawer(size, safe) {
  const cols = GRID[0].length;
  const rows = GRID.length;
  const inner = size * (1 - safe * 2);
  const cell = inner / cols;
  const gap = Math.max(1, Math.round(cell * 0.12));
  const left = (size - cell * cols) / 2;
  const top = (size - cell * rows) / 2;

  return (x, y) => {
    const col = Math.floor((x - left) / cell);
    const row = Math.floor((y - top) / cell);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return INK;

    // Gouttiere entre les cases : c'est elle qui fait lire « grille » et non « bloc ».
    const inCellX = x - left - col * cell;
    const inCellY = y - top - row * cell;
    if (inCellX < gap || inCellY < gap) return INK;

    return GRID[row][col];
  };
}

mkdirSync(OUT, { recursive: true });

const files = [
  ['icon-192.png', 192, 0.08],
  ['icon-512.png', 512, 0.08],
  // Marge large : Android rogne ces icones en cercle, en carre arrondi ou en goutte
  // selon le lanceur, et ne garantit que les 80 % centraux.
  ['icon-maskable-512.png', 512, 0.18],
  // iOS n'utilise pas le manifeste : il lui faut son propre lien, en 180 px.
  ['apple-touch-icon.png', 180, 0.08],
];

for (const [name, size, safe] of files) {
  writeFileSync(join(OUT, name), png(size, drawer(size, safe)));
  console.log(`${name} — ${size}×${size}`);
}

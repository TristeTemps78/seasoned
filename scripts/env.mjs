/**
 * Ce que les scripts d'outillage partagent : lire `.env`, et rien de plus.
 *
 * ## Pourquoi ce fichier existe plutot qu'une copie dans chaque script
 *
 * `readEnv` porte un correctif qui n'a rien d'evident et qui a deja coute une session :
 * sous Windows le fichier est en **CRLF**, et en JavaScript `.` ne matche pas `\r`. Le
 * motif d'origine echouait donc sur **toute ligne renseignee**, tandis que les lignes vides
 * matchaient — le diagnostic annoncait « variable absente » pour des variables
 * parfaitement remplies.
 *
 * > Un correctif recopie est un correctif qu'on oubliera de recopier la prochaine fois.
 *
 * ⚠️ Aucun script ne doit **jamais** afficher une valeur lue ici : elles finissent dans des
 * captures d'ecran et des conversations.
 */

import { readFileSync } from 'node:fs';

export const RESET = '[0m';
export const RED = '[31m';
export const GREEN = '[32m';
export const YELLOW = '[33m';
export const DIM = '[2m';

/** Lit `.env` puis `.env.local` sans dependance : ceci doit tourner avant tout `npm install`. */
export function readEnv() {
  const values = { ...process.env };
  for (const file of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
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

/**
 * L'identifiant du projet, deduit de son URL.
 *
 * Deduit et non demande : une valeur de plus a saisir est une valeur de plus a saisir de
 * travers, et celle-ci est deja dans `.env` sous une autre forme.
 */
export function projectRefFrom(url) {
  const match = /^https:\/\/([a-z0-9-]+)\.supabase\.(co|in)\/?$/.exec(url ?? '');
  return match === null ? undefined : match[1];
}

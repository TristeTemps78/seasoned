/**
 * Les listes — le premier objet que ce produit fabrique **pour quelqu'un d'autre**.
 *
 * Une note, une position, une critique parlent de soi. Une liste se tend : « les cinq
 * series a voir avant de mourir », « ce que je fais regarder a ma mere ». C'est aussi le
 * seul contenu du produit qui ait un sens **avant** d'avoir regarde quoi que ce soit, donc
 * le seul que quelqu'un puisse ecrire le jour de son arrivee.
 *
 * Module **pur** : il fabrique un identifiant d'URL et verifie des bornes. Ou les listes
 * sont rangees ne le regarde pas — c'est `supabase/007_lists.sql` et `src/social/client.ts`.
 */

export const LIST_TITLE_MAX = 80;
export const LIST_NOTE_MAX = 500;

/**
 * Longueur maximale d'un identifiant d'URL.
 *
 * ⚠️ Cette valeur et le `check` de `007_lists.sql` decrivent la **meme** contrainte. Le
 * motif SQL exige au moins deux caracteres et interdit un tiret aux extremites : tout ce
 * que {@link listSlug} rend doit le satisfaire, sans quoi l'insertion echoue avec une
 * erreur de contrainte que l'interface ne saurait pas expliquer.
 */
export const LIST_SLUG_MAX = 60;
const LIST_SLUG_MIN = 2;

export type ListRejection = 'empty' | 'too_long' | 'note_too_long' | 'unusable_title';

export type ListCheck =
  | { readonly ok: true; readonly title: string; readonly slug: string; readonly note?: string }
  | { readonly ok: false; readonly reason: ListRejection };

/**
 * L'identifiant d'URL derive d'un titre.
 *
 * Les accents sont **deposes**, pas supprimes : « Séries françaises » donne
 * `series-francaises` et non `sries-franaises`. La decomposition Unicode (NFD) separe la
 * lettre de son accent, ce qui permet de ne jeter que le second.
 *
 * ⚠️ Le resultat n'est pas garanti utilisable : un titre entierement fait d'emoji ne rend
 * rien. C'est {@link checkList} qui tranche, parce qu'un slug vide est un refus a expliquer
 * et non une chaine a rafistoler.
 */
export function listSlug(title: string): string {
  return title
    .normalize('NFD')
    // La plage des diacritiques combinants (U+0300–U+036F), que NFD vient de separer de
    // leur lettre. Le test « depose les accents » est ce qui garantit que cette classe
    // survit a l'encodage du fichier — la relire ne le dirait pas.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIST_SLUG_MAX)
    // ⚠️ La coupe peut retomber sur un tiret final, que le motif SQL refuse.
    .replace(/-+$/g, '');
}

/**
 * Un identifiant libre, a partir d'un titre et de ce qui est deja pris.
 *
 * Deux listes peuvent legitimement porter le meme titre — on renomme rarement « Mes
 * favoris ». Sans ce suffixe, la seconde ecraserait la premiere : la cle naturelle de la
 * table est `(user_id, slug)`, donc un `insert` en conflit, ou pire un `upsert` silencieux.
 */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, LIST_SLUG_MAX - suffix.length).replace(/-+$/g, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

/**
 * Verifie un titre de liste, et rend sa forme canonique.
 *
 * On **signale**, on ne tronque pas en silence : couper un titre a
 * quatre-vingts caracteres serait le reecrire sans le dire.
 */
export function checkList(rawTitle: string, rawNote?: string): ListCheck {
  const title = rawTitle.trim();
  if (title.length === 0) return { ok: false, reason: 'empty' };
  if (title.length > LIST_TITLE_MAX) return { ok: false, reason: 'too_long' };

  const note = rawNote?.trim();
  if (note !== undefined && note.length > LIST_NOTE_MAX) {
    return { ok: false, reason: 'note_too_long' };
  }

  const slug = listSlug(title);
  if (slug.length < LIST_SLUG_MIN) return { ok: false, reason: 'unusable_title' };

  return {
    ok: true,
    title,
    slug,
    ...(note !== undefined && note.length > 0 ? { note } : {}),
  };
}

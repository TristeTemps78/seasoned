/**
 * Le tirage deterministe, en un seul endroit.
 *
 * ## Pourquoi ce module existe
 *
 * Trois modules avaient recopie la meme chose : `quiz.ts`, `friend-quiz.ts` et
 * `scripts/build-round.mjs` portaient chacun leur generateur pseudo-aleatoire, leur
 * melange de Fisher-Yates et leur tirage de leurres. Trois copies d'un calcul dont la
 * seule qualite est d'etre **reproductible** — c'est-a-dire trois occasions de cesser de
 * l'etre, chacune corrigee separement.
 *
 * C'est la regle 3 (« ne pas refaire ce qui existe deja »), et je l'ai violee trois fois
 * de suite avant qu'un audit ne le montre.
 *
 * ## Pourquoi le hasard est injecte et jamais tire ici
 *
 * `Math.random()` rendrait tout ce qui s'appuie dessus intestable, et une question
 * changerait a chaque rendu React — donc a chaque frappe au clavier. Une graine explicite
 * rend le calcul verifiable : la meme graine doit rendre la meme suite, toujours.
 *
 * Module pur : ni reseau, ni horloge.
 */

/**
 * Une suite reproductible a partir d'une graine.
 *
 * Le detail des constantes importe peu — ce qui compte est qu'une meme graine rende
 * toujours la meme suite, et que deux graines voisines n'en rendent pas la meme.
 */
export function drawFrom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une graine numerique a partir d'un texte — un jour, par exemple. */
export function seedOf(text: string): number {
  let state = 0;
  for (const character of text) state = (state * 31 + character.charCodeAt(0)) >>> 0;
  return state;
}

/** Un element au hasard, ou `undefined` si la liste est vide. */
export function pickOne<T>(list: readonly T[], draw: () => number): T | undefined {
  return list.length === 0 ? undefined : list[Math.floor(draw() * list.length)];
}

/**
 * Melange une liste **en place**, facon Fisher-Yates.
 *
 * ⚠️ Ce n'est pas cosmetique : sans melange, la bonne reponse d'un quiz reste **toujours
 * au meme rang**, ce qu'un joueur remarque au deuxieme tour — et le quiz devient un
 * bouton.
 */
export function shuffle<T>(items: T[], draw: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(draw() * (index + 1));
    const held = items[index] as T;
    items[index] = items[swap] as T;
    items[swap] = held;
  }
  return items;
}

/**
 * Prend `count` elements distincts au hasard, sans jamais rendre deux fois le meme.
 *
 * La liste recue n'est pas modifiee : c'est une copie qui est consommee.
 */
export function takeSome<T>(from: readonly T[], count: number, draw: () => number): T[] {
  const pool = [...from];
  const taken: T[] = [];
  while (taken.length < count && pool.length > 0) {
    taken.push(...pool.splice(Math.floor(draw() * pool.length), 1));
  }
  return taken;
}

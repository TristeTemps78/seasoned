import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { ROOT } from './sources';
import { AVATAR_HUES, avatarHue, avatarInitials } from '@/app/components/Avatar';

/**
 * Ce que l'avatar promet, et que rien d'autre ne verrait.
 *
 * Un avatar qui rend une couleur est **toujours** vert a l'oeil : on ne sait pas, en le
 * regardant, si c'est la bonne. Les trois proprietes ci-dessous sont donc les seules qui
 * distinguent un avatar utile d'un disque decoratif.
 */

it('la teinte est deterministe — le meme pseudo, la meme couleur', () => {
  // La propriete qui porte toute la valeur : sans elle, l'avatar est un ornement.
  expect(avatarHue('tristan')).toBe(avatarHue('tristan'));
  // La casse ne compte pas : `checkHandle` normalise, deux couleurs pour un compte seraient
  // la meme personne rendue deux fois differemment.
  expect(avatarHue('Tristan')).toBe(avatarHue('tristan'));
});

it('la teinte tombe toujours dans la plage declaree par la feuille de style', () => {
  // ⚠️ Le vrai defaut vise : un `data-hue` hors plage ne casse rien, il rend l'avatar **gris**
  // — c'est-a-dire qu'il retombe silencieusement dans le defaut qu'on corrige.
  const pseudos = ['a', 'zz', 'tristan', 'jean-michel', '00000000', 'e'.repeat(40), 'ç'];
  for (const pseudo of pseudos) {
    const hue = avatarHue(pseudo);
    expect(Number.isInteger(hue)).toBe(true);
    expect(hue).toBeGreaterThanOrEqual(1);
    expect(hue).toBeLessThanOrEqual(AVATAR_HUES);
  }
});

it('les huit teintes existent reellement dans la feuille', () => {
  // Sans quoi le composant designerait des regles absentes, et tous les avatars seraient gris
  // sans qu'aucun test ne bouge.
  const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
  for (let hue = 1; hue <= AVATAR_HUES; hue += 1) {
    expect(css).toContain(`--color-hue-${hue}:`);
    expect(css).toContain(`.avatar[data-hue='${hue}']`);
  }
});

it('un long pseudo ne perd pas ses bits de poids faible', () => {
  // Sans le modulo a chaque tour, la somme depasse MAX_SAFE_INTEGER vers le dixieme caractere
  // et deux pseudos qui ne different que par la fin rendent la meme teinte.
  const base = 'abcdefghijklmnopqrstuvwxyz';
  const teintes = new Set([...'12345678'].map((suffixe) => avatarHue(base + suffixe)));
  expect(teintes.size).toBeGreaterThan(1);
});

it('les initiales sont deux lettres, et jamais du bruit', () => {
  expect(avatarInitials('tristan')).toBe('TR');
  // La ponctuation est retiree, pas rendue : `_max` donnerait « _M ».
  expect(avatarInitials('_max')).toBe('MA');
  expect(avatarInitials('a')).toBe('A');
  // Un disque sans lettre ne se relie a aucun compte — le repli est visible, pas vide.
  expect(avatarInitials('___')).toBe('?');
  expect(avatarInitials('')).toBe('?');
});

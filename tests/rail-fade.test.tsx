import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../lib/i18n';
import { Rail } from '@/app/components/Rail';
import { LocaleProvider } from '@/app/i18n/LocaleProvider';

/**
 * Le fondu et les deux fleches d'une rangee d'affiches.
 *
 * ## Pourquoi ce test existe alors que le projet mesure au navigateur
 *
 * Parce que **cette logique-la ne se mesure pas au navigateur, et c'est demontre**. Le
 * 2026-08-13, dans le panneau qui sert a auditer ce produit : `scrollLeft` change bien
 * (0 → 384), mais l'evenement `scroll` n'est **jamais** emis — verifie avec un ecouteur natif
 * pose a la main, qui recoit zero appel — et `behavior: 'smooth'` ne deplace rien du tout. Le
 * panneau ne compose pas de frames, donc ni la boucle de defilement ni `requestAnimationFrame`
 * n'y tournent.
 *
 * L'etat a donc ete verifie a la main en poussant un `Event('scroll')`, et le resultat etait
 * juste aux quatre positions. Ce fichier fige ce qui a ete constate ce jour-la, parce que la
 * prochaine session n'aura pas plus de moyen de le voir a l'ecran que celle-ci.
 *
 * ⚠️ **jsdom n'a aucun moteur de mise en page** — la lecon inscrite dans `CLAUDE.md`. Les
 * trois dimensions sont donc posees a la main : ce fichier ne teste pas que la rangee deborde
 * (ca, c'est au navigateur), il teste **ce qu'on en deduit**, qui est du calcul pur.
 */

function poser(list: HTMLElement, { scrollLeft, clientWidth, scrollWidth }: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}) {
  for (const [prop, value] of [
    ['scrollLeft', scrollLeft],
    ['clientWidth', clientWidth],
    ['scrollWidth', scrollWidth],
  ] as const) {
    Object.defineProperty(list, prop, { value, configurable: true });
  }
}

function monter() {
  render(
    <LocaleProvider locale="fr" messages={DICTIONARIES.fr}>
      <Rail title="Cette semaine" subtitle="Les prochaines">
        <li>une affiche</li>
      </Rail>
    </LocaleProvider>,
  );
  // La liste porte la classe, pas un role : c'est elle que `Rail` mesure.
  const list = document.querySelector('ul.rail');
  if (list === null) throw new Error('la rangee n’a pas ete rendue');
  return list as HTMLElement;
}

const fade = (list: HTMLElement) => list.dataset['fade'];
const bouton = (nom: RegExp) => screen.getByRole('button', { name: nom }) as HTMLButtonElement;

describe('le fondu dit de quel cote il reste des affiches', () => {
  it('rien ne depasse : ni fondu, ni fleches', () => {
    const list = monter();
    poser(list, { scrollLeft: 0, clientWidth: 1280, scrollWidth: 1280 });
    fireEvent.scroll(list);

    expect(fade(list)).toBe('none');
    // ⚠️ Absentes et non desactivees : il n'y a rien a comprendre, donc rien a montrer.
    expect(screen.queryByRole('button', { name: /Avancer/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reculer/ })).toBeNull();
  });

  it('au depart, la suite est a droite et on ne peut pas reculer', () => {
    const list = monter();
    poser(list, { scrollLeft: 0, clientWidth: 1280, scrollWidth: 2456 });
    fireEvent.scroll(list);

    expect(fade(list)).toBe('right');
    expect(bouton(/Reculer/).disabled).toBe(true);
    expect(bouton(/Avancer/).disabled).toBe(false);
  });

  it('au milieu, les deux bords fondent', () => {
    const list = monter();
    poser(list, { scrollLeft: 576, clientWidth: 1280, scrollWidth: 2456 });
    fireEvent.scroll(list);

    expect(fade(list)).toBe('both');
    expect(bouton(/Reculer/).disabled).toBe(false);
    expect(bouton(/Avancer/).disabled).toBe(false);
  });

  it('au bout, on ne peut plus avancer', () => {
    const list = monter();
    poser(list, { scrollLeft: 1176, clientWidth: 1280, scrollWidth: 2456 });
    fireEvent.scroll(list);

    expect(fade(list)).toBe('left');
    expect(bouton(/Avancer/).disabled).toBe(true);
  });

  it('un pixel de marge : une rangee qui rentre pile ne porte pas de fondu', () => {
    // ⚠️ Le defaut vise, et il vient de `Faces` qui l'avait deja rencontre : les largeurs sont
    // fractionnaires et `scrollWidth` arrondit, donc sans la marge une rangee qui tient
    // exactement porterait un fondu permanent — annoncant une suite qui n'existe pas.
    const list = monter();
    poser(list, { scrollLeft: 0, clientWidth: 1280, scrollWidth: 1281 });
    fireEvent.scroll(list);

    expect(fade(list)).toBe('none');
  });

  it('les fleches nomment leur rangee', () => {
    // Trois rangees sur l'accueil : « Avancer » seul laisserait un lecteur d'ecran devant
    // trois boutons indistinguables.
    const list = monter();
    poser(list, { scrollLeft: 0, clientWidth: 1280, scrollWidth: 2456 });
    fireEvent.scroll(list);

    // ⚠️ L'attribut et non `getByRole({ name })` : le nom accessible passe par une
    // normalisation qui ne rend pas les chevrons francais tels quels. Ce qu'on verifie ici
    // est que le titre de la rangee **est dans le libelle**, pas la ponctuation autour.
    expect(bouton(/Avancer/).getAttribute('aria-label')).toContain('Cette semaine');
    expect(bouton(/Reculer/).getAttribute('aria-label')).toContain('Cette semaine');
  });
});

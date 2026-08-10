import { describe, expect, it } from 'vitest';
import { codeOf, filesUnder, pathOf } from './sources';

/**
 * 🔴 **Un controle `sr-only` reste focalisable, et il reste dans l'arbre d'accessibilite.**
 *
 * Mesure au navigateur le 2026-08-11 sur `/moi` : le champ de fichier de `JournalTransfer`
 * portait `sr-only` — invisible a l'oeil — et se presentait quand meme au clavier, **sans
 * nom**. Un lecteur d'ecran annoncait « bouton Importer un fichier », puis un second
 * controle muet juste derriere : le meme geste, deux fois, dont une sans etiquette.
 *
 * `sr-only` ne cache pas, il **deplace** : la classe sort l'element du flux visuel
 * precisement pour le garder lisible aux lecteurs d'ecran. C'est le bon outil pour un texte
 * d'aide, et le mauvais pour un champ qu'un bouton actionne a la place de l'utilisateur.
 *
 * > La regle : un controle `sr-only` est soit **nomme** (il s'adresse vraiment aux lecteurs
 * > d'ecran), soit **retire du parcours** par `tabIndex={-1}` (c'est de la mecanique). Jamais
 * > ni l'un ni l'autre.
 *
 * ⚠️ Ce test lit la source, comme `no-hardcoded-strings` : un test de composant prouverait le
 * cas connu, pas la regle. Le defaut n'a d'ailleurs ete vu ni par le typage, ni par les
 * tests, ni au build — seulement en parcourant la page au clavier.
 */

/** Les elements qui prennent le focus par defaut. */
const FOCUSABLE = /<(input|button|select|textarea|a)\b/i;

const FILES = [...filesUnder('app')]
  .map((file) => ({ path: pathOf(file), code: codeOf(file) }))
  .filter(({ code }) => code.includes('sr-only'));

/**
 * Les balises portant `sr-only`, avec leurs attributs — une balise par entree.
 *
 * On decoupe sur `<` plutot que d'ecrire une expression qui traverse le JSX : les attributs
 * s'etalent sur plusieurs lignes, et un motif « tout ce qui est entre `<` et `>` » se ferait
 * pieger par le premier `>` d'une accolade.
 */
function hiddenControls(code: string): readonly string[] {
  return code
    .split('<')
    .map((chunk) => `<${chunk.split(/\/?>/)[0] ?? ''}`)
    .filter((tag) => tag.includes('sr-only') && FOCUSABLE.test(tag));
}

describe('un controle invisible ne traine pas dans le parcours clavier', () => {
  it('la garde inspecte bien quelque chose', () => {
    // Sans ce garde-fou, un chemin devenu faux rendrait le test vert pour la pire raison :
    // il n'examinerait plus rien.
    expect(FILES.length).toBeGreaterThan(0);
    expect(hiddenControls('<input className="sr-only" type="file" />')).toHaveLength(1);
    // Un texte `sr-only` n'est pas un controle : il doit rester lisible, c'est son role.
    expect(hiddenControls('<span className="sr-only">Chargement</span>')).toHaveLength(0);
  });

  it('chaque controle sr-only est nomme, ou hors du parcours', () => {
    const fautifs = FILES.flatMap(({ path, code }) =>
      hiddenControls(code)
        .filter(
          (tag) =>
            !tag.includes('tabIndex={-1}') &&
            !tag.includes('aria-label') &&
            !tag.includes('aria-labelledby'),
        )
        .map((tag) => `${path} — ${tag.replace(/\s+/g, ' ').slice(0, 90)}`),
    );

    expect(
      fautifs,
      'Controle sr-only ni nomme ni retire du parcours : il est annonce vide au clavier',
    ).toEqual([]);
  });
});

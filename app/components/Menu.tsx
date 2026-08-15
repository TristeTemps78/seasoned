/**
 * Un menu deroulant — **le meme dessin pour les deux natures de choix du produit**.
 *
 * ## Pourquoi un `<select>` natif, et pas un menu dessine
 *
 * Un menu maison demande un piege de focus, la navigation aux fleches, `aria-activedescendant`,
 * la fermeture au `Escape` et au clic dehors — et il ne rendra jamais la **roue de selection**
 * qu'iOS et Android ouvrent pour un `<select>`, qui est exactement ce qu'on veut au pouce.
 * Le produit en avait deja cinq ; la regle 3 dit de ne pas refaire ce qui existe.
 *
 * ## Deux usages, un composant, et le typage empeche de les melanger
 *
 *   - **Sans JavaScript** — `name` + `defaultValue`, dans un `<form method="get">`. C'est
 *     `/parcourir`, qui reste un composant **serveur pur** : aucun etat React, l'adresse
 *     porte toujours la question, et la page marche le JavaScript coupe.
 *   - **Avec etat** — `value` + `onChange`, pour un filtre qui vit dans le navigateur et ne
 *     redemande rien au serveur (les critiques d'une serie sont deja toutes chargees).
 *
 * L'union discriminee rend le melange **impossible a compiler** : un `value` sans `onChange`
 * est un champ que React fige et que personne ne peut plus changer — le defaut classique, et
 * il est silencieux a l'execution.
 *
 * ⚠️ Pas de `'use client'` : le composant n'a aucun etat propre. Il est serveur dans
 * `/parcourir`, et devient client par contagion la ou un composant client l'importe.
 */
export function Menu(props: MenuProps) {
  const { id, label, options, hideLabel = false } = props;

  return (
    <span className="inline-flex items-center gap-2">
      {/*
       * ⚠️ Un `<label>` **toujours**, jamais un `aria-label` : le libelle visible est aussi
       * la cible qui ouvre le menu au clic, ce qui double une zone de 44 px sans dessiner
       * quoi que ce soit. `hideLabel` ne le supprime pas, il le rend `sr-only`.
       */}
      <label className={hideLabel ? 'sr-only' : 'label shrink-0'} htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="menu"
        {...('name' in props && props.name !== undefined
          ? { name: props.name, defaultValue: props.defaultValue }
          : { value: props.value, onChange: (e) => props.onChange(e.target.value) })}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  );
}

interface MenuOption {
  /** ⚠️ La chaine vide est la valeur legitime de « tous » : un filtre absent, pas un choix. */
  readonly value: string;
  readonly label: string;
}

interface MenuCommon {
  readonly id: string;
  readonly label: string;
  readonly options: readonly MenuOption[];
  /**
   * Cacher le libelle aux yeux, jamais aux lecteurs d'ecran.
   *
   * ⚠️ Reserve au cas ou la question est deja ecrite juste au-dessus — sinon un menu qui
   * dit « Tous » sans dire « tous quoi » est une devinette.
   */
  readonly hideLabel?: boolean;
}

/** Sans JavaScript : le menu est un champ de formulaire, et c'est l'envoi qui navigue. */
interface MenuInForm extends MenuCommon {
  readonly name: string;
  readonly defaultValue: string;
  readonly value?: never;
  readonly onChange?: never;
}

/** Avec etat : le choix vit dans le navigateur et ne redemande rien au serveur. */
interface MenuControlled extends MenuCommon {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly name?: never;
  readonly defaultValue?: never;
}

export type MenuProps = MenuInForm | MenuControlled;

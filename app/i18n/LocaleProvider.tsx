'use client';

import { createContext, useContext, useMemo } from 'react';
import {
  DEFAULT_LOCALE,
  formatNumberIn,
  t as translate,
  tn as translateN,
  type Locale,
  type MessageKey,
  type Params,
} from '@/lib/i18n';

/**
 * La langue de la page, telle qu'elle descend jusqu'aux gestes.
 *
 * ## Le defaut que ce module repare, et qui ne se voyait pas
 *
 * Les composants client n'avaient aucun moyen de savoir dans quelle langue la page etait
 * servie. Le seul qui essayait — le bandeau de securite des donnees — **devinait**, en
 * lisant `navigator.language`. Consequence : sur `/fr`, un navigateur regle en anglais
 * affichait un bandeau anglais **au milieu d'une page francaise**, et reciproquement sur
 * `/`. La page devenait bilingue, dans le mauvais sens du terme.
 *
 * C'est la meme famille d'erreur que le `lang="en"` sur `/fr` corrige la veille : chaque
 * morceau etait juste isolement, et l'ensemble se contredisait. La regle qui en sort est
 * la meme : **la langue est une propriete de l'adresse, jamais du visiteur.** L'adresse
 * est choisie (on a clique un lien), le reglage du navigateur est subi.
 *
 * ## Pourquoi un contexte et non une prop
 *
 * Passer `locale` en prop serait plus explicite, et c'est le reflexe correct. Il tombe ici
 * sur un fait : la moitie des composants concernes sont rendus **par d'autres composants
 * client** (`StarRating` par `MyProgress`, `LibraryCard` par `Library`), donc la prop
 * devrait traverser des couches qui n'en ont aucun usage. Seize signatures a modifier,
 * seize occasions d'en oublier une — et un oubli est silencieux : le composant retombe sur
 * l'anglais et personne ne le voit avant de servir la page en francais.
 *
 * Le cout est nul en pratique : React est deja charge, et le fournisseur ne transporte
 * qu'une chaine de deux lettres dans le flux.
 *
 * ## Le repli est l'anglais, et c'est voulu
 *
 * Sans fournisseur — dans un test isole, par exemple — {@link useLocale} rend
 * {@link DEFAULT_LOCALE}. Retomber sur la langue par defaut du site est le comportement
 * le moins surprenant, et il correspond a ce que verrait un visiteur de `/`.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: {
  readonly locale: Locale;
  readonly children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/**
 * La langue de la page courante.
 *
 * ⚠️ **Pas exportee.** Elle l'etait sans lecteur : `useT`, juste en dessous, est le seul.
 * Deux portes pour la meme chose invitent a ecrire `t(useLocale(), 'cle')` dans un ecran
 * neuf — la forme que `useT` existe pour remplacer.
 */
function useLocale(): Locale {
  return useContext(LocaleContext);
}

/**
 * Traduire, dans la langue de la page.
 *
 * Rend `t` et `tn` **deja lies** a la locale, pour que l'appel dans un composant tienne en
 * `t('nav.library')`. Ecrire `t(locale, 'nav.library')` seize fois par fichier invite a
 * capturer une locale perimee dans une fermeture ; ici il n'y a rien a capturer.
 */
export function useT(): {
  readonly locale: Locale;
  readonly t: (key: MessageKey, params?: Params) => string;
  readonly tn: (base: string, n: number, params?: Params) => string;
  /** Un nombre ecrit comme l'ecrit la langue — la virgule francaise n'est pas universelle. */
  readonly n: (value: number, digits?: number) => string;
} {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      t: (key: MessageKey, params?: Params) => translate(locale, key, params),
      tn: (base: string, n: number, params?: Params) => translateN(locale, base, n, params),
      n: (value: number, digits?: number) => formatNumberIn(value, locale, digits),
    }),
    [locale],
  );
}

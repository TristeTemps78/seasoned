'use client';

import { createContext, useContext, useMemo } from 'react';
// 🔴 **Depuis `@/lib/i18n/engine`, jamais `@/lib/i18n`** (8.10). Ce fichier est le
// fournisseur de TOUTES les pages : importer le module qui connait les deux dictionnaires
// suffirait a les remettre dans le paquet du navigateur, et l'economie serait annulee sans
// qu'aucun test de comportement ne bronche. `tests/i18n-split.test.ts` tient cette regle.
import {
  DEFAULT_LOCALE,
  formatNumberIn,
  translateIn,
  translateNIn,
  type Locale,
  type MessageKey,
  type Messages,
  type Params,
} from '@/lib/i18n/engine';

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
/**
 * ## 8.10 — le contexte porte **les phrases**, plus seulement la langue
 *
 * Il ne transportait qu'une chaine de deux lettres, et chaque composant allait chercher les
 * dictionnaires par un import. C'est ce qui les mettait tous les deux dans le paquet client :
 * un import statique ne se choisit pas a l'execution.
 *
 * Le dictionnaire descend donc d'un module `Messages*` — un par langue, chacun n'important
 * que le sien. Comme `/` et `/fr` sont deux routes distinctes, chaque paquet de route ne
 * contient plus que la langue qu'il sert.
 *
 * ⚠️ **Le repli sans fournisseur reste l'anglais** — dans un test isole, par exemple — mais
 * il n'a plus de phrases : un `t()` hors fournisseur rend la cle. C'est volontaire et
 * preferable a l'alternative, qui serait d'embarquer un dictionnaire de secours dans toutes
 * les pages pour un cas qui n'arrive qu'en test. Le typage garantit deja qu'aucune cle ne
 * manque a une langue reellement servie.
 */
const LocaleContext = createContext<{ locale: Locale; messages: Messages }>({
  locale: DEFAULT_LOCALE,
  messages: {} as Messages,
});

export function LocaleProvider({ locale, messages, children }: {
  readonly locale: Locale;
  /** Le dictionnaire de **cette** page. Voir `app/i18n/MessagesEn.tsx`. */
  readonly messages: Messages;
  readonly children: React.ReactNode;
}) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
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
  const { locale, messages } = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      t: (key: MessageKey, params?: Params) => translateIn(messages, locale, key, params),
      tn: (base: string, n: number, params?: Params) =>
        translateNIn(messages, locale, base, n, params),
      n: (value: number, digits?: number) => formatNumberIn(value, locale, digits),
    }),
    [locale, messages],
  );
}

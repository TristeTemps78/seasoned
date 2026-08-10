/**
 * Les langues du produit — **le cote qui connait les phrases**.
 *
 * ## Pourquoi ce module arrive maintenant, et pas « plus tard »
 *
 * Le SEO est **le seul canal d'acquisition qui fonctionne sans utilisateurs**.
 * Or une page en francais ne capte pas *« is X worth watching »*,
 * qui est un marche d'un ordre de grandeur plus grand. L'international n'est donc pas un
 * elargissement du produit : c'est le **multiplicateur du seul canal qui marche a froid**.
 *
 * Et il se trouve que ce projet est, structurellement, bien place pour le faire :
 *
 * > **Le differenciateur est language-agnostic.** Le statut reel, le temps ecoule chiffre,
 * > la trajectoire, le point d'arret, le taux d'abandon se calculent **sans langue** — tout
 * > `src/domain/` est deja muet. Un site de critiques doit traduire son contenu ; nous
 * > avons une centaine de chaines a traduire. Le fosse s'internationalise a cout quasi nul,
 * > ce qui n'est vrai d'aucun concurrent.
 *
 * D'ou la regle de ce module : **le domaine ne connait aucune langue.** Rien ici n'est
 * importe par `src/domain/` — ce serait le chemin le plus court pour rendre les regles
 * metier dependantes de la locale, et perdre precisement l'avantage decrit ci-dessus.
 *
 * ## 🔴 8.10 — ce fichier importe LES DEUX dictionnaires, donc il ne va pas au navigateur
 *
 * C'est desormais sa definition. Le moteur — negociation de langue, pluriels, interpolation,
 * espaces insecables, formats de nombre et de date — vit dans `./i18n/engine`, qui ne connait
 * **aucune** phrase et que n'importe quel composant client peut importer. Ce qui reste ici
 * est ce qui a besoin des deux dictionnaires a la fois : {@link DICTIONARIES} et le repli.
 *
 * ⚠️ **Un composant client qui importe ce module rapatrie toutes les langues.**
 * `tests/i18n-split.test.ts` le refuse. Cote navigateur, les phrases arrivent par
 * `LocaleProvider` — un dictionnaire, celui de la page.
 *
 * Le moteur est reexporte ci-dessous : les cinquante fichiers **serveur** qui ecrivent
 * `from '@/lib/i18n'` n'ont rien a changer, et pour eux le cout est nul.
 */

export * from './i18n/engine';

import { FR } from './i18n/fr';
import { EN } from './i18n/en';
import {
  DEFAULT_LOCALE,
  translateIn,
  translateNIn,
  type Locale,
  type Messages,
  type MessageKey,
  type Params,
  type Translator,
} from './i18n/engine';

export type { MessageKey };

/**
 * Les deux dictionnaires.
 *
 * `fr` fait foi : c'est lui qui definit le jeu de cles, et le typage rend toute cle manquante
 * dans une autre langue **fatale a la compilation**. Une traduction incomplete ne peut donc
 * pas atteindre la production — c'est le seul garde-fou qui tienne sans processus humain.
 *
 * Exporte aussi **pour les tests** : certaines regles portent sur le texte lui-meme et non
 * sur un composant — « aucune phrase ne promet que rien ne sort d'ici », par exemple.
 */
export const DICTIONARIES: Readonly<Record<Locale, Messages>> = {
  fr: FR,
  en: EN,
};

/**
 * Une chaine, dans une langue.
 *
 * Ne rend jamais une cle nue a l'ecran : une traduction manquante retombe sur le francais,
 * qui est complet par construction. Voir un texte dans la mauvaise langue est desagreable ;
 * voir `safety.title` est casse.
 */
export function t(locale: Locale, key: MessageKey, params?: Params): string {
  return translateIn(DICTIONARIES[locale], locale, key, params, FR);
}

/** Une chaine accordee au nombre. Voir {@link translateNIn}. */
export function tn(locale: Locale, base: string, n: number, params?: Params): string {
  return translateNIn(DICTIONARIES[locale], locale, base, n, params, FR);
}

/**
 * De quoi traduire, pour un appelant **serveur**.
 *
 * ⚠️ Le pendant client est `useT()`, et les deux rendent la meme forme : c'est ce qui permet
 * a `lib/format.ts` d'etre appele des deux cotes sans savoir d'ou viennent les phrases.
 */
export function translatorFor(locale: Locale = DEFAULT_LOCALE): Translator {
  return {
    locale,
    t: (key, params) => t(locale, key, params),
    tn: (base, n, params) => tn(locale, base, n, params),
  };
}

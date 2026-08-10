/**
 * Le moteur de langue — **et pas une seule phrase**.
 *
 * ## 8.10 : pourquoi ce fichier existe
 *
 * `lib/i18n.ts` importe les deux dictionnaires. Tout ce qui l'importe les embarque donc tous
 * les deux — y compris `lib/routes.ts`, que seize composants client utilisent pour construire
 * une adresse. Mesure du 2026-08-11 sur le paquet construit : **un seul chunk de 75 604
 * octets (24 620 gzip)** portait `fr` et `en`, et `/` comme `/fr` le chargeaient. Un visiteur
 * anglais telechargeait ~12 Ko gzip de francais qu'il ne lira jamais.
 *
 * ⚠️ **Le probleme n'est pas les 12 Ko, c'est la pente.** A cinq langues, le meme chunk
 * partage ferait ~60 Ko gzip dont 80 % de langues que personne sur la page ne lit — et il
 * grandirait a chaque traduction ajoutee, c'est-a-dire au moment ou l'on croit avancer.
 *
 * La coupure est ici : ce module sait **tout faire** avec des messages qu'on lui donne, et
 * n'en connait aucun. Il peut donc etre importe par n'importe quel composant client sans
 * tirer un seul dictionnaire derriere lui.
 *
 * > Regle a tenir : **rien dans ce fichier ne nomme `FR` ni `EN`.** `MessageKey` vient de
 * > `./fr` en `import type`, donc efface a la compilation — c'est un type, pas des phrases.
 */

import type { MessageKey } from './fr';

export type { MessageKey };

/**
 * Les langues servies.
 *
 * En ajouter une est mecanique : un objet de plus dans `DICTIONARIES`, un module `Messages*`
 * de plus, et le typage rend toute cle manquante fatale a la compilation.
 */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * La langue servie par defaut — **l'anglais**, tranche par Tristan le 2026-08-02 (A10).
 *
 * Ce n'est pas la langue de l'auteur : c'est la langue de la page servie quand rien ne
 * permet de choisir, donc celle que les moteurs indexent. Le defaut est une decision
 * d'acquisition, pas une preference — *« is X worth watching »* est un marche d'un ordre de
 * grandeur plus grand que sa traduction francaise.
 */
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * L'etiquette BCP 47 complete, pour `Intl` et pour le catalogue.
 *
 * C'est le seul endroit du code ou une langue se voit attribuer un pays par defaut —
 * ailleurs, la region est une donnee a part.
 */
const LOCALE_TAG: Readonly<Record<Locale, string>> = {
  fr: 'fr-FR',
  en: 'en-US',
};

export function localeTag(locale: Locale): string {
  return LOCALE_TAG[locale];
}

/**
 * La region de disponibilite par defaut d'une langue.
 *
 * ⚠️ **La langue n'est pas le pays**, et c'est la confusion qui casse « ou la regarder » : un
 * francophone belge ou canadien n'a pas le catalogue francais. Cette table n'est donc qu'un
 * **repli**, a n'utiliser que faute de mieux.
 */
const FALLBACK_REGION: Readonly<Record<Locale, string>> = {
  fr: 'FR',
  en: 'US',
};

export function watchRegion(locale: Locale): string {
  return FALLBACK_REGION[locale];
}

/**
 * Un nombre, ecrit comme l'ecrit la langue.
 *
 * ⚠️ Le separateur decimal n'est pas un detail typographique : `4.5` se lit « quatre mille
 * cinq cents » a quelqu'un dont la langue groupe les milliers par un point. Le code faisait
 * partout `toFixed(1).replace('.', ',')` — une virgule **codee en dur**, donc une note
 * affichee en francais sur une page anglaise.
 */
export function formatNumberIn(value: number, locale: Locale, digits?: number): string {
  return new Intl.NumberFormat(
    localeTag(locale),
    digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  ).format(value);
}

/** Les valeurs interpolables dans un message : `{n}`, `{d}`, `{r}`… */
export type Params = Readonly<Record<string, string | number>>;

/** Un jeu de phrases, quelle que soit la langue. */
export type Messages = Readonly<Record<MessageKey, string>>;

function interpolate(template: string, params: Params | undefined): string {
  if (params === undefined) return template;
  // Un marqueur sans valeur reste tel quel plutot que de devenir « undefined » : c'est
  // visible en relecture, alors qu'un trou silencieux ne l'est pas.
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/**
 * Les espaces insecables du francais, posees a l'affichage.
 *
 * Le francais met une espace **avant** `: ; ! ?` et **autour** des guillemets — et cette
 * espace ne doit pas pouvoir casser en fin de ligne. Constate a l'ecran le 2026-08-07 sur
 * `/moi` : le guillemet fermant rejete seul au debut de la ligne suivante, sur le **premier
 * ecran d'un nouvel utilisateur**. Il y avait **zero** espace insecable dans tout `fr.ts`,
 * pour 67 lignes concernees.
 *
 * > *Extraire une forme ne protege que les ecrans qu'on rouvre le meme jour.* Un point de
 * > passage unique protege aussi ceux qu'on n'a pas ouverts, et les phrases qui n'existent
 * > pas encore.
 *
 * ⚠️ **Sur le modele, jamais sur les valeurs interpolees** : un titre TMDB est une donnee
 * externe, parfois anglaise, et n'a rien a faire dans une regle de composition francaise.
 * ⚠️ **U+00A0 et pas U+202F** : la fine insecable est plus juste, mais toutes les polices ne
 * la dessinent pas, et une police qui l'ignore rend un mot colle. Le risque est asymetrique.
 * ⚠️ Une URL n'est jamais touchee : son `:` n'est pas precede d'une espace.
 *
 * ⚠️ **L'espace est ecrite ` ` et non collee au clavier**, et ce n'est pas du purisme : la version
 * d'origine portait le caractere litteral, invisible a la relecture. Il a suffi de recopier
 * la fonction dans ce fichier pour le remplacer par une espace ordinaire — la regle devenait
 * un `remplace une espace par une espace`, et **onze cles reglementaires sont passees au
 * rouge d'un coup** (`i18n.test.ts`). Un caractere qu'on ne voit pas ne se relit pas ; un
 * echappement, si.
 */
const NBSP = ' ';

function frenchSpacing(template: string): string {
  return template.replace(/ ([:;!?»])/g, `${NBSP}$1`).replace(/« /g, `«${NBSP}`);
}

/**
 * Une chaine, tiree d'un jeu de messages **fourni**.
 *
 * @param fallback les phrases de repli. Cote serveur c'est le francais, complet par
 *   construction. Cote client il n'y en a pas, et il n'en faut pas : `en.ts` est declare
 *   `Record<keyof typeof FR, string>`, donc une cle absente **ne compile pas**. Le repli
 *   couvrait un cas que le typage interdit deja ; l'embarquer dans le navigateur aurait
 *   voulu dire y embarquer un second dictionnaire pour un cas impossible.
 */
export function translateIn(
  messages: Messages,
  locale: Locale,
  key: MessageKey,
  params?: Params,
  fallback?: Messages,
): string {
  const template = messages[key] ?? fallback?.[key] ?? key;
  return interpolate(locale === 'fr' ? frenchSpacing(template) : template, params);
}

/**
 * Une chaine accordee au nombre.
 *
 * ## Pourquoi `Intl.PluralRules` et pas un `n > 1 ?`
 *
 * Parce que les langues ne sont pas d'accord, et que le desaccord commence a **zero** : le
 * francais dit « 0 jour » (singulier), l'anglais « 0 days » (pluriel). Un ternaire ecrit par
 * un francophone produit donc un anglais faux, et c'est le genre de faute qu'on ne voit
 * jamais dans sa propre langue.
 *
 * @param base la cle **sans** le suffixe de forme — on cherchera `base.one` ou `base.other`.
 */
export function translateNIn(
  messages: Messages,
  locale: Locale,
  base: string,
  n: number,
  params?: Params,
  fallback?: Messages,
): string {
  const category = new Intl.PluralRules(localeTag(locale)).select(n);
  const key = `${base}.${category === 'one' ? 'one' : 'other'}` as MessageKey;
  return translateIn(messages, locale, key, { n, ...params }, fallback);
}

/**
 * De quoi ecrire une phrase, sans savoir d'ou viennent les phrases.
 *
 * ⚠️ C'est **exactement** ce que rend `useT()`, et c'est ce qui permet a `lib/format.ts` de
 * ne plus importer de dictionnaire : il recevait une langue, il recoit desormais de quoi
 * traduire. Un composant client passe son `useT()` ; un composant serveur passe
 * `translatorFor(locale)`.
 */
export interface Translator {
  readonly locale: Locale;
  readonly t: (key: MessageKey, params?: Params) => string;
  readonly tn: (base: string, n: number, params?: Params) => string;
}

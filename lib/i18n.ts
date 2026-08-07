/**
 * Les langues du produit.
 *
 * ## Pourquoi ce module arrive maintenant, et pas « plus tard »
 *
 * Le SEO est **le seul canal d'acquisition qui fonctionne sans utilisateurs**
 * (`ROADMAP.md` §0.2). Or une page en francais ne capte pas *« is X worth watching »*,
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
 * ## Ce que ce module ne fait pas encore
 *
 * Il ne fait **pas** le routage par locale (`/en/serie/…`), ni les balises `hreflang`, ni
 * le sitemap par langue. Ce sont les trois choses qui transforment la traduction en trafic,
 * et elles se decident ensemble avec le choix de la langue par defaut (`TASKS.md` 1.60).
 * Ce module est le socle : sans lui, chaque nouvelle chaine ecrite en dur est une dette
 * qu'il faudra repayer une fois par composant.
 */

/**
 * Les langues reellement servies.
 *
 * Deux, et pas cinq. Annoncer des langues qu'on ne sait pas relire serait la meme faute
 * que promettre un import qu'on ne sait pas faire : la liste doit dire ce qui existe.
 * En ajouter une est mecanique — un objet de plus dans {@link DICTIONARIES}, et le
 * typage rend toute cle manquante fatale a la compilation.
 */
export const SUPPORTED_LOCALES = ['fr', 'en'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * La langue servie par defaut — **l'anglais**, tranche par Tristan le 2026-08-02 (A10).
 *
 * ## Ce que « par defaut » veut dire ici, et ce que ca ne veut pas dire
 *
 * Ce n'est pas la langue de l'auteur, ni celle du plus grand nombre d'utilisateurs
 * actuels : il n'y en a pas. C'est **la langue de la page servie quand rien ne permet de
 * choisir** — c'est-a-dire, sur un site statique, la page que les moteurs indexent. Le
 * defaut est donc une decision d'acquisition, pas une preference.
 *
 * Le raisonnement : le SEO est le seul canal qui fonctionne sans utilisateurs, et
 * *« is X worth watching »* est un marche d'un ordre de grandeur plus grand que sa
 * traduction francaise. Servir le francais par defaut revenait a viser le petit marche
 * avec le seul levier disponible.
 *
 * ⚠️ **Le francais n'est pas retrograde**, il cesse d'etre implicite. Il reste servi
 * entierement — et desormais **teste explicitement**, ce qu'il n'etait pas : tant qu'il
 * etait le defaut, les tests qui ne precisaient rien le verifiaient par accident.
 */
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * La locale la plus proche d'un en-tete `Accept-Language`.
 *
 * Tolerant par principe, comme tout le parsing du projet (`AGENTS.md` regle 4) : une
 * valeur absente, vide ou exotique rend la langue par defaut, jamais une erreur. On
 * compare sur la **sous-etiquette de langue** (`fr-CA` → `fr`), parce que ce qui nous
 * interesse est la langue, pas le pays — le pays sert a autre chose, voir
 * {@link watchRegion}.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (header === null || header === undefined) return DEFAULT_LOCALE;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith('q='))
        ?.slice(2);
      const weight = q === undefined ? 1 : Number.parseFloat(q);
      return { tag: tag.trim().toLowerCase(), weight: Number.isNaN(weight) ? 0 : weight };
    })
    .filter((entry) => entry.tag.length > 0 && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  for (const { tag } of ranked) {
    const language = tag.split('-')[0];
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}

/**
 * L'etiquette BCP 47 complete, pour `Intl` et pour le catalogue.
 *
 * Le catalogue veut un pays (TMDB renvoie des metadonnees traduites par `language`), et
 * `Intl` en profite pour les dates. C'est le seul endroit du code ou une langue se voit
 * attribuer un pays par defaut — ailleurs, la region est une donnee a part.
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
 * ⚠️ **La langue n'est pas le pays**, et c'est la confusion qui casse « ou la regarder » :
 * un francophone belge ou canadien n'a pas le catalogue francais. Cette table n'est donc
 * qu'un **repli**, a n'utiliser que faute de mieux. La region choisie par l'utilisateur, ou
 * celle deduite de la requete, doit toujours primer.
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
 * ⚠️ Le separateur decimal n'est pas un detail typographique : `4.5` se lit
 * « quatre mille cinq cents » a quelqu'un dont la langue groupe les milliers par un
 * point. Le code faisait partout `toFixed(1).replace('.', ',')` — une virgule **codee en
 * dur**, donc une note affichee en francais sur une page anglaise. C'est le meme defaut
 * que la langue devinee, en plus discret.
 *
 * @param digits nombre de decimales imposees. Omis, `2.5` rend « 2,5 » et `4` rend « 4 »,
 *   ce qui est ce qu'on veut pour une etiquette lue a voix haute.
 */
export function formatNumberIn(value: number, locale: Locale, digits?: number): string {
  return new Intl.NumberFormat(
    localeTag(locale),
    digits === undefined
      ? {}
      : { minimumFractionDigits: digits, maximumFractionDigits: digits },
  ).format(value);
}

/** Date longue, dans la langue demandee, en UTC pour rester stable d'un serveur a l'autre. */
export function formatDateIn(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

// ---------------------------------------------------------------------------
// Les chaines
// ---------------------------------------------------------------------------

/**
 * Le dictionnaire de reference.
 *
 * `fr` fait foi : c'est lui qui definit le jeu de cles, et le typage de {@link DICTIONARIES}
 * rend toute cle manquante dans une autre langue **fatale a la compilation**. Une
 * traduction incomplete ne peut donc pas atteindre la production — c'est le seul garde-fou
 * qui tienne sans processus humain.
 */
/**
 * Les deux dictionnaires vivent dans `lib/i18n/`, un fichier par langue.
 *
 * ⚠️ **Ils occupaient 84 % de ce fichier** — 1222 lignes sur 1465 — et rendaient le moteur
 * invisible au milieu des phrases. Ce qui reste ici est ce qui *fait* quelque chose : la
 * negociation de langue, les pluriels, l'interpolation.
 *
 * ⚠️ **Le typage ne change pas d'un iota**, et c'est la seule chose qui comptait :
 * {@link MessageKey} vaut toujours `keyof typeof FR`, et `en.ts` declare son dictionnaire
 * comme `Record<keyof typeof FR, string>`. Une cle francaise sans equivalent anglais ne
 * compile toujours pas. Perdre cette garantie en gagnant de la lisibilite aurait ete un
 * mauvais echange — `TASKS.md` 8.10 le dit explicitement.
 *
 * ⚠️ **Ce decoupage ne resout PAS la tache 8.10.** Les deux dictionnaires partent encore
 * dans le meme paquet client : separer des fichiers ne separe pas des chunks. Il la rend
 * seulement faisable.
 */
import { FR } from './i18n/fr';
import { EN } from './i18n/en';

export type MessageKey = keyof typeof FR;

/**
 * Les deux dictionnaires, exportes **pour les tests**.
 *
 * Certaines regles portent sur le texte lui-meme et non sur un composant — « aucune phrase
 * ne promet que rien ne sort d'ici », par exemple. Les verifier en relisant le fichier
 * source serait fragile ; les verifier sur l'objet est exact.
 */
export const DICTIONARIES: Readonly<Record<Locale, Readonly<Record<MessageKey, string>>>> = {
  fr: FR,
  en: EN,
};

/** Les valeurs interpolables dans un message : `{n}`, `{d}`, `{r}`… */
export type Params = Readonly<Record<string, string | number>>;

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
 * ## Pourquoi ici, et pas dans le dictionnaire
 *
 * Le francais met une espace **avant** `: ; ! ?` et **autour** des guillemets — et cette
 * espace ne doit pas pouvoir casser en fin de ligne. Constate a l'ecran le 2026-08-07 sur
 * `/moi` : *« Ouvrez une serie et dites « je veux la voir* **»**`, ou cliquez…` — le
 * guillemet fermant rejete seul au debut de la ligne suivante, sur le **premier ecran d'un
 * nouvel utilisateur**.
 *
 * Ce n'etait pas un cas isole : **zero** espace insecable dans tout `fr.ts`, pour
 * **67 lignes** portant une ponctuation double precedee d'une espace secable. Corriger la
 * phrase vue aurait laisse les 66 autres casser au hasard de la largeur — et la 68ᵉ, ecrite
 * demain, serait repartie du meme mauvais pied.
 *
 * > C'est la lecon que ce depot a deja payee trois fois : *extraire une forme ne protege que
 * > les ecrans qu'on rouvre le meme jour.* Un point de passage unique protege aussi ceux
 * > qu'on n'a pas ouverts, et les phrases qui n'existent pas encore.
 *
 * ⚠️ **Sur le modele, jamais sur les valeurs interpolees** : un titre TMDB est une donnee
 * externe, parfois anglaise, et n'a rien a faire dans une regle de composition francaise.
 * ⚠️ **U+00A0 et pas U+202F** (la fine insecable) : la fine est typographiquement plus juste,
 * mais toutes les polices ne la dessinent pas, et une police qui l'ignore rend un mot colle.
 * Le risque est asymetrique — trop d'espace se remarque, un mot colle est une faute.
 * ⚠️ Une URL n'est jamais touchee : son `:` n'est pas precede d'une espace.
 */
function frenchSpacing(template: string): string {
  return template.replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ');
}

/**
 * Une chaine, dans une langue.
 *
 * Ne rend jamais une cle nue a l'ecran : une traduction manquante retombe sur le francais,
 * qui est complet par construction. Voir un texte dans la mauvaise langue est desagreable ;
 * voir `safety.title` est casse.
 */
export function t(locale: Locale, key: MessageKey, params?: Params): string {
  const template = DICTIONARIES[locale][key] ?? FR[key];
  return interpolate(locale === 'fr' ? frenchSpacing(template) : template, params);
}

/**
 * Une chaine accordee au nombre.
 *
 * ## Pourquoi `Intl.PluralRules` et pas un `n > 1 ?`
 *
 * Parce que les langues ne sont pas d'accord, et que le desaccord commence a **zero** :
 * le francais dit « 0 jour » (singulier), l'anglais « 0 days » (pluriel). Un ternaire
 * ecrit par un francophone produit donc un anglais faux, et c'est le genre de faute qu'on
 * ne voit jamais dans sa propre langue. Le russe ou le polonais ont trois a quatre formes :
 * la table `.one` / `.other` suffit ici pour `fr` et `en`, et la selection passe deja par
 * le bon mecanisme le jour ou une troisieme langue arrive.
 *
 * @param base la cle **sans** le suffixe de forme — `t` cherchera `base.one` ou `base.other`.
 */
export function tn(locale: Locale, base: string, n: number, params?: Params): string {
  const category = new Intl.PluralRules(localeTag(locale)).select(n);
  const key = `${base}.${category === 'one' ? 'one' : 'other'}` as MessageKey;
  return t(locale, key, { n, ...params });
}

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
 * La langue servie par defaut.
 *
 * ⚠️ **Reste `fr` pour l'instant, et ce n'est pas un choix produit.** C'est l'etat du site
 * tel qu'il est en ligne. Basculer le defaut sur `en` est probablement le plus gros levier
 * SEO du projet — et c'est une decision a prendre explicitement, avec le routage par
 * locale, pas un effet de bord d'un module utilitaire.
 */
export const DEFAULT_LOCALE: Locale = 'fr';

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
const FR = {
  'safety.title': 'Ces notes ne vivent que dans ce navigateur',
  'safety.body':
    'Rien n’est envoye ailleurs — c’est voulu. Mais un navigateur oublie : effacer les donnees de navigation, ou simplement ne pas revenir pendant quelques jours sur iPhone, suffit a tout perdre.',
  'safety.install': 'Installer l’application',
  'safety.installWhy': 'Installee sur l’ecran d’accueil, elle garde vos notes.',
  'safety.iosHint': 'Sur iPhone : bouton Partager, puis « Sur l’ecran d’accueil ».',
  'safety.export': 'Enregistrer une copie',
  'safety.later': 'Plus tard',
  'safety.done': 'C’est fait — vos notes sont a l’abri.',
} as const;

const EN: Readonly<Record<keyof typeof FR, string>> = {
  'safety.title': 'These notes live in this browser only',
  'safety.body':
    'Nothing is sent anywhere — that is deliberate. But browsers forget: clearing your browsing data, or simply not coming back for a few days on iPhone, is enough to lose all of it.',
  'safety.install': 'Install the app',
  'safety.installWhy': 'Installed on your home screen, it keeps your notes.',
  'safety.iosHint': 'On iPhone: Share button, then “Add to Home Screen”.',
  'safety.export': 'Save a copy',
  'safety.later': 'Later',
  'safety.done': 'Done — your notes are safe.',
};

export type MessageKey = keyof typeof FR;

const DICTIONARIES: Readonly<Record<Locale, Readonly<Record<MessageKey, string>>>> = {
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
export function t(locale: Locale, key: MessageKey): string {
  return DICTIONARIES[locale][key] ?? FR[key];
}

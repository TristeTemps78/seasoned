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
  // Les libelles du differenciateur. Ce sont eux qui sont indexes, donc eux qui
  // decident si l'international rapporte quelque chose.
  'status.airing': 'En diffusion',
  'status.between_seasons': 'Entre deux saisons',
  'status.awaiting_renewal': 'Sans nouvelle',
  'status.ended': 'Terminée',
  'status.cancelled': 'Annulée',
  'status.upcoming': 'À venir',
  'status.unknown': 'Statut inconnu',

  'say.airing.today': 'Nouvel épisode aujourd’hui.',
  'say.airing.tomorrow': 'Nouvel épisode demain.',
  'say.airing.inDays.one': 'Nouvel épisode dans {n} jour.',
  'say.airing.inDays.other': 'Nouvel épisode dans {n} jours.',
  'say.airing.justAired': 'Un épisode vient de sortir.',
  'say.airing.lastAired.one': 'Dernier épisode il y a {n} jour.',
  'say.airing.lastAired.other': 'Dernier épisode il y a {n} jours.',
  'say.airing.plain': 'Des épisodes sortent en ce moment.',
  'say.between.plain': 'Saison terminée, la suite est attendue.',
  'say.between.since.one': 'Saison terminée il y a {n} mois. La suite est attendue.',
  'say.between.since.other': 'Saison terminée il y a {n} mois. La suite est attendue.',
  'say.awaiting.plain': 'Annoncée comme revenant, sans signe de vie.',
  'say.awaiting.since.one': 'Annoncée comme revenant, mais aucun épisode depuis {n} mois.',
  'say.awaiting.since.other': 'Annoncée comme revenant, mais aucun épisode depuis {n} mois.',
  'say.ended': 'Terminée. Elle a une fin.',
  'say.cancelled': 'Annulée. Elle peut s’arrêter sans conclusion.',
  'say.upcoming': 'Annoncée, rien n’a encore été diffusé.',
  'say.unknown': 'Données de diffusion insuffisantes pour trancher.',

  'chip.today': 'ép. aujourd’hui',
  'chip.tomorrow': 'ép. demain',
  'chip.inDays.one': 'ép. dans {n} j',
  'chip.inDays.other': 'ép. dans {n} j',
  'chip.airing': 'en cours',
  'chip.waiting': 'en attente',
  'chip.waitingSince.one': 'en attente · {n} mois',
  'chip.waitingSince.other': 'en attente · {n} mois',
  'chip.silent': 'sans nouvelle',
  'chip.silentSince.one': 'sans nouvelle · {n} mois',
  'chip.silentSince.other': 'sans nouvelle · {n} mois',
  'chip.cancelled': 'annulée',
  'chip.upcoming': 'à venir',

  'shape.miniseries': 'Mini-série',
  'shape.series': 'Série',

  'commit.underHour': 'moins d’une heure',
  'commit.hours.one': '{n} heure',
  'commit.hours.other': '{n} heures',
  'commit.days.one': '{n} heures — {d} jour plein',
  'commit.days.other': '{n} heures — {d} jours pleins',
  'commit.daysAndHours.one': '{n} heures — {d} jour et {r} h',
  'commit.daysAndHours.other': '{n} heures — {d} jours et {r} h',

  // Espaces compris : c'est un separateur, pas un mot. « et » en francais, « and » en
  // anglais — et la langue suivante pourrait n'avoir ni l'un ni l'autre.
  'join.and': ' et ',
  'series.unavailableTitle': 'Série indisponible',
  'series.unavailableHeading': 'Catalogue indisponible',
  'series.unavailableBody':
    'Impossible de récupérer cette série pour le moment. Réessayez dans un instant.',
  'series.seasons.one': '{n} saison',
  'series.seasons.other': '{n} saisons',
  'series.episodes.one': '{n} épisode',
  'series.episodes.other': '{n} épisodes',
  'series.demands': 'Ce que la série demande',
  'series.sameCreator': 'Du même créateur',
  'stat.seasons': 'Saisons',
  'stat.episodes': 'Épisodes',
  'stat.commitment': 'Engagement',
  'stat.lastEpisode': 'Dernier épisode',

  'meta.description':
    'Où en est une série, combien de temps elle demande, et jusqu’où elle reste bonne.',
  'nav.tagline': 'est-ce que ça vaut le coup ?',
  'nav.library': 'Ma bibliothèque',
  'footer.disclaimer': 'Ce produit utilise l’API TMDB sans être approuvé ni certifié par TMDB.',

  'home.h1': 'Une série n’est pas un long film.',
  // Decoupe en trois parce que le milieu est en italique. Une seule chaine avec du
  // balisage dedans obligerait a faire confiance au traducteur sur du HTML.
  'home.lede.before': 'On ne demande pas à une série si elle est bien. On demande ',
  'home.lede.em': 'si elle le reste',
  'home.lede.after':
    ' — combien de temps elle prend, où elle décroche, et depuis combien de temps on attend la suite.',
  'home.waiting.title': 'En attente',
  'home.waiting.subtitle': 'Depuis combien de temps, exactement.',
  'home.week.title': 'Cette semaine',
  'home.week.subtitle': 'Ce dont tout le monde parle en ce moment.',
  'home.airing.title': 'En cours de diffusion',
  'home.airing.subtitle': 'Le prochain épisode arrive vraiment.',
  'home.unavailable':
    'Le catalogue est momentanément indisponible. La recherche fonctionne peut-être encore.',

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
  'status.airing': 'Airing',
  'status.between_seasons': 'Between seasons',
  'status.awaiting_renewal': 'No news',
  'status.ended': 'Ended',
  'status.cancelled': 'Cancelled',
  'status.upcoming': 'Upcoming',
  'status.unknown': 'Status unknown',

  'say.airing.today': 'New episode today.',
  'say.airing.tomorrow': 'New episode tomorrow.',
  'say.airing.inDays.one': 'New episode in {n} day.',
  'say.airing.inDays.other': 'New episode in {n} days.',
  'say.airing.justAired': 'An episode just aired.',
  'say.airing.lastAired.one': 'Last episode {n} day ago.',
  'say.airing.lastAired.other': 'Last episode {n} days ago.',
  'say.airing.plain': 'Episodes are airing right now.',
  'say.between.plain': 'Season over, the next one is expected.',
  'say.between.since.one': 'Season ended {n} month ago. The next one is expected.',
  'say.between.since.other': 'Season ended {n} months ago. The next one is expected.',
  'say.awaiting.plain': 'Listed as returning, with no sign of life.',
  'say.awaiting.since.one': 'Listed as returning, but no episode for {n} month.',
  'say.awaiting.since.other': 'Listed as returning, but no episode for {n} months.',
  'say.ended': 'Ended. It has an ending.',
  'say.cancelled': 'Cancelled. It may stop without a conclusion.',
  'say.upcoming': 'Announced, nothing has aired yet.',
  'say.unknown': 'Not enough airing data to tell.',

  'chip.today': 'ep. today',
  'chip.tomorrow': 'ep. tomorrow',
  'chip.inDays.one': 'ep. in {n}d',
  'chip.inDays.other': 'ep. in {n}d',
  'chip.airing': 'airing',
  'chip.waiting': 'waiting',
  'chip.waitingSince.one': 'waiting · {n} month',
  'chip.waitingSince.other': 'waiting · {n} months',
  'chip.silent': 'no news',
  'chip.silentSince.one': 'no news · {n} month',
  'chip.silentSince.other': 'no news · {n} months',
  'chip.cancelled': 'cancelled',
  'chip.upcoming': 'upcoming',

  'shape.miniseries': 'Mini-series',
  'shape.series': 'Series',

  'commit.underHour': 'under an hour',
  'commit.hours.one': '{n} hour',
  'commit.hours.other': '{n} hours',
  'commit.days.one': '{n} hours — {d} full day',
  'commit.days.other': '{n} hours — {d} full days',
  'commit.daysAndHours.one': '{n} hours — {d} day and {r}h',
  'commit.daysAndHours.other': '{n} hours — {d} days and {r}h',

  'join.and': ' and ',
  'series.unavailableTitle': 'Series unavailable',
  'series.unavailableHeading': 'Catalogue unavailable',
  'series.unavailableBody': 'Could not load this series right now. Try again in a moment.',
  'series.seasons.one': '{n} season',
  'series.seasons.other': '{n} seasons',
  'series.episodes.one': '{n} episode',
  'series.episodes.other': '{n} episodes',
  'series.demands': 'What this series asks of you',
  'series.sameCreator': 'From the same creator',
  'stat.seasons': 'Seasons',
  'stat.episodes': 'Episodes',
  'stat.commitment': 'Commitment',
  'stat.lastEpisode': 'Last episode',

  'meta.description':
    'Where a series stands, how much time it asks of you, and how long it stays good.',
  'nav.tagline': 'is it worth watching?',
  'nav.library': 'My library',
  'footer.disclaimer': 'This product uses the TMDB API but is not endorsed or certified by TMDB.',

  'home.h1': 'A series is not a long film.',
  'home.lede.before': 'You don’t ask a series whether it’s good. You ask ',
  'home.lede.em': 'whether it stays good',
  'home.lede.after':
    ' — how much time it takes, where it drops off, and how long you have been waiting for the next season.',
  'home.waiting.title': 'Waiting',
  'home.waiting.subtitle': 'For how long, exactly.',
  'home.week.title': 'This week',
  'home.week.subtitle': 'What everyone is talking about right now.',
  'home.airing.title': 'Currently airing',
  'home.airing.subtitle': 'The next episode is really coming.',
  'home.unavailable': 'The catalogue is temporarily unavailable. Search may still work.',

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
 * Une chaine, dans une langue.
 *
 * Ne rend jamais une cle nue a l'ecran : une traduction manquante retombe sur le francais,
 * qui est complet par construction. Voir un texte dans la mauvaise langue est desagreable ;
 * voir `safety.title` est casse.
 */
export function t(locale: Locale, key: MessageKey, params?: Params): string {
  return interpolate(DICTIONARIES[locale][key] ?? FR[key], params);
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

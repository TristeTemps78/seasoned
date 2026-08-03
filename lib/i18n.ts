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
  'series.airsOn': 'le {date}',
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
  'nav.language.aria': 'Langue',
  // Les faces du cube. Une face existe si elle repond a une question qu'on se pose a un
  // moment different — pas a un contenu different (`docs/ARCHITECTURE-APP.md` §2).
  'face.discover': 'Découvrir',
  'face.library': 'Ma bibliothèque',
  'face.calendar': 'Calendrier',
  'face.tally': 'Mon bilan',
  'faces.aria': 'Navigation principale',
  // L'ecran calendrier, distinct de l'export .ics qui vit dans la bibliotheque.
  'agenda.title': 'Ce qui revient',
  'agenda.lede': 'Les dates que le catalogue annonce, pour les séries que vous suivez.',
  'agenda.empty.title': 'Aucune date annoncée',
  'agenda.empty.body':
    'Rien à afficher tant qu’aucune série suivie n’a de retour annoncé. C’est le cas le plus fréquent : une date n’existe qu’une fois la diffusion programmée.',
  'agenda.today': 'aujourd’hui',
  'agenda.tomorrow': 'demain',
  'agenda.inDays.one': 'dans {n} jour',
  'agenda.inDays.other': 'dans {n} jours',
  'legal.title': 'Mentions légales',
  'legal.publisher': 'Éditeur',
  'legal.director': 'Directeur de la publication',
  'legal.host': 'Hébergeur',
  'legal.contact': 'Contact',
  'legal.incomplete.title': 'Ces mentions sont incomplètes',
  'legal.incomplete.body':
    'L’identité de l’éditeur n’est pas encore renseignée. Elle doit l’être avant l’ouverture des comptes, et en tout état de cause avant toute activité commerciale.',
  'legal.tmdb': 'Les données de séries proviennent de TMDB, qui n’approuve ni ne cautionne ce site.',

  // Le compte. ⚠️ Aucun de ces textes ne promet la synchronisation : elle n'existe pas
  // encore, et annoncer une fonctionnalite absente est la seule chose qu'on ne rattrape
  // pas — quelqu'un fermerait son navigateur en croyant ses notes en securite ailleurs.
  'account.title': 'Mon compte',
  'account.lede':
    'Un compte sert à retrouver vos notes ailleurs. Tout le reste du site fonctionne sans.',
  'account.aria': 'Connexion et compte',
  'account.nav': 'Compte',
  'account.email.label': 'Votre adresse e-mail',
  'account.email.placeholder': 'vous@exemple.fr',
  // ⚠️ Le seuil est interpole depuis `MINIMUM_AGE`, jamais recopie : meme procede que les
  // motifs de `/regles`. Changer le domaine sans changer le texte publie serait annoncer
  // une regle qu'on n'applique pas.
  'account.age': 'J’ai {age} ans ou plus',
  'account.ageWhy':
    'Nous ne demandons pas votre date de naissance : une déclaration suffit, et un âge exact serait une donnée de plus à protéger.',
  'account.send': 'Recevoir un lien de connexion',
  'account.sending': 'Envoi…',
  'account.sent':
    'Regardez vos e-mails. Le lien est à ouvrir dans ce navigateur-ci — c’est ce qui fait qu’il ne peut servir à personne d’autre.',
  'account.rateLimited':
    'Trop d’envois pour le moment. Réessayez dans quelques minutes.',
  'account.failed': 'L’envoi a échoué. Réessayez dans un instant.',
  'account.google': 'Continuer avec Google',
  'account.or': 'ou',
  'account.code.label': 'Ou saisissez le code reçu par e-mail',
  'account.code.placeholder': '123456',
  'account.code.submit': 'Valider le code',
  'account.code.failed': 'Ce code n’est pas valide, ou il a expiré.',
  'account.code.why':
    'Utile si vous lisez vos e-mails sur un autre appareil que celui-ci.',
  'account.signedInAs': 'Connecté en tant que {email}.',
  'account.signOut': 'Se déconnecter',
  'account.unavailable.title': 'Les comptes ne sont pas encore ouverts',
  'account.unavailable.body':
    'Cette installation n’est pas reliée à une base de données. Vos notes restent dans ce navigateur, et la bibliothèque fonctionne normalement.',
  'account.notSynced':
    'Vos notes suivent désormais votre compte : elles restent dans ce navigateur et une copie part sur nos serveurs, pour les retrouver sur vos autres appareils. Si le serveur est injoignable, rien ne s’arrête — tout continue ici.',
  // La question de l'appareil partagé. Le défaut est **non**, et le texte doit rendre ce
  // « non » confortable : garder un journal hors d'un compte se répare, l'y avoir versé
  // par erreur ne se répare pas.
  'sync.adopt.title': 'Un journal existe déjà sur cet appareil',
  'sync.adopt.body.one':
    'Il contient {n} série. Est-il à vous ? Si cet appareil est partagé, répondez non : ce journal restera où il est.',
  'sync.adopt.body.other':
    'Il contient {n} séries. Est-il à vous ? Si cet appareil est partagé, répondez non : ce journal restera où il est.',
  'sync.adopt.yes': 'Oui, c’est le mien',
  'sync.adopt.no': 'Non, le laisser ici',
  'account.delete.title': 'Supprimer mon compte',
  'account.delete.body':
    'Immédiatement, sans délai de grâce. Exportez d’abord vos notes : elles vivent dans ce navigateur et n’en partiront pas, mais votre compte, lui, ne se rétablit pas.',
  'account.delete.confirm': 'Supprimer définitivement',
  'account.delete.failed': 'La suppression a échoué. Réessayez, ou écrivez-nous.',
  'account.callback.working': 'Connexion en cours…',
  'account.callback.done': 'C’est bon, vous êtes connecté.',
  'account.callback.wrongBrowser':
    'Ce lien a été demandé depuis un autre navigateur. Ouvrez-le là où vous l’avez demandé, ou saisissez le code à six chiffres du même e-mail.',
  'account.callback.expired':
    'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.',
  'account.callback.nothing': 'Il n’y a rien à valider ici.',
  'account.callback.back': 'Retour à mon compte',
  'privacy.title': 'Confidentialité',
  'privacy.updated': 'À jour du 3 août 2026.',
  'privacy.now.title': 'Sans compte, vos notes ne quittent pas ce navigateur',
  'privacy.now.body':
    'Il n’y a ni traceur, ni mesure d’audience, ni cookie publicitaire. Vos positions, vos notes et vos décisions sont écrites dans le stockage local de cet appareil. Sans compte, elles ne sont envoyées nulle part — et vous pouvez le vérifier : la politique de sécurité du site n’autorise le navigateur à contacter aucun serveur en dehors du nôtre.',
  'privacy.account.title': 'Si vous créez un compte',
  'privacy.account.body':
    'Le compte est facultatif : tout le site se visite et s’utilise sans. Si vous en créez un, nous traitons votre adresse e-mail — c’est elle qui reçoit le lien de connexion, et il n’y a pas de mot de passe à retenir. Elle est conservée par notre hébergeur de base de données, dans l’Union européenne, et ne sert qu’à vous reconnaître. Supprimer votre compte l’efface immédiatement, sans délai ni condition.',
  'privacy.sync.title': 'Ce que la synchronisation envoie',
  'privacy.sync.body':
    'Avec un compte, une copie de votre journal — positions, notes, décisions — est envoyée à cette même base, pour que vous le retrouviez sur vos autres appareils. Elle reste lisible par vous seul : la base refuse toute lecture qui ne vient pas de votre compte. L’original, lui, reste dans ce navigateur, et c’est lui qui fait foi : si nos serveurs tombent, le site continue de fonctionner.',
  'privacy.tmdb.title': 'Ce qui vient d’ailleurs',
  'privacy.tmdb.body':
    'Les fiches de séries et les affiches proviennent de TMDB. Charger une affiche adresse une requête à leur serveur d’images, qui voit donc votre adresse IP — comme pour toute image sur le web. Nous ne leur transmettons rien d’autre.',
  'privacy.hosting.title': 'Hébergement',
  'privacy.hosting.body':
    'Le site est hébergé par Vercel, qui conserve des journaux techniques de connexion. Nous n’y ajoutons aucune mesure d’audience et n’installons aucun cookie.',
  'privacy.rights.title': 'Vos données, et comment les récupérer',
  'privacy.rights.body':
    'L’export intégral est immédiat et sans condition : il se trouve dans votre bibliothèque, et il est calculé ici, sans rien demander à personne. Sans compte, effacer les données du navigateur suffit à tout supprimer. Avec un compte, il faut aussi supprimer le compte — c’est ce qui efface la copie conservée sur nos serveurs, et cela se fait en un clic depuis la page Compte.',
  'privacy.next.title': 'Ce qui changera ensuite',
  'privacy.next.body':
    'Viendront ensuite les profils et le fil d’activité : ce que vous choisirez de rendre visible à d’autres personnes. Rien de ce que vous écrivez aujourd’hui ne le deviendra sans que vous le décidiez, et cette page sera mise à jour avant, pas après. C’est ainsi que la phrase « rien ne sort de ce navigateur » a été retirée le jour où les comptes sont arrivés, et non le jour où quelqu’un l’aurait remarqué.',
  'tallyPage.title': 'Mon bilan',
  'tallyPage.lede': 'Ce que vos séries disent de vous. Calculé ici, dans ce navigateur.',
  'tallyPage.empty.title': 'Rien à mesurer pour l’instant',
  'tallyPage.empty.body':
    'Le bilan apparaît dès que vous avez noté ou positionné quelques séries. Il ne demande aucun compte et ne quitte pas cet appareil.',
  'agenda.thisWeek': 'Cette semaine',
  'agenda.thisMonth': 'Ce mois-ci',
  'agenda.later': 'Plus tard',
  'nav.convert': 'Vous venez de TV Time, Trakt ou Simkl ? Reprenez votre historique.',
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

  // --- Saisons -------------------------------------------------------------
  'seasons.title': 'Saisons',
  'seasons.none': 'Rien n’a encore été diffusé.',
  'seasons.seasonN': 'Saison {n}',
  'seasons.specials': 'Épisodes spéciaux disponibles, hors de la continuité principale.',
  'seasons.warn.split.one':
    'Saison {list} probablement diffusée en deux parties — le découpage du catalogue peut différer de celui du diffuseur.',
  'seasons.warn.split.other':
    'Saisons {list} probablement diffusées en deux parties — le découpage du catalogue peut différer de celui du diffuseur.',
  'seasons.warn.unaired.one': 'Saison {list} annoncée mais pas encore diffusée.',
  'seasons.warn.unaired.other': 'Saisons {list} annoncées mais pas encore diffusées.',
  'seasons.warn.single': 'Mini-série : une seule saison, et c’est toute l’histoire.',

  // --- Courbe --------------------------------------------------------------
  'chart.aria': 'Note par saison',
  'chart.seasonTitle': 'Saison {n} — {v}/5',
  'chart.shape': 'Forme',
  'chart.peak': 'Pic',
  'chart.consistency': 'Constance',
  'shape.masterpiece': 'Tenue de bout en bout',
  'shape.steady': 'Constante',
  'shape.decline': 'Décroche en route',
  'shape.grower': 'S’améliore',
  'shape.erratic': 'En dents de scie',
  'shape.undifferentiated': 'Trop homogène pour conclure',
  'shape.insufficient_data': 'Pas assez de saisons notées',
  'chart.break.one':
    'Décrochage après la saison {after} — {drop} étoile de moins à la saison {before}{gap}.',
  'chart.break.other':
    'Décrochage après la saison {after} — {drop} étoiles de moins à la saison {before}{gap}.',
  'chart.break.gap': ' (saisons non contiguës)',

  // --- Hors ligne et page introuvable --------------------------------------
  'offline.title': 'Hors ligne',
  'offline.heading': 'Pas de réseau',
  'offline.body':
    'Le catalogue a besoin d’une connexion. Votre bibliothèque, elle, est gardée dans ce navigateur : elle reste consultable.',
  'offline.open': 'Ouvrir ma bibliothèque',
  'notFound.heading': 'Rien ici.',
  'notFound.body': 'Cette série n’existe pas dans le catalogue, ou son identifiant a changé.',

  // --- Recherche -----------------------------------------------------------
  'search.placeholder': 'Chercher une série…',
  'search.submit': 'Chercher',
  'search.title': 'Recherche',
  // Les guillemets font partie de la traduction : le francais met des chevrons et une
  // espace insecable, l'anglais des guillemets courbes colles au mot.
  'search.titleQuery': '« {q} »',
  'search.prompt': 'Tapez le nom d’une série.',
  'search.unavailable': 'Le catalogue est momentanément indisponible. Réessayez dans un instant.',
  'search.none': 'Aucun résultat pour « {q} ».',
  'search.count.one': '{n} résultat pour « {q} »',
  'search.count.other': '{n} résultats pour « {q} »',
  'card.noPoster': 'Pas d’affiche',

  // --- Noter ---------------------------------------------------------------
  'rating.of': 'Note de {what}',
  'rating.stars': '{n} sur 5',
  'rating.season': 'la saison {n}',
  'rating.episode': 'l’épisode S{s}E{e}',

  // --- Ma progression ------------------------------------------------------
  'progress.aria': 'Ma progression',
  'progress.title': 'Où j’en suis',
  'progress.local': 'gardé dans ce navigateur, rien n’est envoyé',
  'progress.want': 'Je veux la voir',
  'progress.wanted': '✓ Dans ma liste',
  'progress.start': 'Je l’ai commencée',
  'progress.season': 'Saison',
  'progress.episode': 'Épisode',
  'progress.orGrid': 'ou cliquez un épisode dans la grille',
  'progress.seasonRatings': 'Mes notes de saison',
  'progress.seasonN': 'Saison {n}',
  'progress.suggest': 'vos épisodes donnent {v}',
  'progress.remaining': 'Il vous reste {episodes} · {time}',
  'progress.rateSeason': 'Vous venez de finir la saison {n} — elle valait combien ?',
  'decision.continuing': 'Je continue',
  'decision.paused': 'En pause',
  'decision.abandoned': 'J’abandonne',
  'decision.completed': 'Terminée',

  // --- Grille d'episodes ---------------------------------------------------
  'grid.public': 'Notes du public',
  'grid.mine': 'Mes notes',
  'grid.captionMine': 'Vos notes par épisode, saison par saison',
  'grid.captionPublic': 'Note du public par épisode, saison par saison',
  'grid.cell': 'Saison {s}, épisode {e} : {v} sur 10',
  'grid.cellMine': ', votre note {n} sur 5',
  'grid.here': 'J’en suis là',
  'grid.publicShort': 'public',
  'grid.you': 'vous',
  'grid.scaleStars': '5 étoiles',
  'grid.scaleCeiling': '{n}/10 et plus',

  // --- Ma bibliotheque -----------------------------------------------------
  'library.title': 'Ma bibliothèque',
  'library.lede': 'Ce que vous suivez, ce qui revient, et ce que vous vous étiez promis.',
  'library.returning.title': 'Ça revient',
  'library.returning.subtitle': 'Ce que vous suivez et qui repasse bientôt.',
  'library.resuming.title': 'Reprendre',
  'library.resuming.subtitle': 'Là où vous vous étiez arrêté.',
  'library.wanted.title': 'À voir',
  'library.wanted.subtitle': 'Ce que vous vous êtes promis.',
  'library.finished.title': 'Terminées et abandonnées',
  'library.finished.subtitle': 'Ce qui est derrière vous.',
  'library.empty.title': 'Rien ici pour l’instant',
  'library.empty.before': 'Ouvrez une série et dites ',
  'library.empty.em': '« je veux la voir »',
  'library.empty.after':
    ', ou cliquez un épisode pour marquer où vous en êtes. Tout reste dans ce navigateur.',
  'library.empty.browse': 'Parcourir',
  'library.empty.search': 'Chercher une série',
  'library.card.tracked': 'Série suivie',
  'library.card.today': 'nouvel épisode aujourd’hui',
  'library.card.tomorrow': 'nouvel épisode demain',
  'library.card.inDays.one': 'nouvel épisode dans {n} j',
  'library.card.inDays.other': 'nouvel épisode dans {n} j',
  'library.card.toWatch': 'à voir',

  // --- Reprendre (accueil) -------------------------------------------------
  'resume.returning': 'Ça revient',
  'resume.resume': 'Reprendre',
  'resume.yourSeries': 'votre série en cours',
  'resume.today': 'aujourd’hui',
  'resume.tomorrow': 'demain',
  'resume.inDays.one': 'dans {n} jour',
  'resume.inDays.other': 'dans {n} jours',
  'resume.at': 'vous en étiez à S{s}E{e}',
  'resume.library': 'ma bibliothèque →',

  // --- Sauvegarde ----------------------------------------------------------
  'backup.aria': 'Sauvegarde',
  'backup.title': 'Sauvegarder, ou changer d’appareil',
  'backup.body.before': 'Votre bibliothèque est gardée ',
  'backup.body.em': 'dans ce navigateur',
  'backup.body.after':
    ', et nulle part ailleurs. Elle ne suit pas d’un appareil à l’autre, et vider les données du navigateur l’efface. Le fichier ci-dessous est votre copie : il se relit ici même, ou sur un autre appareil — l’import complète, il ne remplace pas.',
  'backup.export': 'Exporter mon journal',
  'backup.import': 'Importer un fichier',
  'backup.exported.one': '{n} série exportée.',
  'backup.exported.other': '{n} séries exportées.',
  'backup.unreadable': 'Ce fichier ne contient pas de journal lisible. Rien n’a été modifié.',
  'backup.merged.one': 'Fusionné. Votre bibliothèque compte {n} série.',
  'backup.merged.other': 'Fusionné. Votre bibliothèque compte {n} séries.',

  // --- Reprendre un historique venu d'ailleurs ------------------------------
  'convert.title': 'Reprendre votre historique',
  'convert.lede':
    'TV Time a fermé le 15 juillet 2026, et vingt-six millions de personnes y ont perdu leur historique. Si vous en avez sauvé un fichier — de TV Time, Trakt, Simkl, ou d’ailleurs — vous pouvez le déposer ici.',
  'convert.aria': 'Import',
  'convert.pick': 'Choisir un fichier',
  'convert.local':
    'Le fichier est lu dans votre navigateur. Il n’est envoyé nulle part, et nous n’en gardons rien.',
  'convert.imported.one': '{n} série reprise.',
  'convert.imported.other': '{n} séries reprises.',
  'convert.skipped.one':
    '{n} série n’a pas pu être reprise : son identifiant TMDB manque dans le fichier.',
  'convert.skipped.other':
    '{n} séries n’ont pas pu être reprises : leur identifiant TMDB manque dans le fichier.',
  'convert.unreadable':
    'Rien de reconnaissable dans ce fichier. Votre bibliothèque est intacte — rien n’a été modifié.',
  'convert.tooBig': 'Ce fichier est trop volumineux pour être un export de séries.',
  'convert.honestTitle': 'Ce qui marche, et ce qui ne marche pas',
  'convert.honestBody':
    'Nous ne prétendons connaître aucun format en particulier : nous cherchons des identifiants TMDB partout où ils se trouvent, dans un JSON comme dans un tableau. Une série sans identifiant n’est pas reprise — la retrouver par son titre demanderait une recherche par série, et se tromperait sur les remakes, qui portent le même nom. Le compte de ce qui n’est pas passé s’affiche : gardez votre fichier d’origine.',
  'convert.mergeTitle': 'L’import complète, il ne remplace pas',
  'convert.mergeBody':
    'Importer sur un appareil déjà utilisé n’efface rien de ce que vous y avez fait. Vous pouvez donc importer plusieurs fichiers à la suite.',

  // --- Calendrier ----------------------------------------------------------
  'calendar.aria': 'Calendrier',
  'calendar.title': 'Les retours, dans mon agenda',
  'calendar.body':
    'Une saison sort tous les trois mois, et personne ne revient entre-temps. Ce fichier dépose les dates connues dans le calendrier que vous avez déjà : il vous rappellera la suite même si vous ne rouvrez pas ce site. Rien n’est envoyé nulle part, et aucune autorisation ne vous est demandée.',
  'calendar.download': 'Ajouter à mon calendrier',
  'calendar.count.one': '{n} date connue',
  'calendar.count.other': '{n} dates connues',
  'calendar.saved': 'Fichier enregistré.',

  // --- Mon gout ------------------------------------------------------------
  'taste.aria': 'Mon goût',
  'taste.title': 'La forme de mon goût',
  'taste.average': 'Ma moyenne',
  'taste.vsPublic': 'Face au public',
  'taste.aligned': 'aligné',
  'taste.onSeries.one': 'sur {n} série',
  'taste.onSeries.other': 'sur {n} séries',
  'taste.severe': 'plus sévère',
  'taste.generous': 'plus généreux',
  'taste.completedLabel': 'Menées au bout',
  'taste.finished.one': '{n} finie',
  'taste.finished.other': '{n} finies',
  'taste.dropped.one': '{n} abandonnée',
  'taste.dropped.other': '{n} abandonnées',
  'taste.abandonAt': 'J’abandonne en',
  'taste.seasonN': 'saison {n}',
  'taste.median': 'en médiane',
  'taste.basis.one': 'Calculé sur votre {n} note de saison{extra}. Rien de tout cela ne quitte ce navigateur.',
  'taste.basis.other': 'Calculé sur vos {n} notes de saison{extra}. Rien de tout cela ne quitte ce navigateur.',
  'taste.basisEpisodes.one': ' et {n} d’épisode',
  'taste.basisEpisodes.other': ' et {n} d’épisode',

  // --- Mes plateformes -----------------------------------------------------
  'platforms.aria': 'Mes plateformes',
  'platforms.title': 'Mes abonnements',
  'platforms.subtitle':
    'Pour repérer d’un coup d’œil ce que vous pouvez regarder tout de suite.',

  // --- Ou la regarder ------------------------------------------------------
  'watch.aria': 'Où regarder',
  'watch.title': 'Où la regarder',
  'watch.youHave': 'Vous l’avez déjà : {list}.',
  'watch.flatrate': 'Inclus dans l’abonnement',
  'watch.free': 'Gratuit',
  'watch.ads': 'Gratuit avec publicité',
  'watch.rent': 'En location',
  'watch.buy': 'À l’achat',
  'watch.region': 'Disponibilité : {region}.',

  // --- Regles et moderation (5.0a) -----------------------------------------
  //
  // ⚖️ Textes a faire relire par quelqu'un dont c'est le metier. Ce qui est certain :
  // improviser au moment ou le premier signalement arrive est la pire des options.
  'rules.title': 'Les règles, et comment signaler',
  'rules.intro':
    'Ce que vous écrivez ici est visible par d’autres. Ces règles disent ce qui est retiré, comment le signaler, et ce que vous pouvez faire si vous n’êtes pas d’accord.',
  'rules.nothingYet.title': 'Rien de tout cela n’est encore ouvert',
  'rules.nothingYet.body':
    'Il n’existe aujourd’hui aucun profil public, aucun commentaire, aucune liste partagée. Ces règles sont publiées **avant** — parce qu’un dispositif de signalement écrit sous la pression du premier signalement est un dispositif raté.',
  'rules.grounds.title': 'Ce qui est retiré',
  'rules.grounds.intro': 'Cette liste est courte, et c’est délibéré : ce qui n’y figure pas ne se retire pas.',
  'rules.ground.illegal': 'Contenu illicite — ce qui relève de la loi, pas de nos goûts.',
  'rules.ground.abuse': 'Harcèlement, menace, incitation à la haine visant une personne.',
  'rules.ground.privacy': 'Divulgation de la vie privée d’autrui : adresse, identité, image.',
  'rules.ground.spam': 'Spam, publicité, contenu automatisé.',
  'rules.ground.spoiler':
    'Révéler l’intrigue au-delà de ce qui est annoncé. Ailleurs c’est une impolitesse ; ici c’est une atteinte à la promesse du produit.',
  'rules.how.title': 'Comment signaler',
  'rules.how.body':
    'Écrivez à l’adresse de contact ci-dessous, en indiquant la page concernée et le motif. Un formulaire arrivera en même temps que les contenus publics.',
  'rules.how.noContact':
    'L’adresse de contact n’est pas encore renseignée. Tant qu’elle manque, aucun contenu public ne sera ouvert.',
  'rules.delay.title': 'Le délai',
  'rules.delay.body':
    'Réponse sous {hours} heures. Les signalements pour contenu illicite, harcèlement ou vie privée sont traités sans attendre ce délai.',
  'rules.delay.why':
    'Ce délai est celui d’une personne seule qui peut être absente un week-end. Annoncer plus court serait une promesse qu’un seul déplacement casse.',
  'rules.decision.title': 'Ce qui se passe ensuite',
  'rules.decision.hidden':
    'Un contenu retiré est **masqué, jamais supprimé** : son auteur le voit toujours, et une erreur de notre part reste réparable.',
  'rules.decision.told':
    'Son auteur est informé, avec le motif — pas seulement « votre contenu a été retiré ».',
  'rules.decision.contest':
    'Il peut contester à la même adresse. Un dispositif qui sait retirer mais pas rendre n’est pas de la modération.',
  'rules.contact.title': 'Point de contact',

  // --- Decoupages concurrents (4.4) ----------------------------------------
  //
  // Formulation deliberee : **on annonce la convention suivie, on ne crie pas a
  // l'erreur**. Nos chiffres ne sont pas faux — ils suivent l'ordre de diffusion de
  // TMDB. Ce qui serait faux est de laisser croire qu'il n'y en a qu'un, alors que
  // quelqu'un qui regarde sur Netflix compte autrement. Regle 8 : on signale.
  'ordering.title': 'Ce découpage n’est pas le seul',
  'ordering.explain':
    'Les chiffres de cette page suivent l’ordre de diffusion : {seasons} · {episodes}.',
  'ordering.seasons.one': '{n} saison',
  'ordering.seasons.other': '{n} saisons',
  'ordering.episodes.one': '{n} épisode',
  'ordering.episodes.other': '{n} épisodes',
  'ordering.alsoKnown': 'Elle existe aussi en :',
  'ordering.entry': '{name} — {seasons}, {episodes}',
  'ordering.more.one': 'et {n} autre découpage.',
  'ordering.more.other': 'et {n} autres découpages.',
  'ordering.caution':
    'Si vous la suivez dans un autre découpage, vos numéros de saison ne correspondent pas à ceux-ci.',

  // --- Revisionnage --------------------------------------------------------
  'rewatch.done.one': 'Vue une fois, en entier.',
  'rewatch.done.other': 'Vue {n} fois, en entier.',
  'rewatch.again.one': 'Vous la revoyez.',
  'rewatch.again.other': '{n}e visionnage.',
  'taste.rewatched': 'Ma série-refuge',
  'taste.rewatchedTimes.one': 'vue {n} fois',
  'taste.rewatchedTimes.other': 'vue {n} fois',

  // --- Le temps passé ------------------------------------------------------
  // « Au moins », toujours : les instantanés expirent, les séries visitées avant que le
  // journal mémorise la forme des séries ne sont pas comptées, et le catalogue ignore
  // souvent la durée d'un épisode. Le chiffre est un minorant et le dit.
  'tally.aria': 'Mon temps passé',
  'tally.title': 'Le temps que j’y ai passé',
  'tally.atLeast': 'Au moins {commitment}.',
  'tally.episodes.one': '{n} épisode',
  'tally.episodes.other': '{n} épisodes',
  'tally.onSeries.one': '{episodes}, sur {n} série comptée',
  'tally.onSeries.other': '{episodes}, sur {n} séries comptées',
  'tally.heaviest': 'Surtout',
  'tally.heaviestOnce': '{title} : {commitment}',
  'tally.heaviestPasses.one': '{title} : {commitment}, vue {n} fois',
  'tally.heaviestPasses.other': '{title} : {commitment}, vue {n} fois',
  'tally.missing.one':
    '{n} série suivie n’a pas pu être comptée : son instantané a expiré, ou le catalogue ignore la durée de ses épisodes. Le vrai total est plus élevé.',
  'tally.missing.other':
    '{n} séries suivies n’ont pas pu être comptées : leur instantané a expiré, ou le catalogue ignore la durée de leurs épisodes. Le vrai total est plus élevé.',
  'tally.private': 'Calculé ici, dans ce navigateur. Rien n’est envoyé nulle part.',

  // --- Saison en cours -----------------------------------------------------
  'season.aired.one': '{n} épisode sorti',
  'season.aired.other': '{n} épisodes sortis',
  // Un fait sur ce qui est diffusé, jamais un pronostic sur la suite.
  'season.below':
    'Saison {season} — {episodes}, notés {current}/10, soit {gap} sous la moyenne de la série.',
  'season.above':
    'Saison {season} — {episodes}, notés {current}/10, soit {gap} au-dessus de la moyenne de la série.',

  // --- Rattrapage ----------------------------------------------------------
  'catchup.days.one': '{n} jour',
  'catchup.days.other': '{n} jours',
  'catchup.pace': '{episodes} en {days} avant la suite — {time} par jour.',
  // Formulation distincte quand le rythme ne tient pas dans une soirée : « il faudrait »
  // reconnaît que ce n'est pas un plan, au lieu de le présenter comme tel.
  'catchup.tight': '{episodes} en {days} avant la suite — il faudrait {time} par jour.',
  'catchup.plain': '{episodes} en {days} avant la suite.',

  // --- Point d'entree ------------------------------------------------------
  'entry.title': 'Elle démarre lentement',
  'entry.body.one':
    'Le premier épisode est noté {before}/10 ; la suite, {after}/10. Ça décolle à S{s}E{e}.',
  'entry.body.other':
    'Les {n} premiers épisodes sont notés {before}/10 ; la suite, {after}/10. Ça décolle à S{s}E{e}.',

  // --- Trajectoire ---------------------------------------------------------
  'traj.aria': 'Trajectoire',
  'traj.srTitle': 'Trajectoire saison par saison',
  'traj.yours': 'Jusqu’où vous en êtes',
  'traj.seasonsTo': 'saisons 1 à {n}',
  'traj.hidden.one': '{n} saison au-delà de votre position n’est pas affichée.',
  'traj.hidden.other': '{n} saisons au-delà de votre position ne sont pas affichées.',
  'traj.seeMore': 'Voir la suite de la trajectoire',
  'traj.seeAll': 'Voir la trajectoire saison par saison',
  'traj.warning': 'contient un jugement sur les saisons suivantes',
  'traj.episodeByEpisode': 'Épisode par épisode',
  'traj.clickHint': 'Cliquez un épisode pour dire où vous en êtes, ou le noter.',
  'traj.stop.before': 'S’arrêter après la saison {n} ramène la série à ',
  'traj.stop.after': ', au lieu de ~ {full}.',
  'traj.source':
    'Établie à partir des notes du public TMDB, saison par saison — pas des notes de ce site. Ces notes se ressemblent beaucoup d’une saison à l’autre : les écarts comptent plus que les valeurs.',
  'traj.youAndPublic': 'Vous, et le public',
  'traj.you': 'vous {v}',
  'traj.publicIs': 'public {v}',
  'traj.likeMore': 'vous aimez plus',
  'traj.likeLess': 'vous aimez moins',
  'share.save': 'Enregistrer cette courbe en image',
  'share.saved': 'Image enregistrée.',
  'share.caption': 'saison par saison',
  'share.legendMine': 'mes notes · le public en gris',
  'share.legendPublic': 'notes du public TMDB',
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
  'series.airsOn': 'on {date}',
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
  'nav.language.aria': 'Language',
  'face.discover': 'Discover',
  'face.library': 'My library',
  'face.calendar': 'Calendar',
  'face.tally': 'My tally',
  'faces.aria': 'Main navigation',
  'agenda.title': 'What is coming back',
  'agenda.lede': 'The dates the catalogue announces, for the shows you follow.',
  'agenda.empty.title': 'No announced dates',
  'agenda.empty.body':
    'Nothing to show until a show you follow has an announced return. That is the common case: a date only exists once the airing is scheduled.',
  'agenda.today': 'today',
  'agenda.tomorrow': 'tomorrow',
  'agenda.inDays.one': 'in {n} day',
  'agenda.inDays.other': 'in {n} days',
  'legal.title': 'Legal notice',
  'legal.publisher': 'Publisher',
  'legal.director': 'Publication director',
  'legal.host': 'Host',
  'legal.contact': 'Contact',
  'legal.incomplete.title': 'This notice is incomplete',
  'legal.incomplete.body':
    'The publisher’s identity has not been filled in yet. It must be before accounts open, and in any case before any commercial activity.',
  'legal.tmdb': 'Show data comes from TMDB, which does not endorse or certify this site.',

  'account.title': 'My account',
  'account.lede':
    'An account is for finding your notes elsewhere. Everything else on the site works without one.',
  'account.aria': 'Sign in and account',
  'account.nav': 'Account',
  'account.email.label': 'Your email address',
  'account.email.placeholder': 'you@example.com',
  'account.age': 'I am {age} or older',
  'account.ageWhy':
    'We do not ask for your date of birth: a declaration is enough, and an exact age would be one more piece of data to protect.',
  'account.send': 'Send me a sign-in link',
  'account.sending': 'Sending…',
  'account.sent':
    'Check your email. Open the link in this browser — that is what stops it working for anyone else.',
  'account.rateLimited': 'Too many attempts for now. Try again in a few minutes.',
  'account.failed': 'Sending failed. Try again in a moment.',
  'account.google': 'Continue with Google',
  'account.or': 'or',
  'account.code.label': 'Or enter the code from the email',
  'account.code.placeholder': '123456',
  'account.code.submit': 'Check the code',
  'account.code.failed': 'That code is not valid, or it has expired.',
  'account.code.why': 'Useful if you read your email on a different device from this one.',
  'account.signedInAs': 'Signed in as {email}.',
  'account.signOut': 'Sign out',
  'account.unavailable.title': 'Accounts are not open yet',
  'account.unavailable.body':
    'This installation is not connected to a database. Your notes stay in this browser, and the library works as usual.',
  'account.notSynced':
    'Your notes now follow your account: they stay in this browser and a copy goes to our servers, so you find them on your other devices. If the server is unreachable, nothing stops — everything keeps working here.',
  'sync.adopt.title': 'A journal already exists on this device',
  'sync.adopt.body.one':
    'It holds {n} series. Is it yours? If this device is shared, answer no: that journal stays where it is.',
  'sync.adopt.body.other':
    'It holds {n} series. Is it yours? If this device is shared, answer no: that journal stays where it is.',
  'sync.adopt.yes': 'Yes, it is mine',
  'sync.adopt.no': 'No, leave it here',
  'account.delete.title': 'Delete my account',
  'account.delete.body':
    'Immediately, with no grace period. Export your notes first: they live in this browser and are not going anywhere, but your account does not come back.',
  'account.delete.confirm': 'Delete permanently',
  'account.delete.failed': 'Deletion failed. Try again, or write to us.',
  'account.callback.working': 'Signing you in…',
  'account.callback.done': 'Done — you are signed in.',
  'account.callback.wrongBrowser':
    'This link was requested from a different browser. Open it where you asked for it, or enter the six-digit code from the same email.',
  'account.callback.expired': 'This link has expired or has already been used. Ask for a new one.',
  'account.callback.nothing': 'There is nothing to confirm here.',
  'account.callback.back': 'Back to my account',
  'privacy.title': 'Privacy',
  'privacy.updated': 'Last updated 3 August 2026.',
  'privacy.now.title': 'Without an account, your notes never leave this browser',
  'privacy.account.title': 'If you create an account',
  'privacy.account.body':
    'The account is optional: the whole site works without one. If you create one, we process your email address — it is what receives the sign-in link, and there is no password to remember. It is held by our database host, inside the European Union, and is only used to recognise you. Deleting your account erases it immediately, with no delay and no conditions.',
  'privacy.sync.title': 'What syncing sends',
  'privacy.sync.body':
    'With an account, a copy of your journal — positions, ratings, decisions — is sent to that same database, so you find it on your other devices. It stays readable by you alone: the database refuses any read that does not come from your account. The original stays in this browser and remains the source of truth: if our servers go down, the site keeps working.',
  'privacy.now.body':
    'There are no trackers, no analytics and no advertising cookies. Your positions, ratings and decisions are written to this device’s local storage. Without an account they are sent nowhere — and you can check this yourself: the site’s security policy lets the browser contact no server but ours.',
  'privacy.tmdb.title': 'What comes from elsewhere',
  'privacy.tmdb.body':
    'Show details and posters come from TMDB. Loading a poster sends a request to their image server, which therefore sees your IP address — as with any image on the web. We pass them nothing else.',
  'privacy.hosting.title': 'Hosting',
  'privacy.hosting.body':
    'The site is hosted by Vercel, which keeps technical connection logs. We add no analytics and set no cookies.',
  'privacy.rights.title': 'Your data, and how to take it with you',
  'privacy.rights.body':
    'A full export is immediate and unconditional: you will find it in your library, and it is computed here, without asking anyone. Without an account, clearing your browser data deletes everything. With an account, you also need to delete the account — that is what erases the copy kept on our servers, and it takes one click on the Account page.',
  'privacy.next.title': 'What changes next',
  'privacy.next.body':
    'Profiles and the activity feed come next: what you choose to make visible to other people. Nothing you write today becomes visible without you deciding it, and this page is updated before that happens, not after. That is how the sentence “nothing leaves this browser” was removed the day accounts arrived, rather than the day somebody noticed.',
  'tallyPage.title': 'My tally',
  'tallyPage.lede': 'What your shows say about you. Worked out here, in this browser.',
  'tallyPage.empty.title': 'Nothing to measure yet',
  'tallyPage.empty.body':
    'The tally shows up once you have rated or positioned a few shows. It needs no account and never leaves this device.',
  'agenda.thisWeek': 'This week',
  'agenda.thisMonth': 'This month',
  'agenda.later': 'Later',
  'nav.convert': 'Coming from TV Time, Trakt or Simkl? Bring your history with you.',
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

  'seasons.title': 'Seasons',
  'seasons.none': 'Nothing has aired yet.',
  'seasons.seasonN': 'Season {n}',
  'seasons.specials': 'Special episodes available, outside the main continuity.',
  'seasons.warn.split.one':
    'Season {list} was likely aired in two parts — the catalogue’s split may differ from the broadcaster’s.',
  'seasons.warn.split.other':
    'Seasons {list} were likely aired in two parts — the catalogue’s split may differ from the broadcaster’s.',
  'seasons.warn.unaired.one': 'Season {list} is announced but has not aired yet.',
  'seasons.warn.unaired.other': 'Seasons {list} are announced but have not aired yet.',
  'seasons.warn.single': 'Mini-series: a single season, and that is the whole story.',

  'chart.aria': 'Rating per season',
  'chart.seasonTitle': 'Season {n} — {v}/5',
  'chart.shape': 'Shape',
  'chart.peak': 'Peak',
  'chart.consistency': 'Consistency',
  'shape.masterpiece': 'Holds up throughout',
  'shape.steady': 'Steady',
  'shape.decline': 'Declines along the way',
  'shape.grower': 'Gets better',
  'shape.erratic': 'Up and down',
  'shape.undifferentiated': 'Too uniform to call',
  'shape.insufficient_data': 'Not enough rated seasons',
  'chart.break.one':
    'Drop-off after season {after} — {drop} star lower in season {before}{gap}.',
  'chart.break.other':
    'Drop-off after season {after} — {drop} stars lower in season {before}{gap}.',
  'chart.break.gap': ' (non-contiguous seasons)',

  'offline.title': 'Offline',
  'offline.heading': 'No connection',
  'offline.body':
    'The catalogue needs a connection. Your library, however, is kept in this browser: it stays readable.',
  'offline.open': 'Open my library',
  'notFound.heading': 'Nothing here.',
  'notFound.body': 'This series is not in the catalogue, or its identifier has changed.',

  'search.placeholder': 'Search for a series…',
  'search.submit': 'Search',
  'search.title': 'Search',
  'search.titleQuery': '“{q}”',
  'search.prompt': 'Type the name of a series.',
  'search.unavailable': 'The catalogue is temporarily unavailable. Try again in a moment.',
  'search.none': 'No results for “{q}”.',
  'search.count.one': '{n} result for “{q}”',
  'search.count.other': '{n} results for “{q}”',
  'card.noPoster': 'No poster',

  'rating.of': 'Rating for {what}',
  'rating.stars': '{n} out of 5',
  'rating.season': 'season {n}',
  'rating.episode': 'episode S{s}E{e}',

  'progress.aria': 'My progress',
  'progress.title': 'Where I am',
  'progress.local': 'kept in this browser, nothing is sent',
  'progress.want': 'I want to watch it',
  'progress.wanted': '✓ On my list',
  'progress.start': 'I’ve started it',
  'progress.season': 'Season',
  'progress.episode': 'Episode',
  'progress.orGrid': 'or click an episode in the grid',
  'progress.seasonRatings': 'My season ratings',
  'progress.seasonN': 'Season {n}',
  'progress.suggest': 'your episodes say {v}',
  'progress.remaining': 'You have {episodes} left · {time}',
  'progress.rateSeason': 'You just finished season {n} — how was it?',
  'decision.continuing': 'Carrying on',
  'decision.paused': 'Paused',
  'decision.abandoned': 'Dropped',
  'decision.completed': 'Finished',

  'grid.public': 'Public ratings',
  'grid.mine': 'My ratings',
  'grid.captionMine': 'Your ratings per episode, season by season',
  'grid.captionPublic': 'Public rating per episode, season by season',
  'grid.cell': 'Season {s}, episode {e}: {v} out of 10',
  'grid.cellMine': ', your rating {n} out of 5',
  'grid.here': 'I’m here',
  'grid.publicShort': 'public',
  'grid.you': 'you',
  'grid.scaleStars': '5 stars',
  'grid.scaleCeiling': '{n}/10 and up',

  'library.title': 'My library',
  'library.lede': 'What you follow, what is coming back, and what you promised yourself.',
  'library.returning.title': 'Coming back',
  'library.returning.subtitle': 'What you follow and returns soon.',
  'library.resuming.title': 'Resume',
  'library.resuming.subtitle': 'Right where you stopped.',
  'library.wanted.title': 'To watch',
  'library.wanted.subtitle': 'What you promised yourself.',
  'library.finished.title': 'Finished and dropped',
  'library.finished.subtitle': 'What is behind you.',
  'library.empty.title': 'Nothing here yet',
  'library.empty.before': 'Open a series and say ',
  'library.empty.em': '“I want to watch it”',
  'library.empty.after':
    ', or click an episode to mark where you are. Everything stays in this browser.',
  'library.empty.browse': 'Browse',
  'library.empty.search': 'Search for a series',
  'library.card.tracked': 'Tracked series',
  'library.card.today': 'new episode today',
  'library.card.tomorrow': 'new episode tomorrow',
  'library.card.inDays.one': 'new episode in {n}d',
  'library.card.inDays.other': 'new episode in {n}d',
  'library.card.toWatch': 'to watch',

  'resume.returning': 'Coming back',
  'resume.resume': 'Resume',
  'resume.yourSeries': 'the series you started',
  'resume.today': 'today',
  'resume.tomorrow': 'tomorrow',
  'resume.inDays.one': 'in {n} day',
  'resume.inDays.other': 'in {n} days',
  'resume.at': 'you were at S{s}E{e}',
  'resume.library': 'my library →',

  'backup.aria': 'Backup',
  'backup.title': 'Back up, or switch device',
  'backup.body.before': 'Your library is kept ',
  'backup.body.em': 'in this browser',
  'backup.body.after':
    ', and nowhere else. It does not follow you from one device to another, and clearing your browsing data erases it. The file below is your copy: it can be read back here, or on another device — importing adds to what is there, it does not replace it.',
  'backup.export': 'Export my journal',
  'backup.import': 'Import a file',
  'backup.exported.one': '{n} series exported.',
  'backup.exported.other': '{n} series exported.',
  'backup.unreadable': 'This file contains no readable journal. Nothing was changed.',
  'backup.merged.one': 'Merged. Your library now holds {n} series.',
  'backup.merged.other': 'Merged. Your library now holds {n} series.',

  'convert.title': 'Bring your history with you',
  'convert.lede':
    'TV Time shut down on 15 July 2026, and twenty-six million people lost their history with it. If you saved a file — from TV Time, Trakt, Simkl, or anywhere else — you can drop it here.',
  'convert.aria': 'Import',
  'convert.pick': 'Choose a file',
  'convert.local':
    'The file is read in your browser. It is not uploaded anywhere, and we keep none of it.',
  'convert.imported.one': '{n} series brought over.',
  'convert.imported.other': '{n} series brought over.',
  'convert.skipped.one':
    '{n} series could not be brought over: its TMDB identifier is missing from the file.',
  'convert.skipped.other':
    '{n} series could not be brought over: their TMDB identifiers are missing from the file.',
  'convert.unreadable':
    'Nothing recognisable in this file. Your library is untouched — nothing was changed.',
  'convert.tooBig': 'This file is too large to be a series export.',
  'convert.honestTitle': 'What works, and what does not',
  'convert.honestBody':
    'We do not claim to know any format in particular: we look for TMDB identifiers wherever they are, in JSON as in a spreadsheet. A series without an identifier is not brought over — finding it by title would take one search per series, and would get remakes wrong, since they share their name. The count of what did not make it is shown: keep your original file.',
  'convert.mergeTitle': 'Importing adds, it does not replace',
  'convert.mergeBody':
    'Importing on a device you already use erases nothing you did there. You can import several files in a row.',

  'calendar.aria': 'Calendar',
  'calendar.title': 'Returns, in my calendar',
  'calendar.body':
    'A season airs every three months, and nobody comes back in between. This file drops the known dates into the calendar you already use: it will remind you even if you never reopen this site. Nothing is sent anywhere, and no permission is asked of you.',
  'calendar.download': 'Add to my calendar',
  'calendar.count.one': '{n} known date',
  'calendar.count.other': '{n} known dates',
  'calendar.saved': 'File saved.',

  'taste.aria': 'My taste',
  'taste.title': 'The shape of my taste',
  'taste.average': 'My average',
  'taste.vsPublic': 'Versus the public',
  'taste.aligned': 'aligned',
  'taste.onSeries.one': 'across {n} series',
  'taste.onSeries.other': 'across {n} series',
  'taste.severe': 'harsher',
  'taste.generous': 'more generous',
  'taste.completedLabel': 'Seen through',
  'taste.finished.one': '{n} finished',
  'taste.finished.other': '{n} finished',
  'taste.dropped.one': '{n} dropped',
  'taste.dropped.other': '{n} dropped',
  'taste.abandonAt': 'I drop out at',
  'taste.seasonN': 'season {n}',
  'taste.median': 'median',
  'taste.basis.one': 'Based on your {n} season rating{extra}. None of this leaves this browser.',
  'taste.basis.other': 'Based on your {n} season ratings{extra}. None of this leaves this browser.',
  'taste.basisEpisodes.one': ' and {n} episode rating',
  'taste.basisEpisodes.other': ' and {n} episode ratings',

  'platforms.aria': 'My platforms',
  'platforms.title': 'My subscriptions',
  'platforms.subtitle': 'So you can spot at a glance what you can watch right now.',

  'watch.aria': 'Where to watch',
  'watch.title': 'Where to watch it',
  'watch.youHave': 'You already have it: {list}.',
  'watch.flatrate': 'Included in your subscription',
  'watch.free': 'Free',
  'watch.ads': 'Free with ads',
  'watch.rent': 'To rent',
  'watch.buy': 'To buy',
  'watch.region': 'Availability: {region}.',

  'rules.title': 'The rules, and how to report',
  'rules.intro':
    'What you write here is visible to others. These rules say what gets removed, how to report it, and what you can do if you disagree.',
  'rules.nothingYet.title': 'None of this is open yet',
  'rules.nothingYet.body':
    'There are currently no public profiles, no comments, no shared lists. These rules are published **first** — because a reporting process written under the pressure of the first report is a failed one.',
  'rules.grounds.title': 'What gets removed',
  'rules.grounds.intro': 'This list is short, and deliberately so: what is not on it does not get removed.',
  'rules.ground.illegal': 'Illegal content — what the law covers, not what we dislike.',
  'rules.ground.abuse': 'Harassment, threats, or incitement to hatred aimed at a person.',
  'rules.ground.privacy': 'Disclosing someone else’s private life: address, identity, image.',
  'rules.ground.spam': 'Spam, advertising, automated content.',
  'rules.ground.spoiler':
    'Revealing the plot beyond what is announced. Elsewhere that is rudeness; here it breaks the product’s promise.',
  'rules.how.title': 'How to report',
  'rules.how.body':
    'Write to the contact address below, giving the page concerned and the ground. A form will arrive together with public content.',
  'rules.how.noContact':
    'The contact address is not set yet. Until it is, no public content will be opened.',
  'rules.delay.title': 'The deadline',
  'rules.delay.body':
    'Answer within {hours} hours. Reports for illegal content, harassment or privacy are handled without waiting for it.',
  'rules.delay.why':
    'This deadline is one a single person can keep while away for a weekend. Promising less would be a promise one trip breaks.',
  'rules.decision.title': 'What happens next',
  'rules.decision.hidden':
    'Removed content is **hidden, never deleted**: its author still sees it, and a mistake on our part stays fixable.',
  'rules.decision.told':
    'Its author is told, with the ground — not merely “your content was removed”.',
  'rules.decision.contest':
    'They can contest it at the same address. A process that can remove but not restore is not moderation.',
  'rules.contact.title': 'Point of contact',

  'ordering.title': 'This is not the only cut',
  'ordering.explain':
    'The numbers on this page follow the original air order: {seasons} · {episodes}.',
  'ordering.seasons.one': '{n} season',
  'ordering.seasons.other': '{n} seasons',
  'ordering.episodes.one': '{n} episode',
  'ordering.episodes.other': '{n} episodes',
  'ordering.alsoKnown': 'It also exists as:',
  'ordering.entry': '{name} — {seasons}, {episodes}',
  'ordering.more.one': 'and {n} other cut.',
  'ordering.more.other': 'and {n} other cuts.',
  'ordering.caution':
    'If you are following it in another cut, your season numbers will not match these.',

  'rewatch.done.one': 'Watched once, all the way through.',
  'rewatch.done.other': 'Watched {n} times, all the way through.',
  'rewatch.again.one': 'You are watching it again.',
  'rewatch.again.other': 'Watch number {n}.',
  'taste.rewatched': 'My comfort show',
  'taste.rewatchedTimes.one': 'watched {n} time',
  'taste.rewatchedTimes.other': 'watched {n} times',

  'tally.aria': 'My time spent',
  'tally.title': 'The time I have put in',
  'tally.atLeast': 'At least {commitment}.',
  'tally.episodes.one': '{n} episode',
  'tally.episodes.other': '{n} episodes',
  'tally.onSeries.one': '{episodes}, across {n} series counted',
  'tally.onSeries.other': '{episodes}, across {n} series counted',
  'tally.heaviest': 'Mostly',
  'tally.heaviestOnce': '{title}: {commitment}',
  'tally.heaviestPasses.one': '{title}: {commitment}, watched {n} time',
  'tally.heaviestPasses.other': '{title}: {commitment}, watched {n} times',
  'tally.missing.one':
    '{n} show you follow could not be counted: its snapshot has expired, or the catalogue does not know how long its episodes are. The real total is higher.',
  'tally.missing.other':
    '{n} shows you follow could not be counted: their snapshots have expired, or the catalogue does not know how long their episodes are. The real total is higher.',
  'tally.private': 'Worked out right here, in this browser. Nothing is sent anywhere.',

  'season.aired.one': '{n} episode out',
  'season.aired.other': '{n} episodes out',
  'season.below':
    'Season {season} — {episodes}, rated {current}/10, which is {gap} below the show’s average.',
  'season.above':
    'Season {season} — {episodes}, rated {current}/10, which is {gap} above the show’s average.',

  'catchup.days.one': '{n} day',
  'catchup.days.other': '{n} days',
  'catchup.pace': '{episodes} in {days} before the next one — {time} a day.',
  'catchup.tight': '{episodes} in {days} before the next one — that would take {time} a day.',
  'catchup.plain': '{episodes} in {days} before the next one.',

  'entry.title': 'It starts slowly',
  'entry.body.one':
    'The first episode is rated {before}/10; what follows, {after}/10. It picks up at S{s}E{e}.',
  'entry.body.other':
    'The first {n} episodes are rated {before}/10; what follows, {after}/10. It picks up at S{s}E{e}.',

  'traj.aria': 'Trajectory',
  'traj.srTitle': 'Season-by-season trajectory',
  'traj.yours': 'How far you have come',
  'traj.seasonsTo': 'seasons 1 to {n}',
  'traj.hidden.one': '{n} season beyond your position is not shown.',
  'traj.hidden.other': '{n} seasons beyond your position are not shown.',
  'traj.seeMore': 'See the rest of the trajectory',
  'traj.seeAll': 'See the season-by-season trajectory',
  'traj.warning': 'contains a judgement on later seasons',
  'traj.episodeByEpisode': 'Episode by episode',
  'traj.clickHint': 'Click an episode to say where you are, or to rate it.',
  'traj.stop.before': 'Stopping after season {n} brings the series down to ',
  'traj.stop.after': ', instead of ~ {full}.',
  'traj.source':
    'Derived from TMDB public ratings, season by season — not from ratings on this site. Those ratings look very similar from one season to the next: the gaps matter more than the values.',
  'traj.youAndPublic': 'You, and the public',
  'traj.you': 'you {v}',
  'traj.publicIs': 'public {v}',
  'traj.likeMore': 'you like it more',
  'traj.likeLess': 'you like it less',
  'share.save': 'Save this curve as an image',
  'share.saved': 'Image saved.',
  'share.caption': 'season by season',
  'share.legendMine': 'my ratings · public in grey',
  'share.legendPublic': 'TMDB public ratings',
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

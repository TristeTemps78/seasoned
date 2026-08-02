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

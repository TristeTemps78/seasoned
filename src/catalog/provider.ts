/**
 * Interface de fournisseur de catalogue.
 *
 * Applique la regle structurante du projet : **le catalogue est loue,
 * pas possede.** Les formes definies ici sont **ephemeres** — elles transitent, se
 * mettent en cache avec expiration, et ne sont jamais la source de verite. Rien de
 * ce module ne doit atterrir tel quel dans une table.
 *
 * Deux raisons, l'une contractuelle et l'autre strategique :
 *   - TMDB interdit de conserver ses donnees au-dela de six mois ;
 *   - le barème de TheTVDB est plus previsible a long terme, donc un changement de
 *     fournisseur est probable. Il doit rester **un module a reecrire, pas une base
 *     a migrer**.
 */

import type { ExternalIds, ProductionStatus } from '../domain/types';
import type { RawSeason } from '../domain/seasons';
import type { ProgramKind } from '../domain/program';

/** Resultat de recherche : le minimum pour choisir dans une liste. */
/**
 * Qui est cette personne — le strict necessaire pour l'annoncer en tete de sa page.
 *
 * ⚠️ Ni biographie ni date de naissance : ce produit parle de **series**, pas de gens, et une
 * biographie TMDB est un pave de metadonnee louee qu'il faudrait traduire, tronquer et
 * rafraichir. Le visage, le nom et le metier suffisent a dire de qui l'on parle.
 */
export interface PersonIdentity {
  readonly name: string;
  readonly profilePath?: string;
  /**
   * Le metier principal chez TMDB (`known_for_department`) : « Acting », « Writing »…
   *
   * ⚠️ **Brut, jamais traduit ici.** Meme regle que `JournalSnapshot.status` : memoriser un
   * libelle deja traduit fige la langue du moment ou la donnee a ete lue. La page le traduit
   * a l'affichage, ou pas du tout quand la valeur est inconnue.
   */
  readonly knownForDepartment?: string;
}

/** Une serie au generique de quelqu'un, avec le titre auquel il ou elle y figure. */
export interface PersonCredit {
  readonly series: SeriesSummary;
  /**
   * Le personnage joue, ou le poste occupe. Absent quand TMDB ne le donne pas — ce qui
   * arrive, et n'empeche pas d'afficher la serie.
   */
  readonly role?: string;
}

/**
 * Ce qu'une personne a joue, et ce qu'elle a fabrique.
 *
 * ⚠️ **Deux listes et non une**, parce que ce sont deux questions. Les fondre etait le
 * defaut de `mapPersonSeriesCredits` : on ne pouvait pas savoir si quelqu'un avait joue dans
 * une serie ou l'avait ecrite, alors que la reponse arrivait dans le meme paquet.
 */
export interface PersonCredits {
  readonly cast: readonly PersonCredit[];
  readonly crew: readonly PersonCredit[];
}

export interface SeriesSummary {
  readonly providerId: string;
  readonly title: string;
  readonly originalTitle?: string;
  readonly firstAirDate?: Date;
  readonly posterPath?: string;
  /**
   * La banniere 16:9. **Sur le resume et pas seulement sur la fiche** : `backdrop_path`
   * voyage deja dans `trending`, `on_the_air`, `search` et `/tv/{id}` (verifie sur les
   * reponses en cache), donc la porter ici ne coute aucun appel.
   *
   * ⚠️ Souvent absente — un etat normal, pas une panne. Tout ce qui la rend a un repli.
   */
  readonly backdropPath?: string;
  readonly overview?: string;
  /**
   * Nature du programme, traduite depuis les genres du fournisseur.
   *
   * Vit sur le resume et pas seulement sur la fiche detaillee : c'est ce qui permet
   * de filtrer une liste **sans un appel par element**.
   */
  readonly kind?: ProgramKind;
  /**
   * Combien de gens ont note ce programme chez le fournisseur.
   *
   * ⚠️ **Ce n'est pas une note, c'est une assise.** On ne s'en sert jamais pour classer ni
   * pour afficher quoi que ce soit : uniquement pour savoir si une entree a ete vue par
   * assez de monde pour meriter la vitrine (`isPopular`, `lib/catalog.ts`). Le classement
   * `popular` de TMDB mesure le trafic sur *leur* site, pas la notoriete — d'ou des
   * feuilletons regionaux et des journaux televises a 0 vote en page 1.
   *
   * Present dans toutes les reponses de liste comme sur la fiche, donc gratuit a porter ici.
   * Optionnel malgre tout : une source qui ne le donnerait pas ne doit pas vider la vitrine.
   */
  readonly voteCount?: number;
}

/**
 * Comment une serie est mise a disposition.
 *
 * `flatrate` couvre l'abonnement — c'est le cas qui interesse la plupart des gens et
 * le seul affiche par defaut. Les autres existent mais repondent a une autre question
 * (« combien ca coute »), qui n'est pas celle du produit.
 */
export type WatchKind = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';

/** Un service ou regarder une serie, dans un pays donne. */
export interface WatchOption {
  readonly kind: WatchKind;
  readonly providerName: string;
  readonly logoPath?: string;
}

/**
 * Ou regarder une serie, pays par pays.
 *
 * ⚠️ **Un `Record` et non une liste a plat** : la disponibilite est nationale, donc chaque
 * option doit rester attachee a son pays. Une liste aplatie dirait « c'est sur Netflix »
 * sans dire ou, ce qui est exactement le renseignement faux qu'un voyageur ou un
 * expatrie ne pardonne pas.
 */
export interface WatchInRegion {
  readonly options: readonly WatchOption[];
  /**
   * Le lien JustWatch du pays, tel que TMDB le sert (`results.<PAYS>.link`).
   *
   * 🔴 **Les puces etaient des `<span>` inertes.** Mesure au navigateur le 2026-08-15 sur
   * `/serie/1396` : Netflix, Amazon Video, Apple TV Store, Google Play, Fandango — six
   * fournisseurs nommes, `getAttribute('href')` nul sur les six. La section qui est le
   * dernier maillon de la decision que toute la page prepare ne menait nulle part.
   *
   * ⚠️ **Un lien par PAYS, pas par fournisseur** : TMDB ne sert que celui-la. Fabriquer une
   * adresse par service reviendrait a deviner l'URL d'un catalogue tiers — c'est-a-dire a
   * servir des liens morts a la premiere refonte de leur site. C'est aussi ce que fait la
   * reference : ses badges louer/acheter sont un partenariat JustWatch, et son repli pour
   * tout le reste est un unique « All services… ».
   */
  readonly link?: string;
}

export type WatchByRegion = Readonly<Record<string, WatchInRegion>>;

/**
 * Les visuels **que TMDB porte deja** pour une serie.
 *
 * ## Pourquoi ce type, et ce qu'il evite
 *
 * Choisir son affiche est la fonctionnalite la plus aimee de Serializd. Le reflexe serait
 * de laisser envoyer une image : ce serait ouvrir d'un coup le stockage non borne, la
 * moderation d'images et une surface de droit d'auteur a notre charge — les trois raisons
 * pour lesquelles A12 a ecarte l'upload pour les GIF.
 *
 * On ne propose donc **que ce que TMDB sert deja**. Aucun envoi, aucun hebergement,
 * aucune moderation, aucun droit nouveau : c'est la meme ruse qu'A12, et elle rend la
 * fonctionnalite gratuite.
 *
 * Les chemins sont ceux de TMDB (`/xyz.jpg`), jamais des URLs completes : la taille se
 * choisit a l'affichage, et le CDN peut changer de forme sans que le journal mente.
 */
export interface SeriesArtwork {
  readonly posters: readonly string[];
  readonly backdrops: readonly string[];
}

/**
 * Un decoupage **alternatif** d'une serie en saisons et episodes.
 *
 * ## Pourquoi ce type existe, avec des chiffres
 *
 * TMDB sert un decoupage par defaut (son `seasons`), et en connait d'autres : ordre DVD,
 * ordre d'une plateforme, ordre absolu, arcs narratifs. Mesure faite le 2026-08-03 contre
 * l'API reelle :
 *
 *   - **Money Heist** — defaut TMDB : **3 saisons, 41 episodes**. Netflix, c'est-a-dire la
 *     ou tout le monde la regarde : **5 parts, 48 episodes**. Quelqu'un qui dit « je suis
 *     saison 4 » designe donc une saison **qui n'existe pas** dans notre modele, et
 *     « il vous reste X episodes » se trompe de **17 %**.
 *   - **One Piece** — defaut : 23 saisons / 1181 episodes, dont une saison de **197
 *     episodes** ; l'ordre TVDB en compte 24 et 1210.
 *
 * ## Pourquoi c'est plus grave ici que chez un tracker
 *
 * Chez un tracker, un mauvais ordre donne une case cochee au mauvais endroit : **visible**,
 * et l'utilisateur corrige. Ici l'ordre est l'**entree de tous les calculs** — trajectoire,
 * point d'entree, point d'arret, temps restant, bilan d'heures. Le produit rendrait un
 * conseil **faux avec assurance**, et rien ne le montrerait : aucune case n'a l'air fausse,
 * le chiffre est juste faux.
 *
 * D'ou la reponse, qui est une regle du projet : **on signale, on ne repare jamais en
 * silence.** Ce type ne sert pas a corriger un decoupage — il sert a savoir qu'il en existe
 * d'autres, et a le dire.
 */
export interface EpisodeGrouping {
  readonly id: string;
  readonly name: string;
  /**
   * Nature du decoupage telle que TMDB la code.
   *
   * Conserve **brut**, et accompagne de {@link kindName} : le bareme est celui du
   * fournisseur, il peut s'etendre, et un module de domaine n'a pas a connaitre ses
   * numeros.
   */
  readonly kind: number;
  /** Nom lisible de la nature, quand on sait la nommer. */
  readonly kindName?: string;
  /** Nombre de groupes — l'equivalent des saisons dans ce decoupage. */
  readonly groupCount: number;
  /** Nombre total d'episodes dans ce decoupage. */
  readonly episodeCount: number;
}

/** Une personne creditee a la creation d'une serie. */
export interface Creator {
  readonly providerId: string;
  readonly name: string;
}

/**
 * Un role au generique (2026-08-11).
 *
 * ## Pourquoi il n'y avait pas de casting du tout
 *
 * `profile_path` n'apparaissait **nulle part** dans le depot : la fiche serie nommait ses
 * createurs et personne d'autre. Sur la reference du projet, les visages occupent la moitie
 * de la page — c'est le manque que Tristan a nomme le 2026-08-11.
 *
 * ⚠️ `character` est **optionnel, et souvent absent** hors des series americaines — meme
 * degradation silencieuse que `creators`. Un role sans nom de personnage reste un visage
 * utile ; refuser la ligne entiere viderait le generique des series qu'on connait le moins.
 */
export interface CastMember {
  readonly providerId: string;
  readonly name: string;
  /** Le personnage joue, quand le fournisseur le connait. */
  readonly character?: string;
  /** Le chemin de la photo chez le fournisseur. Absent = on rendra un monogramme. */
  readonly profilePath?: string;
}

/** Fiche complete d'une serie, telle que rendue par un fournisseur. */
export interface SeriesDetail extends SeriesSummary {
  readonly externalIds: ExternalIds;
  readonly production: ProductionStatus;
  readonly seasons: readonly RawSeason[];
  /** Note du public chez le fournisseur, sur 10. **Pas** une note de ce produit. */
  readonly voteAverage?: number;
  readonly lastAiredAt?: Date;
  readonly nextAiringAt?: Date;
  readonly episodeRunTimeMinutes?: number;
  /**
   * Le prochain episode, quand il est annonce.
   *
   * « Nouvel episode dans trois jours » laisse le lecteur calculer la date et ignorer
   * de quel episode il s'agit. C'est la seule information du site qui donne une raison
   * de revenir a une date precise.
   */
  readonly nextEpisode?: {
    readonly seasonNumber: number;
    readonly episodeNumber: number;
    readonly title?: string;
    readonly airsOn: Date;
  };
  /**
   * Createurs credites.
   *
   * Un **fait de production**, pas un calcul de similarite : c'est ce qui distingue ce
   * maillage d'une recommandation algorithmique, ecartee par Souvent
   * absent hors des series americaines — degrader sans bruit.
   */
  readonly creators?: readonly Creator[];
  /**
   * Le generique, dans l'ordre du fournisseur.
   *
   * ⚠️ **Borne a la source** (voir `readCast`) : `aggregate_credits` rend le generique de
   * toutes les saisons reunies, soit plus de 400 lignes sur une serie longue. Les charger
   * pour en afficher douze ferait payer la fiche entiere pour un encart.
   */
  readonly cast?: readonly CastMember[];

  /**
   * La cle YouTube de la bande-annonce, quand le catalogue en porte une.
   *
   * 🔴 **Le produit n'avait de bande-annonce nulle part.** La reference en met une sur
   * chaque fiche, a cote de « ou la regarder », et c'est le seul element de la page qui
   * reponde a « a quoi ca ressemble » — question qu'aucun chiffre ne traite.
   *
   * ⚠️ **Une cle, jamais une URL, et jamais un lecteur.** Une cle se compose a l'affichage,
   * donc l'adresse peut changer sans que le catalogue mente ; c'est la meme regle que les
   * chemins d'affiche. Et un lecteur integre ferait entrer un tiers dans la page — des
   * cookies, un script, une politique de securite a rouvrir — pour un lien qui suffit.
   */
  readonly trailerKey?: string;
}

/** Un episode tel que rendu par un fournisseur. */
export interface EpisodeDetail {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  readonly title?: string;
  readonly airedAt?: Date;
  readonly runtimeMinutes?: number;
  readonly overview?: string;
  /** Note du public chez le fournisseur, sur 10. **Pas** une note de ce produit. */
  readonly voteAverage?: number;
  /** Nombre de votes. Une note adossee a trois votes ne vaut rien. */
  readonly voteCount?: number;
}

/** Detail d'une saison, episodes compris. */
export interface SeasonDetail {
  readonly seasonNumber: number;
  readonly name?: string;
  readonly airDate?: Date;
  readonly episodes: readonly EpisodeDetail[];
}

/**
 * Listes de decouverte.
 *
 * Ce ne sont pas des commodites : sans elles, **aucune page serie n'est atteignable**
 * depuis une page indexable, et le canal d'acquisition n°1 est un cul-de-sac. Constate
 * par l'audit du 2026-08-01 : sitemap a une seule URL, `/recherche` en `Disallow`,
 * zero lien sortant depuis l'accueil.
 */
/**
 * Les genres qu'on peut demander en parcourant.
 *
 * ## Des slugs, jamais des identifiants de fournisseur
 *
 * `KIND_BY_TMDB_GENRE` dit la regle noir sur blanc : les nombres propres a TMDB
 * n'existent que dans `tmdb.ts`. Le domaine et l'interface raisonnent sur ces mots-la, et
 * c'est ce qui rend le parcours portable si le fournisseur change — la traduction est un
 * tableau de correspondance a reecrire, pas une fonctionnalite.
 *
 * ⚠️ **Ce n'est pas {@link ProgramKind}.** Celui-la dit la *nature* d'un programme (une
 * telerealite n'est pas une fiction) et sert a decider ce qui entre en vitrine. Celui-ci dit
 * le *sujet*, et sert a chercher. Les confondre ferait disparaitre « Documentaire » du
 * parcours au motif qu'il est deja une nature.
 *
 * Douze, et pas les seize de TMDB : `news`, `talk`, `reality` et `soap` sont precisement ce
 * que `isShowcased` ecarte de la vitrine. Les proposer au parcours rendrait des rangees que
 * le reste du produit refuse d'afficher.
 */
export type BrowseGenre =
  | 'action'
  | 'animation'
  | 'comedy'
  | 'crime'
  | 'documentary'
  | 'drama'
  | 'family'
  | 'kids'
  | 'mystery'
  | 'sci_fi'
  | 'war'
  | 'western';

/** Toutes les valeurs de {@link BrowseGenre}, dans l'ordre d'affichage. */
export const ALL_BROWSE_GENRES: readonly BrowseGenre[] = [
  'action',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'kids',
  'mystery',
  'sci_fi',
  'war',
  'western',
];

/**
 * Comment classer ce qu'on parcourt.
 *
 * ⚠️ `rating` demande un plancher de votes cote fournisseur, sans quoi il rend des series
 * a 10/10 sur deux votes — c'est le meme defaut que `MIN_SHOWCASE_VOTES` corrige sur la
 * vitrine, en pire, puisqu'ici le tri le fait remonter **en tete** au lieu de le noyer.
 */
export type BrowseSort = 'popular' | 'rating' | 'recent';

/** Toutes les valeurs de {@link BrowseSort}, dans l'ordre d'affichage. */
export const ALL_BROWSE_SORTS: readonly BrowseSort[] = ['popular', 'rating', 'recent'];

/**
 * Ce qu'on demande en parcourant le catalogue.
 *
 * Tout est facultatif : sans rien, on rend le plus populaire, ce qui est exactement ce que
 * la vitrine montre deja. Le parcours n'est donc jamais un ecran vide.
 */
/**
 * L'etat de production, en facette de parcours.
 *
 * 🔴 **La seule facette que personne d'autre n'offre, et elle manquait.** `/parcourir`
 * proposait genre, epoque, tri — c'est-a-dire ce que tous les catalogues proposent. Or la
 * these du produit est qu'une serie se juge sur sa duree et sur sa fin : « montre-moi des
 * choses qui **se terminent** » est la question que ce produit existe pour traiter, et elle
 * n'etait posable nulle part.
 *
 * ⚠️ `ended` couvre l'arret **et** l'annulation. Le catalogue les distingue, la fiche aussi
 * (« It has an ending » / « It may stop without a conclusion »), mais pour quelqu'un qui
 * cherche une serie finie les deux repondent oui : il y a un dernier episode.
 */
export type BrowseRun = 'ended' | 'running';

export const ALL_BROWSE_RUNS: readonly BrowseRun[] = ['ended', 'running'];

export interface BrowseQuery {
  readonly genre?: BrowseGenre;
  /** Premiere annee d'une decennie : `1990`, `2000`, `2010`, `2020`. */
  readonly decade?: number;
  readonly sort?: BrowseSort;
  readonly run?: BrowseRun;
}

export type DiscoverKind =
  /** Ce qui bouge cette semaine. Renouvelle la page d'accueil sans effort. */
  | 'trending'
  /** Le fond de catalogue populaire. Alimente le sitemap. */
  | 'popular'
  /** En cours de diffusion — la ou le statut reel a le plus de valeur. */
  | 'on_the_air';

/**
 * Ce que doit fournir n'importe quelle source de catalogue.
 *
 * Volontairement minimale. Toute methode ajoutee ici devra etre implementee par le
 * prochain fournisseur — c'est le prix de la portabilite, et il doit rester bas.
 */
export interface CatalogProvider {
  /** Nom court, pour les journaux de diagnostic et l'attribution. */
  readonly name: string;

  search(query: string): Promise<readonly SeriesSummary[]>;

  getSeries(providerId: string): Promise<SeriesDetail>;

  getSeason(
    providerId: string,
    seasonNumber: number,
  ): Promise<SeasonDetail>;

  /** @param page 1-indexee, comme chez tous les fournisseurs. */
  discover(
    kind: DiscoverKind,
    page?: number,
  ): Promise<readonly SeriesSummary[]>;

  /**
   * Parcourt le catalogue selon des criteres.
   *
   * ⚠️ **Une methode de plus sur cette interface, donc un cout de portabilite assume.** La
   * regle en tete du bloc dit que le prix doit rester bas ; celui-ci l'est, parce que tout
   * catalogue serieux sait filtrer par genre, par periode et par ordre — c'est la premiere
   * chose qu'un fournisseur expose apres la recherche.
   *
   * L'alternative etait pire : composer le parcours a partir de `discover()` et filtrer en
   * memoire. Ca aurait demande de rapatrier des milliers de fiches pour en montrer douze,
   * et rendu des rangees creuses des qu'un genre est rare — un cout par utilisateur, ce que
   * le produit refuse.
   */
  browse(
    query: BrowseQuery,
    page?: number,
  ): Promise<readonly SeriesSummary[]>;

  /**
   * Le nom d'une personne, et son visage.
   *
   * 🔴 **Le generique etait un cul-de-sac.** Douze acteurs affiches sur chaque fiche, aucun
   * cliquable, aucune page derriere. Le `CLAUDE.md` rangeait `Cast` parmi les silences
   * assumes — « ce qui n'a litteralement rien derriere » — mais le classement ne tenait pas :
   * `seriesByCreator` interroge deja `/person/{id}/tv_credits` pour « du meme createur »,
   * donc la donnee existe et sait produire une page. Ce n'etait pas « rien derriere », c'etait
   * « pas encore construit ».
   */
  personName(personId: string): Promise<PersonIdentity | undefined>;

  /** Les autres series d'une personne creditee a la creation. */
  seriesByCreator(
    personId: string,
  ): Promise<readonly SeriesSummary[]>;

  /**
   * Les credits d'une personne, **cast et crew separes**.
   *
   * ## Pourquoi une methode de plus a cote de {@link seriesByCreator}
   *
   * Les deux interrogent `/person/{id}/tv_credits`, et elles ne demandent pas la meme chose.
   * `seriesByCreator` sert « du meme createur » sous une fiche : une liste plate de
   * suggestions, ou l'on se moque de savoir a quel titre la personne y figure. Une **page de
   * personne** pose l'autre question — *qu'a-t-elle jouee, qu'a-t-elle faite* — et fondre les
   * deux etait exactement le defaut : `mapPersonSeriesCredits` parcourt `crew` puis `cast` et
   * **dedoublonne par serie**, donc un acteur qui a aussi produit un episode perdait l'un des
   * deux roles, en silence et selon l'ordre de lecture.
   *
   * ⚠️ Le role vient avec, et il n'est pas decoratif : « Walter White » en dit plus long sur
   * une filmographie que la centieme affiche. C'est la donnee que la page precedente jetait
   * alors qu'elle arrivait dans la meme reponse.
   */
  personCredits(personId: string): Promise<PersonCredits>;

  /**
   * Ou regarder une serie, dans **chacun** des pays demandes.
   *
   * ## Pourquoi plusieurs pays, et pourquoi ca ne coute rien
   *
   * L'appel TMDB `/tv/{id}/watch/providers` ne prend **aucun pays** : il renvoie le monde
   * entier dans une seule reponse. La version precedente en gardait un et jetait tout le
   * reste — « sur Netflix 🇬🇧, pas 🇫🇷 » etait donc a portee sans un appel de plus, et
   * c'est ce qui a decide la forme.
   *
   * ⚠️ La disponibilite reste **nationale** : on ne fusionne jamais deux pays en une
   * liste. Melanger les catalogues dirait qu'une serie est disponible la ou elle ne l'est
   * pas, ce qui est pire que de ne rien afficher. Chaque pays garde sa liste, et l'ecran
   * dit lequel est lequel.
   *
   * @param regions codes ISO 3166-1 a deux lettres, ceux que la personne a choisis.
   */
  watchOptions(
    providerId: string,
    regions: readonly string[],
  ): Promise<WatchByRegion>;

  /**
   * Les affiches et bannieres connues d'une serie. Voir {@link SeriesArtwork}.
   *
   * @returns des listes eventuellement **vides** — beaucoup de series n'ont qu'un visuel,
   *   et ce n'est pas une erreur.
   */
  artwork(providerId: string): Promise<SeriesArtwork>;

  /**
   * Les decoupages alternatifs connus pour une serie. Voir {@link EpisodeGrouping}.
   *
   * @returns une liste eventuellement **vide** — c'est le cas courant, et ce n'est pas une
   *   absence de reponse. Jamais `undefined` : un fournisseur qui ne sait pas repondre rend
   *   une liste vide, ce qui se traite comme « aucun decoupage alternatif connu ».
   */
  episodeGroups(
    providerId: string,
  ): Promise<readonly EpisodeGrouping[]>;
}

/**
 * Mention d'attribution exigee par les conditions d'utilisation de TMDB.
 *
 * Vit ici et non dans un composant d'interface : c'est une obligation
 * contractuelle liee au fournisseur, pas un choix de mise en page. Le logo TMDB
 * doit accompagner ce texte partout ou des donnees TMDB sont affichees.
 */
export const TMDB_ATTRIBUTION =
  'This product uses the TMDB API but is not endorsed or certified by TMDB.';

/**
 * Mention exigee des que des donnees de disponibilite sont affichees.
 *
 * TMDB les agrege depuis JustWatch et impose de le citer — obligation contractuelle,
 * au meme titre que {@link TMDB_ATTRIBUTION}, et non un choix de mise en page.
 *
 * 🔴 **Elle etait ecrite en francais**, et s'affichait telle quelle sur la fiche serie
 * anglaise : *« Disponibilité fournie par JustWatch. »* juste sous « Where to watch it ».
 * Vu a l'ecran le 2026-08-11 — ni les tests ni le typage ne pouvaient le voir, et
 * `no-hardcoded-strings` non plus : il n'inspectait que `app/` et `lib/`, jamais `src/`.
 *
 * Elle rejoint donc {@link TMDB_ATTRIBUTION} dans sa forme contractuelle : **en anglais et
 * verbatim**, comme l'exige TMDB, et non traduite. Les deux mentions se comportent
 * desormais pareil, ce qui etait deja ce que leur voisinage promettait.
 */
export const JUSTWATCH_ATTRIBUTION = 'Availability data provided by JustWatch.';

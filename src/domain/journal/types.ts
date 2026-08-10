/**
 * Le journal — **les formes, les cles, les constantes**. Aucun comportement.
 *
 * C'est la brique que tout le reste importe, et la seule qui ne fasse rien : elle dit ce
 * qu'est une entree, ce qu'est une cle, et combien de temps une valeur survit. Un module
 * qui ne contient que des types n'a pas de test propre — c'est `tsc` qui le verifie.
 */

import type { DecisionKind, SeriesId, Stars } from '../types';
import type { SeasonSize } from '../remaining';
import type { RealStatus } from '../status';


/**
 * Version du format que ce code **sait ecrire**.
 *
 * ⚠️ Ce n'est plus un plafond de lecture : une version superieure est lue, ses champs
 * inconnus sont preserves, et `Journal.version` retient alors le maximum vu. Voir la
 * decision n°4 en tete de module — et son corollaire, qui interdit d'incrementer cette
 * constante avant d'avoir deploye le lecteur tolerant.
 */
export const JOURNAL_VERSION = 3;

/**
 * Fournisseur de catalogue dont proviennent les identifiants ecrits aujourd'hui.
 *
 * Vit ici, en un seul endroit, precisement pour que le jour ou il change on sache quoi
 * remapper ( — le barème de TheTVDB est plus previsible).
 */
export const CURRENT_PROVIDER = 'tmdb';

/**
 * Cle d'une entree de journal : `<fournisseur>:<identifiant>`.
 *
 * Jamais un identifiant nu. Voir la decision n°1 en tete de module.
 */
export type JournalKey = string;

/** Fabrique la cle d'une serie. Le seul endroit ou l'on colle un prefixe. */
export function journalKey(providerId: SeriesId, provider = CURRENT_PROVIDER): JournalKey {
  return `${provider}:${providerId}`;
}

/** Decompose une cle. Rend `undefined` si elle n'a pas la forme attendue. */
export function parseJournalKey(
  key: JournalKey,
): { readonly provider: string; readonly providerId: string } | undefined {
  const at = key.indexOf(':');
  if (at <= 0 || at === key.length - 1) return undefined;
  return { provider: key.slice(0, at), providerId: key.slice(at + 1) };
}

// ---------------------------------------------------------------------------
// A13 — les films dans le journal, sans migration et sans casser les agregats
// ---------------------------------------------------------------------------
//
// Arbitrage A13 (2026-08-03, Tristan) : le produit suit les films, pas seulement les
// series.
//
// ## Pourquoi aucun journal n'est migre
//
// La cle vaut `<espace>:<identifiant>` et {@link parseJournalKey} coupe au **premier**
// `:`. Les series gardent donc `tmdb:1396` **inchange**, et les films prennent un espace
// neuf. C'est la regle appliquee au renommage `seasoned` → `Voltface` : **on ne migre pas
// ce qui marche deja.**
//
// Et le prefixe n'identifiait pas seulement le fournisseur, il identifiait l'**espace
// d'identifiants** — ce qui est exact : chez TMDB, le film 550 et la serie 550 sont deux
// objets differents. La convention etait prete sans qu'on l'ait prevu.
//
// ## 🔴 Le vrai risque, et la raison d'etre de {@link seriesEntries}
//
// Quatre modules du domaine parcourent le journal **entier** en supposant que chaque
// entree a des saisons et des episodes : `calendar` (`upcomingFrom`), `library`, `tally`,
// `taste`. Une entree film non filtree **ne plante pas** — elle empoisonne *silencieusement*
// chaque agregat, et le typage ne dira rien puisqu'une cle est une chaine.
//
// > **Un module qui compile n'est pas un module qui filtre.** Variante de la lecon
// > « un champ qui existe n'est pas un champ qui est ecrit » (`CLAUDE.md`).
//
// D'ou l'ordre impose : **border les quatre modules d'abord, ecrire la premiere entree film
// ensuite.** L'inverse fabrique des chiffres faux dont on ne saura pas depuis quand.

/**
 * Suffixe qui fait d'un espace d'identifiants autre chose qu'une serie.
 *
 * Teste par **suffixe** et non par egalite avec {@link MOVIE_PROVIDER} : le jour ou le
 * fournisseur change, les cles `tmdb-movie:` deja ecrites doivent
 * continuer a se lire comme des films. Parsing tolerant,.
 */
const MOVIE_NAMESPACE_SUFFIX = '-movie';

/** Espace d'identifiants des films chez le fournisseur courant. */
export const MOVIE_PROVIDER = `${CURRENT_PROVIDER}${MOVIE_NAMESPACE_SUFFIX}`;

/** Fabrique la cle d'un film. Le pendant de {@link journalKey}. */
export function movieKey(providerId: string): JournalKey {
  return journalKey(providerId, MOVIE_PROVIDER);
}

/** Vrai si la cle designe un film. */
export function isMovieKey(key: JournalKey): boolean {
  return parseJournalKey(key)?.provider.endsWith(MOVIE_NAMESPACE_SUFFIX) === true;
}

/**
 * Vrai si la cle designe une serie — c'est-a-dire un espace d'identifiants **sans
 * qualificatif**.
 *
 * ## Pourquoi la question est posee dans ce sens
 *
 * Le reflexe serait `!isMovieKey(key)`. C'est le mauvais sens, et la difference compte le
 * jour ou un troisieme type apparait (un livre, un album — le concurrent Achriom en fait
 * deja). Avec `!isMovieKey`, ce type inconnu serait compte **comme une serie** : ses saisons
 * absentes fausseraient chaque agregat, en silence, exactement le defaut qu'on repare ici.
 *
 * > **Le garde-fou doit echouer vers l'exclusion.** Exclure un type inconnu ne fait
 * > qu'omettre ; l'inclure corrompt. Un tiret dans l'espace d'identifiants suffit donc a
 * > sortir des agregats de series, sans que personne ait a penser a mettre a jour cette
 * > fonction.
 *
 * Une cle illisible est traitee comme une serie : elle ne peut venir que d'avant A13,
 * epoque ou tout etait une serie. Ne rien changer pour elle est le seul choix qui preserve
 * le comportement existant.
 */
export function isSeriesKey(key: JournalKey): boolean {
  const parsed = parseJournalKey(key);
  if (parsed === undefined) return true;
  return !parsed.provider.includes('-');
}

/**
 * Les entrees qui sont des series, pour les agregats qui supposent des saisons.
 *
 * Un seul point de filtrage plutot qu'un `if` recopie dans quatre modules : c'est ce qui
 * fait qu'un cinquieme agregat, ecrit plus tard par quelqu'un d'autre, ne peut pas oublier
 * le filtre sans que ca se voie a la lecture.
 */
export function seriesEntries(journal: Journal): readonly [JournalKey, JournalEntry][] {
  return Object.entries(journal.entries).filter(([key]) => isSeriesKey(key));
}

// ---------------------------------------------------------------------------
// 9.0 — la provenance d'un fait, et pourquoi elle ne s'ajoute pas apres coup
// ---------------------------------------------------------------------------
//
// ## Ce que la marque dit exactement
//
// Pas « ce fait vient d'un fichier » — **« la date de ce fait est celle ou il est entre
// ici, pas celle ou il a eu lieu »**. C'est la seule formulation qui soit vraie, et c'est
// elle qui rend la marque utile.
//
// Mesure a l'appui : {@link importForeign} ecrit **chaque** fait a `now`, l'instant de
// l'import. Reprendre dix ans de TV Time depose donc deux cents series portant toutes la
// **meme** date, celle du jour. Deux consequences, verifiees sur le code du 2026-08-09 :
//
//   - une fenetre glissante sur les derniers faits (9.1, la face) serait **entierement**
//     remplie par l'import, et la face decrirait un clic au lieu d'une annee ;
//   - un bilan annuel (8.14) attribuerait dix ans d'historique a l'annee de l'import.
//     `src/` ne contient aujourd'hui **aucun** `getFullYear` : le filtre n'existe pas
//     encore, donc la marque arrive a temps — de justesse.
//
// ## Pourquoi maintenant, et pas quand on en aura besoin
//
// Un journal deja importe ne se demele **jamais** : rien, dans un fait non marque, ne
// distingue une soiree d'hier de dix ans repris d'ailleurs. C'est la cinquieme decision
// irreparable du format, apres les trois de la v2 et le rewatch — et comme les autres,
// elle ne coute rien tant qu'il y a peu de journaux a preserver.
//
// ## Ce qu'on ne fait PAS : deviner la vraie date
//
// Un export porte parfois la date reelle du visionnage. La lire serait mieux ; l'inventer
// serait pire que tout. Tant qu'on ne la lit pas, on **signale** qu'on ne la connait pas
// plutot que de laisser croire que `now` est la bonne.

/**
 * D'ou vient un fait — c'est-a-dire d'ou vient **sa date**.
 *
 * **L'absence est la valeur normale** : un fait pose a la main dans le produit ne porte
 * rien. C'est ce qui rend la migration gratuite — aucun journal existant n'a besoin d'etre
 * touche, et un ancien client qui ne connait pas ce champ le preserve (decision n°4).
 *
 * Une seule valeur aujourd'hui. Le jour ou notre extension de navigateur ecrira des faits
 * (5.20), elle en ajoutera une — et ce sera un fait **vecu**, donc a traiter autrement
 * qu'un import. C'est pour ca que c'est une union et non un booleen `imported`.
 */
export type FactOrigin = 'import';

/** Ou en est l'utilisateur dans une serie. */
export interface JournalPosition {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  /** ISO 8601. Une chaine et non une `Date` : c'est ce qui se serialise. */
  readonly declaredAt: string;
  /** Voir {@link FactOrigin}. Absent = pose a la main. */
  readonly origin?: FactOrigin;
}

/** Une note posee par l'utilisateur. */
export interface JournalRating {
  readonly stars: Stars;
  readonly at: string;
  /** Voir {@link FactOrigin}. Absent = pose a la main. */
  readonly origin?: FactOrigin;
}

/** Ce que l'utilisateur a decide de faire de la serie. */
export interface JournalDecision {
  readonly kind: DecisionKind;
  readonly at: string;
  readonly atSeason?: number;
  readonly atEpisode?: number;
  /**
   * Voir {@link FactOrigin}. Absent = pose a la main.
   *
   * 🔴 **Ce champ manquait, et {@link asImported} le posait quand meme.** Elle marque par
   * **parcours** — tout enregistrement qui porte une date — donc elle marquait deja une
   * decision ; c'est `parseDecision` qui ne le relisait pas, et qui l'effacait donc a la
   * premiere sauvegarde. Exactement le defaut que 9.0 documente, reste ouvert sur les deux
   * seuls champs dont la face (9.1) a besoin.
   *
   * ⚠️ Latent au 2026-08-10 — `importForeign` n'ecrit aujourd'hui ni decision ni
   * visionnage. C'est precisement pour ca qu'on le referme maintenant : *ce qu'on
   * n'enregistre pas au moment du geste manque pour toujours*, et le jour ou un import
   * apprendra a lire un abandon, la marque devra deja etre relue.
   */
  readonly origin?: FactOrigin;
}

/** « Je veux la voir » — le premier geste possible, et le seul qui ne suppose rien. */
export interface JournalWanted {
  readonly at: string;
  /** Voir {@link FactOrigin}. Absent = pose a la main. */
  readonly origin?: FactOrigin;
}

/**
 * Une exception a la position — l'episode qu'on a saute, ou vu en avance.
 *
 * ## Pourquoi ce n'est pas le passage aux cases a cocher
 *
 * La position reste **un pointeur**, et tout ce qui la precede
 * reste implicitement vu. C'est ce qui permet de mettre a jour une progression en un geste
 * au lieu de quarante-sept — et *la saisie manuelle est la cause n°1 d'abandon des
 * trackers*. Ce que le pointeur ne savait pas dire, c'est **l'exception** :
 * « j'ai vu S03E07 mais pas S03E05 », « je saute les episodes de remplissage ».
 *
 * Donc on ajoute les exceptions, pas les regles. Un journal sans aucune marque se comporte
 * exactement comme avant.
 *
 * ## Un seul enregistrement par episode, et c'est ce qui rend la fusion sure
 *
 * Deux champs separes — une liste de sautes, une liste de vus-en-avance — laisseraient le
 * meme episode entrer dans les deux, un etat incoherent que la fusion devrait arbitrer sans
 * aucune regle pour le faire. Un enregistrement unique rend l'exclusion **vraie par
 * construction** : `laterOf` tranche, exactement comme pour une note.
 */
export interface JournalEpisodeMark {
  readonly kind: 'skipped' | 'watched';
  readonly at: string;
}

/**
 * Ce qu'on a ecrit sur une serie, ou sur une saison.
 *
 * ## Une seule structure pour les deux granularites
 *
 * Les cles reprennent **le vocabulaire des pierres tombales**, deja dans ce module :
 * `series` pour l'oeuvre entiere, `season:3` pour une saison. Une structure, une fonction
 * de fusion, un espace de suppression — au lieu de deux de chaque.
 *
 * ## `throughSeason` est declare par l'auteur, jamais devine
 *
 * C'est la borne de spoiler : « ce texte ne revele rien au-dela de la saison N ». Zero veut
 * dire « sans spoiler », donc lisible par quelqu'un qui n'a pas commence — et c'est le cas
 * qui compte, puisque l'audience d'une critique est justement celle qui hesite.
 *
 * ⚠️ Elle n'est PAS deduite de la position de l'auteur, meme si l'interface la prerenseigne
 * ainsi : deduire reviendrait a publier sa position sans qu'il l'ait choisi (regle 7).
 *
 * ## Ce qui n'est pas ici, et pourquoi
 *
 * **L'etat « publie » ne vit pas dans le journal.** Deux appareils s'en disputeraient la
 * valeur sans date qui les departage. L'etat publie, c'est **l'existence de la ligne** cote
 * serveur, dont le serveur est l'autorite parce qu'il en detient la copie.
 */
export interface JournalReview {
  readonly text: string;
  readonly at: string;
  /** Jusqu'ou ce texte va. `0` = rien au-dela du pitch. */
  readonly throughSeason: number;
  /** Langue **declaree** a l'ecriture. Irrattrapable apres coup (A9). */
  readonly lang?: string;
}

/** Plafond d'une critique. Meme ordre de grandeur que la note d'un signalement. */
export const MAX_REVIEW_CHARS = 2000;

/** Ce qui cloche dans un texte, ou rien. Meme forme que `checkHandle`. */
export type ReviewCheck = { readonly ok: true } | { readonly ok: false; readonly reason: 'empty' | 'too_long' };

/**
 * Le texte est-il publiable ?
 *
 * On **signale**, on ne tronque pas en silence : couper la fin d'une
 * critique a 2000 caracteres serait la reecrire sans le dire.
 */
export function checkReview(raw: string): ReviewCheck {
  const text = raw.trim();
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > MAX_REVIEW_CHARS) return { ok: false, reason: 'too_long' };
  return { ok: true };
}

/** Cle canonique d'une critique : `series`, ou `season:3`. */
export function reviewKey(seasonNumber?: number): string {
  return seasonNumber === undefined ? 'series' : `season:${seasonNumber}`;
}

/**
 * Le coeur : « celle-la compte pour moi ».
 *
 * ## Pourquoi il n'est pas une note de plus
 *
 * Une note dit **la qualite**, un coeur dit **l'attachement**, et ce ne sont pas les memes
 * informations : on met cinq etoiles a une serie qu'on ne reverra jamais, et on garde un
 * faible pour une serie qu'on sait bancale. Letterboxd separe les deux depuis toujours ;
 * la note se discute, le coeur ne se discute pas.
 *
 * **Sur la serie seulement.** L'attachement porte sur l'oeuvre, pas sur une saison — et un
 * `likedSeasons` reste possible plus tard sans migration, puisque le format est additif.
 *
 * Meme forme que {@link JournalWanted} : un booleen date. La date n'est pas decorative,
 * c'est elle qui permet a la fusion de departager deux appareils.
 */
export interface JournalLiked {
  readonly at: string;
}

/**
 * Une fois ou la serie a ete menee au bout.
 *
 * ## Version 3 (2026-08-03) — la quatrieme decision irreparable
 *
 * Le journal ne connaissait **aucune** notion de revisionnage. La position etant un
 * pointeur unique, quelqu'un qui recommence *The Office* pour la troisieme fois
 * **ecrasait** sa progression precedente : le produit ne perdait pas une statistique, il
 * perdait le fait.
 *
 * Or le rewatch n'est pas un detail d'usage :
 *
 * > **C'est le seul comportement qui distingue une serie aimee d'une serie finie.** Une
 * > note de cinq etoiles posee une fois et un troisieme visionnage disent deux choses
 * > differentes, et la seconde est bien plus difficile a falsifier.
 *
 * Comme les trois decisions de la v2, celle-ci **ne se rattrape pas** : les visionnages
 * passes qu'on n'a pas enregistres ne se devinent pas. D'ou son ecriture maintenant,
 * tant qu'il y a peu de journaux a preserver.
 *
 * ## Pourquoi une liste de dates, et rien de plus
 *
 * On aurait pu modeliser des « passages » complets — debut, fin, notes propres a chaque
 * vision. Ce serait plus riche et **beaucoup** plus dur a fusionner : deux appareils
 * devraient s'accorder sur l'identite d'un passage, ce qui demande un identifiant stable
 * qu'aucun des deux ne peut attribuer seul.
 *
 * Une liste de dates est un **ensemble**. L'union de deux ensembles est commutative,
 * associative et idempotente **par construction** — donc les huit lois de fusion
 * (`tests/journal-merge.test.ts`) tiennent sans effort. Le fait irreparable est capture ;
 * le reste peut s'ajouter plus tard sans rien perdre.
 */
export interface JournalCompletion {
  readonly at: string;
  /** Voir {@link FactOrigin} et la note de {@link JournalDecision.origin}. */
  readonly origin?: FactOrigin;
}

/**
 * Ce qu'il faut pour dessiner une vignette **sans un seul appel reseau**.
 *
 * ⚠️ Ce sont des **metadonnees du catalogue**, et le plafond contractuel de six mois
 * ne connait pas la frontiere entre serveur et navigateur. Elles
 * sont donc datees et **expirees a la lecture** par {@link SNAPSHOT_TTL_MS}, exactement
 * comme `src/catalog/cache.ts` le fait cote serveur : le plafond est applique **par le
 * code**, jamais par une consigne.
 *
 * C'est aussi ce qui rend `/moi` tenable a 100 000 utilisateurs : rafraichir trente
 * series a chaque visite couterait des millions d'appels par jour, lire un instantane
 * local en coute zero.
 */
export interface JournalSnapshot {
  readonly title: string;
  readonly posterPath?: string;
  /**
   * Statut reel, **brut**. C'est lui qu'on affiche, traduit a la lecture.
   *
   * ## 🔴 Le defaut qu'il repare, constate au navigateur
   *
   * Ce champ n'existait pas : seul {@link statusLabel} etait memorise, **deja traduit**,
   * avec la langue de la page **au moment du geste**. La bibliotheque le reaffichait tel
   * quel — donc `/moi` en anglais annoncait « Entre deux saisons » a qui avait note depuis
   * une page francaise.
   *
   * Le defaut est invisible au typage (c'est une chaine des deux cotes) et invisible aux
   * tests d'une seule langue. **Et la synchronisation l'aggrave** : un journal partage
   * entre deux appareils propagerait des libelles figes dans la langue du premier.
   *
   * > On memorise un **fait**, pas sa mise en forme. La traduction est une decision de
   * > lecture, et elle appartient a la page qui lit.
   */
  readonly status?: RealStatus;
  /**
   * Statut deja mis en forme, dans la langue du geste.
   *
   * ⚠️ **Conserve uniquement pour les journaux deja ecrits**, qui n'ont pas {@link status}
   * et qu'on ne peut pas migrer : ils sont chez les gens. On lit le brut d'abord, celui-ci
   * en repli — « on migre ce qu'on controle ». A retirer quand plus aucun journal en
   * circulation n'aura ete ecrit avant le 2026-08-03.
   */
  readonly statusLabel?: string;
  /** Date du prochain episode annonce, ISO 8601. C'est elle qui fait « Ca revient ». */
  readonly nextEpisodeAt?: string;
  /**
   * Duree mediane d'un episode, en minutes.
   *
   * ## Pourquoi elle est memorisee et non recalculee
   *
   * `/moi` ne fait **aucun appel reseau** — c'est la condition qui rend la bibliotheque
   * tenable a cent mille utilisateurs. Donc ce que le journal ignore au moment du geste,
   * il l'ignorera pour toujours pour cette visite-la.
   *
   * Sans ce champ, aucun bilan de temps passe n'est calculable ailleurs que sur la page
   * de la serie, et **le manque est retroactif** : les visites deja faites ne se rejouent
   * pas. Meme regle que le revisionnage — ce qu'on n'enregistre pas aujourd'hui manque
   * pour toujours.
   *
   * ⚠️ Elle expire avec le reste de l'instantane (plafond contractuel de six mois), donc
   * tout bilan qui s'appuie dessus doit s'annoncer comme un **minorant**.
   */
  readonly episodeMinutes?: number;
  /**
   * Taille de chaque saison notable, en episodes.
   *
   * ## Le jumeau de `episodeMinutes`, trouve une session trop tard
   *
   * Le champ precedent a ete ajoute pour qu'un bilan de temps passe soit calculable hors
   * de la page serie. Il ne suffit pas : une position vaut « saison 3, episode 7 », et
   * **on ne sait pas ce que ca represente sans connaitre la taille des saisons 1 et 2**.
   * Une duree d'episode sans compte d'episodes ne chiffre rien.
   *
   * Le type est celui que {@link SeasonSize} definit pour `remainingAfter` — donc le
   * bilan reutilise le calcul deja ecrit et teste, au lieu de refaire la meme
   * arithmetique une seconde fois avec ses propres erreurs.
   *
   * ⚠️ **Meme regle que le revisionnage et que la duree** : ce que le journal n'enregistre
   * pas au moment du geste, il l'ignorera pour toujours **pour cette visite-la**. Le manque
   * est retroactif, il ne se rattrape pas.
   *
   * La saison en cours grossit apres coup, donc une valeur ancienne **sous-estime**. C'est
   * le bon sens de l'erreur : tout ce qui s'appuie dessus s'annonce comme un minorant.
   */
  readonly seasonSizes?: readonly SeasonSize[];
  /**
   * Note du public pour la serie, sur l'echelle en etoiles.
   *
   * Le seul moyen de dire « vous notez plus severement que le public » ailleurs que
   * sur la page serie : la bibliotheque ne fait aucun appel, donc ce qu'elle ignore au
   * moment du geste, elle l'ignorera pour toujours. Expire avec le reste de
   * l'instantane.
   */
  readonly publicStars?: number;
  readonly cachedAt: string;
}

/**
 * Duree de vie de ce qui **bouge** dans un instantane : trente jours.
 *
 * Statut reel, date du prochain episode, note du public. Passe ce delai, ces champs
 * sont ignores : mieux vaut une vignette sans mention qu'une mention fausse.
 */
export const SNAPSHOT_TTL_MS = 30 * 86_400_000;

/**
 * Duree de vie de ce qui **identifie** une serie : titre et affiche.
 *
 * Six mois — le plafond contractuel exact, applique par le code
 * et non par une consigne.
 *
 * La distinction n'est pas une subtilite : elle a ete trouvee en verifiant la
 * bibliotheque au navigateur. Avec un delai unique de trente jours, toute serie
 * terminee ou abandonnee — donc dont on ne revisite jamais la fiche — retombait sur
 * « Serie 1405 » au bout d'un mois. La section « Terminees » aurait ete illisible en
 * permanence, ce qu'aucun test ne pouvait montrer.
 *
 * Un titre ne se perime pas ; un statut, si. Les faire expirer au meme rythme etait
 * une confusion, pas une precaution.
 */
export const SNAPSHOT_IDENTITY_TTL_MS = 182 * 86_400_000;

/**
 * Ce qui a ete supprime, et quand.
 *
 * Cles canoniques : `season:3`, `episode:3:7`, `decision`, `wanted`. Voir la decision
 * n°3 en tete de module — sans ces traces, une suppression ne survit pas a une fusion.
 */
export type JournalTombstones = Readonly<Record<string, string>>;

/**
 * Duree de vie d'une trace de suppression : quatre-vingt-dix jours.
 *
 * Il faut bien qu'elles disparaissent, sans quoi le journal grossit de tout ce qu'il
 * n'a plus. Passe ce delai, l'appareil qui portait la valeur effacee l'a forcement
 * synchronisee ou abandonnee — et le pire cas restant, une note qui revient apres trois
 * mois de silence, ne vaut pas de conserver eternellement des entrees vides.
 */
export const TOMBSTONE_TTL_MS = 90 * 86_400_000;

/** Tout ce que l'on retient d'une serie. */
export interface JournalEntry {
  readonly position?: JournalPosition;
  /** Notes de saison, indexees par numero de saison. */
  readonly seasonRatings?: Readonly<Record<string, JournalRating>>;
  /**
   * Notes d'episode, indexees par `saison:episode`.
   *
   * Arbitrage A7 (2026-08-02), contraire au modele de notation d'origine et
   * assume comme tel : la note d'episode est **strictement facultative**, et la saison
   * reste l'unite de trajectoire — une note d'episode ne deforme jamais la courbe.
   */
  readonly episodeRatings?: Readonly<Record<string, JournalRating>>;
  readonly decision?: JournalDecision;
  readonly wanted?: JournalWanted;
  /** Le coeur. Voir {@link JournalLiked}. */
  readonly liked?: JournalLiked;
  /**
   * Les exceptions a la position, indexees par `saison:episode`.
   *
   * Voir {@link JournalEpisodeMark}. Un journal sans marque se comporte exactement
   * comme avant leur existence.
   */
  readonly episodeMarks?: Readonly<Record<string, JournalEpisodeMark>>;
  /** Ce qu'on a ecrit, par cible. Voir {@link JournalReview}. */
  readonly reviews?: Readonly<Record<string, JournalReview>>;
  /**
   * Chaque fois que la serie a ete menee au bout. Voir {@link JournalCompletion}.
   *
   * Volontairement **hors de `removed`** : une trace de suppression sert a empecher un
   * fait efface de revenir par la fusion. Ici, il n'y a rien a effacer — un visionnage a
   * eu lieu ou n'a pas eu lieu, et l'oublier serait precisement le defaut qu'on repare.
   */
  readonly completions?: readonly JournalCompletion[];
  /**
   * L'affiche choisie a la main, chemin TMDB (`/xyz.jpg`).
   *
   * ⚠️ **Un chemin, jamais une URL** : la taille se choisit a l'affichage, et le CDN peut
   * changer de forme sans que le journal se mette a mentir. C'est la meme regle que
   * {@link JournalSnapshot.posterPath}.
   *
   * ⚠️ Et **on ne stocke que le choix**, jamais l'image : elle reste chez TMDB. C'est ce
   * qui rend la fonctionnalite gratuite — aucun envoi, aucun hebergement, aucune
   * moderation, aucune surface de droit d'auteur (meme ruse qu'A12 pour les GIF).
   *
   * Absent = l'affiche par defaut du catalogue.
   */
  readonly poster?: string;
  /** La banniere choisie a la main. Meme regle que {@link poster}. */
  readonly backdrop?: string;
  readonly snapshot?: JournalSnapshot;
  readonly removed?: JournalTombstones;
  /**
   * Ce que cette version du code ne sait pas lire, garde intact.
   *
   * Decision n°4 en tete de module. Ce champ n'est **jamais** ecrit par ce code : il ne
   * contient que ce qu'une autre version a mis la, et son seul role est de traverser une
   * lecture et une reecriture sans etre perdu.
   */
  readonly unknownFields?: Readonly<Record<string, unknown>>;
}

export interface Journal {
  /**
   * Le maximum entre {@link JOURNAL_VERSION} et la version du document lu.
   *
   * Reemis tel quel : un document qui a traverse un client plus recent **contient** des
   * champs de cette version-la, meme si le client courant ne les comprend pas. Reecrire
   * un numero plus petit dirait le contraire.
   */
  readonly version: number;
  /**
   * Identifiant local de l'appareil, anonyme.
   *
   * Il ne sert a rien tant qu'il n'y a qu'un appareil — c'est justement pour cela
   * qu'il faut l'ecrire maintenant : le jour ou deux journaux fusionnent, savoir d'ou
   * vient quoi n'est plus reconstituable.
   *
   * ⚠️ **Il PART sur le serveur**, et cette phrase disait le contraire jusqu'au
   * 2026-08-07 (« jamais envoye nulle part aujourd'hui »). Elle etait vraie le jour ou
   * elle a ete ecrite ; le lot 6.3 l'a rendue fausse en ajoutant la synchronisation.
   * {@link serializeJournal} ecrit `deviceId` dans le document, et `RemoteJournalStore`
   * le PUT a chaque sauvegarde d'un compte connecte.
   *
   * Ce que cela vaut exactement, mesure et pas suppose : `supabase/001_journal.sql` rend
   * `journals` lisible **par son seul proprietaire**. L'identifiant part donc dans la
   * ligne de la personne, et personne d'autre ne peut le lire. **Affirmation perimee,
   * pas fuite** — et il ne faut pas l'ecrire plus fort que ca.
   */
  readonly deviceId?: string;
  /** Services auxquels l'utilisateur est abonne, pour « dispo chez vous ». */
  readonly platforms?: readonly string[];
  /**
   * Les pays dont on veut connaitre la disponibilite, codes ISO 3166-1.
   *
   * ## Pourquoi une preference, et pourquoi elle vit ICI
   *
   * ⚠️ **On ne devine pas l'utilisateur, on le laisse choisir** (tranche par Tristan le
   * 2026-08-03). Deduire le pays de l'adresse IP demanderait de l'inspecter cote serveur —
   * donc du tracage, ce qui casse « pas de publicite donc pas de suivi », l'argument meme
   * qui rend le modele coherent — et ce serait **faux** derriere un VPN, precisement pour
   * les gens que la question interesse.
   *
   * Elle vit dans le journal et non dans un etat d'ecran parce qu'elle doit suivre d'un
   * appareil a l'autre, comme {@link platforms}. Champ **additif** : un client plus ancien
   * l'ignore et le preserve.
   *
   * Absent ou vide = le pays de la langue servie, ce que le produit faisait deja.
   */
  readonly regions?: readonly string[];
  /**
   * Ne plus afficher le temps passe devant les series.
   *
   * ## Pourquoi une option, et pourquoi elle **masque** au lieu de supprimer
   *
   * « Au moins 537 heures » est le chiffre le plus spectaculaire du produit, et pour une
   * part reelle des gens c'est un chiffre **anxiogene** — l'equivalent du temps d'ecran
   * qu'on prefere ne pas connaitre. Le rendre obligatoire, c'est faire payer a ces
   * gens-la le prix d'une demonstration technique.
   *
   * ⚠️ Le calcul, lui, **continue** : il alimente le bilan annuel, la serie la plus
   * lourde, le plan de rattrapage. On cache un affichage, on ne mutile pas un journal —
   * et c'est ce qui rend l'option reversible sans rien perdre.
   *
   * Absent = le chiffre s'affiche, ce que le produit faisait deja.
   */
  readonly hideHours?: boolean;
  readonly entries: Readonly<Record<JournalKey, JournalEntry>>;
  /** Champs de document inconnus, preserves. Voir {@link JournalEntry.unknownFields}. */
  readonly unknownFields?: Readonly<Record<string, unknown>>;
}

export const EMPTY_JOURNAL: Journal = { version: JOURNAL_VERSION, entries: {} };

/** Cle canonique d'une note d'episode. */
export function episodeKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}:${episodeNumber}`;
}
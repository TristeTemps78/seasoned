/**
 * Le journal personnel : ce que le produit retient de vous.
 *
 * Quatre des cinq ressorts qui font revenir sur un site de ce genre — progression
 * visible, collection, comparaison, decouverte de soi — supposent que le produit se
 * souvienne. Aucun n'etait possible : le site ne stockait rien.
 *
 * **Ce module ne connait ni navigateur ni base de donnees.** Il decrit la forme des
 * donnees et sait la lire de facon tolerante ; ou elles sont rangees ne le regarde pas
 * — c'est le role du port `src/journal/store.ts`. C'est ce qui permettra de passer du
 * stockage local a une base sans le reecrire. La forme retenue est exactement celle
 * qu'attend `docs/RATING-MODEL.md` §7 :
 *
 *   - la position est **un pointeur**, pas une collection de booleens ;
 *   - la cible d'une note est **polymorphe** (saison, episode, serie) ;
 *   - la decision est une entree **de plein droit**, pas un champ `status`.
 *
 * Lecture **tolerante**, comme pour le catalogue : une entree corrompue est ecartee,
 * jamais l'ensemble. Perdre tout un journal parce qu'une ligne est illisible serait la
 * pire trahison possible pour un produit qui demande d'y investir du temps.
 *
 * ---
 *
 * ## Version 2 — les trois decisions irreparables (2026-08-02)
 *
 * Prises sous la contrainte « multiplateforme, et de 1 a 100 000 utilisateurs » (A8).
 * Elles ne coutent rien aujourd'hui et sont impossibles a rattraper une fois qu'il
 * existe des journaux a preserver.
 *
 * 1. **Les entrees sont indexees par une cle prefixee du fournisseur** (`tmdb:1396`).
 *    La v1 utilisait l'identifiant TMDB nu, alors que `types.ts` ecrit noir sur blanc
 *    que les donnees utilisateur ne doivent jamais pointer un identifiant fournisseur.
 *    Un changement de catalogue — probable, `ROADMAP.md` §4.1 — devient un remappage
 *    au lieu d'une perte totale.
 * 2. **Chaque fait porte sa propre date, et la fusion se fait au niveau du champ.**
 *    Cinq appareils, c'est cinq journaux qui divergent. Fusionner document contre
 *    document perd le travail de l'un des deux ; fusionner champ par champ ne perd
 *    rien. Il faut pour cela que la date vive sur le fait, pas sur le document — et
 *    c'est ce qui ne peut pas s'ajouter apres coup : les dates manquantes des faits
 *    deja ecrits ne se devinent pas.
 * 3. **Une suppression laisse une trace datee** (`removed`). Sans elle, l'appareil qui
 *    a efface une note la voit revenir a la premiere synchronisation, ressuscitee par
 *    l'appareil qui l'ignorait. C'est le defaut classique des fusions naives, et il
 *    est indetectable sans jeu de donnees a deux appareils.
 *
 * ---
 *
 * ## 4. Le format est ADDITIF PAR CONTRAT (2026-08-06)
 *
 * Un champ inconnu — d'une entree comme du document — est **conserve et reecrit**, et une
 * version future n'est plus jetee mais memorisee. Sans cela, un ancien client qui relit un
 * journal ecrit par un plus recent le **reecrit dépouille** a la synchronisation suivante :
 * `parseEntry` reconstruit un objet neuf a partir des seuls champs qu'il connait.
 *
 * Le prix, a payer en connaissance de cause : **une version future ne peut plus changer le
 * SENS d'un champ existant, seulement en ajouter** — un ancien client continue d'ecrire
 * dans ceux qu'il croit comprendre. Les trois versions passees etaient deja additives.
 *
 * ⚠️ **Corollaire** : ne jamais incrementer {@link JOURNAL_VERSION} sans avoir d'abord
 * **deploye** un lecteur qui sait faire ce pass-through. Ecrit ici et pas dans `TASKS.md`,
 * parce que c'est ici qu'on le lit au moment de le faire. Ce que coutait l'inverse est
 * raconte dans {@link tryParseJournal}.
 */

import type { DecisionKind, SeriesId, Stars } from './types';
import type { EpisodeMark, SeasonSize } from './remaining';
import { parseRealStatus, type RealStatus } from './status';

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
 * remapper (`ROADMAP.md` §4.1 — le barème de TheTVDB est plus previsible).
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
 * fournisseur change (`ROADMAP.md` §4.1), les cles `tmdb-movie:` deja ecrites doivent
 * continuer a se lire comme des films. Parsing tolerant, `AGENTS.md` regle 4.
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

/** Ou en est l'utilisateur dans une serie. */
export interface JournalPosition {
  readonly seasonNumber: number;
  readonly episodeNumber: number;
  /** ISO 8601. Une chaine et non une `Date` : c'est ce qui se serialise. */
  readonly declaredAt: string;
}

/** Une note posee par l'utilisateur. */
export interface JournalRating {
  readonly stars: Stars;
  readonly at: string;
}

/** Ce que l'utilisateur a decide de faire de la serie. */
export interface JournalDecision {
  readonly kind: DecisionKind;
  readonly at: string;
  readonly atSeason?: number;
  readonly atEpisode?: number;
}

/** « Je veux la voir » — le premier geste possible, et le seul qui ne suppose rien. */
export interface JournalWanted {
  readonly at: string;
}

/**
 * Une exception a la position — l'episode qu'on a saute, ou vu en avance.
 *
 * ## Pourquoi ce n'est pas le passage aux cases a cocher
 *
 * La position reste **un pointeur** (`RATING-MODEL.md` §7.3), et tout ce qui la precede
 * reste implicitement vu. C'est ce qui permet de mettre a jour une progression en un geste
 * au lieu de quarante-sept — et *la saisie manuelle est la cause n°1 d'abandon des
 * trackers* (`RESEARCH.md`). Ce que le pointeur ne savait pas dire, c'est **l'exception** :
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
 * On **signale**, on ne tronque pas en silence (`AGENTS.md` regle 8) : couper la fin d'une
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
}

/**
 * Ce qu'il faut pour dessiner une vignette **sans un seul appel reseau**.
 *
 * ⚠️ Ce sont des **metadonnees du catalogue**, et le plafond contractuel de six mois
 * (`AGENTS.md` regle 1) ne connait pas la frontiere entre serveur et navigateur. Elles
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
 * Six mois — le plafond contractuel exact (`AGENTS.md` regle 1), applique par le code
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
   * Arbitrage A7 (2026-08-02), contraire a `docs/RATING-MODEL.md` §3 couche 2 et
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
   * Identifiant local de l'appareil, anonyme et jamais envoye nulle part aujourd'hui.
   *
   * Il ne sert a rien tant qu'il n'y a qu'un appareil — c'est justement pour cela
   * qu'il faut l'ecrire maintenant : le jour ou deux journaux fusionnent, savoir d'ou
   * vient quoi n'est plus reconstituable.
   */
  readonly deviceId?: string;
  /** Services auxquels l'utilisateur est abonne, pour « dispo chez vous ». */
  readonly platforms?: readonly string[];
  readonly entries: Readonly<Record<JournalKey, JournalEntry>>;
  /** Champs de document inconnus, preserves. Voir {@link JournalEntry.unknownFields}. */
  readonly unknownFields?: Readonly<Record<string, unknown>>;
}

export const EMPTY_JOURNAL: Journal = { version: JOURNAL_VERSION, entries: {} };

/** Cle canonique d'une note d'episode. */
export function episodeKey(seasonNumber: number, episodeNumber: number): string {
  return `${seasonNumber}:${episodeNumber}`;
}

// ---------------------------------------------------------------------------
// Lecture tolerante
// ---------------------------------------------------------------------------

const VALID_STARS: ReadonlySet<number> = new Set([
  0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5,
]);

const VALID_DECISIONS: ReadonlySet<string> = new Set([
  'continuing',
  'paused',
  'abandoned',
  'completed',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPositiveInt(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : undefined;
}

/**
 * Date de repli d'un **fait** dont la date est absente ou illisible.
 *
 * ## Pourquoi l'epoch et surtout pas l'instant present
 *
 * C'etait `new Date()` — l'horloge de **celui qui lit**. Tant qu'il n'y a qu'un
 * appareil, cela ne se voit pas. Des qu'il y en a deux, c'est une corruption
 * silencieuse : deux appareils lisant **le meme** journal donnent au meme fait deux
 * dates differentes, et la fusion tranche alors au hasard de qui a ouvert l'application
 * en dernier. Un fait sans date ne devient pas plus recent parce qu'on le relit.
 *
 * L'epoch dit la seule chose vraie : « ce fait existe, on ne sait pas quand ». Il perd
 * donc contre n'importe quelle date connue — ce qui est le bon arbitrage, puisqu'une
 * date connue est une information et son absence n'en est pas une.
 *
 * L'horloge de lecture reste legitime pour l'**expiration** (pierres tombales,
 * instantanes) : la question n'y est pas « quand est-ce arrive » mais « est-ce encore
 * valable maintenant ».
 */
const UNDATED = new Date(0).toISOString();

/** Une date lisible, ou la date de repli. */
function readInstant(source: Record<string, unknown>, key: string, fallback: string): string {
  const value = source[key];
  if (typeof value !== 'string') return fallback;
  return Number.isNaN(new Date(value).getTime()) ? fallback : value;
}

function readText(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parsePosition(raw: unknown): JournalPosition | undefined {
  const source = asRecord(raw);
  const seasonNumber = readPositiveInt(source, 'seasonNumber');
  const episodeNumber = readPositiveInt(source, 'episodeNumber');
  if (seasonNumber === undefined || episodeNumber === undefined) return undefined;
  return {
    seasonNumber,
    episodeNumber,
    declaredAt: readInstant(source, 'declaredAt', UNDATED),
  };
}

function parseRating(raw: unknown): JournalRating | undefined {
  const source = asRecord(raw);
  const stars = source['stars'];
  if (typeof stars !== 'number' || !VALID_STARS.has(stars)) return undefined;
  return { stars: stars as Stars, at: readInstant(source, 'at', UNDATED) };
}

function parseDecision(raw: unknown): JournalDecision | undefined {
  const source = asRecord(raw);
  const kind = source['kind'];
  if (typeof kind !== 'string' || !VALID_DECISIONS.has(kind)) return undefined;

  const atSeason = readPositiveInt(source, 'atSeason');
  const atEpisode = readPositiveInt(source, 'atEpisode');
  return {
    kind: kind as DecisionKind,
    at: readInstant(source, 'at', UNDATED),
    ...(atSeason !== undefined ? { atSeason } : {}),
    ...(atEpisode !== undefined ? { atEpisode } : {}),
  };
}

function parseSnapshot(raw: unknown): JournalSnapshot | undefined {
  const source = asRecord(raw);
  const title = readText(source, 'title');
  if (title === undefined) return undefined;

  const posterPath = readText(source, 'posterPath');
  const status = parseRealStatus(source['status']);
  const statusLabel = readText(source, 'statusLabel');
  const nextEpisodeAt = readText(source, 'nextEpisodeAt');
  const rawEpisodeMinutes = source['episodeMinutes'];
  const episodeMinutes =
    typeof rawEpisodeMinutes === 'number' &&
    Number.isFinite(rawEpisodeMinutes) &&
    rawEpisodeMinutes > 0
      ? rawEpisodeMinutes
      : undefined;
  const rawPublic = source['publicStars'];
  const publicStars =
    typeof rawPublic === 'number' && rawPublic > 0 && rawPublic <= 5 ? rawPublic : undefined;
  const seasonSizes = parseSeasonSizes(source['seasonSizes']);
  return {
    title,
    // Un instantane sans date lisible est traite comme perime, donc jete a la premiere
    // lecture. C'est volontairement severe : le considerer frais reviendrait a garder
    // une metadonnee du catalogue sans savoir depuis quand — soit exactement ce que le
    // plafond contractuel de six mois interdit (`AGENTS.md` regle 1). Il se redepose
    // seul a la visite suivante.
    cachedAt: readInstant(source, 'cachedAt', UNDATED),
    ...(posterPath !== undefined ? { posterPath } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(statusLabel !== undefined ? { statusLabel } : {}),
    ...(nextEpisodeAt !== undefined ? { nextEpisodeAt } : {}),
    ...(episodeMinutes !== undefined ? { episodeMinutes } : {}),
    ...(seasonSizes !== undefined ? { seasonSizes } : {}),
    ...(publicStars !== undefined ? { publicStars } : {}),
  };
}

/**
 * Les tailles de saisons, lues sans jamais lever.
 *
 * Une saison mal formee est **ecartee seule** : perdre le decoupage entier parce qu'une
 * ligne sur douze est illisible couterait bien plus que la ligne (`AGENTS.md` regle 4).
 * Une liste qui ne contient rien d'exploitable rend `undefined` plutot qu'un tableau vide,
 * pour que « je n'ai pas l'information » reste distinct de « la serie n'a aucune saison ».
 */
function parseSeasonSizes(raw: unknown): readonly SeasonSize[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const sizes: SeasonSize[] = [];
  for (const item of raw) {
    const source = asRecord(item);
    const seasonNumber = readPositiveInt(source, 'seasonNumber');
    const episodeCount = readPositiveInt(source, 'episodeCount');
    // Une saison a zero episode n'apporte rien a un compte et brouille la distinction
    // ci-dessus : elle est ecartee comme une ligne illisible.
    if (seasonNumber === undefined || episodeCount === undefined || episodeCount === 0) {
      continue;
    }
    sizes.push({ seasonNumber, episodeCount });
  }

  return sizes.length > 0 ? sizes : undefined;
}

function parseRatings(raw: unknown, keyPattern: RegExp): Record<string, JournalRating> {
  const out: Record<string, JournalRating> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (!keyPattern.test(key)) continue;
    const rating = parseRating(value);
    if (rating !== undefined) out[key] = rating;
  }
  return out;
}

function parseEpisodeMarks(raw: unknown): Record<string, JournalEpisodeMark> {
  const out: Record<string, JournalEpisodeMark> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (!EPISODE_KEY.test(key)) continue;
    const source = asRecord(value);
    const kind = source['kind'];
    // Regle 4 : un genre inconnu est ecarte, pas devine. Le jour ou une version future
    // ajoute 'rewatched', cet ancien client l'ignore — et le pass-through de la decision
    // n°4 ne le sauve pas ici, puisque la cle `episodeMarks` est connue de nous.
    if (kind !== 'skipped' && kind !== 'watched') continue;
    out[key] = { kind, at: readInstant(source, 'at', UNDATED) };
  }
  return out;
}

const REVIEW_KEY = /^(series|season:[0-9]+)$/;

function parseReviews(raw: unknown): Record<string, JournalReview> {
  const out: Record<string, JournalReview> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (!REVIEW_KEY.test(key)) continue;
    const source = asRecord(value);
    const text = source['text'];
    if (typeof text !== 'string' || text.trim().length === 0) continue;
    const through = source['throughSeason'];
    const lang = source['lang'];
    out[key] = {
      // Tolerant a la lecture, strict a l'ecriture : un texte deja ecrit ne doit pas
      // disparaitre parce qu'il depasse un plafond que nous avons change depuis.
      text,
      at: readInstant(source, 'at', UNDATED),
      throughSeason: typeof through === 'number' && through >= 0 ? Math.floor(through) : 0,
      ...(typeof lang === 'string' && lang.length > 0 ? { lang } : {}),
    };
  }
  return out;
}

const SEASON_KEY = /^[0-9]+$/;
const EPISODE_KEY = /^[0-9]+:[0-9]+$/;

/**
 * Lit les traces de suppression, en **purgeant celles qui ont fait leur temps**.
 *
 * La purge vit ici, a la lecture, pour la meme raison que l'expiration des
 * instantanes : un journal peut dormir des mois dans un navigateur ferme, et il n'y a
 * aucune tache de fond pour faire le menage.
 */
function parseTombstones(raw: unknown, now: Date): JournalTombstones {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (typeof value !== 'string') continue;
    const age = now.getTime() - new Date(value).getTime();
    if (Number.isNaN(age) || age > TOMBSTONE_TTL_MS) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Lit la liste des visionnages acheves, de facon tolerante.
 *
 * Une entree illisible est **ecartee**, jamais fatale (`AGENTS.md` regle 4). Les dates
 * sont normalisees et dedupliquees des la lecture : un journal ecrit par une version
 * fautive ne doit pas propager ses doublons.
 */
function parseCompletions(raw: unknown): readonly JournalCompletion[] {
  if (!Array.isArray(raw)) return [];
  const days = new Set<string>();
  for (const item of raw) {
    const at = readInstant(asRecord(item), 'at', '');
    if (at.length === 0) continue;
    days.add(at);
  }
  return dedupeByDay([...days].map((at) => ({ at })));
}

/**
 * Un achevement par jour, au plus.
 *
 * ⚠️ **Par jour et non par instant**, et c'est le point delicat. Deux appareils qui
 * synchronisent, ou un import rejoue, enregistrent le meme achevement a quelques
 * millisecondes d'ecart : dedupliquer sur l'horodatage exact laisserait passer les
 * doublons, et « vu 4 fois » compterait des synchronisations au lieu de visionnages.
 *
 * La contrepartie — terminer deux fois la meme serie le meme jour ne compte que pour un —
 * est acceptee : elle n'arrive pas, et l'erreur inverse arriverait tout le temps.
 */
function dedupeByDay(
  completions: readonly JournalCompletion[],
): readonly JournalCompletion[] {
  const byDay = new Map<string, JournalCompletion>();
  for (const completion of completions) {
    const day = completion.at.slice(0, 10);
    const existing = byDay.get(day);
    // A jour egal, on garde la date la plus ancienne : c'est celle du visionnage, les
    // suivantes n'etant que des rejeux.
    if (existing === undefined || completion.at < existing.at) byDay.set(day, completion);
  }
  return [...byDay.values()].sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Ce que {@link parseEntry} sait lire. Toute autre cle part dans `unknownFields`.
 *
 * ⚠️ Ajouter un champ a {@link JournalEntry} **sans l'ajouter ici** le ferait recopier
 * dans le seau des inconnus en plus d'etre lu comme champ propre — donc reecrit deux fois,
 * et fusionne selon deux regles differentes.
 *
 * La coherence des deux listes est verifiee **a la compilation**, plus bas
 * ({@link ExhaustiveEntryFields}) : c'est preferable a un test, parce qu'un test se lance
 * alors que le typage, lui, barre la route au moment ou l'on ecrit le champ.
 */
const KNOWN_ENTRY_FIELDS = [
  'position',
  'decision',
  'wanted',
  'liked',
  'episodeMarks',
  'reviews',
  'completions',
  'snapshot',
  'seasonRatings',
  'episodeRatings',
  'removed',
] as const;

/** Idem au niveau du document. */
const KNOWN_JOURNAL_FIELDS = ['version', 'deviceId', 'platforms', 'entries'] as const;

/**
 * Le filet qui empeche les deux listes ci-dessus de deriver de leurs interfaces.
 *
 * `Exclude<…>` rend `never` quand la liste couvre tous les champs. Sinon il rend l'union
 * des champs **oublies**, et l'affectation echoue en nommant precisement lesquels — donc
 * `npm run typecheck` refuse le commit au lieu de laisser le champ voyager dans les deux
 * seaux a la fois.
 *
 * `unknownFields` est exclu des deux cotes : c'est le seau lui-meme, pas un champ du
 * format serialise.
 */
type ExhaustiveEntryFields = Exclude<
  Exclude<keyof JournalEntry, 'unknownFields'>,
  (typeof KNOWN_ENTRY_FIELDS)[number]
>;
type ExhaustiveJournalFields = Exclude<
  Exclude<keyof Journal, 'unknownFields'>,
  (typeof KNOWN_JOURNAL_FIELDS)[number]
>;

function assertAllFieldsListed<_Forgotten extends never>(): void {}
assertAllFieldsListed<ExhaustiveEntryFields>();
assertAllFieldsListed<ExhaustiveJournalFields>();

/**
 * Les clefs d'un objet brut que la liste des connues ne couvre pas.
 *
 * `undefined` plutot qu'un objet vide : un seau vide ferait exister `unknownFields` sur
 * toutes les entrees du monde, donc grossirait chaque export d'une accolade par serie.
 */
function unknownFieldsOf(
  source: Readonly<Record<string, unknown>>,
  known: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  const out = Object.fromEntries(
    Object.entries(source).filter(([key, value]) => !known.includes(key) && value !== undefined),
  );
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseEntry(raw: unknown, at: Date): JournalEntry | undefined {
  const source = asRecord(raw);

  const position = parsePosition(source['position']);
  const decision = parseDecision(source['decision']);
  const snapshot = parseSnapshot(source['snapshot']);
  const seasonRatings = parseRatings(source['seasonRatings'], SEASON_KEY);
  const episodeRatings = parseRatings(source['episodeRatings'], EPISODE_KEY);
  // `at` — l'horloge de lecture — ne sert qu'ici, a l'expiration. Voir `UNDATED`.
  const removed = parseTombstones(source['removed'], at);

  const wantedSource = source['wanted'];
  const wanted =
    wantedSource !== undefined && wantedSource !== null
      ? { at: readInstant(asRecord(wantedSource), 'at', UNDATED) }
      : undefined;

  const likedSource = source['liked'];
  const liked =
    likedSource !== undefined && likedSource !== null
      ? { at: readInstant(asRecord(likedSource), 'at', UNDATED) }
      : undefined;

  const episodeMarks = parseEpisodeMarks(source['episodeMarks']);
  const reviews = parseReviews(source['reviews']);
  const completions = parseCompletions(source['completions']);
  const unknownFields = unknownFieldsOf(source, KNOWN_ENTRY_FIELDS);

  const entry: JournalEntry = {
    ...(position !== undefined ? { position } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(wanted !== undefined ? { wanted } : {}),
    ...(liked !== undefined ? { liked } : {}),
    ...(Object.keys(episodeMarks).length > 0 ? { episodeMarks } : {}),
    ...(Object.keys(reviews).length > 0 ? { reviews } : {}),
    ...(completions.length > 0 ? { completions } : {}),
    ...(snapshot !== undefined ? { snapshot } : {}),
    ...(Object.keys(seasonRatings).length > 0 ? { seasonRatings } : {}),
    ...(Object.keys(episodeRatings).length > 0 ? { episodeRatings } : {}),
    ...(Object.keys(removed).length > 0 ? { removed } : {}),
    ...(unknownFields !== undefined ? { unknownFields } : {}),
  };

  return worthKeeping(entry) ? entry : undefined;
}

/**
 * Une entree porte-t-elle quelque chose que l'utilisateur reconnaitrait comme sien ?
 *
 * Un instantane seul ne compte pas : ce n'est qu'un cache de vignette. Une trace de
 * suppression non plus — elle dit ce qui n'est **plus** la.
 *
 * C'est ce predicat qui gouverne l'**affichage** et les derivations.
 */
export function hasContent(entry: JournalEntry | undefined): boolean {
  if (entry === undefined) return false;
  return (
    entry.position !== undefined ||
    entry.decision !== undefined ||
    entry.wanted !== undefined ||
    entry.liked !== undefined ||
    (entry.completions ?? []).length > 0 ||
    Object.keys(entry.seasonRatings ?? {}).length > 0 ||
    Object.keys(entry.episodeRatings ?? {}).length > 0 ||
    // Une marque est un geste explicite : sans elle ici, `worthKeeping` supprimerait une
    // entree qui n'a que des marques, et le geste serait perdu a la relecture suivante.
    Object.keys(entry.episodeMarks ?? {}).length > 0 ||
    Object.keys(entry.reviews ?? {}).length > 0
  );
}

/**
 * Faut-il conserver cette entree dans le journal ?
 *
 * Distinct de {@link hasContent}, et la distinction n'est pas cosmetique : **une
 * entree reduite a sa trace de suppression doit survivre**. Sans elle, retirer sa
 * derniere note effacerait l'entree — donc la trace avec — et la note reviendrait
 * telle quelle a la premiere fusion avec un appareil qui l'ignorait. La suppression
 * serait annulee par la synchronisation, ce qui est exactement le defaut que les
 * traces existent pour empecher.
 *
 * Les traces finissent par expirer ({@link TOMBSTONE_TTL_MS}), et l'entree vide
 * disparait alors d'elle-meme a la lecture suivante.
 */
function worthKeeping(entry: JournalEntry): boolean {
  return (
    hasContent(entry) ||
    Object.keys(entry.removed ?? {}).length > 0 ||
    // Meme raisonnement, applique au pass-through : une entree qui n'a que des champs que
    // nous ne comprenons pas n'a, pour nous, aucun contenu — la jeter la supprimerait du
    // document reecrit.
    Object.keys(entry.unknownFields ?? {}).length > 0
  );
}

/**
 * Migration v1 → v2 : les cles nues deviennent des cles prefixees.
 *
 * La v1 indexait par identifiant TMDB brut. On ne peut pas deviner autre chose que
 * TMDB — c'etait le seul fournisseur — donc la migration est sure.
 */
function migrateKey(key: string): JournalKey {
  return parseJournalKey(key) !== undefined ? key : journalKey(key);
}

/**
 * Lit un journal serialise.
 *
 * Ne leve jamais. Une entree illisible est ecartee, les autres survivent : perdre tout
 * un journal parce qu'une ligne est corrompue serait indefendable.
 *
 * @param now instant de reference pour l'**expiration** (pierres tombales, instantanes),
 *   injecte pour les tests. Ce n'est **pas** la date de repli des faits sans date : voir
 *   {@link UNDATED}, et la raison pour laquelle ce fut un defaut.
 */
export function parseJournal(raw: string | null | undefined, now = new Date()): Journal {
  const read = tryParseJournal(raw, now);
  return read.kind === 'ok' ? read.journal : EMPTY_JOURNAL;
}

/**
 * Lit un journal serialise, **en distinguant « vide » de « illisible »**.
 *
 * ## Pourquoi cette fonction existe, et pas seulement {@link parseJournal}
 *
 * 🔴 Rendre un journal vide pour un document qu'on n'a pas su lire est sur **en local** —
 * on relit son propre stockage — et destructeur **a distance**. `src/journal/remote.ts`
 * en faisait un `kind: 'found'` avec zero entree, ce que la synchronisation lit comme
 * « le compte n'a rien », donc comme une invitation a pousser le local par-dessus. Le
 * document distant etait alors remplace en entier, par un `POST merge-duplicates`, apres
 * **un seul geste**.
 *
 * Le type `RemoteRead` distinguait deja `absent` de `unavailable` pour cette raison
 * exacte. Ce qui manquait n'etait pas le concept, c'etait le moyen de le decider ici.
 *
 * `unreadable` couvre ce qui n'est pas un journal du tout : JSON invalide, racine qui
 * n'est pas un objet, `version` absente ou non numerique. Une version **future**, elle,
 * n'est pas illisible — voir la decision n°4.
 */
export function tryParseJournal(
  raw: string | null | undefined,
  now = new Date(),
): { readonly kind: 'ok'; readonly journal: Journal } | { readonly kind: 'unreadable' } {
  if (raw === null || raw === undefined || raw.trim().length === 0) {
    return { kind: 'ok', journal: EMPTY_JOURNAL };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { kind: 'unreadable' };
  }

  if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
    return { kind: 'unreadable' };
  }

  const source = asRecord(decoded);
  const version = source['version'];
  if (typeof version !== 'number' || !Number.isFinite(version) || version < 1) {
    return { kind: 'unreadable' };
  }

  return { kind: 'ok', journal: readJournal(source, version, now) };
}

function readJournal(
  source: Readonly<Record<string, unknown>>,
  version: number,
  now: Date,
): Journal {
  const entries: Record<JournalKey, JournalEntry> = {};
  for (const [key, value] of Object.entries(asRecord(source['entries']))) {
    if (key.length === 0) continue;
    const entry = parseEntry(value, now);
    if (entry !== undefined) entries[migrateKey(key)] = entry;
  }

  const deviceId = readText(source, 'deviceId');
  const rawPlatforms = source['platforms'];
  const platforms = Array.isArray(rawPlatforms)
    ? rawPlatforms.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : [];

  const unknownFields = unknownFieldsOf(source, KNOWN_JOURNAL_FIELDS);

  return {
    // Le maximum, jamais le notre : voir la decision n°4.
    version: Math.max(version, JOURNAL_VERSION),
    entries,
    ...(deviceId !== undefined ? { deviceId } : {}),
    ...(platforms.length > 0 ? { platforms } : {}),
    ...(unknownFields !== undefined ? { unknownFields } : {}),
  };
}

/**
 * Serialise un journal. Format stable — c'est aussi le format d'export.
 *
 * ⚠️ Les entrees sont reserialisees une par une, et non recopiees en bloc : elles portent
 * un seau `unknownFields` qu'il faut **reetaler a plat**. Le recopier tel quel ecrirait un
 * champ litteralement nomme `unknownFields`, que le client d'a cote relirait comme un
 * inconnu de plus — un seau dans un seau, a chaque aller-retour.
 *
 * Le seau est etale **avant** les champs connus : si jamais les deux portaient le meme nom
 * — ce qui ne peut venir que d'un oubli dans {@link KNOWN_ENTRY_FIELDS}, et le typage
 * l'interdit — c'est la valeur que nous savons lire qui doit gagner.
 */
export function serializeJournal(journal: Journal): string {
  const entries: Record<string, unknown> = {};
  for (const [key, { unknownFields, ...known }] of Object.entries(journal.entries)) {
    entries[key] = { ...unknownFields, ...known };
  }

  return JSON.stringify({
    ...journal.unknownFields,
    version: journal.version,
    ...(journal.deviceId !== undefined ? { deviceId: journal.deviceId } : {}),
    ...(journal.platforms !== undefined && journal.platforms.length > 0
      ? { platforms: journal.platforms }
      : {}),
    entries,
  });
}

// ---------------------------------------------------------------------------
// Ecritures
// ---------------------------------------------------------------------------

function withEntry(journal: Journal, key: JournalKey, entry: JournalEntry): Journal {
  const entries = { ...journal.entries };
  if (worthKeeping(entry)) {
    entries[key] = entry;
  } else {
    // Une entree vide n'a pas a encombrer le journal ni son export.
    delete entries[key];
  }
  // ⚠️ La version n'est PAS ramenee a `JOURNAL_VERSION` ici. Ecrire dans un document
  // qu'une version plus recente a touche ne le ramene pas a la notre : ses champs
  // inconnus sont toujours la, preserves. Voir la decision n°4.
  return { ...journal, entries };
}

/** Marque un champ comme supprime a une date donnee. Voir la decision n°3. */
function withTombstone(entry: JournalEntry, field: string, at: string): JournalTombstones {
  return { ...(entry.removed ?? {}), [field]: at };
}

/** Retire une pierre tombale devenue caduque — le champ vient d'etre re-ecrit. */
function withoutTombstone(entry: JournalEntry, field: string): JournalTombstones | undefined {
  if (entry.removed === undefined || !(field in entry.removed)) return entry.removed;
  const { [field]: _dropped, ...rest } = entry.removed;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

function reviseTombstone(
  entry: JournalEntry,
  field: string,
): { readonly removed?: JournalTombstones } {
  const removed = withoutTombstone(entry, field);
  return removed !== undefined ? { removed } : {};
}

/**
 * Declare ou l'on en est.
 *
 * **Un pointeur, pas quarante-sept cases a cocher** (`docs/RATING-MODEL.md` §3,
 * couche 0) : tout ce qui precede est implicitement vu. C'est le seul remede realiste
 * a la friction qui tue les trackers.
 */
export function setPosition(
  journal: Journal,
  key: JournalKey,
  seasonNumber: number,
  episodeNumber: number,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  return withEntry(journal, key, {
    ...entry,
    position: { seasonNumber, episodeNumber, declaredAt: now.toISOString() },
  });
}

/** Note une saison. `undefined` retire la note. */
export function setSeasonRating(
  journal: Journal,
  key: JournalKey,
  seasonNumber: number,
  stars: Stars | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const field = `season:${seasonNumber}`;
  const seasonRatings = { ...(entry.seasonRatings ?? {}) };

  if (stars === undefined) {
    delete seasonRatings[String(seasonNumber)];
    return withEntry(journal, key, {
      ...entry,
      seasonRatings,
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }

  seasonRatings[String(seasonNumber)] = { stars, at: now.toISOString() };
  return withEntry(journal, key, {
    ...entry,
    seasonRatings,
    ...reviseTombstone(entry, field),
  });
}

/**
 * Note un episode. `undefined` retire la note.
 *
 * Arbitrage A7 : contraire a la recommandation de `docs/RATING-MODEL.md` §3 couche 2,
 * et acte. La contrepartie exigee est tenue ailleurs — le geste coute un tap depuis la
 * grille, rien ne reclame la completude, et la trajectoire continue de se calculer sur
 * les seules notes de saison.
 */
export function setEpisodeRating(
  journal: Journal,
  key: JournalKey,
  seasonNumber: number,
  episodeNumber: number,
  stars: Stars | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const cell = episodeKey(seasonNumber, episodeNumber);
  const field = `episode:${cell}`;
  const episodeRatings = { ...(entry.episodeRatings ?? {}) };

  if (stars === undefined) {
    delete episodeRatings[cell];
    return withEntry(journal, key, {
      ...entry,
      episodeRatings,
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }

  episodeRatings[cell] = { stars, at: now.toISOString() };
  return withEntry(journal, key, {
    ...entry,
    episodeRatings,
    ...reviseTombstone(entry, field),
  });
}

/** Enregistre une decision : continuer, mettre en pause, abandonner, avoir fini. */
export function setDecision(
  journal: Journal,
  key: JournalKey,
  kind: DecisionKind | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  if (kind === undefined) {
    const { decision: _removed, ...rest } = entry;
    return withEntry(journal, key, {
      ...rest,
      removed: withTombstone(entry, 'decision', now.toISOString()),
    });
  }

  // Le point exact ou la decision est prise est ce qui a de la valeur : c'est lui qui
  // fera la carte des abandons (`docs/RATING-MODEL.md` §7.4).
  const at = entry.position;
  return withEntry(journal, key, {
    ...entry,
    decision: {
      kind,
      at: now.toISOString(),
      ...(at !== undefined
        ? { atSeason: at.seasonNumber, atEpisode: at.episodeNumber }
        : {}),
    },
    ...reviseTombstone(entry, 'decision'),
  });
}

/**
 * Enregistre que la serie vient d'etre menee au bout.
 *
 * ## Pourquoi ce geste est distinct de la decision « terminee »
 *
 * `setDecision(key, 'completed')` decrit un **etat courant**, et il se retire : on peut
 * l'avoir clique par erreur. Un visionnage acheve est un **evenement**, et il ne se
 * retire pas — c'est arrive. Confondre les deux ferait disparaitre un fait a chaque
 * changement d'avis, ce qui est exactement le defaut que la v3 repare.
 *
 * D'ou l'appel des deux cotes : l'interface pose la decision **et** enregistre le
 * passage. Le second est idempotent dans la journee, donc une bascule repetee ne compte
 * jamais deux fois.
 */
export function markCompleted(
  journal: Journal,
  key: JournalKey,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const completions = dedupeByDay([
    ...(entry.completions ?? []),
    { at: now.toISOString() },
  ]);
  // Rien de neuf : on rend le journal **tel quel**, pour qu'un rendu React ne se
  // declenche pas sur une egalite de reference perdue pour rien.
  if (completions.length === (entry.completions ?? []).length) return journal;
  return withEntry(journal, key, { ...entry, completions });
}

/**
 * Combien de fois la serie a ete menee au bout.
 *
 * Zero pour une serie en cours : c'est le nombre de **passages acheves**, pas le nombre
 * de fois qu'on l'a ouverte.
 */
export function completionCount(entry: JournalEntry | undefined): number {
  return entry?.completions?.length ?? 0;
}

/**
 * Est-on en train de la revoir ?
 *
 * Vrai quand la serie a deja ete achevee **et** qu'une position courante existe. C'est
 * la definition la plus simple qui ne se trompe pas : reposer une position apres avoir
 * fini, c'est recommencer.
 */
export function isRewatching(entry: JournalEntry | undefined): boolean {
  return completionCount(entry) > 0 && entry?.position !== undefined;
}

/**
 * « Je veux la voir. »
 *
 * Le premier geste possible, et le seul qui ne suppose **rien** — ni d'avoir commence,
 * ni d'avoir un avis. Il manquait : le produit n'offrait aucune prise a qui decouvre
 * une serie, c'est-a-dire a la quasi-totalite des arrivants.
 */
export function setWanted(
  journal: Journal,
  key: JournalKey,
  wanted: boolean,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  if (!wanted) {
    const { wanted: _removed, ...rest } = entry;
    return withEntry(journal, key, {
      ...rest,
      removed: withTombstone(entry, 'wanted', now.toISOString()),
    });
  }
  return withEntry(journal, key, {
    ...entry,
    wanted: { at: now.toISOString() },
    ...reviseTombstone(entry, 'wanted'),
  });
}

/**
 * Ecrire, reecrire ou effacer une critique.
 *
 * `text` vide efface — le meme geste rejoue annule, comme partout ailleurs ici.
 */
export function setReview(
  journal: Journal,
  key: JournalKey,
  target: string,
  review: { readonly text: string; readonly throughSeason: number; readonly lang?: string },
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const field = `review:${target}`;
  const { [target]: _current, ...rest } = entry.reviews ?? {};

  if (review.text.trim().length === 0) {
    const { reviews: _dropped, ...withoutReviews } = entry;
    return withEntry(journal, key, {
      ...withoutReviews,
      ...(Object.keys(rest).length > 0 ? { reviews: rest } : {}),
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }

  return withEntry(journal, key, {
    ...entry,
    reviews: {
      ...rest,
      [target]: {
        text: review.text.trim(),
        at: now.toISOString(),
        throughSeason: review.throughSeason,
        ...(review.lang !== undefined ? { lang: review.lang } : {}),
      },
    },
    ...reviseTombstone(entry, field),
  });
}

/**
 * Les marques d'une entree, dans la forme qu'attend le domaine du calcul.
 *
 * La table du journal est indexee par `saison:episode` — pratique pour fusionner, illisible
 * pour compter. Cette traduction vit **ici**, en un seul endroit : chaque appelant qui
 * refendrait la cle lui-meme finirait par le faire un peu differemment.
 */
export function marksOf(entry: JournalEntry | undefined): readonly EpisodeMark[] {
  return Object.entries(entry?.episodeMarks ?? {}).flatMap(([key, mark]) => {
    const [season, episode] = key.split(':').map(Number);
    if (season === undefined || episode === undefined) return [];
    if (!Number.isFinite(season) || !Number.isFinite(episode)) return [];
    return [{ seasonNumber: season, episodeNumber: episode, kind: mark.kind }];
  });
}

/**
 * Marquer un episode saute ou vu en avance — ou retirer la marque.
 *
 * `kind` a `undefined` retire, comme partout ailleurs ici : c'est le meme geste rejoue qui
 * annule, plutot qu'un second mutateur a tenir d'accord avec le premier.
 */
export function setEpisodeMark(
  journal: Journal,
  key: JournalKey,
  seasonNumber: number,
  episodeNumber: number,
  kind: JournalEpisodeMark['kind'] | undefined,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  const at = episodeKey(seasonNumber, episodeNumber);
  const field = `mark:${at}`;
  const { [at]: _current, ...rest } = entry.episodeMarks ?? {};

  if (kind === undefined) {
    // ⚠️ La cle est **retiree**, jamais posee a `undefined` : `exactOptionalPropertyTypes`
    // distingue les deux, et une table vide qui traine reapparaitrait dans l'export.
    const { episodeMarks: _dropped, ...withoutMarks } = entry;
    return withEntry(journal, key, {
      ...withoutMarks,
      ...(Object.keys(rest).length > 0 ? { episodeMarks: rest } : {}),
      removed: withTombstone(entry, field, now.toISOString()),
    });
  }

  return withEntry(journal, key, {
    ...entry,
    episodeMarks: { ...rest, [at]: { kind, at: now.toISOString() } },
    ...reviseTombstone(entry, field),
  });
}

/**
 * Poser ou retirer le coeur. Voir {@link JournalLiked}.
 *
 * Meme mecanique que {@link setWanted}, y compris la pierre tombale : sans elle, retirer un
 * coeur sur le telephone le verrait revenir a la premiere synchronisation avec l'ordinateur
 * qui l'ignorait — la suppression annulee par la synchronisation, decision n°3.
 */
export function setLiked(
  journal: Journal,
  key: JournalKey,
  liked: boolean,
  now = new Date(),
): Journal {
  const entry = journal.entries[key] ?? {};
  if (!liked) {
    const { liked: _removed, ...rest } = entry;
    return withEntry(journal, key, {
      ...rest,
      removed: withTombstone(entry, 'liked', now.toISOString()),
    });
  }
  return withEntry(journal, key, {
    ...entry,
    liked: { at: now.toISOString() },
    ...reviseTombstone(entry, 'liked'),
  });
}

/**
 * Memorise de quoi dessiner la vignette, si l'entree existe deja.
 *
 * **N'en cree jamais une** : sans cela, visiter une page serie suffirait a remplir le
 * journal de series auxquelles on n'a pas touche — et a constituer, page apres page,
 * une base de metadonnees TMDB que le contrat interdit.
 */
export function setSnapshot(
  journal: Journal,
  key: JournalKey,
  snapshot: Omit<JournalSnapshot, 'cachedAt'>,
  now = new Date(),
): Journal {
  const entry = journal.entries[key];
  if (entry === undefined) return journal;
  return withEntry(journal, key, {
    ...entry,
    snapshot: { ...snapshot, cachedAt: now.toISOString() },
  });
}

/** Declare les services auxquels on est abonne. */
export function setPlatforms(
  journal: Journal,
  platforms: readonly string[],
): Journal {
  return { ...journal, platforms: [...platforms] };
}

/** Attache un identifiant d'appareil s'il n'y en a pas encore. */
export function withDeviceId(journal: Journal, deviceId: string): Journal {
  if (journal.deviceId !== undefined) return journal;
  return { ...journal, deviceId };
}

// ---------------------------------------------------------------------------
// Lectures derivees
// ---------------------------------------------------------------------------

/**
 * L'instantane d'une entree, ampute de ce qui a vieilli.
 *
 * Deux horizons, parce que deux natures de donnees (voir {@link SNAPSHOT_TTL_MS} et
 * {@link SNAPSHOT_IDENTITY_TTL_MS}) :
 *
 *   - au-dela de trente jours, le statut, la date du prochain episode et la note du
 *     public disparaissent — ils ont pu changer ;
 *   - au-dela de six mois, l'instantane entier disparait — c'est le plafond
 *     contractuel.
 *
 * L'expiration est appliquee **ici, a la lecture**, et pas au moment de l'ecriture :
 * un journal peut dormir des mois dans un navigateur ferme, et il n'existe aucune
 * tache de fond pour faire le menage.
 *
 * ## ⚠️ Ce qui a change le 2026-08-03, et pourquoi
 *
 * La **forme** d'une serie — duree d'un episode, taille de ses saisons — survit desormais
 * aux trente jours, dans la limite du plafond contractuel comme tout le reste.
 *
 * Le premier decoupage rangeait ces deux champs avec le mouvant, ce qui rendait le bilan
 * de temps passe aveugle a toute serie non revisitee depuis un mois — c'est-a-dire
 * **precisement les series terminees**, celles qui pesent le plus lourd dans un bilan. Le
 * chiffre aurait ete un minorant si severe qu'il n'aurait plus rien mesure.
 *
 * C'est le meme defaut que celui trouve en verifiant la bibliotheque au navigateur, quand
 * un delai unique faisait retomber toute serie finie sur « Serie 1405 » : **un titre ne se
 * perime pas, un statut si.** Une duree d'episode non plus, et une saison passee non plus.
 * Seule la saison en cours grossit — donc l'erreur va vers la sous-estimation, ce qui est
 * le sens qu'on veut.
 */
export function freshSnapshot(
  entry: JournalEntry | undefined,
  now: Date = new Date(),
): JournalSnapshot | undefined {
  const snapshot = entry?.snapshot;
  if (snapshot === undefined) return undefined;

  const age = now.getTime() - new Date(snapshot.cachedAt).getTime();
  if (Number.isNaN(age) || age > SNAPSHOT_IDENTITY_TTL_MS) return undefined;
  if (age <= SNAPSHOT_TTL_MS) return snapshot;

  // Ne reste que ce qui ne se perime pas : l'identite de la serie, et sa forme.
  return {
    title: snapshot.title,
    cachedAt: snapshot.cachedAt,
    ...(snapshot.posterPath !== undefined ? { posterPath: snapshot.posterPath } : {}),
    ...(snapshot.episodeMinutes !== undefined
      ? { episodeMinutes: snapshot.episodeMinutes }
      : {}),
    ...(snapshot.seasonSizes !== undefined ? { seasonSizes: snapshot.seasonSizes } : {}),
  };
}

/** Les notes de saison d'une serie, sous la forme qu'attend le moteur de trajectoire. */
export function seasonScoresOf(
  journal: Journal,
  key: JournalKey,
): readonly { seasonNumber: number; stars: number }[] {
  const ratings = journal.entries[key]?.seasonRatings ?? {};
  return Object.entries(ratings)
    .map(([season, rating]) => ({ seasonNumber: Number(season), stars: rating.stars }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
}

/**
 * Moyenne des notes d'episode d'une saison, arrondie au demi-point.
 *
 * **Une suggestion, jamais une ecriture** (`AGENTS.md` regle 8 : on signale, on ne
 * repare pas en silence). Quelqu'un qui note six episodes d'une saison a manifestement
 * un avis sur la saison ; le lui proposer est utile, le decider a sa place ne l'est pas.
 */
export function suggestedSeasonRating(
  entry: JournalEntry | undefined,
  seasonNumber: number,
): Stars | undefined {
  const ratings = entry?.episodeRatings ?? {};
  const values = Object.entries(ratings)
    .filter(([cell]) => cell.startsWith(`${seasonNumber}:`))
    .map(([, rating]) => rating.stars);

  if (values.length === 0) return undefined;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const rounded = Math.round(mean * 2) / 2;
  return Math.min(5, Math.max(0.5, rounded)) as Stars;
}

// ---------------------------------------------------------------------------
// Fusion
// ---------------------------------------------------------------------------

/**
 * Une forme canonique et stable d'une valeur, pour departager deux faits ex aequo.
 *
 * Les cles sont triees : deux objets identiques ecrits dans un ordre different doivent
 * rendre la **meme** chaine, sans quoi le departage dependrait de l'ordre d'insertion —
 * c'est-a-dire, encore une fois, de l'appareil.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(',')}}`;
}

/**
 * Le plus recent de deux faits — et, a date egale, **toujours le meme des deux**.
 *
 * ## Le defaut que cette fonction a porte
 *
 * C'etait `dateOf(b) > dateOf(a) ? b : a` : un `>` strict, donc a date egale c'est la
 * **position des arguments** qui tranchait. `mergeJournals(A, B)` et
 * `mergeJournals(B, A)` rendaient alors deux resultats differents. Consequence sur deux
 * appareils : chacun fusionne la paire dans son propre ordre, chacun obtient un journal
 * different, chacun le renvoie a l'autre comme etant le bon — **un battement qui ne se
 * stabilise jamais**. Le pire des symptomes : une note qui change toute seule, par
 * intermittence, sans que rien dans l'interface ne l'explique.
 *
 * On croit volontiers l'egalite de date impossible « en pratique », a la milliseconde
 * pres. Elle ne l'est pas : c'est le cas **nominal** d'un import, ou de nombreux faits
 * recoivent la meme date de repli (voir {@link UNDATED}), et d'un geste qui ecrit
 * plusieurs champs dans le meme tour de boucle.
 *
 * Le departage par forme canonique est arbitraire — c'est assume, et c'est le point :
 * il n'existe aucune raison de preferer l'un des deux. Ce qu'on exige de lui n'est pas
 * d'avoir raison, c'est d'etre **total, deterministe et identique partout**, pour que la
 * fusion soit commutative et que les appareils convergent.
 */
function laterOf<T>(
  a: T | undefined,
  b: T | undefined,
  dateOf: (value: T) => string,
): T | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;

  const ta = new Date(dateOf(a)).getTime();
  const tb = new Date(dateOf(b)).getTime();
  // Une date illisible perd contre une date lisible ; si les deux le sont, on retombe
  // sur le departage canonique, jamais sur l'ordre des arguments.
  if (!Number.isNaN(ta) && Number.isNaN(tb)) return a;
  if (Number.isNaN(ta) && !Number.isNaN(tb)) return b;
  if (tb > ta) return b;
  if (ta > tb) return a;

  return canonical(b) > canonical(a) ? b : a;
}

/** Une valeur datee survit-elle a la pierre tombale qui la vise ? */
function survives(at: string | undefined, tombstone: string | undefined): boolean {
  if (at === undefined) return false;
  if (tombstone === undefined) return true;
  return new Date(at).getTime() >= new Date(tombstone).getTime();
}

/**
 * Fusionne deux tables de faits dates, indexees par cle.
 *
 * Une seule fonction pour les notes de saison, les notes d'episode et les marques : c'est
 * le seul endroit ou le `survives` peut se tromper, donc il ne doit exister qu'une fois.
 */
function mergeDated<T extends { readonly at: string }>(
  a: Readonly<Record<string, T>> | undefined,
  b: Readonly<Record<string, T>> | undefined,
  removed: JournalTombstones,
  field: (key: string) => string,
): Record<string, T> {
  const out: Record<string, T> = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    const winner = laterOf(a?.[key], b?.[key], (r) => r.at);
    if (winner !== undefined && survives(winner.at, removed[field(key)])) {
      out[key] = winner;
    }
  }
  return out;
}

/**
 * Union de deux seaux de champs inconnus.
 *
 * On ne peut pas departager par date : un champ dont on ignore la forme n'a pas de date
 * qu'on sache lire. Le conflit se tranche donc par {@link canonical}, exactement comme
 * `laterOf` tranche deux faits ex aequo — et pour la meme raison. Ce qu'on exige ici n'est
 * pas d'avoir raison sur le vainqueur, c'est d'etre **total, deterministe et identique sur
 * tous les appareils**, sans quoi deux telephones fusionnant la meme paire divergeraient
 * et se renverraient indefiniment des journaux differents.
 *
 * Ces trois proprietes suffisent a preserver les huit lois de `journal-merge.test.ts`.
 */
function mergeUnknown(
  a: Readonly<Record<string, unknown>> | undefined,
  b: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;

  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const left = a[key];
    const right = b[key];
    if (!(key in a)) out[key] = right;
    else if (!(key in b)) out[key] = left;
    else out[key] = canonical(right) > canonical(left) ? right : left;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mergeTombstones(a: JournalTombstones, b: JournalTombstones): JournalTombstones {
  const out: Record<string, string> = { ...a };
  for (const [field, at] of Object.entries(b)) {
    const current = out[field];
    if (current === undefined || new Date(at).getTime() > new Date(current).getTime()) {
      out[field] = at;
    }
  }
  return out;
}

function mergeEntries(a: JournalEntry, b: JournalEntry): JournalEntry {
  const removed = mergeTombstones(a.removed ?? {}, b.removed ?? {});

  const position = laterOf(a.position, b.position, (p) => p.declaredAt);
  const decisionWinner = laterOf(a.decision, b.decision, (d) => d.at);
  const decision = survives(decisionWinner?.at, removed['decision'])
    ? decisionWinner
    : undefined;
  const wantedWinner = laterOf(a.wanted, b.wanted, (w) => w.at);
  const wanted = survives(wantedWinner?.at, removed['wanted']) ? wantedWinner : undefined;
  // ⚠️ Pierre tombale `liked`, surtout pas `wanted` : retirer un coeur retirerait sinon
  // « je veux la voir » du meme geste.
  const likedWinner = laterOf(a.liked, b.liked, (l) => l.at);
  const liked = survives(likedWinner?.at, removed['liked']) ? likedWinner : undefined;
  const snapshot = laterOf(a.snapshot, b.snapshot, (s) => s.cachedAt);

  // Union, et non « le plus recent gagne » : un visionnage acheve sur un appareil ne
  // peut pas etre invalide par un autre. C'est un ensemble, donc la fusion est
  // commutative, associative et idempotente sans rien faire de plus.
  const completions = dedupeByDay([...(a.completions ?? []), ...(b.completions ?? [])]);

  const seasonRatings = mergeDated(a.seasonRatings, b.seasonRatings, removed, (k) => `season:${k}`);
  const episodeRatings = mergeDated(
    a.episodeRatings,
    b.episodeRatings,
    removed,
    (k) => `episode:${k}`,
  );
  // ⚠️ Prefixe `mark:` et surtout pas `episode:`, deja pris par la note d'episode :
  // effacer une note effacerait sinon la marque du meme episode, du meme geste.
  const episodeMarks = mergeDated(a.episodeMarks, b.episodeMarks, removed, (k) => `mark:${k}`);
  const reviews = mergeDated(a.reviews, b.reviews, removed, (k) => `review:${k}`);
  const unknownFields = mergeUnknown(a.unknownFields, b.unknownFields);

  return {
    ...(position !== undefined ? { position } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(wanted !== undefined ? { wanted } : {}),
    ...(liked !== undefined ? { liked } : {}),
    ...(completions.length > 0 ? { completions } : {}),
    ...(snapshot !== undefined ? { snapshot } : {}),
    ...(Object.keys(seasonRatings).length > 0 ? { seasonRatings } : {}),
    ...(Object.keys(episodeRatings).length > 0 ? { episodeRatings } : {}),
    ...(Object.keys(episodeMarks).length > 0 ? { episodeMarks } : {}),
    ...(Object.keys(reviews).length > 0 ? { reviews } : {}),
    ...(Object.keys(removed).length > 0 ? { removed } : {}),
    ...(unknownFields !== undefined ? { unknownFields } : {}),
  };
}

/**
 * Fusionne deux journaux, **champ par champ**.
 *
 * C'est la decision n°2 en tete de module, et la raison d'etre des dates portees par
 * chaque fait. Fusionner document contre document — « le plus recent gagne » applique
 * au journal entier — perdrait tout le travail de l'appareil le moins recemment
 * touche : noter une saison sur le telephone effacerait la position posee sur
 * l'ordinateur le matin meme.
 *
 * Sert deja aujourd'hui, sans aucun compte : c'est l'import de fichier qui **complete**
 * un journal existant au lieu de l'ecraser. Servira tel quel a la synchronisation.
 */
export function mergeJournals(a: Journal, b: Journal): Journal {
  const entries: Record<JournalKey, JournalEntry> = {};
  const keys = new Set([...Object.keys(a.entries), ...Object.keys(b.entries)]);

  for (const key of keys) {
    const left = a.entries[key];
    const right = b.entries[key];
    const merged =
      left === undefined ? right : right === undefined ? left : mergeEntries(left, right);
    if (merged !== undefined && worthKeeping(merged)) entries[key] = merged;
  }

  // Les plateformes ne sont pas datees : on garde la liste la plus fournie plutot que
  // d'en perdre. Une preference declaree deux fois n'a jamais fait de mal.
  const platforms = [
    ...new Set([...(a.platforms ?? []), ...(b.platforms ?? [])]),
  ];

  const unknownFields = mergeUnknown(a.unknownFields, b.unknownFields);

  return {
    // Le maximum des deux, pour la meme raison qu'a la lecture : le resultat porte les
    // champs des deux versions, donc annoncer la plus basse serait faux.
    version: Math.max(a.version, b.version),
    entries,
    // L'appareil local garde son identite : c'est *son* journal qui accueille l'autre.
    ...(a.deviceId !== undefined ? { deviceId: a.deviceId } : {}),
    ...(platforms.length > 0 ? { platforms } : {}),
    ...(unknownFields !== undefined ? { unknownFields } : {}),
  };
}

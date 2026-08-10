/**
 * Le nom public d'un compte, et ce qu'il n'a pas le droit d'etre.
 *
 * ## Pourquoi ce module existe avant qu'il y ait des comptes
 *
 * **Un handle attribue ne se retire pas.** C'est une URL — `/@marie` — donc un lien
 * partage, une capture d'ecran, un signet. Le jour ou l'on decouvre que `@moi` entre en
 * collision avec une route, ou que quelqu'un s'est fait passer pour une chaine, il est
 * trop tard : le retirer casse ce qui pointait dessus, le garder laisse le probleme.
 *
 * C'est la meme famille de decision que les quatre precedentes du journal — ecrite tot
 * parce qu'elle est irreparable, pas parce qu'elle presse.
 *
 * ## Les trois risques, et leur reponse
 *
 * 1. **La collision de route.** `/@calendrier` et `/calendrier` ne peuvent pas coexister
 *    sereinement. Les noms de faces et de pages sont donc reserves.
 * 2. **L'usurpation par homoglyphe.** `а` (cyrillique) et `a` (latin) sont visuellement
 *    identiques : `@nеtflix` ecrit avec un `е` cyrillique passerait pour l'original aux
 *    yeux de n'importe qui. D'ou un jeu de caracteres **restreint a l'ASCII**, qui rend
 *    l'attaque impossible plutot que difficile a detecter.
 * 3. **L'usurpation par heritage.** Un handle libere et repris fait heriter son nouveau
 *    proprietaire de tous les liens de l'ancien. La liberation ne remet donc jamais un
 *    handle en circulation — c'est a l'appelant de conserver les anciens, ce module dit
 *    seulement qu'ils comptent comme pris.
 *
 * Module **pur** : ni reseau, ni horloge, ni base. Il decrit une regle, il ne consulte
 * rien — c'est ce qui permet de la tester entierement avant qu'un seul compte existe.
 */

/** Longueurs admises. Trois caracteres au minimum : en dessous, tout se ressemble. */
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;

/**
 * Les caracteres admis : minuscules ASCII, chiffres, tiret bas.
 *
 * Volontairement etroit. Autoriser l'Unicode serait plus accueillant pour les alphabets
 * non latins — et rendrait l'usurpation par homoglyphe **indetectable**. Entre les deux,
 * on choisit ce qui protege ; un nom d'affichage libre (`display_name`) porte le reste,
 * sans jamais servir d'identifiant.
 */
const HANDLE_PATTERN = /^[a-z0-9_]+$/;

/**
 * Ce qu'un handle ne peut pas etre.
 *
 * Trois familles, et chacune repare une faute differente :
 *
 * - **les routes du site** — sans quoi un profil masque une page, ou l'inverse ;
 * - **les mots d'autorite** — `admin`, `support`, `staff` : ils font croire a une parole
 *   officielle, et c'est le vecteur d'hameconnage le plus simple qui soit ;
 * - **les marques du domaine** — personne ne doit pouvoir se faire passer pour un
 *   diffuseur.
 *
 * ⚠️ Cette liste doit etre complete **avant la premiere inscription**. Ajouter un mot
 * apres coup ne retire pas le handle deja attribue a quelqu'un.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  // Les routes existantes et les faces, presentes comme a venir.
  // ⚠️ Seuls les noms qui **pourraient** etre un handle figurent ici. `hors-ligne` porte
  // un tiret, donc le motif le refuse deja : le reserver en plus laisserait croire a une
  // protection qui n'a jamais servi. Une liste de reserves doit etre exactement aussi
  // longue que necessaire, sinon on cesse de la relire.
  'moi', 'serie', 'series', 'recherche', 'convertir', 'calendrier', 'bilan',
  'listes', 'amis', 'mentions', 'confidentialite',
  'search', 'library', 'calendar', 'tally', 'lists', 'friends', 'legal', 'privacy',
  // Les routes du compte, ajoutees avec elles (2026-08-03). ⚠️ L'avertissement de ce
  // module s'applique : **avant** la premiere inscription. Un handle deja attribue ne se
  // retire pas sans casser une URL, et `/compte` est un chemin reel depuis ce jour.
  'compte', 'account', 'auth', 'connexion', 'login', 'logout', 'deconnexion',
  'signaler', 'report', 'profil', 'profile', 'regles', 'rules',
  // ⚠️ `u` n'est PAS ici : trois caracteres minimum, donc il ne pourrait jamais etre pris.
  // Le test l'a attrape — meme bruit que `sw` et `hors-ligne`, retires pour la meme
  // raison. Une reserve inutile laisse croire a une protection qui n'a jamais servi.
  // Les chemins techniques.
  'api', 'www', 'app', 'static', 'assets', 'public', 'icons', 'robots', 'sitemap',
  'manifest', 'null', 'undefined',
  // Les mots d'autorite.
  'admin', 'administrator', 'support', 'staff', 'team', 'help', 'contact', 'root',
  'moderator', 'moderation', 'official', 'system', 'security', 'abuse', 'legal_team',
  // Le produit lui-meme.
  'voltface', 'seasoned',
  // Les marques les plus evidentes du domaine. Liste non exhaustive par nature : elle
  // arrete l'usurpation paresseuse, pas un adversaire determine — c'est le signalement
  // (`reports`) qui traite le reste.
  'netflix', 'disney', 'hbo', 'max', 'prime', 'hulu', 'apple', 'paramount', 'peacock',
  'crunchyroll', 'canal', 'arte', 'tmdb', 'imdb', 'letterboxd', 'trakt', 'tvtime',
]);

/** Pourquoi un handle est refuse. Un code, pas une phrase : le texte vit dans l'i18n. */
export type HandleRejection =
  | 'too_short'
  | 'too_long'
  | 'invalid_characters'
  | 'reserved';

export type HandleCheck =
  | { readonly ok: true; readonly handle: string }
  | { readonly ok: false; readonly reason: HandleRejection };

/**
 * Verifie un handle, et rend sa forme canonique.
 *
 * La normalisation precede la verification : `  Marie  ` et `marie` sont **le meme
 * handle**, et deux comptes ne doivent jamais pouvoir exister sous des ecritures qui se
 * lisent pareil. C'est aussi ce qui rend la liste de reserves efficace — sans elle,
 * `Admin` passerait a cote de `admin`.
 *
 * @param raw ce que l'utilisateur a tape, tel quel.
 * @param taken handles deja pris **ou liberes** : les seconds restent indisponibles, sans
 *   quoi leur repreneur heriterait des liens de leur ancien proprietaire.
 */
export function checkHandle(raw: string, taken: ReadonlySet<string> = new Set()): HandleCheck {
  const handle = raw.trim().toLowerCase();

  if (handle.length < HANDLE_MIN_LENGTH) return { ok: false, reason: 'too_short' };
  if (handle.length > HANDLE_MAX_LENGTH) return { ok: false, reason: 'too_long' };
  // Le motif est verifie **apres** la longueur : « le nom est trop court » est plus utile
  // que « caracteres invalides » a quelqu'un qui a tape deux lettres.
  if (!HANDLE_PATTERN.test(handle)) return { ok: false, reason: 'invalid_characters' };
  if (RESERVED_HANDLES.has(handle) || taken.has(handle)) {
    return { ok: false, reason: 'reserved' };
  }

  return { ok: true, handle };
}

/**
 * Age minimum pour ouvrir un compte seul.
 *
 * ⚖️ Seize ans : le seuil de reference du RGPD pour le consentement numerique autonome.
 * Les Etats membres peuvent l'abaisser — la France retient quinze ans — et **retenir le
 * plus eleve est le choix sur** : il vaut partout ou le produit est servi, ce qui compte
 * pour un produit qui vise l'international des le depart (A9).
 *
 * ⚠️ **Ceci n'est pas un avis juridique.** A faire confirmer avant l'ouverture des
 * comptes, comme tout ce qui porte cette marque dans.
 *
 * Declaratif, et **aucune date de naissance n'est collectee** : un age exact serait une
 * donnee de plus a proteger pour un gain nul — on ne verifie pas davantage.
 */
export const MINIMUM_AGE = 16;

/**
 * Nature d'un programme.
 *
 * Tout ce que les fournisseurs appellent « serie TV » ne se prete pas aux questions
 * que pose ce produit. Constate en production le 2026-08-01 : la rangee « En attente »
 * remontait *Tagesschau* — le journal televise allemand, diffuse depuis 1952 — et
 * *Paradise Hotel*. « Depuis combien de temps attendez-vous la suite ? » n'a aucun sens
 * pour un programme en flux continu.
 *
 * Notion de **domaine**, pas de fournisseur : les identifiants de genre TMDB restent
 * dans `src/catalog/tmdb.ts`, qui les traduit vers ce type. C'est ce qui permet de
 * changer de catalogue sans reecrire la regle.
 */
export type ProgramKind =
  /** Fiction ecrite, decoupee en saisons. Le coeur du produit. */
  | 'scripted'
  /** Documentaire, souvent en saisons — se prete bien au modele. */
  | 'documentary'
  /** Telerealite. Saisons reelles, mais la « trajectoire de qualite » y veut peu dire. */
  | 'reality'
  /** Journal televise. Flux continu, aucune notion de saison. */
  | 'news'
  /** Talk-show quotidien. Idem. */
  | 'talk'
  /** Feuilleton / telenovela : des milliers d'episodes, pas de saisons exploitables. */
  | 'soap'
  /** Le fournisseur n'a rien dit. */
  | 'unknown';

/**
 * Ce qu'on met en avant dans les listes de decouverte.
 *
 * **Filtre la vitrine, pas le catalogue.** Une page serie reste accessible pour
 * n'importe quel programme si quelqu'un la cherche — on ne retire rien, on choisit ce
 * qu'on propose. C'est la meme regle que pour les saisons : on signale, on ne supprime
 * pas en silence.
 *
 * `unknown` passe : mieux vaut montrer une fiction mal etiquetee que masquer par exces
 * de zele un programme sur lequel le fournisseur n'a rien dit.
 */
const SHOWCASED: ReadonlySet<ProgramKind> = new Set<ProgramKind>([
  'scripted',
  'documentary',
  'unknown',
]);

/**
 * Ce programme a-t-il sa place dans une liste mise en avant ?
 *
 * La telerealite est le cas discutable : elle a de vraies saisons et un public qui les
 * suit. Elle est ecartee parce que les questions du produit — « jusqu'ou reste-t-elle
 * bonne », « ca vaut combien d'heures » — ne s'y appliquent guere. **Decision revisable
 * en une ligne** ; c'est pourquoi elle vit ici et pas dispersee dans les pages.
 */
export function isShowcased(kind: ProgramKind): boolean {
  return SHOWCASED.has(kind);
}

/**
 * Nature retenue pour un programme portant plusieurs genres.
 *
 * Une fiction est souvent aussi etiquetee « drame » ou « comedie » ; un journal ne l'est
 * jamais. On applique donc la nature **la plus disqualifiante** : un programme etiquete
 * a la fois `scripted` et `news` est un programme d'information.
 */
const PRECEDENCE: readonly ProgramKind[] = [
  'news',
  'talk',
  'soap',
  'reality',
  'documentary',
  'scripted',
];

export function dominantKind(kinds: readonly ProgramKind[]): ProgramKind {
  for (const candidate of PRECEDENCE) {
    if (kinds.includes(candidate)) return candidate;
  }
  return 'unknown';
}

/**
 * La procedure de moderation : ce qu'on retire, pourquoi, et ce qu'on doit a chacun.
 *
 * > ⚖️ **Je ne suis pas une source juridique.** Ce module encode une **procedure**, pas une
 * > conformite. Le cadre general vient du DSA (mecanisme de signalement, retrait, expose des
 * > motifs, point de contact) ; le texte publie et l'adequation au droit sont a faire relire
 * > par quelqu'un dont c'est le metier. Ce qui est certain, c'est qu'improviser au moment ou
 * > le premier signalement arrive est la pire des options.
 *
 * ## Pourquoi ce module existe **avant** qu'il y ait quoi que ce soit a moderer
 *
 * C'est `TASKS.md` 5.0, ⛔ bloquant, et c'est le verrou qui tient tout le social : profils
 * publics, fil d'activite, listes, avatars, et jusqu'aux cosmetiques d'A6 — qui n'ont de
 * valeur que s'ils sont **vus**.
 *
 * L'ordre n'est pas negociable : **le dispositif d'abord, le contenu ensuite.** Un espace de
 * commentaires ouvert sans procedure oblige a l'inventer sous pression, le jour ou quelqu'un
 * signale quelque chose — c'est-a-dire au pire moment, et pour une personne seule.
 *
 * ## Les trois decisions que ce module fige
 *
 * **1. On masque, on ne supprime jamais.** Un retrait rend invisible et laisse une trace.
 * Supprimer rendrait une erreur irreparable et une contestation inexaminable : on ne peut pas
 * rendre a quelqu'un ce qu'on a efface. C'est la meme regle que les traces de suppression du
 * journal, et le meme principe qu'`AGENTS.md` regle 8 — *on signale, on ne repare jamais en
 * silence*.
 *
 * **2. Tout retrait porte un motif TYPE, jamais seulement du texte libre.** Ce n'est pas de la
 * bureaucratie : une personne seule ne peut pas rediger une explication sur mesure a chaque
 * fois. Un motif type se **gabarise**, donc l'auteur recoit toujours une explication, meme le
 * jour ou l'on n'a pas le temps. Le texte libre reste possible **en plus**, jamais a la place.
 *
 * **3. L'auteur est informe, et il peut contester.** Une moderation sans voie de recours est
 * une moderation qui ne se corrige pas — et le premier a se tromper sera nous.
 *
 * Module pur : ni reseau, ni horloge implicite, ni stockage. L'instant est injecte.
 */

// ---------------------------------------------------------------------------
// Ce qu'on peut signaler, et pourquoi
// ---------------------------------------------------------------------------

/**
 * Les motifs de signalement, **fermes**.
 *
 * ## Pourquoi une liste fermee plutot qu'un champ libre
 *
 * Trois raisons, dans l'ordre d'importance :
 *
 * 1. **Un motif type se traite ; une plainte en prose se lit.** A dix signalements par jour,
 *    la difference decide si le dispositif tient ou s'effondre.
 * 2. **Elle rend l'expose des motifs automatique** — voir {@link statementOfReasons}.
 * 3. **Elle dit d'avance ce qui est interdit.** Une liste de motifs *est* la politique, sous
 *    une autre forme : ce qui n'y figure pas ne se retire pas.
 *
 * Le champ libre existe, mais il **complete** un motif — il ne le remplace pas.
 *
 * ⚠️ Cette liste est courte **exprès**. Chaque motif ajoute est un jugement de plus a rendre,
 * et une personne seule ne peut pas arbitrer finement. Mieux vaut cinq motifs qu'on sait
 * traiter que quinze qu'on subit.
 */
export type ReportGround =
  /** Contenu illicite au sens le plus large : ce qui releve de la loi, pas de nos gouts. */
  | 'illegal'
  /** Harcelement, menace, incitation a la haine — vise une personne. */
  | 'abuse'
  /** Spam, publicite, contenu automatise. */
  | 'spam'
  /** Divulgation de la vie privee d'autrui : adresse, identite, image. */
  | 'privacy'
  /**
   * Revele l'intrigue au-dela de ce qui est annonce.
   *
   * ⚠️ **Propre a ce produit, et il fallait le prevoir** : ailleurs un spoiler est une
   * impolitesse ; ici c'est une atteinte a la promesse centrale (`AGENTS.md` regle 7, contrainte
   * de niveau 1). Le laisser hors de la liste reviendrait a dire qu'on ne le retire pas.
   */
  | 'spoiler';

/** Tous les motifs, pour construire un formulaire sans en oublier. */
export const REPORT_GROUNDS: readonly ReportGround[] = [
  'illegal',
  'abuse',
  'privacy',
  'spam',
  'spoiler',
];

/**
 * Ce sur quoi porte un signalement.
 *
 * Volontairement **polymorphe** : le dispositif doit exister avant les contenus, donc il ne
 * peut pas connaitre leur liste. Une critique, un profil, une liste, un avatar se signalent de
 * la meme facon, et un type ajoute plus tard n'oblige a rien reecrire.
 */
export interface ReportSubject {
  readonly kind: string;
  readonly id: string;
}

/** Un signalement recu. */
export interface Report {
  readonly subject: ReportSubject;
  readonly ground: ReportGround;
  /** Precision facultative du signalant. Complete le motif, ne le remplace jamais. */
  readonly detail?: string;
  readonly receivedAt: Date;
}

// ---------------------------------------------------------------------------
// Le delai
// ---------------------------------------------------------------------------

/**
 * Delai que l'on s'engage a tenir pour repondre a un signalement, en heures.
 *
 * **72 h**, et c'est un choix de personne seule, pas une norme : c'est le delai qu'on peut
 * tenir en etant absent un week-end. Annoncer 24 h serait une promesse qu'un seul deplacement
 * casse — et une promesse de moderation non tenue est pire que pas de promesse, parce qu'elle
 * est verifiable par celui qui attend.
 *
 * ⚠️ Les contenus signales `illegal` ou `abuse` ne s'accommodent pas d'un delai confortable :
 * voir {@link isUrgent}.
 */
export const REVIEW_DEADLINE_HOURS = 72;

/**
 * Motifs qui appellent un examen **immediat**, sans attendre le delai ordinaire.
 *
 * Ce sont ceux dont le prejudice grandit avec le temps : une adresse personnelle publiee ou
 * une menace font des degats a chaque heure. Un spoiler ou un spam, non — ils sont penibles,
 * ils ne s'aggravent pas.
 */
export function isUrgent(ground: ReportGround): boolean {
  return ground === 'illegal' || ground === 'abuse' || ground === 'privacy';
}

/** L'instant avant lequel un signalement doit avoir recu une reponse. */
export function reviewDeadline(report: Report): Date {
  const hours = isUrgent(report.ground) ? 0 : REVIEW_DEADLINE_HOURS;
  return new Date(report.receivedAt.getTime() + hours * 3_600_000);
}

/** Vrai si le delai est depasse — donc s'il faut traiter celui-la avant les autres. */
export function isOverdue(report: Report, now: Date): boolean {
  return now.getTime() > reviewDeadline(report).getTime();
}

/**
 * Les signalements a traiter, du plus urgent au moins urgent.
 *
 * L'ordre n'est pas cosmetique : c'est la seule chose qui empeche une file de dix
 * signalements de faire passer un spoiler avant une menace. Depasse d'abord, puis urgent, puis
 * le plus ancien — et jamais l'ordre d'arrivee seul.
 */
export function triage(reports: readonly Report[], now: Date): readonly Report[] {
  return [...reports].sort((a, b) => {
    const overdue = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
    if (overdue !== 0) return overdue;
    const urgent = Number(isUrgent(b.ground)) - Number(isUrgent(a.ground));
    if (urgent !== 0) return urgent;
    return a.receivedAt.getTime() - b.receivedAt.getTime();
  });
}

// ---------------------------------------------------------------------------
// La decision, et ce qu'on doit a l'auteur
// ---------------------------------------------------------------------------

/** Ce que l'on decide d'un signalement. */
export type ModerationOutcome =
  /** Le contenu reste. Le signalant est informe, l'auteur n'a pas a l'etre. */
  | 'kept'
  /** Le contenu est **masque**. Reversible, trace, et l'auteur doit etre informe. */
  | 'hidden';

/** Une decision rendue. */
export interface ModerationDecision {
  readonly subject: ReportSubject;
  readonly outcome: ModerationOutcome;
  readonly ground: ReportGround;
  readonly decidedAt: Date;
  /** Precision du moderateur, facultative — elle **complete** le motif type. */
  readonly note?: string;
}

/**
 * L'expose des motifs du a l'auteur d'un contenu masque.
 *
 * ## Pourquoi une structure et pas une chaine
 *
 * Parce que le texte doit exister **dans la langue de l'auteur**, et que le domaine est muet
 * (`AGENTS.md` regle 2 — `src/domain/` n'importe rien de `lib/i18n.ts`, et A9 en fait une
 * regle produit). Ce module decide **ce qui doit etre dit** ; l'interface decide **comment**.
 *
 * Meme raisonnement que partout ici : le domaine produit des faits, la couche de rendu produit
 * des phrases.
 */
export interface StatementOfReasons {
  readonly subject: ReportSubject;
  /** Le motif type — la raison, gabarisable dans n'importe quelle langue. */
  readonly ground: ReportGround;
  readonly decidedAt: Date;
  /** Le retrait est-il reversible ? Toujours vrai ici : on masque, on ne supprime pas. */
  readonly reversible: true;
  /** L'auteur peut-il contester ? Toujours vrai — une moderation sans recours ne se corrige pas. */
  readonly contestable: true;
  readonly note?: string;
}

/**
 * Ce qu'on doit dire a l'auteur, ou `undefined` s'il n'y a rien a lui dire.
 *
 * Rend `undefined` quand le contenu est **garde** : informer quelqu'un qu'il a ete signale
 * sans que rien ne lui soit reproche ne protege personne et lui apprend qu'on l'a vise. Le
 * signalant, lui, est informe dans les deux cas — c'est lui qui attend une reponse.
 */
export function statementOfReasons(
  decision: ModerationDecision,
): StatementOfReasons | undefined {
  if (decision.outcome !== 'hidden') return undefined;
  return {
    subject: decision.subject,
    ground: decision.ground,
    decidedAt: decision.decidedAt,
    reversible: true,
    contestable: true,
    ...(decision.note !== undefined && decision.note.trim().length > 0
      ? { note: decision.note.trim() }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// La visibilite
// ---------------------------------------------------------------------------

/**
 * Etat de visibilite d'un contenu de tiers.
 *
 * `hidden` n'est **pas** une suppression : l'objet existe encore, son auteur le voit, et une
 * contestation peut etre examinee sur piece. C'est ce qui rend une erreur de moderation
 * rattrapable — et la premiere erreur sera la notre.
 */
export interface Visibility {
  readonly hidden: boolean;
  readonly hiddenAt?: Date;
  readonly ground?: ReportGround;
}

/** Visible, l'etat par defaut de tout contenu. */
export const VISIBLE: Visibility = { hidden: false };

/** Applique une decision a la visibilite d'un contenu. */
export function applyDecision(decision: ModerationDecision): Visibility {
  if (decision.outcome !== 'hidden') return VISIBLE;
  return { hidden: true, hiddenAt: decision.decidedAt, ground: decision.ground };
}

/**
 * Retablit un contenu masque a tort.
 *
 * Existe pour une seule raison, et elle vaut d'etre ecrite : **la voie de recours doit avoir
 * une mecanique, sinon elle n'est qu'une phrase dans une page de regles.** Un dispositif qui
 * sait retirer mais pas rendre n'est pas un dispositif de moderation, c'est un dispositif de
 * censure.
 */
export function restore(): Visibility {
  return VISIBLE;
}

/**
 * Ce qu'un tiers doit voir d'un contenu masque : rien.
 *
 * Le filtrage vit **ici**, dans le domaine, et pas a l'affichage — meme raison que
 * `spoiler.ts` : un filtre pose au rendu laisse fuir le contenu par les agregats, les
 * compteurs, les exports et les fils. C'est la lecon deja apprise une fois sur la trajectoire.
 */
export function visibleToOthers<T>(item: T, visibility: Visibility): T | undefined {
  return visibility.hidden ? undefined : item;
}

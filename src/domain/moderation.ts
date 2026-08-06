/**
 * Ce qu'on retire, et sous quel delai.
 *
 * > ⚖️ Ce module n'encode pas une conformite juridique. Le texte publie sur `/regles` est a
 * > faire relire par quelqu'un dont c'est le metier.
 *
 * ## Pourquoi c'est si court
 *
 * Ce qui doit exister avant tout contenu de tiers, c'est la **politique publiee** — la liste
 * de ce qui est retire et le delai annonce. C'est elle qui rend un retrait legitime : retirer
 * sans avoir dit d'avance ce qui est interdit, c'est de l'arbitraire.
 *
 * Le reste — file d'attente, tri par urgence, exposé des motifs, retablissement — n'est
 * toujours pas ecrit, et c'est **toujours** le bon choix : une premiere version de ce module
 * les avait ecrits pour un flux de travail qui n'existait pas, la meme erreur que creer une
 * table `reports` « pendant qu'on y est » (`supabase/001_journal.sql`). Ils s'ecriront quand
 * il y aura un volume a traiter, pas quand il y a un contenu a traiter.
 *
 * ⚠️ **Ce paragraphe disait « il n'existe aujourd'hui aucun contenu de tiers » jusqu'au
 * 2026-08-07, et c'etait faux depuis le lot 8** : les critiques publiques, les profils et le
 * fil sont livres, et `ReportButton` est monte a deux endroits. La justification tenait par
 * une absence qui n'existait plus — donc elle justifiait le contraire de ce qu'elle croyait.
 * La meme phrase etait **publiee sur `/regles`**, ou elle annoncait au public qu'il n'y avait
 * ni profil ni commentaire : elle en a ete retiree le meme jour.
 *
 * Les promesses de procedure — *on masque sans supprimer*, *l'auteur est informe*, *il peut
 * contester* — vivent pour l'instant dans le **texte** de `/regles`, ou elles engagent. Elles
 * deviendront du code le jour ou il y aura quelque chose a masquer.
 *
 * Module pur : ni reseau, ni horloge, ni stockage.
 */

/**
 * Les motifs de retrait, **fermes**.
 *
 * Cette liste **est** la politique : ce qui n'y figure pas ne se retire pas. Elle est courte
 * exprès — chaque motif ajoute est un jugement de plus a rendre, et une personne seule ne peut
 * pas arbitrer finement.
 *
 * `spoiler` est propre a ce produit et il fallait y penser : ailleurs c'est une impolitesse,
 * ici c'est une atteinte a la promesse centrale (`AGENTS.md` regle 7). L'omettre aurait dit
 * qu'on ne le retire pas.
 */
export type ReportGround = 'illegal' | 'abuse' | 'privacy' | 'spam' | 'spoiler';

/**
 * Tous les motifs, pour que `/regles` les publie sans risque d'en oublier un.
 *
 * L'ordre est celui de la gravite. Il sert d'affichage aujourd'hui, et servira de priorite
 * de traitement le jour ou il y aura une file.
 */
export const REPORT_GROUNDS: readonly ReportGround[] = [
  'illegal',
  'abuse',
  'privacy',
  'spam',
  'spoiler',
];

/**
 * Delai annonce pour repondre a un signalement, en heures.
 *
 * **72 h**, et c'est un choix de personne seule, pas une norme : c'est le delai qu'on tient en
 * etant absent un week-end. Annoncer 24 h serait une promesse qu'un seul deplacement casse — et
 * une promesse de moderation non tenue est **verifiable par celui qui attend**.
 */
export const REVIEW_DEADLINE_HOURS = 72;

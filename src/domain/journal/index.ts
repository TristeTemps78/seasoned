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
 * qu'attend :
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
 *    Un changement de catalogue — probable, — devient un remappage
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
 * **deploye** un lecteur qui sait faire ce pass-through. Ecrit ici et pas ailleurs,
 * parce que c'est ici qu'on le lit au moment de le faire. Ce que coutait l'inverse est
 * raconte dans {@link tryParseJournal}.
 */


export * from './types';
export * from './entry';
export * from './parse';
export * from './write';
export * from './derive';
export * from './merge';

/**
 * La face — **ce que votre facon de regarder dit de vous**, et qui se decouvre.
 *
 * ## D'ou elle vient
 *
 * De l'idee de Tristan « des equipes comme Pokemon GO » (2026-08-06), **retournee** : on ne
 * choisit pas sa face, on la merite. Une face choisie ne dit rien de personne ; une face
 * calculee sur un journal est **structurellement incopiable** — il faut *le votre*.
 *
 * Trois, pas quatre : le logo a trois faces colorees, et une quatrieme exigerait une couleur
 * qui n'existe nulle part.
 *
 * ## 🔴 Les quatre pieges, tous trouves par Tristan AVANT l'ecriture
 *
 * Ils sont consignes ici parce qu'ils expliquent la seule chose qui compte dans ce module :
 * **le choix de la matiere**.
 *
 * 1. **Le biais de survie.** On se souvient de ce qu'on a fini, pas de ce qu'on a lache a
 *    S1E3. Une saisie d'historique penche donc vers l'achevement, et *tout le monde
 *    arriverait rouge*.
 * 2. **« 10 series nouvelles » ne le regle pas** : ca compte des *saisies*, pas des
 *    *parcours*. Vingt series entrees d'un bloc restent vingt souvenirs.
 * 3. **L'ecart position → decision non plus.** *Personne ne met son tracker a jour en temps
 *    reel* : celui qui a vraiment enchaine deux series en quinze jours pose position et
 *    decision dans le meme geste, exactement comme celui qui declare un souvenir de 2019.
 * 4. **Et l'import fabrique le meme geste**, donc toute regle fondee sur la nature du geste
 *    s'effondre devant un export TV Time.
 *
 * ## La reponse : ne compter que ce qu'un import ne peut pas fabriquer
 *
 * Pas d'heuristique de plus — une **matiere** differente. Ce module ne regarde que
 * {@link JournalDecision} et {@link JournalCompletion} : *j'ai fini*, *j'ai laisse tomber*,
 * *je l'ai revue*. Ce sont des **evenements**, et `importForeign` n'en ecrit aucun (verifie
 * le 2026-08-10 : il n'ecrit que `wanted`, `position` et `seasonRatings`).
 *
 * Ce qui est volontairement **exclu** :
 *
 * - **les notes** — un jugement peut porter sur quelque chose vu il y a dix ans ; la
 *   distinction entre *dater un fait* et *exprimer un avis* est celle de Letterboxd, et elle
 *   existait ici dans `LogEntry` avant d'etre retiree comme code mort (*le code etait mort,
 *   la pensee non*) ;
 * - **tout fait portant `origin`** — la ceinture, apres les bretelles. Elle ne sert a rien
 *   aujourd'hui puisque l'import n'ecrit pas ces faits-la ; elle servira le jour ou il
 *   apprendra a lire un abandon, et ce jour-la il sera trop tard pour l'ajouter.
 *
 * ## La fenetre glissante, et pourquoi elle n'est pas un detail
 *
 * Les {@link FACE_WINDOW} derniers faits, **jamais les premiers**. Une face calculee sur
 * tout l'historique se fige : quelqu'un qui a fini trente series en cinq ans et n'en finit
 * plus une seule resterait rouge pour toujours. Or **basculer *est* le produit** — c'est
 * litteralement ce que « volte-face » veut dire.
 *
 * Module **pur** : ni reseau, ni horloge implicite, n'importe que ses voisins. Il part donc
 * tel quel sur iOS et Android (A11).
 */

import { isSeriesKey, type Journal, type JournalKey } from './journal';

/**
 * Les trois faces.
 *
 * ## ⚠️ Des noms, pas des couleurs — et c'est une decision
 *
 * Le reflexe serait `'red' | 'blue' | 'yellow'`, puisque c'est ainsi qu'on les reconnait. Ce
 * serait ranger une **presentation** dans une donnee durable, et ce depot a deja paye
 * exactement ca : `JournalSnapshot.statusLabel` memorisait le statut *deja traduit*, si bien
 * qu'un `/moi` en anglais annoncait « Entre deux saisons ». Le jour ou la palette bouge — et
 * le lot 9 est ouvert precisement pour ca — `red` en base deviendrait un mensonge.
 *
 * La couleur vit donc dans le CSS, le nom public dans le dictionnaire, et **seul ceci** va
 * en base et sur le reseau.
 */
export type FaceId = 'finisher' | 'cutter' | 'rewatcher';

/**
 * Combien de faits recents la face regarde.
 *
 * Dix n'a rien de magique. Ce qui compte est que la fenetre soit **courte devant une vie de
 * spectateur** : c'est elle qui rend la bascule possible.
 */
export const FACE_WINDOW = 10;

/**
 * En dessous de combien de faits on ne dit **rien**.
 *
 * Meme regle que `MIN_SERIES_FOR_TASTE` (`taste.ts`), et pour la meme raison, qui vaut d'etre
 * repetee : *un profil calcule sur trois series est du bruit presente comme un fait*.
 * Annoncer une identite a quelqu'un qui a fini une serie serait pire qu'inutile — ce serait
 * faux, et il le saurait.
 */
export const MIN_FACTS_FOR_FACE = 5;

export interface Face {
  readonly id: FaceId;
  /** Nombre de faits qui ont servi au calcul, dans la fenetre. */
  readonly seen: number;
  /** Repartition dans la fenetre, pour que l'ecran puisse **montrer** le pourquoi. */
  readonly counts: Readonly<Record<FaceId, number>>;
}

/** Un fait vecu qui parle d'une facon de regarder. */
interface Fact {
  readonly at: string;
  readonly face: FaceId;
}

/**
 * La face, ou **rien**.
 *
 * `undefined` sous le seuil, et ce n'est pas un cas d'erreur : c'est le comportement normal
 * d'un produit qui se tait tant qu'il n'a pas de quoi parler. L'ecran doit dire *« pas
 * encore »*, jamais inventer une face par defaut.
 *
 * ## ⚠️ Aucun instant de reference, et c'est un choix
 *
 * Tous les modules purs du domaine recoivent `now` ; celui-ci n'en a pas besoin, et lui en
 * donner un serait « au cas ou ». La fenetre compte des **faits**, pas des jours : un fait
 * vieux de trois ans compte s'il est l'un des dix derniers, et c'est voulu — quelqu'un qui
 * regarde deux series par an n'a pas moins d'identite que quelqu'un qui en devore trente.
 * Une fenetre en jours, elle, ferait **disparaitre** la face des gens lents.
 */
export function faceOf(journal: Journal): Face | undefined {
  const facts: Fact[] = [];

  for (const [key, entry] of Object.entries(journal.entries)) {
    // A13 : une face se lit sur des saisons et des abandons, un film n'en a pas.
    if (!isSeriesKey(key as JournalKey)) continue;

    const decision = entry.decision;
    // ⚠️ `origin` d'abord : un fait repris d'ailleurs porte la date de l'import, donc il
    // remplirait la fenetre a lui seul et la face decrirait un clic au lieu d'une annee.
    if (decision !== undefined && decision.origin === undefined) {
      // Menee au bout, ou laissee en route. Les autres decisions (`paused`, etc.) ne
      // tranchent rien : quelqu'un qui met en pause n'a **pas encore** decide, et compter
      // son indecision d'un cote ou de l'autre serait inventer une reponse.
      if (decision.kind === 'completed') facts.push({ at: decision.at, face: 'finisher' });
      if (decision.kind === 'abandoned') facts.push({ at: decision.at, face: 'cutter' });
    }

    // Un visionnage **au-dela du premier** : revoir est le seul geste qui distingue une
    // serie aimee d'une serie finie, et c'est le plus difficile a falsifier — on ne revoit
    // pas trois fois quarante heures par erreur.
    //
    // ⚠️ Le premier visionnage est ecarte et ce n'est pas un detail de comptage : il decrit
    // le meme evenement que « terminee », donc le compter donnerait **deux** faits pour un
    // seul geste, et le jaune l'emporterait sur le rouge chez quelqu'un qui ne revoit rien.
    for (const completion of (entry.completions ?? []).slice(1)) {
      if (completion.origin === undefined) facts.push({ at: completion.at, face: 'rewatcher' });
    }
  }

  // Les plus recents d'abord, puis la fenetre. Un fait sans date lisible se retrouve en
  // queue plutot qu'en tete : `at` est une chaine ISO, donc l'ordre lexical est l'ordre
  // chronologique — et une chaine vide ou aberrante ne peut pas se hisser devant.
  const window = facts.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FACE_WINDOW);
  if (window.length < MIN_FACTS_FOR_FACE) return undefined;

  const counts: Record<FaceId, number> = { finisher: 0, cutter: 0, rewatcher: 0 };
  for (const fact of window) counts[fact.face] += 1;

  return { id: strongest(counts, window), seen: window.length, counts };
}

/**
 * Laquelle des trois l'emporte.
 *
 * ## L'egalite doit etre tranchee par quelque chose, et surtout pas par l'ordre des cles
 *
 * Un `Object.entries(...).sort()` departagerait deux faces ex aequo par l'ordre de
 * declaration — c'est-a-dire par un detail d'ecriture, stable mais arbitraire, et qui
 * donnerait a `finisher` un avantage permanent que rien ne justifie. Le depot connait ce
 * defaut : c'est le `deviceId` de `sameJournal`, un depart pris pour une decision.
 *
 * On tranche donc par **le fait le plus recent** : a egalite, la face est celle vers
 * laquelle on vient de basculer. C'est la lecture la plus fidele a ce que le produit est.
 */
function strongest(counts: Readonly<Record<FaceId, number>>, window: readonly Fact[]): FaceId {
  const best = Math.max(counts.finisher, counts.cutter, counts.rewatcher);
  const tied = window.filter((fact) => counts[fact.face] === best);
  // `window` est deja trie du plus recent au plus ancien : le premier survivant est donc le
  // fait le plus recent parmi les faces a egalite.
  return tied[0]?.face ?? 'finisher';
}

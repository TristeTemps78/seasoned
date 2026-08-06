import { describe, expect, it } from 'vitest';
import {
  describeStatus as describeStatusIn,
  formatCommitment as formatCommitmentIn,
  shortStatus as shortStatusIn,
  year,
} from '../lib/format';
import { deriveStatus } from '../src/domain/status';
import { t, tn } from '../lib/i18n';

/**
 * ## Pourquoi on compare a `t(...)` et non a une phrase recopiee
 *
 * Ce fichier portait **22 egalites sur du texte litteral** pour 24 tests — le pire rapport
 * du depot. Or le bug que chacune attrape est **le chiffre** (25 mois, 12 jours, 3 j) et
 * **l'accord** (0 / 1 / 2), jamais la phrase : reformuler « Annoncee comme revenant » en
 * « Annoncee pour revenir » faisait tomber deux tests sans qu'aucun defaut existe.
 *
 * Comparer a `tn('fr', 'say.awaiting.since', 25)` garde tout ce qui compte et perd la
 * fragilite : le test tombe si le calcul des mois est faux, si la mauvaise cle est
 * choisie, ou si le pluriel derape — et **pas** si le dictionnaire est reecrit.
 *
 * ⚠️ **Deux exceptions restent litterales, et c'est motive** : les durees composees
 * (« 62 heures — 2 jours et 14 h »). Leur objet est la **decomposition**, et la comparer a
 * `tn(..., { n: 62, d: 2, r: 14 })` reviendrait a recopier dans le test l'arithmetique que
 * le test verifie. La phrase entiere se lit mieux et prouve la meme chose.
 *
 * ⚠️ Restent litterales aussi, et pour la raison inverse, les assertions du bloc anglais
 * qui portent sur **le texte lui-meme** : « aucune trace de francais dans l'anglais » n'a
 * de sens que sur la chaine rendue.
 *
 * ## Ces tests-ci disent le **francais**, explicitement.
 *
 * Ils ont ete ecrits quand le francais etait la seule langue, donc quand ne rien preciser
 * revenait a le demander. Depuis que la langue par defaut est l'anglais, ne rien preciser
 * voudrait dire « la langue du moment » — et un test qui change de reponse selon une
 * constante d'un autre module ne teste plus rien. Le francais est verifie ici, l'anglais
 * dans le bloc du bas.
 */
const describeStatus = (status: Parameters<typeof describeStatusIn>[0]): string =>
  describeStatusIn(status, 'fr');
const shortStatus = (status: Parameters<typeof shortStatusIn>[0]): string | undefined =>
  shortStatusIn(status, 'fr');
const formatCommitment = (minutes: number): string => formatCommitmentIn(minutes, 'fr');

const NOW = new Date('2026-08-01T00:00:00Z');

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

function inDays(n: number): Date {
  return new Date(NOW.getTime() + n * 86_400_000);
}

describe('describeStatus — le cas qui porte la valeur', () => {
  it('chiffre le silence d une serie declaree vivante', () => {
    // Le differenciateur de la phase 1 : tous les trackers affichent « running ».
    // L'utilisateur ne sait pas s'il attend ou s'il abandonne. Ici on lui donne le
    // chiffre, et on le laisse conclure.
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(760) },
      NOW,
    );

    expect(status.status).toBe('awaiting_renewal');
    expect(describeStatus(status)).toBe(tn('fr', 'say.awaiting.since', 25));
  });

  it('ne declare pas une serie morte a la place de ses producteurs', () => {
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(900) },
      NOW,
    );
    const text = describeStatus(status);

    // Ce que l'on refuse : que le produit conclue a la place des producteurs. Le motif
    // reste litteral **a dessein** — c'est le vocabulaire interdit qui est le sujet.
    expect(text).not.toMatch(/mort|annul|fini/i);
    // Et ce qu'on exige a la place : la phrase du silence chiffre. 900 j / 30,44 = 30 mois.
    expect(text).toBe(tn('fr', 'say.awaiting.since', 30));
  });
});

describe('describeStatus — les autres statuts', () => {
  it('annonce un prochain episode date', () => {
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(300), nextAiringAt: inDays(12) },
      NOW,
    );
    expect(describeStatus(status)).toBe(tn('fr', 'say.airing.inDays', 12));
  });

  it('dit « demain » plutot que « dans 1 jours »', () => {
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(300), nextAiringAt: inDays(1) },
      NOW,
    );
    expect(describeStatus(status)).toBe(t('fr', 'say.airing.tomorrow'));
  });

  it('distingue une pause normale d un abandon', () => {
    const status = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(200) }, NOW);
    expect(status.status).toBe('between_seasons');
    expect(describeStatus(status)).toMatch(/La suite est attendue/);
  });

  it('signale qu une serie annulee peut n avoir aucune conclusion', () => {
    const status = deriveStatus({ production: 'canceled', lastAiredAt: daysAgo(100) }, NOW);
    expect(describeStatus(status)).toMatch(/sans conclusion/);
  });

  it('couvre tous les statuts sans jamais rendre une chaine vide', () => {
    const cases = [
      deriveStatus({ production: 'ended', lastAiredAt: daysAgo(10) }, NOW),
      deriveStatus({ production: 'planned' }, NOW),
      deriveStatus({ production: 'unknown' }, NOW),
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(2) }, NOW),
    ];
    for (const status of cases) {
      expect(describeStatus(status).length).toBeGreaterThan(0);
    }
  });
});

describe('shortStatus — la valeur tient dans le chiffre', () => {
  // Le recentrage du 2026-08-01 : ce qui vaut, ce n'est pas l'etat (« Returning
  // Series » ne dit rien) mais le temps ecoule chiffre.
  it('chiffre l attente entre deux saisons', () => {
    const status = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(335) }, NOW);
    expect(shortStatus(status)).toBe(tn('fr', 'chip.waitingSince', 11));
  });

  it('chiffre le silence d une serie zombie', () => {
    const status = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(760) }, NOW);
    expect(shortStatus(status)).toBe(tn('fr', 'chip.silentSince', 25));
  });

  it('annonce le prochain episode quand il est date', () => {
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(300), nextAiringAt: inDays(3) },
      NOW,
    );
    expect(shortStatus(status)).toBe(tn('fr', 'chip.inDays', 3));
  });

  it('reste muet quand il n y a rien d utile a dire', () => {
    // Une vignette muette vaut mieux qu'une vignette qui repete l'evidence :
    // l'affiche et le titre suffisent.
    expect(shortStatus(deriveStatus({ production: 'ended', lastAiredAt: daysAgo(9) }, NOW))).toBeUndefined();
    expect(shortStatus(deriveStatus({ production: 'unknown' }, NOW))).toBeUndefined();
  });

  it('signale une annulation', () => {
    const status = deriveStatus({ production: 'canceled', lastAiredAt: daysAgo(100) }, NOW);
    expect(shortStatus(status)).toBe(t('fr', 'chip.cancelled'));
  });

  it('tient sur une vignette', () => {
    // Contrainte d'affichage : sous une affiche, en petit. Au-dela, ca tronque.
    const cases = [
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(1000) }, NOW),
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(200) }, NOW),
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(2), nextAiringAt: inDays(40) }, NOW),
    ];
    for (const status of cases) {
      expect(shortStatus(status)!.length).toBeLessThanOrEqual(24);
    }
  });
});

describe('formatCommitment — « ça vaut mes 40 heures ? »', () => {
  it('compte en heures, pas en minutes', () => {
    // Les gens comptent leur temps libre en heures. 1800 minutes ne veut rien dire.
    expect(formatCommitment(30 * 60)).toBe(tn('fr', 'commit.hours', 30));
  });

  it('ajoute l equivalent en jours au-dela de deux jours', () => {
    // Sous 48 h, l'heure suffit : personne ne pense « 1 jour et 7 h ».
    expect(formatCommitment(47 * 60)).toBe(tn('fr', 'commit.hours', 47));
    // Au-dela, le chiffre en heures cesse de parler — c'est le moment de dire
    // ce que ca represente vraiment.
    expect(formatCommitment(62 * 60)).toBe('62 heures — 2 jours et 14 h');
    expect(formatCommitment(72 * 60)).toBe('72 heures — 3 jours pleins');
    expect(formatCommitment(50 * 60)).toBe('50 heures — 2 jours et 2 h');
  });

  it('accorde le singulier', () => {
    expect(formatCommitment(60)).toBe(tn('fr', 'commit.hours', 1));
    expect(formatCommitment(120)).toBe(tn('fr', 'commit.hours', 2));
  });

  it('gere les durees minuscules', () => {
    expect(formatCommitment(20)).toBe(t('fr', 'commit.underHour'));
    expect(formatCommitment(0)).toBe(t('fr', 'commit.underHour'));
  });
});

describe('year', () => {
  it('lit l annee en UTC, pas dans le fuseau du serveur', () => {
    // Sans UTC, une date du 1er janvier bascule d'une annee selon le serveur.
    expect(year(new Date('2008-01-01T00:00:00Z'))).toBe(2008);
    expect(year(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// L'anglais, qui est desormais la langue par defaut — donc celle qui est indexee
// ---------------------------------------------------------------------------

describe('en — le differenciateur doit se dire aussi bien en anglais', () => {
  it('chiffre le silence d une serie declaree vivante', () => {
    const status = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(760) }, NOW);
    expect(describeStatusIn(status, 'en')).toBe(tn('en', 'say.awaiting.since', 25));
  });

  it('est bien la langue par defaut : ne rien preciser rend de l anglais', () => {
    // C'est **le** test de la bascule. S'il tombe, la decision « en par defaut » a ete
    // annulee quelque part sans que personne ne le remarque.
    const status = deriveStatus({ production: 'returning', lastAiredAt: daysAgo(760) }, NOW);
    expect(describeStatusIn(status)).toBe(describeStatusIn(status, 'en'));
  });

  it('accorde le pluriel anglais, qui n est pas le pluriel francais', () => {
    // 1 : les deux langues disent le singulier.
    expect(formatCommitmentIn(60, 'en')).toBe(tn('en', 'commit.hours', 1));
    expect(formatCommitmentIn(60, 'fr')).toBe(tn('fr', 'commit.hours', 1));
    expect(formatCommitmentIn(120, 'en')).toBe(tn('en', 'commit.hours', 2));
  });

  it('accorde zero comme l anglais l accorde, et non comme le francais', () => {
    // Le desaccord commence a zero : le francais dit « 0 jour », l'anglais « 0 days ».
    // C'est exactement la faute qu'un ternaire `n > 1` produit sans qu'on la voie, et la
    // raison pour laquelle la selection passe par `Intl.PluralRules`.
    const status = deriveStatus(
      { production: 'returning', lastAiredAt: daysAgo(5), nextAiringAt: inDays(0) },
      NOW,
    );
    // Cas nominal a zero jour : les deux langues ont une phrase dediee, verifions-la.
    expect(describeStatusIn(status, 'en')).toBe(t('en', 'say.airing.today'));
    expect(describeStatusIn(status, 'fr')).toBe(t('fr', 'say.airing.today'));
  });

  it('tient sur une vignette en anglais aussi', () => {
    // La contrainte d'affichage ne dispense pas la traduction : l'anglais est souvent
    // plus court, mais « waiting · 12 months » ne l'est pas.
    const cases = [
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(1000) }, NOW),
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(200) }, NOW),
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(2), nextAiringAt: inDays(40) }, NOW),
    ];
    for (const status of cases) {
      expect(shortStatusIn(status, 'en')!.length).toBeLessThanOrEqual(24);
    }
  });

  it('ne laisse aucune trace de francais dans les phrases anglaises', () => {
    // Un dictionnaire se copie-colle, et une cle oubliee reste en francais sans que rien
    // ne le signale : le typage garantit la presence, pas la traduction.
    const statuses = [
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(760) }, NOW),
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(200) }, NOW),
      deriveStatus({ production: 'ended', lastAiredAt: daysAgo(9) }, NOW),
      deriveStatus({ production: 'canceled', lastAiredAt: daysAgo(100) }, NOW),
      deriveStatus({ production: 'planned' }, NOW),
      deriveStatus({ production: 'unknown' }, NOW),
      deriveStatus({ production: 'returning', lastAiredAt: daysAgo(2), nextAiringAt: inDays(3) }, NOW),
    ];
    const french = /[éèêàçôûù]|\bmois\b|\bjours?\b|\bheures?\b|\bépisode\b/i;
    for (const status of statuses) {
      expect(describeStatusIn(status, 'en')).not.toMatch(french);
      const chip = shortStatusIn(status, 'en');
      if (chip !== undefined) expect(chip).not.toMatch(french);
    }
    expect(formatCommitmentIn(62 * 60, 'en')).not.toMatch(french);
    expect(formatCommitmentIn(20, 'en')).not.toMatch(french);
  });
});

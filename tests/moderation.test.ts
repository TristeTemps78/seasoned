import { describe, expect, it } from 'vitest';
import {
  applyDecision,
  isOverdue,
  isUrgent,
  REPORT_GROUNDS,
  REVIEW_DEADLINE_HOURS,
  restore,
  reviewDeadline,
  statementOfReasons,
  triage,
  VISIBLE,
  visibleToOthers,
  type ModerationDecision,
  type Report,
  type ReportGround,
} from '../src/domain/moderation';

/**
 * La procedure de moderation.
 *
 * ⚖️ Ces tests verifient une **procedure**, pas une conformite juridique. Ils figent les
 * trois decisions qui ne doivent pas se defaire discretement : on masque sans supprimer,
 * tout retrait porte un motif type, et l'auteur peut contester.
 */

const NOW = new Date('2026-08-03T12:00:00.000Z');
const SUBJECT = { kind: 'review', id: 'r-1' };

function report(over: Partial<Report> = {}): Report {
  return { subject: SUBJECT, ground: 'spam', receivedAt: NOW, ...over };
}

describe('les motifs', () => {
  it('sont fermes, et la liste les contient tous', () => {
    // La liste sert a batir un formulaire sans en oublier un. Si un motif est ajoute au
    // type sans l'etre ici, il devient impossible a signaler — un motif invisible est un
    // motif qui n'existe pas.
    const all: readonly ReportGround[] = ['illegal', 'abuse', 'privacy', 'spam', 'spoiler'];
    expect([...REPORT_GROUNDS].sort()).toEqual([...all].sort());
  });

  it('comprennent le spoiler, qui est propre a ce produit', () => {
    // Ailleurs c'est une impolitesse ; ici c'est une atteinte a la promesse centrale
    // (regle 7, contrainte de niveau 1). L'omettre reviendrait a dire qu'on ne le retire pas.
    expect(REPORT_GROUNDS).toContain('spoiler');
  });
});

describe('l’urgence et le delai', () => {
  it('traite immediatement ce dont le prejudice grandit avec le temps', () => {
    // Une adresse personnelle publiee ou une menace font des degats a chaque heure.
    expect(isUrgent('illegal')).toBe(true);
    expect(isUrgent('abuse')).toBe(true);
    expect(isUrgent('privacy')).toBe(true);
  });

  it('laisse le delai ordinaire a ce qui ne s’aggrave pas', () => {
    // Un spam ou un spoiler sont penibles, ils ne empirent pas.
    expect(isUrgent('spam')).toBe(false);
    expect(isUrgent('spoiler')).toBe(false);
    const deadline = reviewDeadline(report({ ground: 'spoiler' }));
    expect(deadline.getTime() - NOW.getTime()).toBe(REVIEW_DEADLINE_HOURS * 3_600_000);
  });

  it('rend un signalement urgent depasse des la seconde suivante', () => {
    const urgent = report({ ground: 'abuse' });
    expect(isOverdue(urgent, new Date(NOW.getTime() + 1_000))).toBe(true);
    // Et l'ordinaire ne l'est pas encore a 71 h.
    const ordinary = report({ ground: 'spam' });
    expect(isOverdue(ordinary, new Date(NOW.getTime() + 71 * 3_600_000))).toBe(false);
    expect(isOverdue(ordinary, new Date(NOW.getTime() + 73 * 3_600_000))).toBe(true);
  });
});

describe('triage', () => {
  it('🔴 ne laisse jamais un spoiler passer avant une menace', () => {
    // Le seul point de cette fonction. Une file traitee dans l'ordre d'arrivee ferait
    // exactement ca — et c'est le defaut qu'on ne remarque que le jour ou il coute cher.
    const older = report({ ground: 'spoiler', receivedAt: new Date(NOW.getTime() - 3_600_000) });
    const newer = report({ ground: 'abuse', receivedAt: NOW });
    expect(triage([older, newer], NOW).map((r) => r.ground)).toEqual(['abuse', 'spoiler']);
  });

  it('met le depasse devant, meme s’il est moins grave', () => {
    // Quelqu'un qui attend depuis quatre jours doit passer : un delai annonce et non tenu
    // est verifiable par celui qui attend.
    const late = report({
      ground: 'spam',
      receivedAt: new Date(NOW.getTime() - 96 * 3_600_000),
    });
    const fresh = report({ ground: 'privacy', receivedAt: NOW });
    expect(triage([fresh, late], NOW)[0]?.ground).toBe('spam');
  });

  it('departage a egalite par l’anciennete, et ne modifie pas l’entree', () => {
    const first = report({ ground: 'spam', receivedAt: new Date(NOW.getTime() - 7_200_000) });
    const second = report({ ground: 'spoiler', receivedAt: new Date(NOW.getTime() - 3_600_000) });
    const input = [second, first];
    const sorted = triage(input, NOW);
    expect(sorted[0]).toBe(first);
    // Trier une file ne doit pas la reordonner chez l'appelant.
    expect(input[0]).toBe(second);
  });
});

describe('la decision et ce qu’on doit a l’auteur', () => {
  const hidden: ModerationDecision = {
    subject: SUBJECT,
    outcome: 'hidden',
    ground: 'abuse',
    decidedAt: NOW,
  };

  it('🔴 masque sans supprimer, et le dit', () => {
    // La decision structurante. Supprimer rendrait une erreur irreparable et une
    // contestation inexaminable — on ne peut pas rendre ce qu'on a efface.
    const visibility = applyDecision(hidden);
    expect(visibility.hidden).toBe(true);
    expect(visibility.hiddenAt).toEqual(NOW);
    expect(visibility.ground).toBe('abuse');
  });

  it('sait retablir — sans quoi la voie de recours n’est qu’une phrase', () => {
    // Un dispositif qui sait retirer mais pas rendre n'est pas de la moderation.
    expect(restore()).toEqual(VISIBLE);
    expect(restore().hidden).toBe(false);
  });

  it('doit a l’auteur un motif type, reversible et contestable', () => {
    const statement = statementOfReasons(hidden)!;
    expect(statement.ground).toBe('abuse');
    expect(statement.reversible).toBe(true);
    expect(statement.contestable).toBe(true);
  });

  it('ne dit RIEN a l’auteur quand le contenu est garde', () => {
    // Informer quelqu'un qu'il a ete signale sans que rien ne lui soit reproche ne protege
    // personne, et lui apprend qu'on l'a vise. Le signalant, lui, recoit une reponse.
    expect(
      statementOfReasons({ ...hidden, outcome: 'kept' }),
    ).toBeUndefined();
    expect(applyDecision({ ...hidden, outcome: 'kept' })).toEqual(VISIBLE);
  });

  it('porte la precision du moderateur quand il y en a une, jamais a la place du motif', () => {
    const withNote = statementOfReasons({ ...hidden, note: '  vise une personne nommee  ' })!;
    expect(withNote.note).toBe('vise une personne nommee');
    // Le motif type reste : c'est lui qui se gabarise dans n'importe quelle langue.
    expect(withNote.ground).toBe('abuse');
    // Une note vide ne cree pas un champ vide.
    expect(statementOfReasons({ ...hidden, note: '   ' })?.note).toBeUndefined();
  });

  it('ne fabrique AUCUNE phrase destinee a l’auteur — le domaine reste muet', () => {
    // `src/domain/` n'importe rien de `lib/i18n.ts`, et A9 en fait une regle produit : le
    // texte doit exister dans la langue de l'auteur, donc le domaine produit des **faits**
    // et la couche de rendu produit des **phrases**.
    //
    // ⚠️ Ce test disait d'abord « aucune valeur ne contient d'espace », ce qui etait faux :
    // `note` est du texte libre du moderateur, donc legitimement une phrase. Il passait
    // seulement parce que le cas teste n'en avait pas. Ancre desormais sur ce qui compte —
    // le motif est un **jeton**, et aucun champ ne porte de message redige.
    const statement = statementOfReasons(hidden)!;
    expect(statement.ground).toMatch(/^[a-z]+$/);
    expect(statement).not.toHaveProperty('message');
    expect(statement).not.toHaveProperty('text');

    // Et la note, quand elle existe, reste une precision — pas le message envoye.
    const withNote = statementOfReasons({ ...hidden, note: 'vise une personne nommee' })!;
    expect(withNote.note).toBe('vise une personne nommee');
    expect(withNote.ground).toBe('abuse');
  });
});

describe('visibleToOthers', () => {
  it('cache le contenu masque, et le filtrage vit dans le domaine', () => {
    // Meme raison que `spoiler.ts` : un filtre pose a l'affichage laisse fuir le contenu
    // par les agregats, les compteurs, les exports et les fils.
    const item = { text: 'bonjour' };
    expect(visibleToOthers(item, VISIBLE)).toBe(item);
    expect(visibleToOthers(item, applyDecision({
      subject: SUBJECT,
      outcome: 'hidden',
      ground: 'spam',
      decidedAt: NOW,
    }))).toBeUndefined();
  });
});

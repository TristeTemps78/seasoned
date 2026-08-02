import { describe, expect, it } from 'vitest';
import { COMFORTABLE_MINUTES_PER_DAY, catchUpPlan } from '../src/domain/catch-up';
import type { Remaining } from '../src/domain/remaining';

const NOW = new Date('2026-08-03T12:00:00Z');
const IN_TEN_DAYS = new Date('2026-08-13T12:00:00Z');

function left(episodes: number): Remaining {
  return { episodes, done: episodes === 0 };
}

describe('catchUpPlan — quand la question ne se pose pas', () => {
  it('se tait quand il ne reste rien', () => {
    expect(catchUpPlan(left(0), IN_TEN_DAYS, NOW, 45)).toBeUndefined();
    expect(catchUpPlan(undefined, IN_TEN_DAYS, NOW, 45)).toBeUndefined();
  });

  it('se tait sans date de retour connue', () => {
    expect(catchUpPlan(left(10), undefined, NOW, 45)).toBeUndefined();
    expect(catchUpPlan(left(10), new Date('pas une date'), NOW, 45)).toBeUndefined();
  });

  it('se tait sur une date deja passee', () => {
    // Un plan pour un evenement passe serait un mensonge poli.
    expect(catchUpPlan(left(10), new Date('2026-07-01T00:00:00Z'), NOW, 45)).toBeUndefined();
  });
});

describe('catchUpPlan — le rythme', () => {
  it('donne le nombre de jours et le rythme', () => {
    const plan = catchUpPlan(left(20), IN_TEN_DAYS, NOW, 45);
    expect(plan?.days).toBe(10);
    expect(plan?.perDay).toBe(2);
  });

  it('donne surtout le TEMPS par jour', () => {
    // Le chiffre sur lequel on peut decider. « 1,2 episode par jour » demande une
    // conversion mentale que le produit est justement la pour faire.
    const plan = catchUpPlan(left(15), IN_TEN_DAYS, NOW, 45);
    expect(plan?.minutesPerDay).toBe(68);
  });

  it('ne s’arrete jamais a zero jour', () => {
    // Un episode qui sort dans huit heures laisse « aujourd'hui », pas « zero jour ».
    // Zero produirait une division par zero, donc un rythme infini a l'ecran.
    const soon = new Date('2026-08-03T20:00:00Z');
    const plan = catchUpPlan(left(3), soon, NOW, 45);
    expect(plan?.days).toBe(1);
    expect(plan?.perDay).toBe(3);
    expect(Number.isFinite(plan?.minutesPerDay ?? 0)).toBe(true);
  });

  it('arrondit les jours au superieur', () => {
    // Sortie dans 10 jours et 2 heures : on ne compte pas 10 jours pleins, sinon le
    // rythme annonce est intenable de quelques minutes.
    const plan = catchUpPlan(left(11), new Date('2026-08-13T14:00:00Z'), NOW, 45);
    expect(plan?.days).toBe(11);
    expect(plan?.perDay).toBe(1);
  });
});

describe('catchUpPlan — ce qui tient, et ce qui ne tient pas', () => {
  it('reconnait un rythme tenable', () => {
    const plan = catchUpPlan(left(10), IN_TEN_DAYS, NOW, 45);
    expect(plan?.minutesPerDay).toBe(45);
    expect(plan?.withinReach).toBe(true);
  });

  it('annonce quand meme un plan intenable, au lieu de se taire', () => {
    // L'information « tu ne rattraperas pas » est exactement celle qu'on cherche : elle
    // evite un marathon perdu d'avance. Le domaine donne le chiffre, l'affichage choisit
    // la formulation.
    const plan = catchUpPlan(left(60), IN_TEN_DAYS, NOW, 50);
    expect(plan).toBeDefined();
    expect(plan?.minutesPerDay).toBe(300);
    expect(plan?.withinReach).toBe(false);
  });

  it('place la frontiere exactement sur le seuil documenté', () => {
    const plan = catchUpPlan(left(10), new Date('2026-08-08T12:00:00Z'), NOW, 60);
    expect(plan?.minutesPerDay).toBe(COMFORTABLE_MINUTES_PER_DAY);
    // `<=` et non `<` : deux heures pile reste du cote tenable. Un seuil qui exclut sa
    // propre valeur surprend a la lecture du code comme a l'usage.
    expect(plan?.withinReach).toBe(true);
  });

  it('ne declare rien d’intenable quand la duree est inconnue', () => {
    // TMDB abandonne `episode_run_time` : le cas « on ne sait pas » est courant. Juger
    // un plan sur une donnee absente serait inventer.
    const plan = catchUpPlan(left(60), IN_TEN_DAYS, NOW);
    expect(plan?.minutesPerDay).toBeUndefined();
    expect(plan?.withinReach).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { MIN_SEASON_GAP, MIN_REFERENCE_SEASONS } from '../src/domain/current-season';
import {
  MAX_ENTRY_FRACTION,
  MAX_SKIPPED_EPISODES,
  MIN_ENTRY_LIFT,
  MIN_EPISODES_AFTER,
  MIN_SKIPPED_EPISODES,
} from '../src/domain/entry-point';
import { PUBLIC_BREAK_POINT_MIN_DROP } from '../src/domain/rating-scale';
import { COMFORTABLE_MINUTES_PER_DAY } from '../src/domain/catch-up';

/**
 * Les seuils, verifies dans leurs **rapports** plutot que dans leurs valeurs.
 *
 * Le projet a fait des seuils des parametres nommes et exportes, et c'est une lecon
 * durement acquise : `trajectory.ts` a demande trois passes parce que des constantes
 * taillees pour des notes humaines etaient appliquees a des moyennes de foule.
 *
 * Mais un parametre exporte qu'aucun test ne touche peut etre modifie sans que rien ne
 * tombe — et le risque n'est pas qu'une valeur soit « mauvaise », c'est que **deux
 * valeurs qui doivent rester liees divergent en silence**. Ce fichier verrouille les
 * relations, pas les nombres : chacun reste librement reglable tant que l'ensemble garde
 * un sens.
 */
describe('les seuils gardent un sens les uns par rapport aux autres', () => {
  it('un decollage et un decrochage se mesurent a la meme aune', () => {
    // Sinon le produit serait plus severe que genereux — ou l'inverse — sans que
    // personne ne l'ait decide. Les deux seuils vivent sur des echelles differentes
    // (etoiles sur cinq, notes sur dix), d'ou le facteur deux.
    expect(MIN_ENTRY_LIFT).toBe(PUBLIC_BREAK_POINT_MIN_DROP * 2);
    expect(MIN_SEASON_GAP).toBe(PUBLIC_BREAK_POINT_MIN_DROP * 2);
  });

  it('le plafond d’episodes a passer reste au-dessus du plancher', () => {
    // Un plafond passe sous le plancher rendrait la fonction muette pour toujours, sans
    // qu'aucun autre test ne s'en apercoive : tous les cas deviendraient « se tait ».
    expect(MAX_SKIPPED_EPISODES).toBeGreaterThan(MIN_SKIPPED_EPISODES);
  });

  it('un point d’entree exige plus d’episodes apres que devant', () => {
    // La mediane « apres » sert de reference : si elle portait sur moins d'episodes que
    // le creux, on comparerait un fait a une impression.
    expect(MIN_EPISODES_AFTER).toBeGreaterThan(MIN_SKIPPED_EPISODES);
  });

  it('un demarrage lent reste une minorite de la serie', () => {
    expect(MAX_ENTRY_FRACTION).toBeGreaterThan(0);
    expect(MAX_ENTRY_FRACTION).toBeLessThanOrEqual(0.5);
  });

  it('juger une saison demande plus d’une saison de reference', () => {
    // Comparer a une seule saison passee, c'est comparer a un accident.
    expect(MIN_REFERENCE_SEASONS).toBeGreaterThanOrEqual(2);
  });

  it('le rythme confortable tient dans une soiree', () => {
    // Au-dela de trois heures par jour, tous les jours, ce n'est plus un rattrapage —
    // et le produit ne doit pas presenter cela comme un plan.
    expect(COMFORTABLE_MINUTES_PER_DAY).toBeGreaterThan(30);
    expect(COMFORTABLE_MINUTES_PER_DAY).toBeLessThanOrEqual(180);
  });
});

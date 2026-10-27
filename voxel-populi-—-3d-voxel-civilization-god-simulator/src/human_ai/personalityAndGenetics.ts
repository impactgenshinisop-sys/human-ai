/**
 * ============================================================================
 * LAYER 1: PERSONALITY, GENETIC INHERITANCE & LIFE-STAGE DEVELOPMENT
 * ============================================================================
 * Models how human personality traits and cognitive aptitudes are generated,
 * inherited from parents with genetic crossover + mutation, and how humans
 * mature across 5 developmental life stages (Baby -> Child -> Teen -> Adult -> Elder).
 */

import {
  GeneticAptitudes,
  LifeStage,
  PersonalityVector,
} from './types';

/**
 * Deterministic PRNG interface so the AI remains 100% reproducible from any seed.
 */
export interface DeterministicRNG {
  next(): number; // Returns float in [0, 1)
  range(min: number, max: number): number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Computes the developmental life stage from biological age in years.
 * - Baby (0–3): Dependent on parents; observes surroundings.
 * - Child (4–11): Plays with peers, explores curiosity, builds early social bonds.
 * - Teen (12–17): Becomes an Apprentice under an adult Mentor; rapid skill acquisition.
 * - Adult (18–54): Full economic producer, innovator, parent, and mentor.
 * - Elder (55+): Physical strength declines, but high scholarship/wisdom boosts mentorship & lore.
 */
export function computeLifeStage(age: number): LifeStage {
  if (age < 4) return 'Baby';
  if (age < 12) return 'Child';
  if (age < 18) return 'Teen';
  if (age < 55) return 'Adult';
  return 'Elder';
}

/**
 * Generates a founder human's 5-axis personality vector (-1.0 to +1.0).
 */
export function generateFounderPersonality(rng: DeterministicRNG): PersonalityVector {
  return {
    diligence: Number(rng.range(-0.6, 0.9).toFixed(2)),
    curiosity: Number(rng.range(-0.5, 0.95).toFixed(2)),
    sociability: Number(rng.range(-0.6, 0.9).toFixed(2)),
    courage: Number(rng.range(-0.6, 0.9).toFixed(2)),
    piety: Number(rng.range(-0.5, 0.85).toFixed(2)),
  };
}

/**
 * Generates a founder human's cognitive & physical aptitudes (0.40 to 1.60).
 */
export function generateFounderAptitudes(rng: DeterministicRNG): GeneticAptitudes {
  return {
    intelligence: Number(rng.range(0.75, 1.35).toFixed(2)),
    strength: Number(rng.range(0.75, 1.35).toFixed(2)),
    fertility: Number(rng.range(0.7, 1.3).toFixed(2)),
  };
}

/**
 * Genetic & Cultural Inheritance Model:
 * When a child is born to one or two parents, their personality and aptitudes
 * are inherited via weighted parental crossover plus Gaussian-like mutation.
 *
 * Formula per trait T:
 *   T_child = clamp( w * T_parentA + (1 - w) * T_parentB + Mutation(-0.18, +0.18), -1.0, +1.0 )
 */
export function inheritChildGenetics(
  parentAPersonality: PersonalityVector,
  parentAAptitudes: GeneticAptitudes,
  parentBPersonality: PersonalityVector | null,
  parentBAptitudes: GeneticAptitudes | null,
  rng: DeterministicRNG
): { personality: PersonalityVector; aptitudes: GeneticAptitudes } {
  const pB = parentBPersonality ?? parentAPersonality;
  const aB = parentBAptitudes ?? parentAAptitudes;

  const mixTrait = (a: number, b: number): number => {
    const weight = rng.range(0.3, 0.7);
    const mutation = rng.range(-0.18, 0.18);
    return Number(clamp(a * weight + b * (1 - weight) + mutation, -1.0, 1.0).toFixed(2));
  };

  const mixAptitude = (a: number, b: number): number => {
    const weight = rng.range(0.35, 0.65);
    const mutation = rng.range(-0.12, 0.14);
    return Number(clamp(a * weight + b * (1 - weight) + mutation, 0.45, 1.6).toFixed(2));
  };

  return {
    personality: {
      diligence: mixTrait(parentAPersonality.diligence, pB.diligence),
      curiosity: mixTrait(parentAPersonality.curiosity, pB.curiosity),
      sociability: mixTrait(parentAPersonality.sociability, pB.sociability),
      courage: mixTrait(parentAPersonality.courage, pB.courage),
      piety: mixTrait(parentAPersonality.piety, pB.piety),
    },
    aptitudes: {
      intelligence: mixAptitude(parentAAptitudes.intelligence, aB.intelligence),
      strength: mixAptitude(parentAAptitudes.strength, aB.strength),
      fertility: mixAptitude(parentAAptitudes.fertility, aB.fertility),
    },
  };
}

/**
 * Computes age-adjusted effective cognitive and physical multipliers.
 * - Children/Teens have higher neuroplasticity (faster learning rate) but lower physical strength.
 * - Elders have lower physical strength but high wisdom/mentorship effectiveness.
 */
export function getLifeStageMultipliers(lifeStage: LifeStage): {
  learningRateMultiplier: number;
  workOutputMultiplier: number;
  mentorshipTeachingBonus: number;
} {
  switch (lifeStage) {
    case 'Baby':
      return {
        learningRateMultiplier: 0.2,
        workOutputMultiplier: 0.0,
        mentorshipTeachingBonus: 0.0,
      };
    case 'Child':
      return {
        learningRateMultiplier: 1.35, // High childhood curiosity & plasticity
        workOutputMultiplier: 0.25,
        mentorshipTeachingBonus: 0.0,
      };
    case 'Teen':
      return {
        learningRateMultiplier: 1.5, // Peak apprenticeship learning phase
        workOutputMultiplier: 0.75,
        mentorshipTeachingBonus: 0.1,
      };
    case 'Adult':
      return {
        learningRateMultiplier: 1.0,
        workOutputMultiplier: 1.0,
        mentorshipTeachingBonus: 0.35,
      };
    case 'Elder':
      return {
        learningRateMultiplier: 0.75,
        workOutputMultiplier: 0.65,
        mentorshipTeachingBonus: 0.65, // Elders excel at passing down knowledge
      };
  }
}

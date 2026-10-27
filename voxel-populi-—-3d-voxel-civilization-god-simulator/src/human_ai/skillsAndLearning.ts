/**
 * ============================================================================
 * LAYER 2: EXPERIENTIAL LEARNING, SKILL MASTERY & DYNAMIC CAREER REASSIGNMENT
 * ============================================================================
 * Models how humans acquire skills over time:
 * 1. Learning by Doing (Experiential Practice with diminishing returns as mastery approaches 100)
 * 2. Mentorship & Observational Learning (Apprentices learning from higher-skill Mentors)
 * 3. Skill-to-Profession Mapping & Dynamic Career Reassignment (Comparative Advantage)
 * 4. Mastery Rank Progression (Novice -> Apprentice -> Journeyman -> Master -> Grandmaster)
 */

import { getLifeStageMultipliers } from './personalityAndGenetics';
import {
  HumanBrainState,
  HumanProfession,
  HumanSkillSet,
  SkillName,
} from './types';

/**
 * Maps each profession to its primary and secondary skill domains.
 */
export const PROFESSION_SKILL_MAP: Record<
  HumanProfession,
  { primary: SkillName; secondary: SkillName }
> = {
  Forager: { primary: 'farming', secondary: 'carpentry' },
  Hunter: { primary: 'combat', secondary: 'farming' },
  Fisher: { primary: 'seafaring', secondary: 'farming' },
  Sailor: { primary: 'seafaring', secondary: 'carpentry' },
  Lumberjack: { primary: 'carpentry', secondary: 'mining' },
  Miner: { primary: 'mining', secondary: 'smithing' },
  Farmer: { primary: 'farming', secondary: 'carpentry' },
  Builder: { primary: 'carpentry', secondary: 'mining' },
  Artisan: { primary: 'smithing', secondary: 'carpentry' },
  Trader: { primary: 'scholarship', secondary: 'seafaring' },
  Soldier: { primary: 'combat', secondary: 'smithing' },
  Scholar: { primary: 'scholarship', secondary: 'smithing' },
  Priest: { primary: 'scholarship', secondary: 'farming' },
  Explorer: { primary: 'seafaring', secondary: 'combat' },
  Ruler: { primary: 'scholarship', secondary: 'combat' },
};

/**
 * Creates a fresh initial skill set for a newborn or newly spawned human.
 */
export function createInitialSkills(baseLevel = 5): HumanSkillSet {
  return {
    farming: baseLevel,
    mining: baseLevel,
    smithing: baseLevel,
    carpentry: baseLevel,
    combat: baseLevel,
    scholarship: baseLevel,
    seafaring: baseLevel,
  };
}

/**
 * Experiential Learning Formula ("Learning by Doing"):
 *
 * When a human executes a task using skill S, their skill gain ΔS is computed as:
 *   ΔS = BaseGain
 *        × IntelligenceAptitude
 *        × (1 + 0.35 × max(0, Curiosity) + 0.25 × max(0, Diligence))
 *        × LifeStagePlasticityMultiplier
 *        × MentorBonus
 *        × DiminishingReturnsFactor(S)
 *
 * Where DiminishingReturnsFactor(S) = ((100 - S) / 100)^0.65
 * so novices improve rapidly from early practice, while reaching 95–100 requires
 * sustained dedication and high intelligence.
 */
export function applyExperientialSkillLearning(
  human: HumanBrainState,
  practicedSkill: SkillName,
  basePracticeIntensity = 1.4,
  mentorBrain?: HumanBrainState | null
): {
  previousLevel: number;
  newLevel: number;
  deltaGained: number;
  rankPromoted: boolean;
  skillBreakthroughReached: boolean;
} {
  const prev = human.skills[practicedSkill];
  if (prev >= 100) {
    return {
      previousLevel: 100,
      newLevel: 100,
      deltaGained: 0,
      rankPromoted: false,
      skillBreakthroughReached: false,
    };
  }

  const stageMult = getLifeStageMultipliers(human.lifeStage).learningRateMultiplier;

  // Personality multiplier: curious and diligent humans learn faster from experience
  const traitBoost =
    1.0 +
    Math.max(0, human.personality.curiosity) * 0.35 +
    Math.max(0, human.personality.diligence) * 0.25;

  // Mentorship transfer: if paired with a mentor whose skill exceeds the learner's,
  // knowledge transfers proportional to the skill gap and mentor's teaching ability.
  let mentorMultiplier = 1.0;
  if (mentorBrain && mentorBrain.skills[practicedSkill] > prev) {
    const skillGap = mentorBrain.skills[practicedSkill] - prev;
    const mentorTeachingBonus = getLifeStageMultipliers(
      mentorBrain.lifeStage
    ).mentorshipTeachingBonus;
    mentorMultiplier = 1.0 + (skillGap / 100) * (0.65 + mentorTeachingBonus);
  }

  // Asymptotic diminishing returns as skill approaches 100
  const diminishingReturns = Math.pow(Math.max(0.05, (100 - prev) / 100), 0.65);

  const rawDelta =
    basePracticeIntensity *
    human.aptitudes.intelligence *
    traitBoost *
    stageMult *
    mentorMultiplier *
    diminishingReturns;

  const next = Math.min(100, Number((prev + rawDelta).toFixed(2)));
  human.skills[practicedSkill] = next;
  human.experiencePoints += Math.round(rawDelta * 10);

  // Check if a major milestone (25, 50, 75, 90) was crossed
  const milestones = [25, 50, 75, 90];
  const skillBreakthroughReached = milestones.some((m) => prev < m && next >= m);

  // Update mastery rank title based on primary job skill
  const prevRank = human.rankTitle;
  human.rankTitle = computeMasteryRank(human);
  const rankPromoted = prevRank !== human.rankTitle;

  return {
    previousLevel: prev,
    newLevel: next,
    deltaGained: Number((next - prev).toFixed(2)),
    rankPromoted,
    skillBreakthroughReached,
  };
}

/**
 * Computes a human's mastery rank from their primary profession skill level.
 */
export function computeMasteryRank(
  human: HumanBrainState
): HumanBrainState['rankTitle'] {
  const mapping = PROFESSION_SKILL_MAP[human.profession];
  const primaryLevel = human.skills[mapping.primary];

  if (primaryLevel >= 88) return 'Grandmaster';
  if (primaryLevel >= 70) return 'Master';
  if (primaryLevel >= 45) return 'Journeyman';
  if (primaryLevel >= 22) return 'Apprentice';
  return 'Novice';
}

/**
 * Computes how productive a human is at their current profession, combining:
 * - Primary skill proficiency (70% weight)
 * - Secondary skill proficiency (30% weight)
 * - Diligence personality trait
 * - Life-stage work output multiplier
 */
export function computeWorkProductivityMultiplier(human: HumanBrainState): number {
  const { primary, secondary } = PROFESSION_SKILL_MAP[human.profession];
  const weightedSkill =
    human.skills[primary] * 0.7 + human.skills[secondary] * 0.3;

  const skillFactor = 0.65 + (weightedSkill / 100) * 1.35; // 0.65x at 0 skill -> 2.0x at 100 skill
  const diligenceFactor = 1.0 + human.personality.diligence * 0.25;
  const stageFactor = getLifeStageMultipliers(human.lifeStage).workOutputMultiplier;

  return Number((skillFactor * diligenceFactor * stageFactor).toFixed(2));
}

/**
 * Dynamic Career Adaptation (Comparative Advantage & Societal Needs):
 * Evaluates whether an adult human should switch professions based on:
 * 1. Emergency community food shortage (switch to Forager/Farmer/Hunter)
 * 2. High personal talent in a specific skill + high curiosity/ambition
 */
export function evaluateCareerAdaptation(
  human: HumanBrainState,
  communityFoodShortage: boolean,
  eraIndex: number
): HumanProfession {
  if (human.profession === 'Ruler' || human.lifeStage === 'Baby' || human.lifeStage === 'Child') {
    return human.profession;
  }

  // Survival override: if the community is starving and this human isn't already producing food,
  // pragmatic citizens retrain into food production.
  if (
    communityFoodShortage &&
    human.profession !== 'Farmer' &&
    human.profession !== 'Hunter' &&
    human.profession !== 'Fisher' &&
    human.profession !== 'Forager'
  ) {
    if (eraIndex === 0) {
      return human.skills.combat >= human.skills.farming ? 'Hunter' : 'Forager';
    }
    return 'Farmer';
  }

  // Comparative advantage specialization: find the human's highest developed skill
  const entries = Object.entries(human.skills) as [SkillName, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [bestSkill, bestVal] = entries[0];

  const currentPrimary = PROFESSION_SKILL_MAP[human.profession].primary;
  const currentVal = human.skills[currentPrimary];

  // Only switch if another skill is significantly stronger (+18 pts) and era supports the job
  if (bestVal >= currentVal + 18) {
    switch (bestSkill) {
      case 'scholarship':
        return eraIndex >= 1 ? 'Scholar' : human.profession;
      case 'smithing':
        return eraIndex >= 2 ? 'Artisan' : 'Builder';
      case 'carpentry':
        return 'Builder';
      case 'mining':
        return 'Miner';
      case 'combat':
        return eraIndex >= 1 ? 'Soldier' : 'Hunter';
      case 'seafaring':
        return eraIndex >= 1 ? 'Sailor' : 'Fisher';
      case 'farming':
        return eraIndex >= 1 ? 'Farmer' : 'Forager';
    }
  }

  return human.profession;
}

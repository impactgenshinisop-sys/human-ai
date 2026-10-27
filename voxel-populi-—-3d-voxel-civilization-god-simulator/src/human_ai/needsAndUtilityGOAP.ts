/**
 * ============================================================================
 * LAYER 3: MASLOW NEEDS, CIRCADIAN SCHEDULE & UTILITY / GOAP DECISION ENGINE
 * ============================================================================
 * Models how a human perceives their internal physiological/psychological drives
 * and external context, scores every candidate goal using continuous Utility
 * curves, and generates a multi-step GOAP (Goal-Oriented Action Planning) plan
 * plus an internal monologue thought bubble.
 */

import { PROFESSION_SKILL_MAP } from './skillsAndLearning';
import {
  CognitiveGoalType,
  DailyScheduleSlot,
  GOAPDecisionResult,
  HumanBrainState,
  PerceivedEnvironmentContext,
  SkillName,
} from './types';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Maps normalized time of day (0.0 .. 1.0) to a structured circadian schedule slot.
 */
export function computeDailyScheduleSlot(timeOfDay01: number): DailyScheduleSlot {
  if (timeOfDay01 < 0.22 || timeOfDay01 >= 0.88) return 'NightRest';
  if (timeOfDay01 < 0.30) return 'Dawn';
  if (timeOfDay01 < 0.48) return 'MorningShift';
  if (timeOfDay01 < 0.56) return 'MiddayMeal';
  if (timeOfDay01 < 0.74) return 'AfternoonShift';
  return 'EveningSocial';
}

/**
 * Updates a human's biological and psychological drives over a simulation tick:
 * - Satiety decays steadily (faster during heavy physical work)
 * - Warmth & Rest decays faster during cold weather or night hours outside shelter
 * - Safety drops when nearbyThreatLevel01 is elevated
 * - Social belonging decays slowly when isolated
 */
export function tickBiologicalNeeds(
  human: HumanBrainState,
  env: PerceivedEnvironmentContext,
  dtSeconds: number
): void {
  const isWorkingHard =
    human.currentGoal === 'PerformProfessionWork' ||
    human.currentGoal === 'ConstructCommunityProject';

  const metabolicRate = isWorkingHard ? 0.55 : 0.32;
  human.needs.satiety = clamp(
    human.needs.satiety - metabolicRate * dtSeconds,
    0,
    100
  );

  const coldDrain = 0.25 + env.environmentalColdStress01 * 0.65;
  human.needs.warmthAndRest = clamp(
    human.needs.warmthAndRest - coldDrain * dtSeconds,
    0,
    100
  );

  if (env.nearbyThreatLevel01 > 0.1) {
    human.needs.safety = clamp(
      human.needs.safety - env.nearbyThreatLevel01 * 2.5 * dtSeconds,
      0,
      100
    );
  } else {
    human.needs.safety = clamp(human.needs.safety + 0.8 * dtSeconds, 0, 100);
  }

  human.needs.socialBelonging = clamp(
    human.needs.socialBelonging - 0.22 * dtSeconds,
    0,
    100
  );

  // Starvation or severe hypothermia damages health
  if (human.needs.satiety <= 2 || human.needs.warmthAndRest <= 2) {
    human.health = Math.max(0, human.health - 1.2 * dtSeconds);
  } else if (human.needs.satiety > 60 && human.needs.warmthAndRest > 50) {
    human.health = Math.min(human.maxHealth, human.health + 0.4 * dtSeconds);
  }
}

/**
 * Evaluates moral compliance vs. desperation theft when a human faces severe scarcity:
 * If satiety < 18, community food is unavailable, and personal wealth is 0,
 * low-piety / low-diligence citizens may resort to `DesperateThief`.
 */
export function evaluateMoralPressure(
  human: HumanBrainState,
  env: PerceivedEnvironmentContext
): void {
  if (human.moralStatus === 'Imprisoned') return;

  const isStarving = human.needs.satiety < 18 && human.foodRationsCarried <= 0;
  const isDestitute = human.wealthCoins <= 1 && !env.communityFoodAvailable;

  // Moral resistance threshold depends on piety and diligence
  const moralAnchor = human.personality.piety * 0.6 + human.personality.diligence * 0.4;

  if (isStarving && isDestitute && moralAnchor < 0.15) {
    human.moralStatus = human.crimeCount >= 3 ? 'Outlaw' : 'DesperateThief';
  } else if (human.needs.satiety > 55 && human.moralStatus === 'DesperateThief') {
    // Reformed once survival crisis passes
    human.moralStatus = 'LawAbiding';
  }
}

/**
 * Core Utility + GOAP Decision Engine:
 *
 * Evaluates all 13 candidate goals using non-linear urgency curves:
 * - Physiological survival drives (Hunger, Warmth, Threat) use exponential urgency curves
 *   so they naturally preempt routine work only when critical.
 * - During work shifts (`MorningShift`, `AfternoonShift`), productive goals scale with
 *   `diligence`, `curiosity`, and skill proficiency.
 * - Children prioritize `ChildPlayAndLearn`; Teens prioritize `ApprenticeStudyUnderMentor`.
 */
export function evaluateGOAPDecision(
  human: HumanBrainState,
  env: PerceivedEnvironmentContext
): GOAPDecisionResult {
  const slot = computeDailyScheduleSlot(env.timeOfDay01);
  human.scheduleSlot = slot;

  evaluateMoralPressure(human, env);

  const scores: Record<CognitiveGoalType, number> = {
    EmergencyEat: 0,
    EmergencyWarmthAndRest: 0,
    FleeOrFightThreat: 0,
    ChildPlayAndLearn: 0,
    ApprenticeStudyUnderMentor: 0,
    PerformProfessionWork: 0,
    ConstructCommunityProject: 0,
    ConductResearchAndScholarship: 0,
    TradeAndBarter: 0,
    SocializeAndCourt: 0,
    PatrolAndEnforceLaw: 0,
    CommitDesperationTheft: 0,
    SleepAtHome: 0,
  };

  // 1. Physiological Hunger Drive (Exponential urgency below satiety = 35)
  const hungerDeficit = 100 - human.needs.satiety;
  scores.EmergencyEat =
    human.needs.satiety < 28
      ? 85 + Math.pow((30 - human.needs.satiety) / 30, 1.5) * 40
      : slot === 'MiddayMeal' && human.needs.satiety < 75
      ? 68
      : hungerDeficit * 0.45;

  // 2. Thermal & Exhaustion Drive
  const restDeficit = 100 - human.needs.warmthAndRest;
  scores.EmergencyWarmthAndRest =
    human.needs.warmthAndRest < 24
      ? 82 + (25 - human.needs.warmthAndRest) * 1.5
      : restDeficit * 0.4 + env.environmentalColdStress01 * 28;

  // 3. Threat Response (Fight or Flight based on Courage + Combat Skill)
  if (env.nearbyThreatLevel01 > 0.15) {
    scores.FleeOrFightThreat = 92 + env.nearbyThreatLevel01 * 35;
  }

  // 4. Circadian Night Sleep
  if (slot === 'NightRest') {
    scores.SleepAtHome = 78 + (100 - human.needs.warmthAndRest) * 0.3;
  }

  // 5. Life-Stage Specific Developmental Goals (Children & Teen Apprentices)
  if (human.lifeStage === 'Baby' || human.lifeStage === 'Child') {
    scores.ChildPlayAndLearn =
      slot === 'NightRest' ? 15 : 76 + Math.max(0, human.personality.curiosity) * 18;
  } else if (human.lifeStage === 'Teen') {
    scores.ApprenticeStudyUnderMentor =
      slot === 'MorningShift' || slot === 'AfternoonShift'
        ? 79 + Math.max(0, human.personality.curiosity) * 16
        : 32;
  }

  // 6. Adult & Elder Productive Goals during Work Shifts
  const isWorkShift =
    slot === 'Dawn' || slot === 'MorningShift' || slot === 'AfternoonShift';

  if (human.lifeStage === 'Adult' || human.lifeStage === 'Elder') {
    const workDrive =
      (isWorkShift ? 64 : 28) +
      human.personality.diligence * 18 +
      (human.skills[PROFESSION_SKILL_MAP[human.profession].primary] / 100) * 12;

    scores.PerformProfessionWork = workDrive;

    if (
      env.hasActiveConstructionProject &&
      (human.profession === 'Builder' || human.skills.carpentry >= 30)
    ) {
      scores.ConstructCommunityProject =
        (isWorkShift ? 68 : 25) + human.personality.diligence * 16;
    }

    if (
      human.profession === 'Scholar' ||
      human.profession === 'Priest' ||
      human.personality.curiosity > 0.45
    ) {
      scores.ConductResearchAndScholarship =
        (isWorkShift ? 62 : 35) +
        human.personality.curiosity * 24 +
        (human.skills.scholarship / 100) * 15;
    }

    if (human.profession === 'Trader') {
      scores.TradeAndBarter = isWorkShift ? 72 : 35;
    }

    if (human.profession === 'Soldier') {
      scores.PatrolAndEnforceLaw =
        (isWorkShift ? 70 : 45) + human.personality.courage * 18;
    }
  }

  // 7. Social Belonging, Courtship & Mentorship
  const socialDeficit = 100 - human.needs.socialBelonging;
  scores.SocializeAndCourt =
    (slot === 'EveningSocial' ? 66 : 22) +
    socialDeficit * 0.35 +
    human.personality.sociability * 18;

  // 8. Desperation Theft (only when starving & morally compromised)
  if (human.moralStatus === 'DesperateThief' || human.moralStatus === 'Outlaw') {
    scores.CommitDesperationTheft =
      human.needs.satiety < 22 ? 89 : 45 - human.personality.piety * 25;
  }

  // Select highest-scoring goal
  let chosenGoal: CognitiveGoalType = 'PerformProfessionWork';
  let bestScore = -Infinity;

  for (const [goalKey, score] of Object.entries(scores) as [
    CognitiveGoalType,
    number,
  ][]) {
    if (score > bestScore) {
      bestScore = score;
      chosenGoal = goalKey;
    }
  }

  const plan = buildGOAPPlanAndMonologue(human, chosenGoal, env);
  human.currentGoal = chosenGoal;
  human.plannedSteps = plan.steps;
  human.thoughtBubble = plan.monologue;

  return {
    chosenGoal,
    utilityScore: Number(bestScore.toFixed(1)),
    plannedSteps: plan.steps,
    internalMonologue: plan.monologue,
    targetSkillToPractice: plan.practicedSkill,
    allGoalScores: scores,
  };
}

/**
 * Generates the multi-step GOAP action sequence, practiced skill, and natural-language
 * internal thought bubble for the winning goal.
 */
function buildGOAPPlanAndMonologue(
  human: HumanBrainState,
  goal: CognitiveGoalType,
  env: PerceivedEnvironmentContext
): {
  steps: string[];
  monologue: string;
  practicedSkill: SkillName | null;
} {
  const jobSkill = PROFESSION_SKILL_MAP[human.profession].primary;

  switch (goal) {
    case 'EmergencyEat':
      return {
        steps: [
          'LocateFoodSourceOrGranary',
          'AcquireRation',
          'ConsumeMealAndRestoreSatiety',
        ],
        monologue:
          human.foodRationsCarried > 0
            ? 'Eating my carried rations to keep my strength up.'
            : 'Heading to the granary for a hot meal.',
        practicedSkill: null,
      };

    case 'EmergencyWarmthAndRest':
      return {
        steps: ['FindNearestHearthOrHome', 'WarmByFirepit', 'RecoverStamina'],
        monologue:
          env.environmentalColdStress01 > 0.5
            ? 'Freezing wind—need to warm up by the hearth!'
            : 'Exhausted—taking a moment to rest.',
        practicedSkill: null,
      };

    case 'FleeOrFightThreat': {
      const bravelyFights =
        human.profession === 'Soldier' ||
        human.personality.courage > 0.25 ||
        human.skills.combat >= 40;
      return bravelyFights
        ? {
            steps: ['ReadyWeapon', 'InterceptHostileThreat', 'DefendSettlement'],
            monologue: 'Standing firm to defend our people from danger!',
            practicedSkill: 'combat',
          }
        : {
            steps: ['AlertWatch', 'RetreatToSafeShelter', 'WaitUntilAllClear'],
            monologue: 'Danger nearby! Getting to safety!',
            practicedSkill: null,
          };
    }

    case 'ChildPlayAndLearn':
      return {
        steps: ['GatherWithVillageChildren', 'PlayTagAndExplore', 'ObserveAdultsWorking'],
        monologue: 'Playing with friends and watching how the elders craft!',
        practicedSkill: human.personality.curiosity > 0.2 ? 'scholarship' : 'carpentry',
      };

    case 'ApprenticeStudyUnderMentor':
      return {
        steps: [
          'SeekAssignedMentor',
          'ObserveMasterTechnique',
          'PracticeApprenticeTask',
        ],
        monologue: `Learning the ${human.profession.toLowerCase()} trade as an apprentice.`,
        practicedSkill: jobSkill,
      };

    case 'ConstructCommunityProject':
      return {
        steps: [
          'FetchTimberAndStone',
          'MoveToActiveBuildSite',
          'AssembleStructuralFrame',
        ],
        monologue: 'Hauling materials to help raise our new building.',
        practicedSkill: 'carpentry',
      };

    case 'ConductResearchAndScholarship':
      return {
        steps: [
          'GatherObservationsAndNotes',
          'ExperimentWithTechniques',
          'RecordFindingsInChronicle',
        ],
        monologue: 'Studying nature and testing new ideas for our tribe.',
        practicedSkill: 'scholarship',
      };

    case 'TradeAndBarter':
      return {
        steps: [
          'LoadSurplusGoods',
          'TravelToMarketExchange',
          'NegotiateFairBarter',
        ],
        monologue: 'Trading surplus wares at the market stalls.',
        practicedSkill: 'scholarship',
      };

    case 'SocializeAndCourt':
      return {
        steps: [
          'VisitTownSquareOrHearth',
          'ShareStoriesWithNeighbors',
          'StrengthenSocialBonds',
        ],
        monologue: 'Catching up with friends and family by the fire.',
        practicedSkill: null,
      };

    case 'PatrolAndEnforceLaw':
      return {
        steps: [
          'WalkSettlementPerimeter',
          'InspectRoadsAndGranaries',
          'DetainLawbreakersOrPredators',
        ],
        monologue: 'On watch patrol—keeping the peace.',
        practicedSkill: 'combat',
      };

    case 'CommitDesperationTheft':
      return {
        steps: [
          'CheckForNearbyGuards',
          'SneakIntoStorage',
          'PilferEmergencyRations',
        ],
        monologue: 'So hungry... I have no choice but to take a ration.',
        practicedSkill: null,
      };

    case 'SleepAtHome':
      return {
        steps: ['ReturnToHomeShelter', 'SleepThroughNight', 'WakeRefreshedAtDawn'],
        monologue: 'Heading home to sleep for the night.',
        practicedSkill: null,
      };

    case 'PerformProfessionWork':
    default:
      return {
        steps: [
          `Equip${human.profession}Tools`,
          `TravelTo${human.profession}Workplace`,
          `Execute${human.profession}Production`,
          'DepositOutputInStockpile',
        ],
        monologue: `Working diligently as a ${human.rankTitle} ${human.profession}.`,
        practicedSkill: jobSkill,
      };
  }
}

/**
 * STANDALONE HUMAN AI ENGINE (SINGLE-FILE EDITION)
 * Pure human intelligence, learning, skills, genetics, GOAP decisions, memory & social bonds.
 * Zero graphics, zero appearance/clothing, zero worldgen/biomes.
 */

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}


// ==================== FILE: types.ts ====================
/**
 * ============================================================================
 * HUMAN AI ENGINE — PURE COGNITION, LEARNING, SKILLS & DECISION TYPES
 * ============================================================================
 * Zero graphics, zero visual appearance/clothing, zero worldgen/biome logic.
 * Purely models how human agents think, learn, inherit traits, satisfy needs,
 * make Utility/GOAP decisions, form memories/relationships, and advance society.
 */

export type LifeStage = 'Baby' | 'Child' | 'Teen' | 'Adult' | 'Elder';

export type SocialClass =
  | 'Servant'
  | 'Peasant'
  | 'Craftsperson'
  | 'Merchant'
  | 'Clergy'
  | 'Noble'
  | 'Ruler';

export type HumanProfession =
  | 'Forager'
  | 'Hunter'
  | 'Fisher'
  | 'Sailor'
  | 'Lumberjack'
  | 'Miner'
  | 'Farmer'
  | 'Builder'
  | 'Artisan'
  | 'Trader'
  | 'Soldier'
  | 'Scholar'
  | 'Priest'
  | 'Explorer'
  | 'Ruler';

export type EraTier =
  | 'Stone Age'
  | 'Neolithic'
  | 'Bronze Age'
  | 'Iron Age'
  | 'Medieval'
  | 'Arcane Renaissance';

export type DailyScheduleSlot =
  | 'Dawn'
  | 'MorningShift'
  | 'MiddayMeal'
  | 'AfternoonShift'
  | 'EveningSocial'
  | 'NightRest';

export type MoralStatus = 'LawAbiding' | 'DesperateThief' | 'Outlaw' | 'Imprisoned';

/**
 * 5-Axis Continuous Personality Vector (-1.0 to +1.0)
 * Governs intrinsic preferences, work ethic, learning speed, and social behavior.
 */
export interface PersonalityVector {
  /** Work ethic & persistence (-1 = idle/lazy, +1 = tireless worker) */
  diligence: number;
  /** Drive to explore, experiment, and learn new skills/tech (-1 = traditional, +1 = inventive) */
  curiosity: number;
  /** Desire for conversation, courtship, and mentorship (-1 = solitary, +1 = gregarious) */
  sociability: number;
  /** Willingness to confront threats, hunt predators, or defend others (-1 = timid, +1 = fearless) */
  courage: number;
  /** Respect for laws, traditions, and spiritual rites (-1 = rebellious, +1 = devout/lawful) */
  piety: number;
}

/**
 * Core Genetic & Cognitive Aptitudes (0.40 to 1.60 multiplier scale)
 */
export interface GeneticAptitudes {
  /** Scales experiential skill gain rate and research output */
  intelligence: number;
  /** Scales physical labor output, stamina, and combat resilience */
  strength: number;
  /** Scales reproductive likelihood during adulthood */
  fertility: number;
}

/**
 * 7 Experiential Skills (0 to 100 proficiency scale)
 * Humans are NOT born with fixed mastery; they learn by doing tasks and via mentorship.
 */
export interface HumanSkillSet {
  farming: number;
  mining: number;
  smithing: number;
  carpentry: number;
  combat: number;
  scholarship: number;
  seafaring: number;
}

export type SkillName = keyof HumanSkillSet;

/**
 * Maslow-Inspired Biological & Psychological Drives (0 to 100 scale, where 100 = fully satisfied)
 * Note: `hunger` is tracked as fullness/satiety (100 = full, 0 = starving).
 */
export interface VitalNeeds {
  /** Satiety (100 = well-fed, < 30 = hungry, < 15 = starving emergency) */
  satiety: number;
  /** Rest & thermal comfort (100 = well-rested/warm, < 25 = exhausted/freezing) */
  warmthAndRest: number;
  /** Perceived safety from threats/predators/war (100 = safe, < 35 = endangered) */
  safety: number;
  /** Social belonging & companionship (100 = fulfilled, < 30 = lonely) */
  socialBelonging: number;
}

/**
 * High-Level Candidate Goals Evaluated by the Utility + GOAP Decision Engine
 */
export type CognitiveGoalType =
  | 'EmergencyEat'
  | 'EmergencyWarmthAndRest'
  | 'FleeOrFightThreat'
  | 'ChildPlayAndLearn'
  | 'ApprenticeStudyUnderMentor'
  | 'PerformProfessionWork'
  | 'ConstructCommunityProject'
  | 'ConductResearchAndScholarship'
  | 'TradeAndBarter'
  | 'SocializeAndCourt'
  | 'PatrolAndEnforceLaw'
  | 'CommitDesperationTheft'
  | 'SleepAtHome';

/**
 * Scored GOAP Decision Output
 */
export interface GOAPDecisionResult {
  chosenGoal: CognitiveGoalType;
  utilityScore: number;
  plannedSteps: string[];
  internalMonologue: string;
  targetSkillToPractice: SkillName | null;
  allGoalScores: Record<CognitiveGoalType, number>;
}

/**
 * Episodic Memory Entry in a Human's Life Log
 */
export interface EpisodicMemory {
  year: number;
  age: number;
  category:
    | 'Birth'
    | 'SkillBreakthrough'
    | 'CareerPromotion'
    | 'Marriage'
    | 'Childbirth'
    | 'SurvivalCrisis'
    | 'Mentorship'
    | 'CrimeOrJustice'
    | 'Discovery';
  importance: number; // 0..100 (determines retention during memory consolidation)
  summary: string;
}

/**
 * Directed Social Relationship Edge in the Human Social Graph
 */
export interface SocialBond {
  targetAgentId: number;
  targetName: string;
  relationType: 'Spouse' | 'Parent' | 'Child' | 'Mentor' | 'Apprentice' | 'Friend' | 'Rival';
  /** Affinity score (-100 = bitter enemy, 0 = neutral, +100 = devoted bond) */
  affinity: number;
}

/**
 * Abstract Environment Context Passed to the Brain Each Tick
 * (Contains zero graphics or terrain generation details—only cognitive perceptions)
 */
export interface PerceivedEnvironmentContext {
  currentYear: number;
  /** Normalized time of day (0.0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk) */
  timeOfDay01: number;
  /** Ambient cold/weather stress (0.0 = mild, 1.0 = severe blizzard/storm) */
  environmentalColdStress01: number;
  /** Nearby danger level from hostiles/predators (0.0 = peaceful, 1.0 = active attack) */
  nearbyThreatLevel01: number;
  /** Whether community food stockpile has rations available */
  communityFoodAvailable: boolean;
  /** Whether there is an active construction project needing builders */
  hasActiveConstructionProject: boolean;
  /** Current technological era index (0 = Stone Age .. 5 = Arcane Renaissance) */
  eraIndex: number;
}

/**
 * Complete State of a Single Intelligent Human Agent
 */
export interface HumanBrainState {
  id: number;
  name: string;
  age: number;
  lifeStage: LifeStage;
  profession: HumanProfession;
  roleTitle: string;
  rankTitle: 'Novice' | 'Apprentice' | 'Journeyman' | 'Master' | 'Grandmaster';
  socialClass: SocialClass;

  // Genetics & Personality
  personality: PersonalityVector;
  aptitudes: GeneticAptitudes;
  parentIds: [number | null, number | null];

  // Learning & Skills
  skills: HumanSkillSet;
  totalTasksCompleted: number;
  experiencePoints: number;
  mentorId: number | null;

  // Biological & Psychological Drives
  health: number;
  maxHealth: number;
  needs: VitalNeeds;
  wealthCoins: number;
  foodRationsCarried: number;

  // Morality & Law
  moralStatus: MoralStatus;
  crimeCount: number;

  // Active Cognition
  scheduleSlot: DailyScheduleSlot;
  currentGoal: CognitiveGoalType;
  plannedSteps: string[];
  thoughtBubble: string;

  // Memory & Social Graph
  memories: EpisodicMemory[];
  relationships: SocialBond[];
  isNotableHistoricalFigure: boolean;
  notableReason: string | null;
}

// ==================== FILE: personalityAndGenetics.ts ====================
/**
 * ============================================================================
 * LAYER 1: PERSONALITY, GENETIC INHERITANCE & LIFE-STAGE DEVELOPMENT
 * ============================================================================
 * Models how human personality traits and cognitive aptitudes are generated,
 * inherited from parents with genetic crossover + mutation, and how humans
 * mature across 5 developmental life stages (Baby -> Child -> Teen -> Adult -> Elder).
 */


/**
 * Deterministic PRNG interface so the AI remains 100% reproducible from any seed.
 */
export interface DeterministicRNG {
  next(): number; // Returns float in [0, 1)
  range(min: number, max: number): number;
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

// ==================== FILE: skillsAndLearning.ts ====================
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

// ==================== FILE: needsAndUtilityGOAP.ts ====================
/**
 * ============================================================================
 * LAYER 3: MASLOW NEEDS, CIRCADIAN SCHEDULE & UTILITY / GOAP DECISION ENGINE
 * ============================================================================
 * Models how a human perceives their internal physiological/psychological drives
 * and external context, scores every candidate goal using continuous Utility
 * curves, and generates a multi-step GOAP (Goal-Oriented Action Planning) plan
 * plus an internal monologue thought bubble.
 */





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

// ==================== FILE: memoryAndSocialBonds.ts ====================
/**
 * ============================================================================
 * LAYER 4: EPISODIC MEMORY CONSOLIDATION & SOCIAL GRAPH DYNAMICS
 * ============================================================================
 * Models how humans remember significant life events, prune low-importance
 * memories while preserving core autobiographical milestones, form friendships,
 * mentorships, marriages, and earn Hall-of-Fame historical status.
 */




/**
 * Records an episodic memory in the human's autobiographical life log.
 * Automatically consolidates memory if the log exceeds capacity:
 * - Regular citizens retain their top 12 highest-importance memories.
 * - Notable historical figures retain up to 35 detailed memories.
 */
export function recordEpisodicMemory(
  human: HumanBrainState,
  memory: EpisodicMemory
): void {
  human.memories.push(memory);

  const maxCapacity = human.isNotableHistoricalFigure ? 35 : 12;
  if (human.memories.length > maxCapacity) {
    // Keep chronological order of the most important milestones
    const sortedByImportance = [...human.memories].sort(
      (a, b) => b.importance - a.importance
    );
    const keptSet = new Set(sortedByImportance.slice(0, maxCapacity));
    human.memories = human.memories.filter((m) => keptSet.has(m));
  }
}

/**
 * Computes personality compatibility (-1.0 to +1.0) between two humans
 * using cosine-like similarity across their 5 personality axes.
 * Humans with similar values in diligence, curiosity, and piety bond faster.
 */
export function computePersonalityCompatibility(
  a: PersonalityVector,
  b: PersonalityVector
): number {
  const diff =
    Math.abs(a.diligence - b.diligence) * 0.25 +
    Math.abs(a.curiosity - b.curiosity) * 0.2 +
    Math.abs(a.sociability - b.sociability) * 0.2 +
    Math.abs(a.courage - b.courage) * 0.15 +
    Math.abs(a.piety - b.piety) * 0.2;

  // diff is in [0, 2]; map to [-1, +1]
  return Number(clamp(1.0 - diff, -1.0, 1.0).toFixed(2));
}

/**
 * Updates social affinity between two interacting humans and upgrades their
 * relationship status (Friend, Rival, Spouse, or Mentor/Apprentice).
 */
export function interactAndUpdateSocialBond(
  humanA: HumanBrainState,
  humanB: HumanBrainState,
  currentYear: number
): {
  affinityDelta: number;
  newRelationType: string;
  formedMarriage: boolean;
  formedMentorship: boolean;
} {
  const compatibility = computePersonalityCompatibility(
    humanA.personality,
    humanB.personality
  );

  const sociabilityBoost =
    (humanA.personality.sociability + humanB.personality.sociability) * 2.5;
  const affinityDelta = Number((4.5 + compatibility * 6.0 + sociabilityBoost).toFixed(1));

  const upsertBond = (
    self: HumanBrainState,
    other: HumanBrainState,
    delta: number
  ) => {
    let bond = self.relationships.find((r) => r.targetAgentId === other.id);
    if (!bond) {
      bond = {
        targetAgentId: other.id,
        targetName: other.name,
        relationType: delta >= 0 ? 'Friend' : 'Rival',
        affinity: clamp(delta * 3, -100, 100),
      };
      self.relationships.push(bond);
    } else {
      bond.affinity = clamp(bond.affinity + delta, -100, 100);
      if (bond.relationType === 'Friend' && bond.affinity < -25) {
        bond.relationType = 'Rival';
      } else if (bond.relationType === 'Rival' && bond.affinity > 20) {
        bond.relationType = 'Friend';
      }
    }
    return bond;
  };

  const bondA = upsertBond(humanA, humanB, affinityDelta);
  const bondB = upsertBond(humanB, humanA, affinityDelta);

  // Restore social belonging need for both participants
  humanA.needs.socialBelonging = clamp(humanA.needs.socialBelonging + 14, 0, 100);
  humanB.needs.socialBelonging = clamp(humanB.needs.socialBelonging + 14, 0, 100);

  let formedMarriage = false;
  let formedMentorship = false;

  // Check for Marriage formation between compatible, unpartnered Adults
  const aHasSpouse = humanA.relationships.some((r) => r.relationType === 'Spouse');
  const bHasSpouse = humanB.relationships.some((r) => r.relationType === 'Spouse');
  const areRelatives = humanA.relationships.some(
    (r) =>
      r.targetAgentId === humanB.id &&
      (r.relationType === 'Parent' || r.relationType === 'Child')
  );

  if (
    !aHasSpouse &&
    !bHasSpouse &&
    !areRelatives &&
    humanA.lifeStage === 'Adult' &&
    humanB.lifeStage === 'Adult' &&
    bondA.affinity >= 65
  ) {
    bondA.relationType = 'Spouse';
    bondB.relationType = 'Spouse';
    formedMarriage = true;

    recordEpisodicMemory(humanA, {
      year: currentYear,
      age: humanA.age,
      category: 'Marriage',
      importance: 92,
      summary: `United in marriage with ${humanB.name}.`,
    });
    recordEpisodicMemory(humanB, {
      year: currentYear,
      age: humanB.age,
      category: 'Marriage',
      importance: 92,
      summary: `United in marriage with ${humanA.name}.`,
    });
  }

  // Check for Mentor <-> Apprentice pairing (Teen/Novice learning from Master/Adult)
  if (
    humanA.lifeStage === 'Teen' &&
    humanA.mentorId === null &&
    (humanB.lifeStage === 'Adult' || humanB.lifeStage === 'Elder') &&
    bondA.affinity >= 25
  ) {
    humanA.mentorId = humanB.id;
    bondA.relationType = 'Mentor';
    bondB.relationType = 'Apprentice';
    formedMentorship = true;

    recordEpisodicMemory(humanA, {
      year: currentYear,
      age: humanA.age,
      category: 'Mentorship',
      importance: 78,
      summary: `Became apprentice under Mentor ${humanB.name} (${humanB.profession}).`,
    });
  }

  return {
    affinityDelta,
    newRelationType: bondA.relationType,
    formedMarriage,
    formedMentorship,
  };
}

/**
 * Evaluates whether a human has achieved extraordinary feats worthy of permanent
 * promotion to a Notable Historical Figure ("Hall of Fame").
 */
export function evaluateNotablePromotion(
  human: HumanBrainState,
  currentYear: number
): boolean {
  if (human.isNotableHistoricalFigure) return true;

  const maxSkillEntry = (
    Object.entries(human.skills) as [string, number][]
  ).reduce((best, cur) => (cur[1] > best[1] ? cur : best), ['farming', 0]);

  if (human.profession === 'Ruler') {
    human.isNotableHistoricalFigure = true;
    human.notableReason = `Sovereign Ruler of the Community`;
  } else if (maxSkillEntry[1] >= 88) {
    human.isNotableHistoricalFigure = true;
    human.notableReason = `Grandmaster of ${maxSkillEntry[0]} (Skill ${Math.round(
      maxSkillEntry[1]
    )})`;
  } else if (human.totalTasksCompleted >= 40) {
    human.isNotableHistoricalFigure = true;
    human.notableReason = `Heroic Pillar of Labor (${human.totalTasksCompleted} tasks completed)`;
  }

  if (human.isNotableHistoricalFigure && human.notableReason) {
    recordEpisodicMemory(human, {
      year: currentYear,
      age: human.age,
      category: 'CareerPromotion',
      importance: 98,
      summary: `Recognized in the Hall of Fame: ${human.notableReason}.`,
    });
  }

  return human.isNotableHistoricalFigure;
}

// ==================== FILE: collectiveIntelligence.ts ====================
/**
 * ============================================================================
 * LAYER 5: COLLECTIVE CIVILIZATION LEARNING & TECHNOLOGICAL PROGRESSION
 * ============================================================================
 * Models how individual human learning, curiosity, and task execution aggregate
 * into collective civilization knowledge, unlocking technologies and advancing
 * society across 6 historical eras.
 */


export interface TechMilestone {
  eraIndex: number;
  eraName: EraTier;
  requiredKnowledgePoints: number;
  unlockedDiscoveries: string[];
}

export const CIVILIZATION_TECH_TREE: TechMilestone[] = [
  {
    eraIndex: 0,
    eraName: 'Stone Age',
    requiredKnowledgePoints: 0,
    unlockedDiscoveries: ['Controlled Fire', 'Flint Knapping', 'Foraging Lore'],
  },
  {
    eraIndex: 1,
    eraName: 'Neolithic',
    requiredKnowledgePoints: 100,
    unlockedDiscoveries: ['Crop Domestication', 'Earthenware Pottery', 'Dugout Rafts', 'Mudbrick Weaving'],
  },
  {
    eraIndex: 2,
    eraName: 'Bronze Age',
    requiredKnowledgePoints: 260,
    unlockedDiscoveries: ['Copper & Bronze Smelting', 'Wheeled Carts', 'Written Clay Ledgers', 'Sailing Hulls'],
  },
  {
    eraIndex: 3,
    eraName: 'Iron Age',
    requiredKnowledgePoints: 500,
    unlockedDiscoveries: ['Iron Bloomeries', 'Stone Arch Masonry', 'Codified Law Courts', 'Paved Viaducts'],
  },
  {
    eraIndex: 4,
    eraName: 'Medieval',
    requiredKnowledgePoints: 850,
    unlockedDiscoveries: ['Heavy Steel Metallurgy', 'Windmill Mechanics', 'Guild Charters', 'Oceanic Caravels'],
  },
  {
    eraIndex: 5,
    eraName: 'Arcane Renaissance',
    requiredKnowledgePoints: 1300,
    unlockedDiscoveries: ['Scientific Method & Optics', 'Printing Press', 'University Academies', 'Aether Resonance'],
  },
];

export interface CollectiveKnowledgeState {
  eraIndex: number;
  eraName: EraTier;
  knowledgePoints: number;
  discoveredTechs: string[];
}

/**
 * Computes the knowledge points contributed by a single human when they complete
 * a research or production cycle:
 * - Scholars and Priests contribute primary theoretical research.
 * - Artisans, Builders, Farmers, and Sailors contribute empirical "innovation by doing".
 * - Scaled by the human's `intelligence`, `curiosity`, and `scholarship` skill.
 */
export function computeHumanKnowledgeContribution(
  human: HumanBrainState
): number {
  const isDedicatedThinker =
    human.profession === 'Scholar' ||
    human.profession === 'Priest' ||
    human.currentGoal === 'ConductResearchAndScholarship';

  const baseContribution = isDedicatedThinker ? 1.85 : 0.35;
  const scholarshipFactor = 1.0 + (human.skills.scholarship / 100) * 1.5;
  const curiosityFactor = 1.0 + Math.max(0, human.personality.curiosity) * 0.6;

  return Number(
    (
      baseContribution *
      human.aptitudes.intelligence *
      scholarshipFactor *
      curiosityFactor
    ).toFixed(2)
  );
}

/**
 * Aggregates individual knowledge contributions into the collective civilization
 * knowledge pool and checks for Era breakthroughs.
 */
export function advanceCollectiveKnowledge(
  state: CollectiveKnowledgeState,
  activeHumans: HumanBrainState[]
): {
  pointsAdded: number;
  eraAdvanced: boolean;
  newEra: EraTier;
  newlyUnlockedTechs: string[];
} {
  let pointsAdded = 0;
  for (const h of activeHumans) {
    if (h.lifeStage === 'Adult' || h.lifeStage === 'Elder' || h.lifeStage === 'Teen') {
      pointsAdded += computeHumanKnowledgeContribution(h);
    }
  }

  state.knowledgePoints = Number((state.knowledgePoints + pointsAdded).toFixed(2));

  let eraAdvanced = false;
  const newlyUnlockedTechs: string[] = [];

  while (
    state.eraIndex + 1 < CIVILIZATION_TECH_TREE.length &&
    state.knowledgePoints >=
      CIVILIZATION_TECH_TREE[state.eraIndex + 1].requiredKnowledgePoints
  ) {
    state.eraIndex += 1;
    const milestone = CIVILIZATION_TECH_TREE[state.eraIndex];
    state.eraName = milestone.eraName;
    eraAdvanced = true;

    for (const tech of milestone.unlockedDiscoveries) {
      if (!state.discoveredTechs.includes(tech)) {
        state.discoveredTechs.push(tech);
        newlyUnlockedTechs.push(tech);
      }
    }
  }

  return {
    pointsAdded: Number(pointsAdded.toFixed(2)),
    eraAdvanced,
    newEra: state.eraName,
    newlyUnlockedTechs,
  };
}

// ==================== FILE: HumanAIEngine.ts ====================
/**
 * ============================================================================
 * HUMAN AI ENGINE — SELF-CONTAINED COGNITIVE ORCHESTRATOR
 * ============================================================================
 * Orchestrates the complete lifecycle of intelligent human agents:
 *   Perception -> Biological Needs -> Utility/GOAP Decision -> Task Execution
 *   -> Experiential Skill Learning -> Mentorship & Social Bonds -> Memory Consolidation
 *   -> Collective Civilization Knowledge Progression.
 *
 * Strictly zero graphics, zero sprite/clothing logic, and zero terrain/worldgen.
 */







export class SimpleSeededRNG implements DeterministicRNG {
  private state: number;
  constructor(seed = 123456789) {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

export class HumanAIEngine {
  private rng: DeterministicRNG;
  private nextAgentId = 1;
  public humans: Map<number, HumanBrainState> = new Map();
  public collectiveKnowledge: CollectiveKnowledgeState = {
    eraIndex: 0,
    eraName: 'Stone Age',
    knowledgePoints: 0,
    discoveredTechs: [...CIVILIZATION_TECH_TREE[0].unlockedDiscoveries],
  };

  constructor(seed = 42) {
    this.rng = new SimpleSeededRNG(seed);
  }

  /**
   * Spawns a founder human brain with seeded personality traits and aptitudes.
   */
  public createFounderHuman(
    name: string,
    age = 22,
    profession: HumanProfession = 'Forager',
    currentYear = 1
  ): HumanBrainState {
    const id = this.nextAgentId++;
    const personality = generateFounderPersonality(this.rng);
    const aptitudes = generateFounderAptitudes(this.rng);
    const skills = createInitialSkills(8);

    // Give founders a small starting familiarity in their initial profession
    const primarySkill = PROFESSION_SKILL_MAP[profession].primary;
    skills[primarySkill] = Math.round(this.rng.range(15, 28));

    const human: HumanBrainState = {
      id,
      name,
      age,
      lifeStage: computeLifeStage(age),
      profession,
      roleTitle: `Novice ${profession}`,
      rankTitle: 'Novice',
      socialClass: profession === 'Ruler' ? 'Ruler' : 'Peasant',
      personality,
      aptitudes,
      parentIds: [null, null],
      skills,
      totalTasksCompleted: 0,
      experiencePoints: 0,
      mentorId: null,
      health: 100,
      maxHealth: 100,
      needs: {
        satiety: 85,
        warmthAndRest: 85,
        safety: 95,
        socialBelonging: 75,
      },
      wealthCoins: 10,
      foodRationsCarried: 2,
      moralStatus: 'LawAbiding',
      crimeCount: 0,
      scheduleSlot: 'MorningShift',
      currentGoal: 'PerformProfessionWork',
      plannedSteps: [],
      thoughtBubble: 'Ready to begin work.',
      memories: [],
      relationships: [],
      isNotableHistoricalFigure: profession === 'Ruler',
      notableReason: profession === 'Ruler' ? 'Founding Leader' : null,
    };

    human.rankTitle = computeMasteryRank(human);
    human.roleTitle = `${human.rankTitle} ${human.profession}`;

    recordEpisodicMemory(human, {
      year: currentYear,
      age,
      category: 'Birth',
      importance: 85,
      summary: `Entered the community as a founding ${human.profession}.`,
    });

    this.humans.set(id, human);
    return human;
  }

  /**
   * Spawns a child who inherits genetics (personality + aptitudes) from their parents.
   */
  public procreateChild(
    childName: string,
    parentA: HumanBrainState,
    parentB: HumanBrainState | null,
    currentYear: number
  ): HumanBrainState {
    const id = this.nextAgentId++;
    const inherited = inheritChildGenetics(
      parentA.personality,
      parentA.aptitudes,
      parentB?.personality ?? null,
      parentB?.aptitudes ?? null,
      this.rng
    );

    const child: HumanBrainState = {
      id,
      name: childName,
      age: 0,
      lifeStage: 'Baby',
      profession: parentA.profession,
      roleTitle: 'Child of the Hearth',
      rankTitle: 'Novice',
      socialClass: parentA.socialClass,
      personality: inherited.personality,
      aptitudes: inherited.aptitudes,
      parentIds: [parentA.id, parentB ? parentB.id : null],
      skills: createInitialSkills(2),
      totalTasksCompleted: 0,
      experiencePoints: 0,
      mentorId: null,
      health: 100,
      maxHealth: 100,
      needs: {
        satiety: 95,
        warmthAndRest: 95,
        safety: 100,
        socialBelonging: 95,
      },
      wealthCoins: 0,
      foodRationsCarried: 1,
      moralStatus: 'LawAbiding',
      crimeCount: 0,
      scheduleSlot: 'MorningShift',
      currentGoal: 'ChildPlayAndLearn',
      plannedSteps: [],
      thoughtBubble: 'Observing the world around me.',
      memories: [],
      relationships: [
        {
          targetAgentId: parentA.id,
          targetName: parentA.name,
          relationType: 'Parent',
          affinity: 90,
        },
      ],
      isNotableHistoricalFigure: false,
      notableReason: null,
    };

    parentA.relationships.push({
      targetAgentId: child.id,
      targetName: child.name,
      relationType: 'Child',
      affinity: 95,
    });

    if (parentB) {
      child.relationships.push({
        targetAgentId: parentB.id,
        targetName: parentB.name,
        relationType: 'Parent',
        affinity: 90,
      });
      parentB.relationships.push({
        targetAgentId: child.id,
        targetName: child.name,
        relationType: 'Child',
        affinity: 95,
      });
    }

    recordEpisodicMemory(child, {
      year: currentYear,
      age: 0,
      category: 'Birth',
      importance: 90,
      summary: `Born to ${parentA.name}${parentB ? ` and ${parentB.name}` : ''}.`,
    });

    this.humans.set(id, child);
    return child;
  }

  /**
   * Steps a single human's brain through one cognitive cycle:
   * 1. Updates biological & psychological drives
   * 2. Evaluates Utility + GOAP decision for the current schedule slot
   * 3. Executes goal satisfaction & experiential learning-by-doing
   */
  public stepHumanCognition(
    human: HumanBrainState,
    env: PerceivedEnvironmentContext,
    dtSeconds = 1.0
  ) {
    human.scheduleSlot = computeDailyScheduleSlot(env.timeOfDay01);
    tickBiologicalNeeds(human, env, dtSeconds);

    const decision = evaluateGOAPDecision(human, env);

    // Satisfy needs or gain experiential skill based on the active goal
    if (decision.chosenGoal === 'EmergencyEat') {
      if (human.foodRationsCarried > 0 || env.communityFoodAvailable) {
        if (human.foodRationsCarried > 0) human.foodRationsCarried--;
        human.needs.satiety = Math.min(100, human.needs.satiety + 65);
      }
    } else if (
      decision.chosenGoal === 'EmergencyWarmthAndRest' ||
      decision.chosenGoal === 'SleepAtHome'
    ) {
      human.needs.warmthAndRest = Math.min(100, human.needs.warmthAndRest + 45);
    } else if (decision.targetSkillToPractice) {
      const mentor =
        human.mentorId !== null ? this.humans.get(human.mentorId) ?? null : null;

      const learningOutcome = applyExperientialSkillLearning(
        human,
        decision.targetSkillToPractice,
        1.25,
        mentor
      );

      human.totalTasksCompleted += 1;
      human.roleTitle = `${human.rankTitle} ${human.profession}`;

      if (learningOutcome.skillBreakthroughReached) {
        const mem: EpisodicMemory = {
          year: env.currentYear,
          age: human.age,
          category: 'SkillBreakthrough',
          importance: 80,
          summary: `Mastered ${decision.targetSkillToPractice} to level ${Math.round(
            learningOutcome.newLevel
          )} (${human.rankTitle}).`,
        };
        recordEpisodicMemory(human, mem);
      }

      evaluateNotablePromotion(human, env.currentYear);
    }

    return {
      decision,
      productivityMultiplier: computeWorkProductivityMultiplier(human),
    };
  }

  /**
   * Advances all humans by one simulation year (aging, life-stage transitions,
   * dynamic career adaptation, social bonding, and collective tech research).
   */
  public advanceYearForAllHumans(env: PerceivedEnvironmentContext) {
    const allHumans = Array.from(this.humans.values());

    for (const human of allHumans) {
      human.age += 1;
      const prevStage = human.lifeStage;
      human.lifeStage = computeLifeStage(human.age);

      if (prevStage !== human.lifeStage) {
        recordEpisodicMemory(human, {
          year: env.currentYear,
          age: human.age,
          category: 'CareerPromotion',
          importance: 75,
          summary: `Grew into a ${human.lifeStage} at age ${human.age}.`,
        });
      }

      // Check if the human should adapt their career based on comparative skill advantage
      const nextProfession = evaluateCareerAdaptation(
        human,
        !env.communityFoodAvailable,
        this.collectiveKnowledge.eraIndex
      );
      if (nextProfession !== human.profession) {
        human.profession = nextProfession;
        human.rankTitle = computeMasteryRank(human);
        human.roleTitle = `${human.rankTitle} ${human.profession}`;
      }
    }

    // Social interactions among community members
    if (allHumans.length >= 2) {
      for (let i = 0; i < allHumans.length; i++) {
        const a = allHumans[i];
        const b = allHumans[(i + 1) % allHumans.length];
        if (a.id !== b.id) {
          interactAndUpdateSocialBond(a, b, env.currentYear);
        }
      }
    }

    // Collective civilization research
    return advanceCollectiveKnowledge(this.collectiveKnowledge, allHumans);
  }
}

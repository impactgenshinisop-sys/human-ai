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

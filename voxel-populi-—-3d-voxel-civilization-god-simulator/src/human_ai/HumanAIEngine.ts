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

import {
  advanceCollectiveKnowledge,
  CIVILIZATION_TECH_TREE,
  CollectiveKnowledgeState,
} from './collectiveIntelligence';
import {
  evaluateNotablePromotion,
  interactAndUpdateSocialBond,
  recordEpisodicMemory,
} from './memoryAndSocialBonds';
import {
  computeDailyScheduleSlot,
  evaluateGOAPDecision,
  tickBiologicalNeeds,
} from './needsAndUtilityGOAP';
import {
  computeLifeStage,
  DeterministicRNG,
  generateFounderAptitudes,
  generateFounderPersonality,
  inheritChildGenetics,
} from './personalityAndGenetics';
import {
  applyExperientialSkillLearning,
  computeMasteryRank,
  computeWorkProductivityMultiplier,
  createInitialSkills,
  evaluateCareerAdaptation,
  PROFESSION_SKILL_MAP,
} from './skillsAndLearning';
import {
  EpisodicMemory,
  HumanBrainState,
  HumanProfession,
  PerceivedEnvironmentContext,
} from './types';

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

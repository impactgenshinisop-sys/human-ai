/**
 * ============================================================================
 * LAYER 4: EPISODIC MEMORY CONSOLIDATION & SOCIAL GRAPH DYNAMICS
 * ============================================================================
 * Models how humans remember significant life events, prune low-importance
 * memories while preserving core autobiographical milestones, form friendships,
 * mentorships, marriages, and earn Hall-of-Fame historical status.
 */

import {
  EpisodicMemory,
  HumanBrainState,
  PersonalityVector,
} from './types';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

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

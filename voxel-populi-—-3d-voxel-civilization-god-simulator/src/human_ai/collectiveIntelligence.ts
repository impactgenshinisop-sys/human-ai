/**
 * ============================================================================
 * LAYER 5: COLLECTIVE CIVILIZATION LEARNING & TECHNOLOGICAL PROGRESSION
 * ============================================================================
 * Models how individual human learning, curiosity, and task execution aggregate
 * into collective civilization knowledge, unlocking technologies and advancing
 * society across 6 historical eras.
 */

import { EraTier, HumanBrainState } from './types';

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

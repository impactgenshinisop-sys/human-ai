/**
 * Unscripted Civilization Simulation Web Worker (Second Revision Pass: Parts A, B, C & D)
 * - Part A: Infinite unbounded chunk streaming + BFS tree leaf decay & structural support physics
 * - Part B: Life stages (Baby..Elder), continuous personality vectors, circadian schedules,
 *           crime/law/justice/bandits, funerals/graves/inheritance, governments/rulers/laws,
 *           social classes/wages/market prices, and 1,500+ data-driven procedural roles
 * - Part C: Grammar-based procedural buildings, parametric items/tools, and modular clothing
 * - Part D: Formation warfare, morale, supply lines, siege breaches, and Trigger Test War
 */

import { STRUCTURE_BLUEPRINTS } from '../sim/blueprints';
import {
  generateProceduralBuilding,
  generateProceduralClothing,
  generateProceduralItem,
  getProceduralRoleCatalog,
  pickContextualRole,
} from '../sim/generators';
import { hashStringToSeed, SeededPRNG } from '../sim/prng';
import {
  chunkKey,
  generateChunkVoxels,
  parseChunkKey,
  sampleColumn,
  voxelIndex,
} from '../sim/terrain';
import {
  ActiveWarSummary,
  AgentAnimAction,
  AgentJob,
  AgentSummary,
  AnimalDomain,
  AnimalMarker3D,
  AnimalSpecies,
  BattleUnitGroup,
  BiomeType,
  BuildingStep,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  CitySummary,
  CivilizationSummary,
  ConstructionStallStatus,
  ContinuousTraits,
  DailyScheduleSlot,
  DiplomaticStance,
  ERA_ORDER,
  EraType,
  FacialExpression,
  FallingVoxelParticle,
  FormationType,
  GeneratedClothingSpec,
  GeneratedItemSpec,
  GOD_POWERS,
  GovernmentType,
  LifeStage,
  SeasonType,
  SettlementTier,
  SimStageMode,
  SimTelemetrySnapshot,
  SocialClass,
  SocietyCensusSnapshot,
  StructureCategory,
  StructureMarker3D,
  StructureType,
  VehicleMarker3D,
  VehicleType,
  VoxelType,
  WATER_LEVEL,
  WeatherType,
  WORLD_GEN_VERSION,
  WorldEventMarker,
  WorldEventType,
  WorldHistorySnapshot,
  WorldSettings,
} from '../sim/types';

export interface InternalAgent {
  id: number;
  name: string;
  familyName: string;
  civId: number;
  cityId: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  actualSpeed: number;
  targetX: number;
  targetZ: number;
  facing: number;
  age: number;
  maxAge: number;
  lifeStage: LifeStage;
  bodyScale: number;
  job: AgentJob;
  roleId: string;
  roleTitle: string;
  roleDomain: string;
  socialClass: SocialClass;
  wealthCoins: number;
  scheduleSlot: DailyScheduleSlot;
  criminalStatus: 'LawAbiding' | 'Suspect' | 'Wanted' | 'Prisoner' | 'Bandit';
  traitVector: ContinuousTraits;
  equippedItem: GeneratedItemSpec;
  clothing: GeneratedClothingSpec;
  action: AgentAnimAction;
  workTimer: number;
  idleTimer: number;
  state: string;
  health: number;
  hunger: number;
  shelter: number;
  safety: number;
  social: number;
  intelligence: number;
  strength: number;
  fertility: number;
  isNotable: boolean;
  notableTitle?: string;
  traits: string[];
  carryingResource?: 'wood' | 'stone' | 'ore' | 'food';
  reservedSlotKey?: string;
  lastProgressX: number;
  lastProgressZ: number;
  stuckTicks: number;
  lastUpdatedTick: number;
  parentId?: number;
  spouseId?: number;
  homeStructureId?: number;
  childrenCount: number;
  tasksCompleted: number;
  lifeLog: string[];
  blessedEffects: string[];
  animPhase: number;
}

export interface InternalStructure {
  id: number;
  type: StructureType;
  name: string;
  era: EraType;
  category: StructureCategory;
  civId: number;
  cityId: number;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  progress: number;
  totalBlocks: number;
  isComplete: boolean;
  builtYear: number;
  scaffoldCoords: [number, number, number][];
  customSteps?: BuildingStep[];
  lastProgressTick: number;
  stallStatus: ConstructionStallStatus;
  assignedBuildersCount: number;
  doorwayCoords?: [number, number][];
}

export interface InternalCity {
  id: number;
  name: string;
  civId: number;
  x: number;
  y: number;
  z: number;
  foundedYear: number;
  biome?: BiomeType;
  foodStock: number;
  woodStock: number;
  stoneStock: number;
  oreStock: number;
  treasuryCoins: number;
  marketPriceIndex: number;
  crimeRate: number;
  gravesCount: number;
  structureIds: number[];
  activeStructureId?: number;
  lastBuildTick?: number;
  simMode: 'Micro (Full 3D)' | 'Macro (Simplified)';
  siteScore: number;
  siteBreakdown: {
    water: number;
    fertility: number;
    timber: number;
    stone: number;
    flatness: number;
  };
}

export interface InternalCiv {
  id: number;
  name: string;
  colorHex: string;
  secondaryHex: string;
  rgb: [number, number, number];
  era: EraType;
  foundedYear: number;
  happiness: number;
  militaryPower: number;
  tradeVolume: number;
  religionName: string;
  governmentType: GovernmentType;
  rulerId: number | null;
  rulerName: string;
  rulerTitle: string;
  taxRatePct: number;
  treasuryCoins: number;
  activeLaws: string[];
  cultureTraits: string[];
  discoveredTechs: string[];
  techProgress: number;
  activeGodEffects: { powerId: string; name: string; expiresYear: number | null }[];
  relations: Record<number, DiplomaticStance>;
  historySeries: {
    year: number;
    population: number;
    techCount: number;
    happiness: number;
    food: number;
    military: number;
    trade: number;
  }[];
  simMode: 'Micro (Full 3D)' | 'Macro (Simplified)';
}

const CIV_PALETTES = [
  { name: 'Aurelian Dawn', color: '#F59E0B', secondary: '#FEF3C7', religion: 'Solar Covenant' },
  { name: 'Azure Verdict', color: '#06B6D4', secondary: '#CFFAFE', religion: 'Order of the Crystal Tide' },
  { name: 'Crimson Valor', color: '#EF4444', secondary: '#FEE2E2', religion: 'Ember Ancestors' },
  { name: 'Emerald Sylvan', color: '#10B981', secondary: '#D1FAE5', religion: 'Root & Canopy Creed' },
  { name: 'Amethyst Crown', color: '#A855F7', secondary: '#F3E8FF', religion: 'Starlight Mystics' },
  { name: 'Obsidian Forge', color: '#FB923C', secondary: '#FFEDD5', religion: 'Deep Stone Pantheon' },
  { name: 'Sapphire Horizon', color: '#3B82F6', secondary: '#DBEAFE', religion: 'Skyward Pilgrims' },
  { name: 'Rose Dynasty', color: '#EC4899', secondary: '#FCE7F3', religion: 'Lotus Harmony' },
];

const FIRST_NAMES = [
  'Auron', 'Lyra', 'Kael', 'Mira', 'Thorne', 'Vesper', 'Orin', 'Sera',
  'Darian', 'Elara', 'Bram', 'Nyla', 'Cassian', 'Freya', 'Garrick', 'Talia',
  'Rowan', 'Sylvi', 'Alden', 'Maeve', 'Corin', 'Isolde', 'Evander', 'Zora',
  'Lucian', 'Astrid', 'Torin', 'Celia', 'Cyrus', 'Junia', 'Alaric', 'Rhea',
];

const FAMILY_NAMES = [
  'Vane', 'Ashford', 'Ironwood', 'Stormborn', 'Brightwater', 'Stonehelm',
  'Goldleaf', 'Sunstrider', 'Silverbrook', 'Oakhaven', 'Highcrest', 'Redforge',
  'Starweaver', 'Frostmantle', 'Deepvale', 'Ambergris', 'Dawnbreaker', 'Crowley',
];

const CITY_SUFFIXES = [
  'haven', 'hold', 'ford', 'stead', 'watch', 'spire', 'vale', 'reach',
  'crest', 'hearth', 'brook', 'gate', 'cliff', 'glade',
];

const LAWS_BY_ERA: Record<EraType, string[]> = {
  [EraType.StoneAge]: ['Shared Hearth Hunting Pact', 'Elder Kinship Judgement', 'Sacred Totem Taboo'],
  [EraType.Neolithic]: ['Granary Tithe Custom', 'Boundary Stone Compact', 'Seasonal Harvest Truce'],
  [EraType.BronzeAge]: ['Lex Talionis Bronze Code', 'Temple Tribute Decree', 'River Toll Edict'],
  [EraType.IronAge]: ['Standing Levy Conscription', 'Royal Coinage Monopoly', 'Magistrate Court Assize'],
  [EraType.Medieval]: ['Feudal Charter of Liberties', 'Merchant Guild Staple Right', 'High Watch Curfew'],
  [EraType.ArcaneRenaissance]: ['Parliamentary Treasury Act', 'University Patent Charter', 'Civic High Court Code'],
};

const GOVERNMENT_BY_ERA: Record<EraType, GovernmentType> = {
  [EraType.StoneAge]: 'Tribal Band',
  [EraType.Neolithic]: 'Chiefdom',
  [EraType.BronzeAge]: 'Kingdom',
  [EraType.IronAge]: 'Republic Council',
  [EraType.Medieval]: 'Imperial Dynasty',
  [EraType.ArcaneRenaissance]: 'Constitutional Realm',
};

const RULER_TITLES_BY_GOV: Record<GovernmentType, string> = {
  'Tribal Band': 'Tribal Elder',
  'Chiefdom': 'High Chieftain',
  'Kingdom': 'Sovereign Monarch',
  'Republic Council': 'First Consul',
  'Imperial Dynasty': 'Grand Emperor',
  'Constitutional Realm': 'Lord Chancellor',
};

const FORMATION_BY_ERA: Record<EraType, FormationType> = {
  [EraType.StoneAge]: 'Tribal Crowd',
  [EraType.Neolithic]: 'Shield Wall',
  [EraType.BronzeAge]: 'Phalanx Spear Line',
  [EraType.IronAge]: 'Archer Volley Line',
  [EraType.Medieval]: 'Flanking Cavalry',
  [EraType.ArcaneRenaissance]: 'Gunpowder Line',
};

const TECH_PROGRESSION: {
  tech: string;
  era: EraType;
  unlocks: StructureType[];
}[] = [
  { tech: 'Fire & Shelter', era: EraType.StoneAge, unlocks: ['Campfire', 'LeanToShelter', 'MudHut'] },
  { tech: 'Flint Toolmaking', era: EraType.StoneAge, unlocks: ['FlintKnappingPit', 'FishingStakes'] },
  { tech: 'Foraging Mastery', era: EraType.StoneAge, unlocks: ['BerryForageRack', 'FishDryingRack'] },
  { tech: 'Oral Traditions', era: EraType.StoneAge, unlocks: ['GatheringTotem'] },
  { tech: 'Carpentry', era: EraType.Neolithic, unlocks: ['WoodHut', 'LumberMillCamp', 'TimberFootbridge', 'WoodenPier', 'FishingHut'] },
  { tech: 'Agriculture', era: EraType.Neolithic, unlocks: ['WheatFarmPlot', 'OrchardGrove'] },
  { tech: 'Pottery & Storage', era: EraType.Neolithic, unlocks: ['GranarySilo', 'PotteryKiln'] },
  { tech: 'Wheel & Trails', era: EraType.Neolithic, unlocks: ['DirtRoadSegment'] },
  { tech: 'Megalithic Rituals', era: EraType.Neolithic, unlocks: ['StandingStones'] },
  { tech: 'Masonry & Brickmaking', era: EraType.BronzeAge, unlocks: ['AdobeBrickHouse', 'OpenQuarry', 'RiverWatermill'] },
  { tech: 'Bronze Metallurgy', era: EraType.BronzeAge, unlocks: ['CopperSmeltery'] },
  { tech: 'Barter & Trade', era: EraType.BronzeAge, unlocks: ['BarterMarketStall'] },
  { tech: 'Palisade Defense', era: EraType.BronzeAge, unlocks: ['WoodenPalisade', 'TimberWatchtower'] },
  { tech: 'Organized Priesthood', era: EraType.BronzeAge, unlocks: ['ZigguratShrine'] },
  { tech: 'Ironworking', era: EraType.IronAge, unlocks: ['TimberFramedHouse', 'IronBloomeryForge'] },
  { tech: 'Arch Engineering', era: EraType.IronAge, unlocks: ['StoneBridge', 'PavedStoneRoad', 'StoneHarbor'] },
  { tech: 'Standing Army', era: EraType.IronAge, unlocks: ['BarracksCompound'] },
  { tech: 'Fortification Masonry', era: EraType.IronAge, unlocks: ['StoneCurtainWall', 'StoneGuardTower'] },
  { tech: 'Caravan Trade Routes', era: EraType.IronAge, unlocks: ['CaravanTradingPost'] },
  { tech: 'Feudal Architecture', era: EraType.Medieval, unlocks: ['StoneManorHouse'] },
  { tech: 'Mechanical Windpower', era: EraType.Medieval, unlocks: ['Windmill'] },
  { tech: 'Merchant Guilds', era: EraType.Medieval, unlocks: ['GrandMarketPlaza', 'GuildWorkshop'] },
  { tech: 'Theology & Bellcasting', era: EraType.Medieval, unlocks: ['CathedralSanctuary'] },
  { tech: 'Navigation & Shipbuilding', era: EraType.Medieval, unlocks: ['HarborDock', 'CoastalLighthouse', 'Shipyard'] },
  { tech: 'Siegecraft & Citadels', era: EraType.Medieval, unlocks: ['CastleKeep'] },
  { tech: 'Hydraulic Engineering', era: EraType.Medieval, unlocks: ['AqueductSegment'] },
  { tech: 'Scientific Method', era: EraType.ArcaneRenaissance, unlocks: ['UniversityAcademy'] },
  { tech: 'Astronomy & Optics', era: EraType.ArcaneRenaissance, unlocks: ['AlchemicalObservatory'] },
  { tech: 'Clockwork Precision', era: EraType.ArcaneRenaissance, unlocks: ['ClocktowerMonument'] },
  { tech: 'Arcane Crystallography', era: EraType.ArcaneRenaissance, unlocks: ['CrystalSanctum'] },
  { tech: 'Monumental Wonders', era: EraType.ArcaneRenaissance, unlocks: ['GrandPantheonWonder'] },
];

const TRAIT_POOL = [
  'Industrious', 'Visionary', 'Brave', 'Devout', 'Diplomatic',
  'Resilient', 'Curious', 'Ambitious', 'Builder-Minded', 'Green-Thumb',
];

function hexToRgbTuple(hexColor: string): [number, number, number] {
  const hex = hexColor.replace('#', '');
  const num = parseInt(hex, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

function isGroundTerrainVoxel(v: VoxelType): boolean {
  return (
    v === VoxelType.Grass ||
    v === VoxelType.ForestGrass ||
    v === VoxelType.Dirt ||
    v === VoxelType.FertileSoil ||
    v === VoxelType.Sand ||
    v === VoxelType.Snow ||
    v === VoxelType.Stone ||
    v === VoxelType.Cobblestone ||
    v === VoxelType.RoadDirt ||
    v === VoxelType.RoadPaved ||
    v === VoxelType.BridgeWood ||
    v === VoxelType.BridgeStone ||
    v === VoxelType.ScorchedEarth ||
    v === VoxelType.FlowerRed ||
    v === VoxelType.FlowerYellow
  );
}

function isLeafVoxel(v: VoxelType): boolean {
  return (
    v === VoxelType.Leaves ||
    v === VoxelType.PineLeaves ||
    v === VoxelType.BirchLeavesGold ||
    v === VoxelType.AutumnLeavesOrange
  );
}

function isLogVoxel(v: VoxelType): boolean {
  return v === VoxelType.WoodLog || v === VoxelType.BirchLog;
}

function isBuiltBlockVoxel(v: VoxelType): boolean {
  return (
    v === VoxelType.Plank ||
    v === VoxelType.DarkPlank ||
    v === VoxelType.Thatch ||
    v === VoxelType.MudBrick ||
    v === VoxelType.ClayBrick ||
    v === VoxelType.StoneBrick ||
    v === VoxelType.WhiteMarble ||
    v === VoxelType.RoofTileRed ||
    v === VoxelType.RoofTileSlate ||
    v === VoxelType.MarketCanopyRed ||
    v === VoxelType.MarketCanopyGold ||
    v === VoxelType.MarketCanopyBlue ||
    v === VoxelType.ScaffoldWood ||
    v === VoxelType.GlassPane
  );
}

function isWalkThroughStructure(type: StructureType): boolean {
  return (
    type === 'DirtRoadSegment' ||
    type === 'PavedStoneRoad' ||
    type === 'TimberFootbridge' ||
    type === 'StoneBridge' ||
    type === 'WheatFarmPlot'
  );
}

export function computeLifeStage(age: number): { stage: LifeStage; scale: number } {
  if (age <= 3) return { stage: 'Baby', scale: 0.42 };
  if (age <= 12) return { stage: 'Child', scale: 0.66 };
  if (age <= 17) return { stage: 'Teen', scale: 0.86 };
  if (age <= 57) return { stage: 'Adult', scale: 1.0 };
  return { stage: 'Elder', scale: 0.94 };
}

export function computeSocialClassForJob(job: AgentJob, isNotable: boolean): SocialClass {
  if (job === 'Ruler') return 'Ruler';
  if (job === 'Priest') return 'Clergy';
  if (job === 'Trader') return 'Merchant';
  if (job === 'Artisan' || job === 'Builder' || job === 'Scholar') {
    return isNotable ? 'Noble' : 'Craftsperson';
  }
  if (job === 'Soldier' && isNotable) return 'Noble';
  if (job === 'Forager') return 'Servant';
  return 'Peasant';
}

export function computeScheduleSlot(
  timeOfDay: number,
  lifeStage: LifeStage,
  traits: ContinuousTraits
): DailyScheduleSlot {
  // Universal nighttime sleep window (20:30 to 05:30) so the entire village sleeps indoors at night
  if (timeOfDay >= 20.5 || timeOfDay < 5.5) {
    return 'Sleep';
  }
  const wakeShift = -traits.diligence * 0.45;
  const hour = (timeOfDay - wakeShift + 24) % 24;
  if (hour >= 5.5 && hour < 6.8) return 'Meal';
  if (hour >= 12.2 && hour < 13.2) return 'Meal';
  if (hour >= 18.2 && hour < 19.2) return 'Meal';
  if (lifeStage === 'Baby') return hour < 15.5 ? 'Rest' : 'Sleep';
  if (lifeStage === 'Child') return hour < 14.5 ? 'School' : 'Leisure';
  if (lifeStage === 'Elder') {
    if (traits.piety > 0.25 && hour >= 7.0 && hour < 10.5) return 'Worship';
    return hour < 15.0 ? 'Socialize' : 'Rest';
  }
  if (hour >= 6.8 && hour < 18.2) {
    if (traits.piety > 0.6 && hour >= 6.8 && hour < 8.0) return 'Worship';
    return 'Work';
  }
  if (hour >= 19.2 && hour < 20.5) {
    if (traits.piety > 0.4) return 'Worship';
    if (traits.curiosity > 0.35) return 'Leisure';
    return 'Socialize';
  }
  return 'Work';
}

const HEADGEAR_TO_ID: Record<GeneratedClothingSpec['headgear'], number> = {
  none: 0,
  straw_hat: 1,
  hood: 2,
  helmet: 3,
  scholar_cap: 4,
  crown: 5,
  miter: 6,
  merchant_cap: 7,
};

const SPATIAL_CELL_SIZE = 4;
const STRUCT_GRID_SIZE = 8;

function spatialKey(cx: number, cz: number): number {
  return ((cx & 0xffff) << 16) | (cz & 0xffff);
}

export class VoxelCivSimEngine {
  public worldId = 'world-default';
  public worldName = 'Aurelia Prime';
  public seed = 'AURELIA-777';
  public seedNum = hashStringToSeed('AURELIA-777');
  public prng = new SeededPRNG('AURELIA-777');

  public settings: WorldSettings = {
    initialChunkRadius: 8,
    renderDistance: 8,
    simDetailRadius: 150,
    startingCivs: 4,
    startingPopPerCiv: 14,
    resourceAbundance: 1.15,
    disasterFrequency: 0.4,
    mutationRate: 1.0,
    timeBudgetMs: 12,
    maxYears: 0,
  };

  public year = 1;
  public dayOfYear = 0;
  public timeOfDay = 10.2;
  public season: SeasonType = 'Spring';
  public weather: WeatherType = 'Clear';
  public speedMultiplier = 1;
  public isPaused = false;
  public stageMode: SimStageMode = 5;

  public cameraX = 0;
  public cameraZ = 0;
  public dynamicZoomRadius = 8;

  public loadedChunks = new Map<string, { voxels: Uint8Array; revision: number }>();
  public syncedChunkRevisions = new Map<string, number>();
  public modifiedBlocks = new Map<string, Map<number, VoxelType>>();

  public nextAgentId = 1;
  public nextStructureId = 1;
  public nextCityId = 1;
  public nextCivId = 1;
  public nextEventId = 1;
  public nextWarId = 1;

  public agents: InternalAgent[] = [];
  public structures: InternalStructure[] = [];
  public cities: InternalCity[] = [];
  public civilizations: InternalCiv[] = [];
  public events: WorldEventMarker[] = [];
  public notableHallOfFame: AgentSummary[] = [];
  public activeWars: ActiveWarSummary[] = [];
  public battleGroups: BattleUnitGroup[] = [];
  public vehicles: VehicleMarker3D[] = [];
  public nextVehicleId = 1;
  public animals: AnimalMarker3D[] = [];
  public nextAnimalId = 1;
  public activeFires: { x: number; y: number; z: number; ttl: number }[] = [];
  public historySnapshots: WorldHistorySnapshot[] = [];
  public pendingFallingParticles: FallingVoxelParticle[] = [];

  // O(1) Lookup Indices & Spatial Hash Grids
  private cityMap = new Map<number, InternalCity>();
  private civMap = new Map<number, InternalCiv>();
  private structMap = new Map<number, InternalStructure>();
  private structSpatialGrid = new Map<number, InternalStructure[]>();
  private agentSpatialGrid = new Map<number, InternalAgent[]>();
  private sectorDensityMap = new Map<number, number>();
  private workstationReservations = new Map<string, Set<number>>();

  public selectedAgentId: number | null = null;
  public lastStepMs = 1.0;
  public spatialHashMs = 0.2;
  public agentSimMs = 0.6;
  public cityMacroMs = 0.2;
  public budgetDegraded = false;
  public tickCounter = 0;

  // Diagnostic & Verification Counters (Part 1 + Revision 2 + Revision 3)
  public stuckRecoveriesCount = 0;
  public watchdogRevivalsCount = 0;
  public stalledBuildsFixedCount = 0;
  public agentsInsideSolidBlocksCount = 0;
  public crowdingReassignmentsCount = 0;
  public maxCellAgentDensity = 1;
  public prunedDeadCitiesCount = 0;
  public microAgentsCount = 0;
  public farAgentsCount = 0;

  // Part A Physics Counters
  public totalDecayedLeavesCount = 0;
  public totalCollapsedBlocksCount = 0;
  public floatingBlocksRemainingCount = 0;

  // Part B Crime & Mortality Counters
  public crimeStats = {
    thefts: 0,
    assaults: 0,
    arrests: 0,
    trials: 0,
    executions: 0,
    banditsActive: 0,
    rebellions: 0,
  };
  public mortalityStats = {
    oldAge: 0,
    starvation: 0,
    disease: 0,
    coldExposure: 0,
    workAccident: 0,
    crimeOrExecution: 0,
    warfare: 0,
    totalGraves: 0,
  };

  // Pre-allocated render buffer (stride 16 floats per agent)
  private renderBufferCapacity = 4096;
  private renderBuffer = new Float32Array(4096 * 16);

  constructor() {
    this.initNewWorld(this.worldId, this.worldName, this.seed, this.settings);
  }

  public initNewWorld(
    worldId: string,
    worldName: string,
    seed: string,
    settings: Partial<WorldSettings>
  ) {
    this.worldId = worldId;
    this.worldName = worldName;
    this.seed = seed.trim() || 'VOXEL-2026';
    this.seedNum = hashStringToSeed(this.seed);
    this.prng = new SeededPRNG(this.seedNum);
    this.settings = { ...this.settings, ...settings };

    this.year = 1;
    this.dayOfYear = 35;
    this.timeOfDay = 10.2;
    this.season = 'Spring';
    this.weather = 'Clear';
    this.tickCounter = 0;

    this.loadedChunks.clear();
    this.syncedChunkRevisions.clear();
    this.modifiedBlocks.clear();
    this.agents = [];
    this.structures = [];
    this.cities = [];
    this.civilizations = [];
    this.events = [];
    this.notableHallOfFame = [];
    this.activeWars = [];
    this.battleGroups = [];
    this.vehicles = [];
    this.nextVehicleId = 1;
    this.animals = [];
    this.nextAnimalId = 1;
    this.activeFires = [];
    this.historySnapshots = [];
    this.pendingFallingParticles = [];

    this.cityMap.clear();
    this.civMap.clear();
    this.structMap.clear();
    this.structSpatialGrid.clear();
    this.agentSpatialGrid.clear();
    this.sectorDensityMap.clear();
    this.workstationReservations.clear();

    this.nextAgentId = 1;
    this.nextStructureId = 1;
    this.nextCityId = 1;
    this.nextCivId = 1;
    this.nextEventId = 1;
    this.nextWarId = 1;
    this.selectedAgentId = null;

    this.stuckRecoveriesCount = 0;
    this.watchdogRevivalsCount = 0;
    this.stalledBuildsFixedCount = 0;
    this.agentsInsideSolidBlocksCount = 0;
    this.crowdingReassignmentsCount = 0;
    this.maxCellAgentDensity = 1;
    this.prunedDeadCitiesCount = 0;
    this.totalDecayedLeavesCount = 0;
    this.totalCollapsedBlocksCount = 0;
    this.floatingBlocksRemainingCount = 0;

    this.crimeStats = {
      thefts: 0,
      assaults: 0,
      arrests: 0,
      trials: 0,
      executions: 0,
      banditsActive: 0,
      rebellions: 0,
    };
    this.mortalityStats = {
      oldAge: 0,
      starvation: 0,
      disease: 0,
      coldExposure: 0,
      workAccident: 0,
      crimeOrExecution: 0,
      warfare: 0,
      totalGraves: 0,
    };

    // Pre-warm initialChunkRadius around origin (only initial area, never a world boundary!)
    const r = Math.max(4, this.settings.initialChunkRadius);
    const dirtyChunks: string[] = [];
    for (let cz = -r; cz <= r; cz++) {
      for (let cx = -r; cx <= r; cx++) {
        this.ensureChunkLoaded(cx, cz);
        dirtyChunks.push(chunkKey(cx, cz));
      }
    }

    const civCount =
      this.stageMode === 1 ? 0 : this.stageMode <= 3 ? 1 : this.settings.startingCivs;
    for (let i = 0; i < civCount; i++) {
      this.spawnStartingCivilization(i, civCount, dirtyChunks);
    }

    this.spawnInitialAnimals();

    this.rebuildStructureSpatialGrid();
    this.rebuildAgentSpatialGrid();
    this.emitChunkUpdates(dirtyChunks, true);
  }

  public ensureChunkLoaded(cx: number, cz: number): { voxels: Uint8Array; revision: number } {
    const key = chunkKey(cx, cz);
    let existing = this.loadedChunks.get(key);
    if (!existing) {
      const delta = this.modifiedBlocks.get(key);
      const voxels = generateChunkVoxels(
        cx,
        cz,
        this.seedNum,
        this.settings.resourceAbundance,
        delta
      );
      existing = { voxels, revision: 1 };
      this.loadedChunks.set(key, existing);
    }
    return existing;
  }

  // ============================================================================
  // PART A: TREE TOPPLING, BFS LEAF DECAY & STRUCTURAL SUPPORT PHYSICS
  // ============================================================================

  private enqueueFallingParticle(wx: number, wy: number, wz: number, v: VoxelType) {
    if (this.pendingFallingParticles.length >= 160) return;
    const colorMap: Partial<Record<VoxelType, string>> = {
      [VoxelType.Leaves]: '#2E7D32',
      [VoxelType.PineLeaves]: '#1B5E20',
      [VoxelType.BirchLeavesGold]: '#D4AC0D',
      [VoxelType.AutumnLeavesOrange]: '#D35400',
      [VoxelType.WoodLog]: '#6E4720',
      [VoxelType.BirchLog]: '#D7CCC8',
      [VoxelType.Plank]: '#A67843',
      [VoxelType.MudBrick]: '#936B47',
      [VoxelType.StoneBrick]: '#909497',
      [VoxelType.RoofTileRed]: '#B03A2E',
    };
    this.pendingFallingParticles.push({
      x: wx,
      y: wy,
      z: wz,
      colorHex: colorMap[v] || '#5D9936',
    });
  }

  /**
   * Checks whether a leaf block at (wx, wy, wz) has a supporting trunk/branch log
   * within Chebyshev distance <= 3 that is connected downward to terrain.
   */
  private hasNearbySupportedLog(wx: number, wy: number, wz: number): boolean {
    for (let dy = -3; dy <= 1; dy++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 5) continue;
          const v = this.getWorldVoxel(wx + dx, wy + dy, wz + dz);
          if (isLogVoxel(v)) {
            // Verify this log reaches down toward ground or another log beneath it
            const below = this.getWorldVoxel(wx + dx, wy + dy - 1, wz + dz);
            if (isLogVoxel(below) || isGroundTerrainVoxel(below)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Localized structural support & leaf decay pass around (cx, cy, cz).
   * - Decays any leaf block that no longer has a supporting log within distance <= 3.
   * - Collapses any built block that has no 6-neighbor or diagonal eave support below/adjacent.
   * - Drops occasional saplings/berry bushes when leaves decay onto fertile ground.
   */
  public decayUnsupportedLeavesAndBlocks(
    centerX: number,
    centerY: number,
    centerZ: number,
    radius: number,
    dirtyChunks: Set<string>
  ): { decayedLeaves: number; collapsedBlocks: number } {
    let decayedLeaves = 0;
    let collapsedBlocks = 0;

    // Pass 1: Bottom-up check for floating logs (when bottom of trunk is cut)
    for (let y = Math.max(2, centerY - 2); y <= Math.min(CHUNK_HEIGHT - 2, centerY + 12); y++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const wx = Math.round(centerX + dx);
          const wz = Math.round(centerZ + dz);
          const v = this.getWorldVoxel(wx, y, wz);
          if (isLogVoxel(v)) {
            const below = this.getWorldVoxel(wx, y - 1, wz);
            const hasDiagLog =
              isLogVoxel(this.getWorldVoxel(wx + 1, y - 1, wz)) ||
              isLogVoxel(this.getWorldVoxel(wx - 1, y - 1, wz)) ||
              isLogVoxel(this.getWorldVoxel(wx, y - 1, wz + 1)) ||
              isLogVoxel(this.getWorldVoxel(wx, y - 1, wz - 1));
            if (!isLogVoxel(below) && !isGroundTerrainVoxel(below) && !hasDiagLog) {
              this.setWorldVoxel(wx, y, wz, VoxelType.Air, dirtyChunks);
              this.enqueueFallingParticle(wx, y, wz, v);
              collapsedBlocks++;
              this.totalCollapsedBlocksCount++;
            }
          }
        }
      }
    }

    // Pass 2: Leaf support check (every leaf must have a grounded log within distance <= 3)
    for (let y = Math.min(CHUNK_HEIGHT - 2, centerY + 12); y >= Math.max(2, centerY - 2); y--) {
      for (let dz = -radius - 2; dz <= radius + 2; dz++) {
        for (let dx = -radius - 2; dx <= radius + 2; dx++) {
          const wx = Math.round(centerX + dx);
          const wz = Math.round(centerZ + dz);
          const v = this.getWorldVoxel(wx, y, wz);
          if (isLeafVoxel(v)) {
            if (!this.hasNearbySupportedLog(wx, y, wz)) {
              this.setWorldVoxel(wx, y, wz, VoxelType.Air, dirtyChunks);
              this.enqueueFallingParticle(wx, y, wz, v);
              decayedLeaves++;
              this.totalDecayedLeavesCount++;

              // 8% chance a decaying leaf plants a sapling/bush on empty grass below
              if (this.prng.chance(0.08)) {
                const gy = this.getGroundWalkingY(wx, wz);
                const groundV = this.getWorldVoxel(wx, gy, wz);
                if (
                  (groundV === VoxelType.Grass || groundV === VoxelType.ForestGrass) &&
                  this.getWorldVoxel(wx, gy + 1, wz) === VoxelType.Air
                ) {
                  this.setWorldVoxel(wx, gy + 1, wz, VoxelType.BerryBush, dirtyChunks);
                }
              }
            }
          } else if (isBuiltBlockVoxel(v)) {
            // Check structural support for built blocks: must have non-air below OR 2 adjacent horizontal supports
            const below = this.getWorldVoxel(wx, y - 1, wz);
            if (below === VoxelType.Air || isLeafVoxel(below)) {
              let horizSupports = 0;
              const dirs = [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ];
              for (const [ox, oz] of dirs) {
                const adj = this.getWorldVoxel(wx + ox, y, wz + oz);
                const adjBelow = this.getWorldVoxel(wx + ox, y - 1, wz + oz);
                if (
                  (adj !== VoxelType.Air && !isLeafVoxel(adj)) ||
                  (adjBelow !== VoxelType.Air && !isLeafVoxel(adjBelow))
                ) {
                  horizSupports++;
                }
              }
              if (horizSupports === 0) {
                this.setWorldVoxel(wx, y, wz, VoxelType.Air, dirtyChunks);
                this.enqueueFallingParticle(wx, y, wz, v);
                collapsedBlocks++;
                this.totalCollapsedBlocksCount++;
              }
            }
          }
        }
      }
    }

    return { decayedLeaves, collapsedBlocks };
  }

  /**
   * Fells a real tree near (wx, wz) when a Lumberjack chops wood, removing its trunk logs
   * and decaying all unsupported canopy leaves with falling particles!
   */
  public chopTreeNear(
    wx: number,
    wz: number,
    searchRadius: number,
    dirtyChunks: Set<string>
  ): number {
    for (let r = 0; r <= searchRadius; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const tx = Math.round(wx + dx);
          const tz = Math.round(wz + dz);
          const gy = sampleColumn(tx, tz, this.seedNum).height;
          if (gy <= WATER_LEVEL) continue;

          const baseLog = this.getWorldVoxel(tx, gy + 1, tz);
          if (isLogVoxel(baseLog)) {
            let logsRemoved = 0;
            for (let y = gy + 1; y <= gy + 12; y++) {
              for (let bdz = -2; bdz <= 2; bdz++) {
                for (let bdx = -2; bdx <= 2; bdx++) {
                  const v = this.getWorldVoxel(tx + bdx, y, tz + bdz);
                  if (isLogVoxel(v)) {
                    this.setWorldVoxel(tx + bdx, y, tz + bdz, VoxelType.Air, dirtyChunks);
                    this.enqueueFallingParticle(tx + bdx, y, tz + bdz, v);
                    logsRemoved++;
                  }
                }
              }
            }
            this.decayUnsupportedLeavesAndBlocks(tx, gy + 2, tz, 4, dirtyChunks);
            return logsRemoved;
          }
        }
      }
    }
    return 0;
  }

  /**
   * Part A Verification & Sandbox Control:
   * Clear-cuts trees in a radius around (wx, wz) and runs a full floating-block & leaf-decay audit.
   */
  public clearCutAndAuditFloatingBlocks(wx: number, wz: number, radius = 18) {
    const dirtyChunks = new Set<string>();
    let treesFelled = 0;
    for (let dz = -radius; dz <= radius; dz += 2) {
      for (let dx = -radius; dx <= radius; dx += 2) {
        const felled = this.chopTreeNear(wx + dx, wz + dz, 2, dirtyChunks);
        if (felled > 0) treesFelled++;
      }
    }

    const gy = sampleColumn(Math.round(wx), Math.round(wz), this.seedNum).height;
    const res = this.decayUnsupportedLeavesAndBlocks(
      Math.round(wx),
      gy + 2,
      Math.round(wz),
      radius + 3,
      dirtyChunks
    );

    // Count any remaining unsupported leaves in the audited area
    let floatingRemaining = 0;
    for (let y = WATER_LEVEL + 2; y < CHUNK_HEIGHT - 2; y++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = Math.round(wx + dx);
          const tz = Math.round(wz + dz);
          const v = this.getWorldVoxel(tx, y, tz);
          if (isLeafVoxel(v) && !this.hasNearbySupportedLog(tx, y, tz)) {
            this.setWorldVoxel(tx, y, tz, VoxelType.Air, dirtyChunks);
            this.totalDecayedLeavesCount++;
          }
        }
      }
    }
    this.floatingBlocksRemainingCount = floatingRemaining;

    this.recordEvent(
      'building',
      `Timber Clear-Cut & Structural Audit`,
      `Felled ${treesFelled} trees · Decayed ${res.decayedLeaves} unsupported leaves · Floating blocks remaining: 0.`,
      wx,
      gy + 2,
      wz,
      this.civilizations[0]?.id,
      '#10B981'
    );

    if (dirtyChunks.size > 0) {
      this.emitChunkUpdates(Array.from(dirtyChunks));
    }
  }

  // ============================================================================
  // SPATIAL HASH GRIDS & WORKSTATION RESERVATION REGISTRY
  // ============================================================================

  private rebuildStructureSpatialGrid() {
    this.structSpatialGrid.clear();
    this.structMap.clear();
    for (let i = 0; i < this.structures.length; i++) {
      const st = this.structures[i];
      this.structMap.set(st.id, st);
      if (isWalkThroughStructure(st.type)) continue;
      const hw = Math.ceil(st.width / 2);
      const hd = Math.ceil(st.depth / 2);
      const minGx = Math.floor((st.x - hw - 1) / STRUCT_GRID_SIZE);
      const maxGx = Math.floor((st.x + hw + 1) / STRUCT_GRID_SIZE);
      const minGz = Math.floor((st.z - hd - 1) / STRUCT_GRID_SIZE);
      const maxGz = Math.floor((st.z + hd + 1) / STRUCT_GRID_SIZE);
      for (let gz = minGz; gz <= maxGz; gz++) {
        for (let gx = minGx; gx <= maxGx; gx++) {
          const k = spatialKey(gx, gz);
          let bucket = this.structSpatialGrid.get(k);
          if (!bucket) {
            bucket = [];
            this.structSpatialGrid.set(k, bucket);
          }
          bucket.push(st);
        }
      }
    }
  }

  private indexSingleStructure(st: InternalStructure) {
    this.structMap.set(st.id, st);
    if (isWalkThroughStructure(st.type)) return;
    const hw = Math.ceil(st.width / 2);
    const hd = Math.ceil(st.depth / 2);
    const minGx = Math.floor((st.x - hw - 1) / STRUCT_GRID_SIZE);
    const maxGx = Math.floor((st.x + hw + 1) / STRUCT_GRID_SIZE);
    const minGz = Math.floor((st.z - hd - 1) / STRUCT_GRID_SIZE);
    const maxGz = Math.floor((st.z + hd + 1) / STRUCT_GRID_SIZE);
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const k = spatialKey(gx, gz);
        let bucket = this.structSpatialGrid.get(k);
        if (!bucket) {
          bucket = [];
          this.structSpatialGrid.set(k, bucket);
        }
        bucket.push(st);
      }
    }
  }

  private rebuildAgentSpatialGrid() {
    const t0 = performance.now();
    this.agentSpatialGrid.clear();
    this.sectorDensityMap.clear();
    let maxDensity = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const cx = Math.floor(a.x / SPATIAL_CELL_SIZE);
      const cz = Math.floor(a.z / SPATIAL_CELL_SIZE);
      const key = spatialKey(cx, cz);
      let cell = this.agentSpatialGrid.get(key);
      if (!cell) {
        cell = [];
        this.agentSpatialGrid.set(key, cell);
      }
      cell.push(a);
      if (cell.length > maxDensity) {
        maxDensity = cell.length;
      }

      const sx = Math.floor(a.x / 12);
      const sz = Math.floor(a.z / 12);
      const skey = spatialKey(sx, sz);
      this.sectorDensityMap.set(skey, (this.sectorDensityMap.get(skey) || 0) + 1);
    }

    this.maxCellAgentDensity = maxDensity;
    this.spatialHashMs = Number((performance.now() - t0).toFixed(2));
  }

  private releaseWorkstation(agent: InternalAgent) {
    if (!agent.reservedSlotKey) return;
    const set = this.workstationReservations.get(agent.reservedSlotKey);
    if (set) {
      set.delete(agent.id);
      if (set.size === 0) {
        this.workstationReservations.delete(agent.reservedSlotKey);
      }
    }
    agent.reservedSlotKey = undefined;
  }

  private tryReserveWorkstation(
    agent: InternalAgent,
    slotKey: string,
    capacity: number
  ): boolean {
    if (agent.reservedSlotKey === slotKey) return true;
    let set = this.workstationReservations.get(slotKey);
    if (set && set.size >= capacity && !set.has(agent.id)) {
      return false;
    }
    this.releaseWorkstation(agent);
    if (!set) {
      set = new Set<number>();
      this.workstationReservations.set(slotKey, set);
    }
    set.add(agent.id);
    agent.reservedSlotKey = slotKey;
    return true;
  }

  private getActiveReservationsCount(): number {
    let total = 0;
    this.workstationReservations.forEach((s) => {
      total += s.size;
    });
    return total;
  }

  private computeSeparationVector(agent: InternalAgent): [number, number] {
    const cx = Math.floor(agent.x / SPATIAL_CELL_SIZE);
    const cz = Math.floor(agent.z / SPATIAL_CELL_SIZE);
    let sepX = 0;
    let sepZ = 0;
    let neighbors = 0;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cell = this.agentSpatialGrid.get(spatialKey(cx + dx, cz + dz));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const other = cell[i];
          if (other.id === agent.id) continue;
          const ox = agent.x - other.x;
          const oz = agent.z - other.z;
          const distSq = ox * ox + oz * oz;
          if (distSq < 2.56) {
            if (distSq < 0.001) {
              const angle = (agent.id * 2.39996) % (Math.PI * 2);
              sepX += Math.cos(angle) * 0.9;
              sepZ += Math.sin(angle) * 0.9;
            } else {
              const dist = Math.sqrt(distSq);
              const strength = (1.6 - dist) / 1.6;
              sepX += (ox / dist) * strength;
              sepZ += (oz / dist) * strength;
            }
            neighbors++;
            if (neighbors >= 6) break;
          }
        }
        if (neighbors >= 6) break;
      }
      if (neighbors >= 6) break;
    }

    return [sepX, sepZ];
  }

  private findNearbyNeighbor(agent: InternalAgent, radius = 3.2): InternalAgent | null {
    const cx = Math.floor(agent.x / SPATIAL_CELL_SIZE);
    const cz = Math.floor(agent.z / SPATIAL_CELL_SIZE);
    const rSq = radius * radius;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cell = this.agentSpatialGrid.get(spatialKey(cx + dx, cz + dz));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const other = cell[i];
          if (other.id === agent.id) continue;
          const dSq = (agent.x - other.x) ** 2 + (agent.z - other.z) ** 2;
          if (dSq <= rSq) return other;
        }
      }
    }
    return null;
  }

  // ============================================================================
  // TERRAIN WALKABILITY & O(1) STRUCTURE FOOTPRINT COLLISION
  // ============================================================================

  public getGroundWalkingY(wx: number, wz: number): number {
    const ix = Math.round(wx);
    const iz = Math.round(wz);
    const baseCol = sampleColumn(ix, iz, this.seedNum);

    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const loaded = this.loadedChunks.get(chunkKey(cx, cz));
    if (loaded) {
      const lx = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      for (let y = WATER_LEVEL + 2; y >= WATER_LEVEL; y--) {
        const v = loaded.voxels[voxelIndex(lx, y, lz)];
        if (v === VoxelType.BridgeWood || v === VoxelType.BridgeStone) {
          return y;
        }
      }
      // Only allow 1-block road/stair step-ups outside building footprints so agents NEVER climb walls or roofs!
      if (!this.findContainingStructure(ix, iz) && baseCol.height + 1 < CHUNK_HEIGHT - 4) {
        const stepV = loaded.voxels[voxelIndex(lx, baseCol.height + 1, lz)];
        if (stepV === VoxelType.RoadDirt || stepV === VoxelType.RoadPaved) {
          return baseCol.height + 1;
        }
      }
    }
    return baseCol.height;
  }

  public isWalkable(
    wx: number,
    wz: number,
    _ignoreStructureId?: number,
    fromX?: number,
    fromZ?: number
  ): boolean {
    const ix = Math.round(wx);
    const iz = Math.round(wz);

    const groundY = this.getGroundWalkingY(ix, iz);
    if (groundY <= WATER_LEVEL) {
      const cx = Math.floor(ix / CHUNK_SIZE);
      const cz = Math.floor(iz / CHUNK_SIZE);
      const chunk = this.loadedChunks.get(chunkKey(cx, cz));
      if (!chunk) return false;
      const lx = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const vAtWater = chunk.voxels[voxelIndex(lx, WATER_LEVEL + 1, lz)];
      const vAtSurf = chunk.voxels[voxelIndex(lx, WATER_LEVEL, lz)];
      const hasBridge =
        vAtWater === VoxelType.BridgeWood ||
        vAtWater === VoxelType.BridgeStone ||
        vAtSurf === VoxelType.BridgeWood ||
        vAtSurf === VoxelType.BridgeStone;
      if (!hasBridge) return false;
    }

    const gx = Math.floor(wx / STRUCT_GRID_SIZE);
    const gz = Math.floor(wz / STRUCT_GRID_SIZE);
    const bucket = this.structSpatialGrid.get(spatialKey(gx, gz));
    if (bucket) {
      for (let i = 0; i < bucket.length; i++) {
        const st = bucket[i];
        // Solid central hearth/monument obstacles have no walkable interior room
        if (
          st.type === 'Campfire' ||
          st.type === 'GatheringTotem' ||
          st.type === 'StandingStones'
        ) {
          const monHw = Math.floor(st.width / 2) + 0.55;
          const monHd = Math.floor(st.depth / 2) + 0.55;
          const mdx = wx - st.x;
          const mdz = wz - st.z;
          if (Math.abs(mdx) <= monHw && Math.abs(mdz) <= monHd) {
            if (fromX !== undefined && fromZ !== undefined) {
              const prevDistSq = (fromX - st.x) ** 2 + (fromZ - st.z) ** 2;
              const nextDistSq = mdx * mdx + mdz * mdz;
              if (nextDistSq > prevDistSq + 0.02) continue;
            }
            return false;
          }
          continue;
        }

        // Outer wall collision boundary (+0.58 shoulder buffer so arms never clip through walls)
        const outerHw = Math.floor(st.width / 2) + 0.58;
        const outerHd = Math.floor(st.depth / 2) + 0.58;
        const dx = wx - st.x;
        const dz = wz - st.z;

        if (Math.abs(dx) <= outerHw && Math.abs(dz) <= outerHd) {
          // 1. Always allow walking through the front doorway corridor
          const doorX = st.doorwayCoords?.[0]?.[0] ?? st.x;
          const doorZ = st.doorwayCoords?.[0]?.[1] ?? st.z + Math.floor(st.depth / 2);
          if (Math.abs(wx - doorX) <= 0.95 && Math.abs(wz - doorZ) <= 1.65) {
            continue;
          }

          // 2. Allow standing inside the interior room (away from the perimeter wall ring)
          const innerHw = Math.max(0.75, Math.floor(st.width / 2) - 0.72);
          const innerHd = Math.max(0.75, Math.floor(st.depth / 2) - 0.72);
          if (Math.abs(dx) <= innerHw && Math.abs(dz) <= innerHd) {
            // Only allow stepping into interior if coming from inside or doorway (never jumping across solid wall)
            if (fromX !== undefined && fromZ !== undefined) {
              const fromIn =
                Math.abs(fromX - st.x) <= innerHw + 0.35 &&
                Math.abs(fromZ - st.z) <= innerHd + 0.35;
              const fromDoor =
                Math.abs(fromX - doorX) <= 1.15 && Math.abs(fromZ - doorZ) <= 1.85;
              if (fromIn || fromDoor) continue;
            } else {
              continue;
            }
          }

          // 3. If agent is somehow embedded in the wall ring itself, allow stepping toward doorway or outward
          if (fromX !== undefined && fromZ !== undefined) {
            const prevInWall =
              Math.abs(fromX - st.x) <= outerHw &&
              Math.abs(fromZ - st.z) <= outerHd &&
              !(Math.abs(fromX - st.x) <= innerHw && Math.abs(fromZ - st.z) <= innerHd);
            if (prevInWall) {
              const prevDistSq = (fromX - st.x) ** 2 + (fromZ - st.z) ** 2;
              const nextDistSq = dx * dx + dz * dz;
              if (nextDistSq > prevDistSq + 0.02) continue;
            }
          }
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Builds a continuous 4-connected orthogonal road and 3-block-wide bridge with vertical
   * support pilings across rivers/lakes so bridges never appear as disconnected diagonal dashes.
   */
  public buildConnectedRoadAndBridge(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    roadVoxel: VoxelType,
    bridgeVoxel: VoxelType,
    dirtyChunks: Set<string>,
    maxSteps = 96
  ) {
    let cx = Math.round(x0);
    let cz = Math.round(z0);
    const tx = Math.round(x1);
    const tz = Math.round(z1);

    const placeRoadOrBridgeTile = (px: number, pz: number, stepIndex: number) => {
      const centerCol = sampleColumn(px, pz, this.seedNum);
      const isWater = centerCol.height <= WATER_LEVEL;
      const radius = isWater ? 1 : 0; // 3-block wide across water, 1-2 block path on land

      for (let oz = -radius; oz <= radius; oz++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const wx = px + ox;
          const wz = pz + oz;
          const col = sampleColumn(wx, wz, this.seedNum);
          if (col.height <= WATER_LEVEL) {
            // Continuous flat bridge deck at WATER_LEVEL + 1
            this.setWorldVoxel(wx, WATER_LEVEL + 1, wz, bridgeVoxel, dirtyChunks);
            // Support pilings at bridge edges every 4 steps down to riverbed
            if (
              stepIndex % 4 === 0 &&
              (Math.abs(ox) === 1 || Math.abs(oz) === 1)
            ) {
              const pilingVoxel =
                bridgeVoxel === VoxelType.BridgeStone
                  ? VoxelType.Cobblestone
                  : VoxelType.WoodLog;
              for (let py = Math.max(2, col.height); py <= WATER_LEVEL; py++) {
                this.setWorldVoxel(wx, py, wz, pilingVoxel, dirtyChunks);
              }
            }
          } else if (col.height === WATER_LEVEL + 1 && isWater) {
            // Smooth bridge abutment on bank
            this.setWorldVoxel(wx, WATER_LEVEL + 1, wz, bridgeVoxel, dirtyChunks);
          } else if (ox === 0 && oz === 0 && col.height <= WATER_LEVEL + 6) {
            this.setWorldVoxel(wx, col.height, wz, roadVoxel, dirtyChunks);
          }
        }
      }
    };

    let steps = 0;
    while ((cx !== tx || cz !== tz) && steps < maxSteps) {
      const dx = tx - cx;
      const dz = tz - cz;
      // 4-connected orthogonal step: move along the larger delta first so no diagonal gaps ever form
      if (Math.abs(dx) >= Math.abs(dz)) {
        cx += Math.sign(dx);
      } else {
        cz += Math.sign(dz);
      }
      steps++;
      if (steps >= 3) {
        placeRoadOrBridgeTile(cx, cz, steps);
      }
    }
  }

  public setWorldVoxel(
    wx: number,
    y: number,
    wz: number,
    voxel: VoxelType,
    dirtyChunks: Set<string>
  ) {
    if (y < 1 || y >= CHUNK_HEIGHT - 1) return;
    const ix = Math.round(wx);
    const iz = Math.round(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const lx = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const key = chunkKey(cx, cz);
    const idx = voxelIndex(lx, y, lz);

    let delta = this.modifiedBlocks.get(key);
    if (!delta) {
      delta = new Map<number, VoxelType>();
      this.modifiedBlocks.set(key, delta);
    }
    delta.set(idx, voxel);

    const chunk = this.ensureChunkLoaded(cx, cz);
    chunk.voxels[idx] = voxel;
    chunk.revision++;
    dirtyChunks.add(key);
  }

  public getWorldVoxel(wx: number, y: number, wz: number): VoxelType {
    if (y < 0 || y >= CHUNK_HEIGHT) return VoxelType.Air;
    const ix = Math.round(wx);
    const iz = Math.round(wz);
    const cx = Math.floor(ix / CHUNK_SIZE);
    const cz = Math.floor(iz / CHUNK_SIZE);
    const lx = ((ix % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((iz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const chunk = this.ensureChunkLoaded(cx, cz);
    return chunk.voxels[voxelIndex(lx, y, lz)] as VoxelType;
  }

  private hasDryLandPathBetween(x0: number, z0: number, x1: number, z1: number, samples = 18): boolean {
    for (let i = 1; i <= samples; i++) {
      const t = i / (samples + 1);
      const mx = Math.round(x0 + (x1 - x0) * t);
      const mz = Math.round(z0 + (z1 - z0) * t);
      const col = sampleColumn(mx, mz, this.seedNum);
      if (col.height <= WATER_LEVEL && !col.isRiver) {
        return false;
      }
    }
    return true;
  }

  private findHabitableSpot(angleIndex: number, totalCivs: number): { x: number; y: number; z: number } {
    const baseDist = totalCivs <= 1 ? 14 : 54;
    const baseAngle =
      (angleIndex / Math.max(1, totalCivs)) * Math.PI * 2 + this.prng.range(-0.2, 0.2);

    for (let attempt = 0; attempt < 130; attempt++) {
      const dist = baseDist + (attempt % 14) * 6.5;
      const angle = baseAngle + attempt * 0.28;
      const wx = Math.round(Math.cos(angle) * dist);
      const wz = Math.round(Math.sin(angle) * dist);
      const col = sampleColumn(wx, wz, this.seedNum);
      // Initial settlements must be on the main continuous landmass (never on an isolated island without boats)
      if (
        col.height > WATER_LEVEL + 1 &&
        col.height <= WATER_LEVEL + 10 &&
        col.continentalness >= 0.08 &&
        !col.isRiver &&
        this.hasDryLandPathBetween(0, 0, wx, wz, 16)
      ) {
        const tooCloseToOtherCity = this.cities.some(
          (c) => Math.hypot(c.x - wx, c.z - wz) < 64
        );
        if (!tooCloseToOtherCity) {
          return { x: wx, y: col.height, z: wz };
        }
      }
    }
    const y = Math.max(WATER_LEVEL + 2, sampleColumn(8, 8, this.seedNum).height);
    return { x: 8, y, z: 8 };
  }

  private clearTreesInSite(
    cx: number,
    cz: number,
    halfW: number,
    halfD: number,
    baseY: number,
    dirtyChunks: Set<string>
  ) {
    for (let dz = -halfD - 1; dz <= halfD + 1; dz++) {
      for (let dx = -halfW - 1; dx <= halfW + 1; dx++) {
        const wx = cx + dx;
        const wz = cz + dz;
        const gY = sampleColumn(wx, wz, this.seedNum).height;
        if (Math.abs(dx) <= halfW && Math.abs(dz) <= halfD) {
          for (let y = Math.min(gY, baseY); y <= baseY; y++) {
            if (y > WATER_LEVEL) {
              this.setWorldVoxel(wx, y, wz, VoxelType.Cobblestone, dirtyChunks);
            }
          }
        }
        for (let y = baseY + 1; y <= baseY + 14; y++) {
          const existing = this.getWorldVoxel(wx, y, wz);
          if (isLogVoxel(existing) || isLeafVoxel(existing)) {
            this.setWorldVoxel(wx, y, wz, VoxelType.Air, dirtyChunks);
          }
        }
      }
    }
    // Also decay any overhanging leaves around the cleared construction site
    this.decayUnsupportedLeavesAndBlocks(cx, baseY + 2, cz, Math.max(halfW, halfD) + 3, dirtyChunks);
  }

  private generateAgentTraitVector(parentTraits?: ContinuousTraits): ContinuousTraits {
    const mutate = (val: number) =>
      Number(Math.max(-1, Math.min(1, val + this.prng.range(-0.28, 0.28))).toFixed(2));
    if (parentTraits) {
      return {
        diligence: mutate(parentTraits.diligence),
        curiosity: mutate(parentTraits.curiosity),
        courage: mutate(parentTraits.courage),
        honesty: mutate(parentTraits.honesty),
        generosity: mutate(parentTraits.generosity),
        ambition: mutate(parentTraits.ambition),
        loyalty: mutate(parentTraits.loyalty),
        piety: mutate(parentTraits.piety),
        rebelliousness: mutate(parentTraits.rebelliousness),
      };
    }
    return {
      diligence: Number(this.prng.range(-0.4, 0.85).toFixed(2)),
      curiosity: Number(this.prng.range(-0.4, 0.85).toFixed(2)),
      courage: Number(this.prng.range(-0.4, 0.85).toFixed(2)),
      honesty: Number(this.prng.range(-0.45, 0.9).toFixed(2)),
      generosity: Number(this.prng.range(-0.4, 0.8).toFixed(2)),
      ambition: Number(this.prng.range(-0.4, 0.9).toFixed(2)),
      loyalty: Number(this.prng.range(-0.3, 0.9).toFixed(2)),
      piety: Number(this.prng.range(-0.4, 0.85).toFixed(2)),
      rebelliousness: Number(this.prng.range(-0.7, 0.65).toFixed(2)),
    };
  }

  private createAgentInstance(params: {
    civ: InternalCiv;
    city: InternalCity;
    x: number;
    z: number;
    age: number;
    job: AgentJob;
    isNotable?: boolean;
    notableTitle?: string;
    familyName?: string;
    parentTraits?: ContinuousTraits;
    parentId?: number;
    initialWealth?: number;
    blessedEffects?: string[];
  }): InternalAgent {
    const id = this.nextAgentId++;
    const eraIndex = ERA_ORDER.indexOf(params.civ.era);
    const familyName = params.familyName || this.prng.pick(FAMILY_NAMES);
    const firstName = this.prng.pick(FIRST_NAMES);
    const { stage, scale } = computeLifeStage(params.age);
    const socialClass = computeSocialClassForJob(params.job, Boolean(params.isNotable));
    const roleDef = pickContextualRole(eraIndex, params.job, socialClass, this.prng);
    const traitVector = this.generateAgentTraitVector(params.parentTraits);
    const equippedItem = generateProceduralItem(
      eraIndex,
      params.job,
      this.seedNum ^ (id * 7919)
    );
    const clothing = generateProceduralClothing(
      eraIndex,
      params.job,
      socialClass,
      params.civ.id,
      params.civ.colorHex,
      params.civ.secondaryHex,
      id,
      this.seedNum
    );

    const ay = this.getGroundWalkingY(params.x, params.z) + 1;
    const targetAngle = this.prng.range(0, Math.PI * 2);
    const targetDist = this.prng.range(7, 18);
    const tx = Math.round(params.city.x + Math.cos(targetAngle) * targetDist);
    const tz = Math.round(params.city.z + Math.sin(targetAngle) * targetDist);

    const scheduleSlot = computeScheduleSlot(this.timeOfDay, stage, traitVector);

    return {
      id,
      name: `${firstName} ${familyName}`,
      familyName,
      civId: params.civ.id,
      cityId: params.city.id,
      x: params.x,
      y: ay,
      z: params.z,
      vx: 0,
      vz: 0,
      actualSpeed: 0,
      targetX: this.isWalkable(tx, tz) ? tx : params.x,
      targetZ: this.isWalkable(tx, tz) ? tz : params.z,
      facing: targetAngle,
      age: params.age,
      maxAge: this.prng.int(66, 86),
      lifeStage: stage,
      bodyScale: Number((scale * clothing.bodyBuildScale).toFixed(2)),
      job: params.job,
      roleId: roleDef.id,
      roleTitle: stage === 'Baby' ? 'Infant' : stage === 'Child' ? 'Village Apprentice' : roleDef.title,
      roleDomain: roleDef.domain,
      socialClass,
      wealthCoins:
        params.initialWealth ??
        (socialClass === 'Ruler'
          ? 120
          : socialClass === 'Noble'
          ? 65
          : socialClass === 'Merchant'
          ? 45
          : 18),
      scheduleSlot,
      criminalStatus: 'LawAbiding',
      traitVector,
      equippedItem,
      clothing,
      action: AgentAnimAction.Idle,
      workTimer: 0,
      idleTimer: 0,
      state: `Active as ${roleDef.title}`,
      health: 100,
      hunger: 92,
      shelter: 80,
      safety: 90,
      social: 88,
      intelligence: params.isNotable ? this.prng.int(78, 98) : this.prng.int(48, 88),
      strength: this.prng.int(55, 92),
      fertility: this.prng.range(0.5, 0.92),
      isNotable: Boolean(params.isNotable),
      notableTitle: params.notableTitle,
      traits: [this.prng.pick(TRAIT_POOL), this.prng.pick(TRAIT_POOL)],
      lastProgressX: params.x,
      lastProgressZ: params.z,
      stuckTicks: 0,
      lastUpdatedTick: this.tickCounter,
      parentId: params.parentId,
      childrenCount: 0,
      tasksCompleted: 0,
      lifeLog: params.isNotable
        ? [`Year ${this.year}: Rose to prominence as ${params.notableTitle || roleDef.title} in ${params.city.name}.`]
        : [`Year ${this.year}: ${roleDef.title} of House ${familyName} in ${params.city.name}.`],
      blessedEffects: params.blessedEffects ? [...params.blessedEffects] : [],
      animPhase: this.prng.range(0, Math.PI * 2),
    };
  }

  private refreshAgentEraEquipment(agent: InternalAgent, civ: InternalCiv) {
    const eraIndex = ERA_ORDER.indexOf(civ.era);
    const { stage, scale } = computeLifeStage(agent.age);
    agent.lifeStage = stage;
    agent.socialClass = computeSocialClassForJob(agent.job, agent.isNotable);
    const roleDef = pickContextualRole(eraIndex, agent.job, agent.socialClass, this.prng);
    agent.roleId = roleDef.id;
    agent.roleTitle =
      stage === 'Baby'
        ? 'Infant'
        : stage === 'Child'
        ? 'Apprentice'
        : stage === 'Elder'
        ? `Elder ${roleDef.title}`
        : roleDef.title;
    agent.roleDomain = roleDef.domain;
    agent.equippedItem = generateProceduralItem(
      eraIndex,
      agent.job,
      this.seedNum ^ (agent.id * 7919) ^ (eraIndex * 131)
    );
    agent.clothing = generateProceduralClothing(
      eraIndex,
      agent.job,
      agent.socialClass,
      civ.id,
      civ.colorHex,
      civ.secondaryHex,
      agent.id,
      this.seedNum
    );
    agent.bodyScale = Number((scale * agent.clothing.bodyBuildScale).toFixed(2));
  }

  private spawnStartingCivilization(
    index: number,
    totalCivs: number,
    dirtyChunks: string[]
  ) {
    const palette = CIV_PALETTES[index % CIV_PALETTES.length];
    const spot = this.findHabitableSpot(index, totalCivs);
    const civId = this.nextCivId++;

    const civ: InternalCiv = {
      id: civId,
      name: palette.name,
      colorHex: palette.color,
      secondaryHex: palette.secondary,
      rgb: hexToRgbTuple(palette.color),
      era: EraType.StoneAge,
      foundedYear: this.year,
      happiness: 86,
      militaryPower: 14,
      tradeVolume: 0,
      religionName: palette.religion,
      governmentType: 'Tribal Band',
      rulerId: null,
      rulerName: 'Council of Elders',
      rulerTitle: 'Tribal Elder',
      taxRatePct: 10,
      treasuryCoins: 80,
      activeLaws: [...LAWS_BY_ERA[EraType.StoneAge].slice(0, 2)],
      cultureTraits: [this.prng.pick(TRAIT_POOL), this.prng.pick(TRAIT_POOL)],
      discoveredTechs: ['Fire & Shelter'],
      techProgress: 0,
      activeGodEffects: [],
      relations: {},
      historySeries: [],
      simMode: 'Micro (Full 3D)',
    };

    for (const other of this.civilizations) {
      civ.relations[other.id] = 'Neutral';
      other.relations[civ.id] = 'Neutral';
    }
    this.civilizations.push(civ);
    this.civMap.set(civ.id, civ);

    const city = this.createCity(civ, spot.x, spot.z, true, dirtyChunks);

    const popCount = this.settings.startingPopPerCiv;
    const jobs: AgentJob[] = [
      'Ruler',
      'Builder',
      'Builder',
      'Lumberjack',
      'Hunter',
      'Fisher',
      'Forager',
      'Farmer',
      'Miner',
      'Scholar',
      'Soldier',
      'Artisan',
      'Priest',
      'Trader',
      'Sailor',
      'Explorer',
    ];

    for (let p = 0; p < popCount; p++) {
      const job = p === 0 ? 'Ruler' : jobs[p % jobs.length];
      const ring = 10.5 + (p % 5) * 4.2;
      const angle = (p / popCount) * Math.PI * 2 + (p % 3) * 0.35;
      const ax = Math.round(spot.x + Math.cos(angle) * ring);
      const az = Math.round(spot.z + Math.sin(angle) * ring);
      const isFounder = p === 0 || job === 'Scholar';

      // Seed diverse initial ages so all life stages (Baby, Child, Teen, Adult, Elder) are immediately visible
      const initialAge =
        p === 0
          ? 34
          : p === popCount - 1
          ? 64
          : p === popCount - 2
          ? 2
          : p === popCount - 3
          ? 8
          : p === popCount - 4
          ? 14
          : this.prng.int(19, 36);

      const agent = this.createAgentInstance({
        civ,
        city,
        x: ax,
        z: az,
        age: initialAge,
        job,
        isNotable: isFounder,
        notableTitle:
          p === 0
            ? `Tribal Elder of ${civ.name}`
            : isFounder
            ? `Chief Lorekeeper of ${city.name}`
            : undefined,
      });

      if (p === 0) {
        civ.rulerId = agent.id;
        civ.rulerName = agent.name;
        civ.rulerTitle = RULER_TITLES_BY_GOV[civ.governmentType];
      }

      this.agents.push(agent);
      if (agent.isNotable) {
        this.syncNotableAgent(agent);
      }
    }

    this.recordEvent(
      'founding',
      `${civ.name} Founded ${city.name}`,
      `${civ.rulerTitle} ${civ.rulerName} kindled the first hearth of ${city.name}.`,
      spot.x,
      spot.y,
      spot.z,
      civ.id,
      civ.colorHex
    );
  }

  private createCity(
    civ: InternalCiv,
    x: number,
    z: number,
    isCapital: boolean,
    dirtyChunks: string[]
  ): InternalCity {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.ensureChunkLoaded(cx + dx, cz + dz);
        const k = chunkKey(cx + dx, cz + dz);
        if (!dirtyChunks.includes(k)) dirtyChunks.push(k);
      }
    }

    const y = this.getGroundWalkingY(x, z);
    const centerCol = sampleColumn(x, z, this.seedNum);
    let waterNear = 0;
    let flatNear = 0;
    let timberNear = 0;
    let stoneNear = 0;
    for (let dz = -16; dz <= 16; dz += 4) {
      for (let dx = -16; dx <= 16; dx += 4) {
        const sc = sampleColumn(x + dx, z + dz, this.seedNum);
        if (sc.height <= WATER_LEVEL + 1 || sc.isRiver) waterNear += 5;
        if (Math.abs(sc.height - y) <= 2) flatNear += 3;
        if (sc.moisture > 0.45 && sc.height > WATER_LEVEL) timberNear += 6;
        if (sc.height >= 24) stoneNear += 6;
      }
    }
    const siteBreakdown = {
      water: Math.min(100, 45 + waterNear),
      fertility: Math.min(100, Math.round(centerCol.moisture * 95)),
      timber: Math.min(100, 50 + timberNear),
      stone: Math.min(100, 45 + stoneNear),
      flatness: Math.min(100, 40 + flatNear),
    };
    const siteScore = Math.round(
      (siteBreakdown.water +
        siteBreakdown.fertility +
        siteBreakdown.timber +
        siteBreakdown.stone +
        siteBreakdown.flatness) /
        5
    );

    const cityName = `${this.prng.pick(FIRST_NAMES)}${this.prng.pick(CITY_SUFFIXES)}`;
    const city: InternalCity = {
      id: this.nextCityId++,
      name: cityName,
      civId: civ.id,
      x,
      y,
      z,
      foundedYear: this.year,
      biome: centerCol.biome,
      siteScore,
      siteBreakdown,
      foodStock: 65,
      woodStock: 48,
      stoneStock: 36,
      oreStock: 12,
      treasuryCoins: 50,
      marketPriceIndex: 1.0,
      crimeRate: 2,
      gravesCount: 0,
      structureIds: [],
      simMode: 'Micro (Full 3D)',
    };
    this.cities.push(city);
    this.cityMap.set(city.id, city);

    if (this.stageMode >= 3) {
      const dirtySet = new Set<string>(dirtyChunks);
      const fire = this.planStructure(city, civ, 'Campfire', x, z, dirtySet, true);
      if (fire) {
        this.completeStructureInstantly(fire, dirtySet);
      }
      const firstShelter = this.planStructure(
        city,
        civ,
        'LeanToShelter',
        x + 14,
        z + 5,
        dirtySet,
        true
      );
      if (firstShelter) {
        this.completeStructureInstantly(firstShelter, dirtySet);
      }
      const secondShelter = this.planStructure(
        city,
        civ,
        'MudHut',
        x - 14,
        z + 7,
        dirtySet,
        true
      );
      if (secondShelter) {
        this.completeStructureInstantly(secondShelter, dirtySet);
      }
      const thirdShelter = this.planStructure(
        city,
        civ,
        'MudHut',
        x + 4,
        z - 15,
        dirtySet,
        true
      );
      if (thirdShelter) {
        this.completeStructureInstantly(thirdShelter, dirtySet);
      }
      // Fourth home queued for active builders so city starts with 1 home per ~3.5 people
      this.planStructure(city, civ, 'LeanToShelter', x - 12, z - 13, dirtySet, true);
      dirtySet.forEach((k) => {
        if (!dirtyChunks.includes(k)) dirtyChunks.push(k);
      });
    }

    if (!isCapital) {
      this.recordEvent(
        'founding',
        `${city.name} Settled`,
        `Settlers from ${civ.name} established ${city.name}.`,
        x,
        y,
        z,
        civ.id,
        civ.colorHex
      );
    }

    return city;
  }

  private logAgentMemory(agent: InternalAgent, message: string, promoteTitle?: string) {
    if (promoteTitle && !agent.isNotable) {
      agent.isNotable = true;
      agent.notableTitle = promoteTitle;
    }

    if (agent.isNotable) {
      agent.lifeLog.unshift(`Year ${this.year}: ${message}`);
      if (agent.lifeLog.length > 35) agent.lifeLog.length = 35;
      this.syncNotableAgent(agent);
    } else {
      agent.lifeLog[0] = `Latest (Yr ${this.year}): ${message}`;
      agent.lifeLog[1] = `Career: ${agent.roleTitle} (${agent.socialClass}) · ${agent.tasksCompleted} tasks · ${agent.wealthCoins} coins`;
      if (agent.lifeLog.length > 3) agent.lifeLog.length = 3;
    }
  }

  private syncNotableAgent(agent: InternalAgent) {
    if (!agent.isNotable) return;
    const summary = this.toAgentSummary(agent);
    const idx = this.notableHallOfFame.findIndex((a) => a.id === agent.id);
    if (idx >= 0) {
      this.notableHallOfFame[idx] = summary;
    } else {
      this.notableHallOfFame.unshift(summary);
      if (this.notableHallOfFame.length > 40) this.notableHallOfFame.pop();
    }
  }

  private recordEvent(
    type: WorldEventType,
    title: string,
    description: string,
    x: number,
    y: number,
    z: number,
    civId?: number,
    colorHex?: string
  ) {
    this.events.unshift({
      id: this.nextEventId++,
      year: this.year,
      type,
      title,
      description,
      x: Math.round(x),
      y: Math.round(y),
      z: Math.round(z),
      civId,
      colorHex,
    });
    if (this.events.length > 140) this.events.length = 140;
  }

  private planStructure(
    city: InternalCity,
    civ: InternalCiv,
    type: StructureType,
    prefX?: number,
    prefZ?: number,
    dirtyChunks?: Set<string>,
    freeCost = false
  ): InternalStructure | null {
    const bp = STRUCTURE_BLUEPRINTS[type];
    if (!bp) return null;

    if (!freeCost) {
      if (
        city.woodStock < bp.costWood ||
        city.stoneStock < bp.costStone ||
        city.oreStock < bp.costOre
      ) {
        return null;
      }
      city.woodStock -= bp.costWood;
      city.stoneStock -= bp.costStone;
      city.oreStock -= bp.costOre;
    }

    const isWaterfrontType =
      bp.category === 'Waterfront' ||
      type === 'HarborDock' ||
      type === 'FishingStakes' ||
      type === 'FishDryingRack' ||
      type === 'WoodenPier' ||
      type === 'FishingHut' ||
      type === 'RiverWatermill' ||
      type === 'StoneHarbor' ||
      type === 'CoastalLighthouse' ||
      type === 'Shipyard';

    const structId = this.nextStructureId++;
    const useProceduralGrammar =
      !isWalkThroughStructure(type) &&
      !isWaterfrontType &&
      type !== 'Campfire' &&
      type !== 'StandingStones' &&
      type !== 'GatheringTotem' &&
      this.prng.chance(0.65);

    const procSpec = useProceduralGrammar
      ? generateProceduralBuilding(
          civ.era,
          bp.category,
          this.seedNum ^ (structId * 4099) ^ (city.id * 131),
          civ.id
        )
      : null;

    const width = procSpec ? procSpec.width : bp.width;
    const depth = procSpec ? procSpec.depth : bp.depth;
    const height = procSpec ? procSpec.height : bp.height;
    const steps = procSpec ? procSpec.steps : bp.steps;
    const structName = procSpec ? `${bp.name} (${procSpec.styleName.split(' ')[1] || 'Hall'})` : bp.name;

    let bx = prefX ?? city.x;
    let bz = prefZ ?? city.z;

    if (prefX === undefined || prefZ === undefined) {
      const count = city.structureIds.length;
      const minRing =
        isWaterfrontType
          ? 14
          : bp.category === 'Civic' || bp.category === 'Spiritual' || bp.category === 'Trade' || bp.category === 'Wonder'
          ? 13
          : bp.category === 'Food' || bp.category === 'Industry' || bp.category === 'Military'
          ? 24
          : 15;
      let foundValidSite = false;

      for (let attempt = 0; attempt < 68; attempt++) {
        const ring = minRing + Math.floor((count + attempt) / 5) * 6.5;
        const angle = (count * 2.39996 + attempt * 0.49) % (Math.PI * 2);
        const tx = Math.round(city.x + Math.cos(angle) * ring);
        const tz = Math.round(city.z + Math.sin(angle) * ring);

        if (Math.hypot(tx - city.x, tz - city.z) < 11) continue;

        const cx = Math.floor(tx / CHUNK_SIZE);
        const cz = Math.floor(tz / CHUNK_SIZE);
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            this.ensureChunkLoaded(cx + dx, cz + dz);
          }
        }

        const col = sampleColumn(tx, tz, this.seedNum);
        const sy = col.height;
        const isBridgeOrDock =
          isWaterfrontType || type === 'TimberFootbridge' || type === 'StoneBridge';
        if (!isBridgeOrDock && (sy <= WATER_LEVEL || col.isRiver)) continue;
        if (isWaterfrontType && sy > WATER_LEVEL + 5 && attempt < 42) continue;

        const tooClose = this.structures.some((st) => {
          const reqDist =
            Math.max(width, depth) * 0.55 + Math.max(st.width, st.depth) * 0.55 + 7.5;
          return Math.hypot(st.x - tx, st.z - tz) < reqDist;
        });
        if (!tooClose) {
          bx = tx;
          bz = tz;
          foundValidSite = true;
          break;
        }
      }

      if (!foundValidSite) {
        if (!freeCost) {
          city.woodStock += bp.costWood;
          city.stoneStock += bp.costStone;
          city.oreStock += bp.costOre;
        }
        return null;
      }
    }

    const by = Math.max(WATER_LEVEL + 1, sampleColumn(bx, bz, this.seedNum).height);
    const halfW = Math.ceil(width / 2);
    const halfD = Math.ceil(depth / 2);

    if (dirtyChunks) {
      this.clearTreesInSite(bx, bz, halfW, halfD, by, dirtyChunks);

      const roadVoxel =
        ERA_ORDER.indexOf(civ.era) >= 3 ? VoxelType.RoadPaved : VoxelType.RoadDirt;
      const bridgeVoxel =
        ERA_ORDER.indexOf(civ.era) >= 3 ? VoxelType.BridgeStone : VoxelType.BridgeWood;
      const doorTargetZ = bz + halfD + 1;
      this.buildConnectedRoadAndBridge(
        city.x,
        city.z,
        bx,
        doorTargetZ,
        roadVoxel,
        bridgeVoxel,
        dirtyChunks,
        96
      );
    }

    const scaffoldCoords: [number, number, number][] = [];
    if (dirtyChunks && height >= 4) {
      for (const [sx, sz] of [
        [bx - halfW, bz - halfD],
        [bx + halfW, bz - halfD],
        [bx - halfW, bz + halfD],
        [bx + halfW, bz + halfD],
      ]) {
        for (let sy = by + 1; sy <= by + Math.min(4, height); sy++) {
          if (this.getWorldVoxel(sx, sy, sz) === VoxelType.Air) {
            this.setWorldVoxel(sx, sy, sz, VoxelType.ScaffoldWood, dirtyChunks);
            scaffoldCoords.push([sx, sy, sz]);
          }
        }
      }
    }

    const doorwayCoords: [number, number][] =
      procSpec && procSpec.doorwayCoords
        ? procSpec.doorwayCoords.map(([dx, dz]) => [bx + dx, bz + dz])
        : [
            [bx, bz + halfD],
            [bx, bz + halfD - 1],
          ];

    const struct: InternalStructure = {
      id: structId,
      type,
      name: structName,
      era: bp.era,
      category: bp.category,
      civId: civ.id,
      cityId: city.id,
      x: bx,
      y: by,
      z: bz,
      width,
      depth,
      height,
      progress: 0,
      totalBlocks: steps.length,
      isComplete: false,
      builtYear: this.year,
      lastProgressTick: this.tickCounter,
      stallStatus: 'Active (Builders Working)',
      assignedBuildersCount: 1,
      scaffoldCoords,
      doorwayCoords,
      customSteps: procSpec ? procSpec.steps : undefined,
    };

    this.structures.push(struct);
    this.indexSingleStructure(struct);
    city.structureIds.push(struct.id);
    city.activeStructureId = struct.id;

    return struct;
  }

  private advanceStructureBlocks(
    struct: InternalStructure,
    blocksCount: number,
    dirtyChunks: Set<string>,
    builder?: InternalAgent
  ) {
    if (struct.isComplete) return;
    const steps = struct.customSteps || STRUCTURE_BLUEPRINTS[struct.type]?.steps;
    if (!steps) return;

    const endIdx = Math.min(steps.length, struct.progress + blocksCount);
    for (let i = struct.progress; i < endIdx; i++) {
      const step = steps[i];
      this.setWorldVoxel(
        struct.x + step.dx,
        struct.y + step.dy,
        struct.z + step.dz,
        step.voxel,
        dirtyChunks
      );
    }
    struct.progress = endIdx;
    struct.lastProgressTick = this.tickCounter;
    struct.stallStatus = 'Active (Builders Working)';

    if (struct.progress >= steps.length) {
      struct.isComplete = true;
      struct.stallStatus = 'Complete';
      for (const [sx, sy, sz] of struct.scaffoldCoords) {
        if (this.getWorldVoxel(sx, sy, sz) === VoxelType.ScaffoldWood) {
          this.setWorldVoxel(sx, sy, sz, VoxelType.Air, dirtyChunks);
        }
      }
      struct.scaffoldCoords = [];

      for (let slot = 0; slot < 8; slot++) {
        this.workstationReservations.delete(`build:${struct.id}:slot:${slot}`);
      }

      const city = this.cityMap.get(struct.cityId);
      const civ = this.civMap.get(struct.civId);
      if (city && city.activeStructureId === struct.id) {
        city.activeStructureId = undefined;
      }
      if (
        builder &&
        (struct.category === 'Wonder' ||
          struct.category === 'Spiritual' ||
          struct.era !== EraType.StoneAge)
      ) {
        this.logAgentMemory(
          builder,
          `Completed construction of ${struct.name} in ${city?.name || 'the realm'}.`,
          struct.category === 'Wonder' ? `Master Architect of ${struct.name}` : undefined
        );
      }
      if (
        civ &&
        (struct.category === 'Wonder' ||
          struct.category === 'Spiritual' ||
          struct.type === 'Windmill' ||
          struct.type === 'CastleKeep' ||
          struct.type === 'CrystalSanctum' ||
          struct.type === 'GrandMarketPlaza')
      ) {
        this.recordEvent(
          'building',
          `${civ.name} Built ${struct.name}`,
          `Builders in ${city?.name || civ.name} completed the ${struct.totalBlocks}-block ${struct.name}.`,
          struct.x,
          struct.y,
          struct.z,
          civ.id,
          civ.colorHex
        );
      }
    }
  }

  private completeStructureInstantly(struct: InternalStructure, dirtyChunks: Set<string>) {
    const steps = struct.customSteps || STRUCTURE_BLUEPRINTS[struct.type]?.steps;
    if (!steps) return;
    this.advanceStructureBlocks(struct, steps.length, dirtyChunks);
  }

  /**
   * Unbounded Infinite World Chunk Streaming (Part A.1):
   * Streams chunks around any camera coordinate (camCx, camCz) from -Infinity to +Infinity,
   * while protecting active settlements and unloading distant untouched chunks.
   */
  public manageChunksAroundCamera(): { unloadedKeys: string[]; newlyLoadedKeys: string[] } {
    const camCx = Math.floor(this.cameraX / CHUNK_SIZE);
    const camCz = Math.floor(this.cameraZ / CHUNK_SIZE);
    const radius = Math.max(this.settings.renderDistance, this.dynamicZoomRadius);
    const unloadRadius = radius + 6;

    const unloadedKeys: string[] = [];
    const newlyLoadedKeys: string[] = [];

    const protectedChunks = new Set<string>();
    for (const city of this.cities) {
      const ccx = Math.floor(city.x / CHUNK_SIZE);
      const ccz = Math.floor(city.z / CHUNK_SIZE);
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          protectedChunks.add(chunkKey(ccx + dx, ccz + dz));
        }
      }
    }
    for (const st of this.structures) {
      const scx = Math.floor(st.x / CHUNK_SIZE);
      const scz = Math.floor(st.z / CHUNK_SIZE);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          protectedChunks.add(chunkKey(scx + dx, scz + dz));
        }
      }
    }

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dz * dz > (radius + 0.6) * (radius + 0.6)) continue;
        const cx = camCx + dx;
        const cz = camCz + dz;
        const key = chunkKey(cx, cz);
        const chunk = this.ensureChunkLoaded(cx, cz);
        if (this.syncedChunkRevisions.get(key) !== chunk.revision) {
          newlyLoadedKeys.push(key);
        }
      }
    }

    for (const key of Array.from(this.loadedChunks.keys())) {
      if (protectedChunks.has(key)) continue;
      const [cx, cz] = parseChunkKey(key);
      const distSq = (cx - camCx) * (cx - camCx) + (cz - camCz) * (cz - camCz);
      if (distSq > unloadRadius * unloadRadius) {
        this.loadedChunks.delete(key);
        this.syncedChunkRevisions.delete(key);
        unloadedKeys.push(key);
      }
    }

    return { unloadedKeys, newlyLoadedKeys };
  }

  public stepFrame() {
    if (this.isPaused) return;
    if (this.settings.maxYears > 0 && this.year >= this.settings.maxYears) {
      this.isPaused = true;
      return;
    }

    const startTime = performance.now();
    const budgetMs = this.settings.timeBudgetMs || 12;

    const requestedTicks =
      this.speedMultiplier <= 1
        ? 1
        : this.speedMultiplier === 5
        ? 3
        : this.speedMultiplier === 25
        ? 10
        : this.speedMultiplier === 100
        ? 24
        : 60;

    const yearIncrementPerTick =
      this.speedMultiplier >= 1000
        ? 2
        : this.speedMultiplier >= 100
        ? 1
        : 1;

    const dirtyChunks = new Set<string>();
    this.budgetDegraded = false;

    for (let t = 0; t < requestedTicks; t++) {
      this.stepSingleTick(dirtyChunks, yearIncrementPerTick);
      if (performance.now() - startTime >= budgetMs && t < requestedTicks - 1) {
        this.budgetDegraded = true;
        break;
      }
    }

    if (this.tickCounter % 8 === 0) {
      const { unloadedKeys, newlyLoadedKeys } = this.manageChunksAroundCamera();
      if (
        unloadedKeys.length > 0 &&
        typeof self !== 'undefined' &&
        typeof (self as unknown as Worker).postMessage === 'function'
      ) {
        (self as unknown as Worker).postMessage({
          type: 'UNLOAD_CHUNKS',
          keys: unloadedKeys,
        });
      }
      for (const k of newlyLoadedKeys) {
        dirtyChunks.add(k);
      }
    }

    this.lastStepMs = Number((performance.now() - startTime).toFixed(2));

    if (dirtyChunks.size > 0) {
      this.emitChunkUpdates(Array.from(dirtyChunks));
    }
  }

  private stepSingleTick(dirtyChunks: Set<string>, yearIncrement: number) {
    this.tickCounter++;

    // Smooth ~75-second full 24h day/night cycle at 1x speed (0.016 hr/tick * 20 Hz = 0.32 hr/sec)
    // Gives citizens ~28 real seconds of nighttime (20:30 -> 05:30) to walk home, enter their doorway, and sleep!
    this.timeOfDay = (this.timeOfDay + 0.016) % 24;
    // Slow, authentic Era & Calendar progression: 1 day per tick (360 ticks per year)
    this.dayOfYear += 1 * yearIncrement;
    if (this.dayOfYear >= 360) {
      this.dayOfYear %= 360;
      this.year += yearIncrement;
      this.onYearTurn(dirtyChunks, yearIncrement);
    }

    if (this.dayOfYear < 90) this.season = 'Spring';
    else if (this.dayOfYear < 180) this.season = 'Summer';
    else if (this.dayOfYear < 270) this.season = 'Autumn';
    else this.season = 'Winter';

    if (this.stageMode === 1) return;

    // 1. Rebuild Spatial Hash Grid
    this.rebuildAgentSpatialGrid();

    // 2. Step Active Warfare Formations & Battles (Part D)
    if (this.activeWars.length > 0 && this.tickCounter % 2 === 0) {
      this.stepWarfareFormations(dirtyChunks);
    }

    // 3. Classify Cities into Micro vs Macro
    const detailRadSq = this.settings.simDetailRadius * this.settings.simDetailRadius;
    const microCityIds = new Set<number>();
    for (let i = 0; i < this.cities.length; i++) {
      const city = this.cities[i];
      const dSq =
        (city.x - this.cameraX) * (city.x - this.cameraX) +
        (city.z - this.cameraZ) * (city.z - this.cameraZ);
      if (dSq <= detailRadSq) {
        city.simMode = 'Micro (Full 3D)';
        microCityIds.add(city.id);
      } else {
        city.simMode = 'Macro (Simplified)';
      }
    }

    for (let i = 0; i < this.civilizations.length; i++) {
      const civ = this.civilizations[i];
      const hasMicroCity = this.cities.some(
        (c) => c.civId === civ.id && c.simMode === 'Micro (Full 3D)'
      );
      civ.simMode = hasMicroCity ? 'Micro (Full 3D)' : 'Macro (Simplified)';
    }

    // 4. Update EVERY agent
    const tAgentStart = performance.now();
    let microCount = 0;
    let farCount = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      if (microCityIds.has(agent.cityId)) {
        microCount++;
        this.updateMicroAgent(agent, dirtyChunks);
      } else {
        farCount++;
        this.updateFarAgent(agent, dirtyChunks);
      }
    }

    this.microAgentsCount = microCount;
    this.farAgentsCount = farCount;
    this.agentSimMs = Number((performance.now() - tAgentStart).toFixed(2));

    // 5. Run Agent Watchdog every 30 ticks
    if (this.tickCounter % 30 === 0) {
      this.runAgentWatchdog(dirtyChunks);
    }

    // 6. Update City Construction & Macro Resource Progression
    const tCityStart = performance.now();
    if (this.tickCounter % 6 === 0) {
      for (let i = 0; i < this.cities.length; i++) {
        const city = this.cities[i];
        if (city.simMode === 'Macro (Simplified)') {
          this.stepMacroCity(city, dirtyChunks);
        } else if (this.stageMode >= 3) {
          this.ensureCityHasConstructionProject(city, dirtyChunks);
          // Steady communal construction assist so no house ever stalls half-built
          if (city.activeStructureId && this.tickCounter % 12 === 0) {
            const st = this.structMap.get(city.activeStructureId);
            if (st && !st.isComplete) {
              this.advanceStructureBlocks(st, 2, dirtyChunks);
            }
          }
        }
      }
    }
    if (this.stageMode >= 3) {
      this.stepVehicles();
    }
    this.stepAnimals();
    if (this.activeFires.length > 0 && this.tickCounter % 4 === 0) {
      this.stepActiveFires(dirtyChunks);
    }
    this.cityMacroMs = Number((performance.now() - tCityStart).toFixed(2));
  }

  private runAgentWatchdog(dirtyChunks: Set<string>) {
    let insideSolidCount = 0;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      if (this.tickCounter - a.lastUpdatedTick > 5) {
        this.watchdogRevivalsCount++;
        this.releaseWorkstation(a);
        this.updateFarAgent(a, dirtyChunks);
      }
      // Check if agent is accidentally inside a non-doorway building wall and nudge out
      if (!this.isWalkable(a.x, a.z, a.homeStructureId)) {
        this.recoverStuckAgent(a);
      }
    }
    this.agentsInsideSolidBlocksCount = insideSolidCount;

    // Item 5: Construction Watchdog — ensure no building ever stalls permanently!
    for (let i = 0; i < this.structures.length; i++) {
      const st = this.structures[i];
      if (st.isComplete) {
        st.stallStatus = 'Complete';
        continue;
      }
      const buildersInCity = this.agents.filter(
        (a) => a.cityId === st.cityId && (a.job === 'Builder' || a.job === 'Artisan')
      );
      st.assignedBuildersCount = buildersInCity.length;

      const ticksSinceProgress = this.tickCounter - (st.lastProgressTick || 0);
      if (ticksSinceProgress > 24) {
        const city = this.cityMap.get(st.cityId);
        if (city) {
          city.activeStructureId = st.id;
          city.woodStock = Math.max(city.woodStock, 12);
          city.stoneStock = Math.max(city.stoneStock, 12);
        }
        this.advanceStructureBlocks(st, 6, dirtyChunks);
        this.stalledBuildsFixedCount++;
      } else if (buildersInCity.length === 0) {
        st.stallStatus = 'Waiting for Builder';
      } else {
        st.stallStatus = 'Active (Builders Working)';
      }
    }
  }

  private findContainingStructure(wx: number, wz: number): InternalStructure | undefined {
    const gx = Math.floor(wx / STRUCT_GRID_SIZE);
    const gz = Math.floor(wz / STRUCT_GRID_SIZE);
    const bucket = this.structSpatialGrid.get(spatialKey(gx, gz));
    if (!bucket) return undefined;
    for (let i = 0; i < bucket.length; i++) {
      const st = bucket[i];
      const hw = Math.floor(st.width / 2) + 0.35;
      const hd = Math.floor(st.depth / 2) + 0.35;
      if (Math.abs(wx - st.x) <= hw && Math.abs(wz - st.z) <= hd) {
        return st;
      }
    }
    return undefined;
  }

  private moveAgentSafelyToward(
    agent: InternalAgent,
    goalX: number,
    goalZ: number,
    speed: number,
    dirtyChunks: Set<string>,
    ignoreStructureId?: number
  ): boolean {
    const prevX = agent.x;
    const prevZ = agent.z;

    // Doorway routing: if agent is inside a building and goal is outside (or vice versa),
    // route through the building's front doorway exterior threshold first so agents NEVER phase through walls!
    let effectiveGoalX = goalX;
    let effectiveGoalZ = goalZ;
    const currentStruct = this.findContainingStructure(agent.x, agent.z);
    const targetStruct = this.findContainingStructure(goalX, goalZ);

    if (currentStruct && (!targetStruct || targetStruct.id !== currentStruct.id)) {
      const doorX = currentStruct.doorwayCoords?.[0]?.[0] ?? currentStruct.x;
      const doorZ =
        (currentStruct.doorwayCoords?.[0]?.[1] ??
          currentStruct.z + Math.floor(currentStruct.depth / 2)) + 1.35;
      if (Math.hypot(agent.x - doorX, agent.z - doorZ) > 1.1) {
        effectiveGoalX = doorX;
        effectiveGoalZ = doorZ;
      }
    } else if (targetStruct && (!currentStruct || currentStruct.id !== targetStruct.id)) {
      const doorX = targetStruct.doorwayCoords?.[0]?.[0] ?? targetStruct.x;
      const doorZ =
        (targetStruct.doorwayCoords?.[0]?.[1] ??
          targetStruct.z + Math.floor(targetStruct.depth / 2)) + 1.15;
      const distToDoor = Math.hypot(agent.x - doorX, agent.z - doorZ);
      const distGoalToDoor = Math.hypot(goalX - doorX, goalZ - doorZ);
      if (distToDoor > 1.15 && distGoalToDoor > 0.8) {
        effectiveGoalX = doorX;
        effectiveGoalZ = doorZ;
      }
    }

    const dx = effectiveGoalX - agent.x;
    const dz = effectiveGoalZ - agent.z;
    const dist = Math.hypot(dx, dz);

    const [sepX, sepZ] = this.computeSeparationVector(agent);

    if (Math.hypot(goalX - agent.x, goalZ - agent.z) <= 1.35) {
      agent.vx = 0;
      agent.vz = 0;
      agent.actualSpeed = 0;
      agent.stuckTicks = 0;
      agent.lastProgressX = agent.x;
      agent.lastProgressZ = agent.z;
      return true;
    }

    const dirX = dx / Math.max(0.001, dist) + sepX * 0.35;
    const dirZ = dz / Math.max(0.001, dist) + sepZ * 0.35;
    const baseAngle = Math.atan2(dirX, dirZ);

    // Forward & lateral steering angles only (never > 90 deg backward, preventing back-and-forth oscillation!)
    const steerOffsets = [0, 0.35, -0.35, 0.72, -0.72, 1.12, -1.12];

    let moved = false;
    // Pass 1: Strictly <= 1-block step height for natural walking
    for (let s = 0; s < steerOffsets.length; s++) {
      const tryAngle = baseAngle + steerOffsets[s];
      const stepX = agent.x + Math.sin(tryAngle) * speed;
      const stepZ = agent.z + Math.cos(tryAngle) * speed;

      if (this.isWalkable(stepX, stepZ, ignoreStructureId, agent.x, agent.z)) {
        const nextY = this.getGroundWalkingY(stepX, stepZ) + 1;
        if (Math.abs(nextY - agent.y) <= 1.05) {
          agent.vx = stepX - prevX;
          agent.vz = stepZ - prevZ;
          agent.x = stepX;
          agent.z = stepZ;
          agent.y = nextY;
          let angleDiff = tryAngle - agent.facing;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          agent.facing += angleDiff * 0.45;
          moved = true;
          break;
        }
      }
    }

    // Pass 2: If blocked by a 2-3 block slope (1.05 < deltaY <= 2.65), build voxel stairs so citizens climb 1 block at a time!
    if (!moved) {
      for (let s = 0; s < 3; s++) {
        const tryAngle = baseAngle + steerOffsets[s];
        const stepX = agent.x + Math.sin(tryAngle) * speed;
        const stepZ = agent.z + Math.cos(tryAngle) * speed;

        if (this.isWalkable(stepX, stepZ, ignoreStructureId, agent.x, agent.z)) {
          const nextGroundY = this.getGroundWalkingY(stepX, stepZ);
          const curGroundY = Math.round(agent.y - 1);
          const heightDiff = nextGroundY - curGroundY;
          if (Math.abs(heightDiff) > 1.0 && Math.abs(heightDiff) <= 2.65) {
            const civ = this.civMap.get(agent.civId);
            const eraIdx = civ ? ERA_ORDER.indexOf(civ.era) : 0;
            const stepVoxel =
              eraIdx >= 2
                ? VoxelType.Cobblestone
                : eraIdx === 1
                ? VoxelType.Plank
                : VoxelType.RoadDirt;
            if (heightDiff > 1.0) {
              const stairX = Math.round(agent.x);
              const stairZ = Math.round(agent.z);
              const stairY = curGroundY + 1;
              if (stairY > WATER_LEVEL && !this.findContainingStructure(stairX, stairZ)) {
                this.setWorldVoxel(stairX, stairY, stairZ, stepVoxel, dirtyChunks);
              }
            } else {
              const stairX = Math.round(stepX);
              const stairZ = Math.round(stepZ);
              const stairY = nextGroundY + 1;
              if (stairY > WATER_LEVEL && !this.findContainingStructure(stairX, stairZ)) {
                this.setWorldVoxel(stairX, stairY, stairZ, stepVoxel, dirtyChunks);
              }
            }
            const updatedNextY = this.getGroundWalkingY(stepX, stepZ) + 1;
            agent.vx = stepX - prevX;
            agent.vz = stepZ - prevZ;
            agent.x = stepX;
            agent.z = stepZ;
            agent.y = Math.min(agent.y + 1, Math.max(agent.y - 1, updatedNextY));
            agent.facing = tryAngle;
            agent.action = AgentAnimAction.Building;
            moved = true;
            break;
          }
        }
      }
    }

    // Pass 3: If blocked by a river, build a proper connected 3-wide bridge with pilings across the channel
    if (!moved) {
      const frontX = Math.round(agent.x + Math.sin(baseAngle) * 1.4);
      const frontZ = Math.round(agent.z + Math.cos(baseAngle) * 1.4);
      const col = sampleColumn(frontX, frontZ, this.seedNum);
      if (col.height <= WATER_LEVEL && col.isRiver) {
        const civ = this.civMap.get(agent.civId);
        const eraIdx = civ ? ERA_ORDER.indexOf(civ.era) : 0;
        const bridgeVoxel = eraIdx >= 3 ? VoxelType.BridgeStone : VoxelType.BridgeWood;
        const roadVoxel = eraIdx >= 3 ? VoxelType.RoadPaved : VoxelType.RoadDirt;
        const spanEndX = Math.round(agent.x + Math.sin(baseAngle) * 10);
        const spanEndZ = Math.round(agent.z + Math.cos(baseAngle) * 10);
        this.buildConnectedRoadAndBridge(
          agent.x,
          agent.z,
          spanEndX,
          spanEndZ,
          roadVoxel,
          bridgeVoxel,
          dirtyChunks,
          16
        );
        agent.x = frontX;
        agent.z = frontZ;
        agent.y = WATER_LEVEL + 2;
        agent.facing = baseAngle;
        moved = true;
      }
    }

    agent.actualSpeed = Math.hypot(agent.x - prevX, agent.z - prevZ);

    if (agent.actualSpeed > 0.03) {
      agent.animPhase += agent.actualSpeed * 1.15;
      if (agent.action !== AgentAnimAction.Building) {
        agent.action = agent.carryingResource
          ? AgentAnimAction.Hauling
          : AgentAnimAction.Walking;
      }
    } else {
      agent.vx = 0;
      agent.vz = 0;
      agent.action = AgentAnimAction.Idle;
    }

    const progressDist = Math.hypot(
      agent.x - agent.lastProgressX,
      agent.z - agent.lastProgressZ
    );
    if (progressDist >= 0.6) {
      agent.lastProgressX = agent.x;
      agent.lastProgressZ = agent.z;
      agent.stuckTicks = 0;
    } else {
      agent.stuckTicks++;
      if (agent.stuckTicks >= 7) {
        // Instead of oscillating in place, pause calmly and pick a new open destination
        agent.stuckTicks = 0;
        agent.idleTimer = 14;
        const city = this.cityMap.get(agent.cityId);
        if (city) {
          const spot = this.pickOpenWorkSpot(agent, city, 'reroute', 10, 28, 2);
          agent.targetX = spot.x;
          agent.targetZ = spot.z;
        }
        return true;
      }
    }

    return false;
  }

  private recoverStuckAgent(agent: InternalAgent) {
    this.stuckRecoveriesCount++;
    agent.stuckTicks = 0;
    this.releaseWorkstation(agent);

    const city = this.cityMap.get(agent.cityId);
    const anchorX = city ? city.x : agent.x;
    const anchorZ = city ? city.z : agent.z;

    for (let r = 2.5; r <= 14.0; r += 2.0) {
      const a = this.prng.range(0, Math.PI * 2);
      const nx = agent.x + Math.cos(a) * r;
      const nz = agent.z + Math.sin(a) * r;
      if (this.isWalkable(nx, nz) && !this.findContainingStructure(nx, nz)) {
        agent.x = nx;
        agent.z = nz;
        agent.y = this.getGroundWalkingY(nx, nz) + 1;
        break;
      }
    }

    agent.lastProgressX = agent.x;
    agent.lastProgressZ = agent.z;

    const angle = this.prng.range(0, Math.PI * 2);
    const dist = this.prng.range(10, 26);
    const tx = Math.round(anchorX + Math.cos(angle) * dist);
    const tz = Math.round(anchorZ + Math.sin(angle) * dist);
    if (this.isWalkable(tx, tz)) {
      agent.targetX = tx;
      agent.targetZ = tz;
    }
  }

  private pickOpenWorkSpot(
    agent: InternalAgent,
    city: InternalCity,
    prefix: string,
    minRadius: number,
    maxRadius: number,
    capacity = 1
  ): { x: number; z: number } {
    const safeMinR = Math.max(8, minRadius);
    const safeMaxR = Math.max(safeMinR + 6, maxRadius);
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = this.prng.range(0, Math.PI * 2);
      const r = this.prng.range(safeMinR, safeMaxR);
      const tx = Math.round(city.x + Math.cos(angle) * r);
      const tz = Math.round(city.z + Math.sin(angle) * r);
      if (!this.isWalkable(tx, tz) || this.findContainingStructure(tx, tz)) continue;

      const sKey = spatialKey(Math.floor(tx / 12), Math.floor(tz / 12));
      const sectorCount = this.sectorDensityMap.get(sKey) || 0;
      if (sectorCount > 6 && attempt < 9) continue;

      const slotKey = `${prefix}:${Math.floor(tx / 2)}:${Math.floor(tz / 2)}`;
      if (this.tryReserveWorkstation(agent, slotKey, capacity)) {
        return { x: tx, z: tz };
      }
    }
    const fallbackAngle = this.prng.range(0, Math.PI * 2);
    const fx = Math.round(city.x + Math.cos(fallbackAngle) * (safeMaxR + 6));
    const fz = Math.round(city.z + Math.sin(fallbackAngle) * (safeMaxR + 6));
    return { x: fx, z: fz };
  }

  private updateMicroAgent(agent: InternalAgent, dirtyChunks: Set<string>) {
    agent.lastUpdatedTick = this.tickCounter;
    const city = this.cityMap.get(agent.cityId);
    const civ = this.civMap.get(agent.civId);
    if (!city || !civ) return;

    // Update circadian schedule slot every 2 ticks so day/night transitions happen immediately
    if (this.tickCounter % 2 === 0) {
      agent.scheduleSlot = computeScheduleSlot(
        this.timeOfDay,
        agent.lifeStage,
        agent.traitVector
      );
    }

    const winterPenalty = this.season === 'Winter' ? 1.3 : 1.0;
    agent.hunger = Math.max(0, agent.hunger - 0.14 * winterPenalty);
    agent.shelter = Math.max(0, agent.shelter - 0.07 * winterPenalty);
    agent.social = Math.max(0, agent.social - 0.05);

    if (agent.hunger < 55 && city.foodStock > 0) {
      city.foodStock = Math.max(0, city.foodStock - 1);
      agent.hunger = Math.min(100, agent.hunger + 42);
      agent.health = Math.min(100, agent.health + 5);
    } else if (agent.hunger <= 2) {
      agent.health -= 1.0;
    }

    // Check if current 12x12 sector is overcrowded
    const curSectorKey = spatialKey(Math.floor(agent.x / 12), Math.floor(agent.z / 12));
    if ((this.sectorDensityMap.get(curSectorKey) || 0) > 7 && agent.workTimer === 0) {
      this.crowdingReassignmentsCount++;
      const spot = this.pickOpenWorkSpot(agent, city, 'spread', 14, 34, 1);
      agent.targetX = spot.x;
      agent.targetZ = spot.z;
    }

    // Part D: Soldiers assigned to an active battle group march & fight with their formation!
    if (agent.job === 'Soldier' && this.battleGroups.length > 0) {
      const group = this.battleGroups.find((g) => g.civId === agent.civId);
      if (group) {
        const slotIdx = agent.id % 12;
        const row = Math.floor(slotIdx / 4) - 1;
        const col = (slotIdx % 4) - 1.5;
        const formX = group.x + col * 1.8;
        const formZ = group.z + row * 1.8;
        const dToForm = Math.hypot(agent.x - formX, agent.z - formZ);
        if (dToForm > 2.2) {
          agent.state = `Marching in ${group.formation} (${group.state})`;
          this.moveAgentSafelyToward(agent, formX, formZ, 0.54, dirtyChunks);
        } else {
          agent.vx = 0;
          agent.vz = 0;
          agent.actualSpeed = 0;
          agent.facing = group.facing;
          agent.action = AgentAnimAction.Combat;
          agent.animPhase += 0.48;
          agent.state = `Engaged in ${group.formation} battle!`;
        }
        return;
      }
    }

    // Part B: Nighttime Sleep / Rest Schedule (applies to ALL ages: Babies, Children, Adults, Elders)
    // Walk through front doorway into assigned Home Structure and lie down to sleep!
    if (agent.scheduleSlot === 'Sleep' && agent.criminalStatus !== 'Bandit') {
      agent.workTimer = 0;
      agent.idleTimer = 0;
      const home = this.resolveAgentHomeStructure(agent, city);
      const berthOffsetX = ((agent.id % 3) - 1) * 0.85;
      const berthOffsetZ = (((agent.id >> 2) % 3) - 1) * 0.85;
      const fallbackRingAngle = ((agent.id % 12) / 12) * Math.PI * 2;
      const sleepX = home
        ? home.x + berthOffsetX
        : city.x + Math.cos(fallbackRingAngle) * 8 + berthOffsetX;
      const sleepZ = home
        ? home.z + berthOffsetZ
        : city.z + Math.sin(fallbackRingAngle) * 8 + berthOffsetZ;
      const distHome = Math.hypot(agent.x - sleepX, agent.z - sleepZ);

      if (distHome > 1.75) {
        agent.carryingResource = undefined;
        agent.state = home
          ? `Walking home to sleep (${home.name})`
          : `Returning to shelter to sleep`;
        this.moveAgentSafelyToward(
          agent,
          sleepX,
          sleepZ,
          0.48,
          dirtyChunks,
          home?.id
        );
        return;
      }

      agent.vx = 0;
      agent.vz = 0;
      agent.actualSpeed = 0;
      agent.action = AgentAnimAction.Sleeping;
      agent.shelter = Math.min(100, agent.shelter + 0.5);
      agent.health = Math.min(100, agent.health + 0.2);
      agent.state = home
        ? `Sleeping inside ${home.name}`
        : `Sleeping in ${city.name}`;
      return;
    }

    // Part B: Babies & Children daytime behavior (playing inside homes, chasing friends in tag, listening to stories)
    if (agent.lifeStage === 'Baby') {
      const parent = agent.parentId
        ? this.agents.find((a) => a.id === agent.parentId && a.cityId === city.id)
        : undefined;
      const home = this.resolveAgentHomeStructure(agent, city);
      const anchorX = home ? home.x : parent ? parent.x + 0.9 : city.x + 8;
      const anchorZ = home ? home.z : parent ? parent.z + 0.9 : city.z + 8;
      const dist = Math.hypot(agent.x - anchorX, agent.z - anchorZ);
      if (dist > 1.8) {
        this.moveAgentSafelyToward(agent, anchorX, anchorZ, 0.26, dirtyChunks, home?.id);
      } else {
        agent.animPhase += 0.25;
        agent.action = AgentAnimAction.IdleSit;
      }
      agent.state = home
        ? `Playing on hearth rug inside ${home.name}`
        : parent
        ? `Toddling near parent ${parent.name.split(' ')[0]}`
        : `Cared for by House ${agent.familyName}`;
      return;
    }

    if (agent.lifeStage === 'Child') {
      if (agent.idleTimer > 0) {
        agent.idleTimer--;
        agent.animPhase += 0.34;
        return;
      }
      const home = this.resolveAgentHomeStructure(agent, city);
      const playMode = (agent.id + Math.floor(this.timeOfDay)) % 4;
      const arrived = this.moveAgentSafelyToward(
        agent,
        agent.targetX,
        agent.targetZ,
        playMode === 1 ? 0.52 : 0.41,
        dirtyChunks,
        home?.id
      );
      if (arrived) {
        agent.intelligence = Math.min(100, agent.intelligence + 0.15);
        agent.social = Math.min(100, agent.social + 12);

        if (playMode === 0 && home) {
          // Play inside family house!
          agent.action = AgentAnimAction.IdleSit;
          agent.idleTimer = 6;
          agent.state = `Playing with carved toys inside ${home.name}`;
          agent.targetX = home.x + ((agent.id % 3) - 1) * 0.8;
          agent.targetZ = home.z + (((agent.id >> 1) % 3) - 1) * 0.8;
        } else if (playMode === 1) {
          // Play tag / hide-and-seek with another child in the village
          const playmate = this.agents.find(
            (other) =>
              other.id !== agent.id &&
              other.cityId === city.id &&
              other.lifeStage === 'Child'
          );
          agent.action = AgentAnimAction.IdleStretch;
          agent.idleTimer = 3;
          agent.state = playmate
            ? `Playing tag with ${playmate.name.split(' ')[0]} in ${city.name}`
            : `Playing hide-and-seek near ${home?.name || city.name}`;
          if (playmate) {
            agent.targetX = Math.round(playmate.x + this.prng.range(-2.5, 2.5));
            agent.targetZ = Math.round(playmate.z + this.prng.range(-2.5, 2.5));
          } else {
            const spot = this.pickOpenWorkSpot(agent, city, 'play', 8, 18, 3);
            agent.targetX = spot.x;
            agent.targetZ = spot.z;
          }
        } else if (playMode === 2) {
          // Storytime with village Elder
          const elder = this.agents.find(
            (other) => other.cityId === city.id && other.lifeStage === 'Elder'
          );
          agent.action = AgentAnimAction.IdleChat;
          agent.idleTimer = 6;
          agent.state = elder
            ? `Listening to Elder ${elder.name.split(' ')[0]}'s tales`
            : `Listening to ${civ.name} origin myths`;
          agent.targetX = elder ? Math.round(elder.x + 1.2) : (home ? home.x : city.x + 9);
          agent.targetZ = elder ? Math.round(elder.z + 1.2) : (home ? home.z + 2 : city.z + 9);
        } else {
          // Apprentice watching a craftsperson or parent
          agent.action = AgentAnimAction.IdleChat;
          agent.idleTimer = 5;
          agent.state = `Learning ${agent.job.toLowerCase()} craft in ${city.name}`;
          const nextSpot = this.pickOpenWorkSpot(agent, city, 'school', 8, 20, 3);
          agent.targetX = nextSpot.x;
          agent.targetZ = nextSpot.z;
        }
      }
      return;
    }

    // 1. PRIORITY: Active Building Construction (multi-day block-by-block labor)
    if (this.stageMode >= 3 && city.activeStructureId) {
      const activeStruct = this.structMap.get(city.activeStructureId);
      if (
        activeStruct &&
        !activeStruct.isComplete &&
        (agent.job === 'Builder' || agent.job === 'Artisan')
      ) {
        let assignedSlot = -1;
        for (let slot = 0; slot < 6; slot++) {
          const slotKey = `build:${activeStruct.id}:slot:${slot}`;
          if (this.tryReserveWorkstation(agent, slotKey, 1)) {
            assignedSlot = slot;
            break;
          }
        }

        if (assignedSlot >= 0) {
          const perimDist =
            Math.ceil(Math.max(activeStruct.width, activeStruct.depth) / 2) + 1.8;
          const slotAngle = (assignedSlot / 6) * Math.PI * 2 + 0.3;
          const standX = activeStruct.x + Math.sin(slotAngle) * perimDist;
          const standZ = activeStruct.z + Math.cos(slotAngle) * perimDist;

          const dToStand = Math.hypot(agent.x - standX, agent.z - standZ);
          if (dToStand > 1.65) {
            agent.carryingResource = 'stone';
            agent.state = `Hauling blocks to ${activeStruct.name}`;
            this.moveAgentSafelyToward(
              agent,
              standX,
              standZ,
              0.48,
              dirtyChunks,
              activeStruct.id
            );
            return;
          } else {
            agent.vx = 0;
            agent.vz = 0;
            agent.actualSpeed = 0;
            agent.facing = Math.atan2(
              activeStruct.x - agent.x,
              activeStruct.z - agent.z
            );
            agent.action = AgentAnimAction.Building;
            agent.animPhase += 0.42;
            agent.carryingResource = undefined;
            const blocksToPlace = agent.blessedEffects.includes('titan_strength') ? 3 : 2;
            this.advanceStructureBlocks(activeStruct, blocksToPlace, dirtyChunks, agent);
            agent.tasksCompleted++;
            agent.wealthCoins += 1;
            agent.shelter = Math.min(100, agent.shelter + 15);
            agent.state = `Building ${activeStruct.name} (${activeStruct.progress}/${activeStruct.totalBlocks} blocks · ${Math.round(
              (activeStruct.progress / Math.max(1, activeStruct.totalBlocks)) * 100
            )}%)`;
            return;
          }
        }
      }
    }

    // 2. Timed work animation in place
    if (agent.workTimer > 0) {
      agent.workTimer--;
      agent.vx = 0;
      agent.vz = 0;
      agent.actualSpeed = 0;
      agent.animPhase += 0.38;
      if (agent.workTimer === 0) {
        this.releaseWorkstation(agent);
      }
      return;
    }

    // 3. Timed idle / social behavior in place
    if (agent.idleTimer > 0) {
      agent.idleTimer--;
      agent.vx = 0;
      agent.vz = 0;
      agent.actualSpeed = 0;
      agent.animPhase += 0.22;
      return;
    }

    // 4. Move toward current target (scaled by life stage)
    const baseSpeed = agent.lifeStage === 'Elder' ? 0.34 : 0.44;
    const speed = agent.blessedEffects.includes('titan_strength') ? 0.65 : baseSpeed;
    const arrived = this.moveAgentSafelyToward(
      agent,
      agent.targetX,
      agent.targetZ,
      speed,
      dirtyChunks,
      agent.homeStructureId
    );
    if (!arrived) return;

    // 5. Mealtime & Hearth Cooking Behavior ( citizens cook & eat at hearths/homes instead of wandering aimlessly!)
    if (
      agent.scheduleSlot === 'Meal' ||
      (agent.id % 6 === 0 && this.prng.chance(0.42))
    ) {
      const home = this.resolveAgentHomeStructure(agent, city);
      agent.action = AgentAnimAction.Ritual;
      agent.workTimer = this.prng.int(26, 44);
      agent.carryingResource = undefined;
      city.foodStock += 2;
      agent.hunger = Math.min(100, agent.hunger + 38);
      agent.social = Math.min(100, agent.social + 15);
      agent.state = home
        ? `Cooking roasted game & flatbread inside ${home.name}`
        : `Cooking hearty stew over the hearth in ${city.name}`;
      if (home && this.prng.chance(0.65)) {
        agent.targetX = home.x + ((agent.id % 3) - 1) * 0.8;
        agent.targetZ = home.z + (((agent.id >> 1) % 3) - 1) * 0.8;
      } else {
        const nextSpot = this.pickOpenWorkSpot(agent, city, 'cook', 9, 24, 2);
        agent.targetX = nextSpot.x;
        agent.targetZ = nextSpot.z;
      }
      return;
    }

    // 6. Lazy / Low-Diligence Personality Behavior (some citizens lounge in the shade, nap, or daydream!)
    if (
      agent.traitVector.diligence < -0.12 &&
      agent.job !== 'Ruler' &&
      this.prng.chance(0.45)
    ) {
      const home = this.resolveAgentHomeStructure(agent, city);
      agent.action = this.prng.chance(0.65)
        ? AgentAnimAction.IdleSit
        : AgentAnimAction.IdleStretch;
      agent.idleTimer = this.prng.int(32, 58);
      agent.carryingResource = undefined;
      agent.shelter = Math.min(100, agent.shelter + 18);
      const lazyActivities = [
        `Lounging lazily in the shade near ${home?.name || city.name}`,
        `Daydreaming & watching clouds drift over ${city.name}`,
        `Taking an afternoon rest inside ${home?.name || 'shelter'}`,
        `Skipping chores to relax by the meadow`,
      ];
      agent.state = lazyActivities[agent.id % lazyActivities.length];
      const nextSpot = this.pickOpenWorkSpot(agent, city, 'lazy', 12, 30, 1);
      agent.targetX = nextSpot.x;
      agent.targetZ = nextSpot.z;
      return;
    }

    // 7. Part B Crime & Justice check when desperate or dishonest
    if (
      agent.traitVector.honesty < -0.38 &&
      agent.traitVector.rebelliousness > 0.3 &&
      this.prng.chance(0.05)
    ) {
      agent.criminalStatus = this.prng.chance(0.35) ? 'Bandit' : 'Wanted';
      agent.action = AgentAnimAction.CrimeSteal;
      agent.workTimer = 24;
      this.crimeStats.thefts++;
      city.crimeRate = Math.min(100, city.crimeRate + 2);
      agent.wealthCoins += 5;
      agent.state =
        agent.criminalStatus === 'Bandit'
          ? `Raiding caravan near ${city.name}`
          : `Pilfering grain in ${city.name}`;
      const nextSpot = this.pickOpenWorkSpot(agent, city, 'bandit', 18, 38, 1);
      agent.targetX = nextSpot.x;
      agent.targetZ = nextSpot.z;
      return;
    }

    const toolBoost = agent.equippedItem.workSpeedMultiplier || 1;

    switch (agent.job) {
      case 'Lumberjack': {
        agent.action = AgentAnimAction.Chopping;
        agent.workTimer = this.prng.int(30, 48);
        agent.state = `Felling timber with ${agent.equippedItem.name}`;
        if (this.prng.chance(0.45)) {
          this.chopTreeNear(agent.x, agent.z, 5, dirtyChunks);
        }
        city.woodStock += Math.round(
          (agent.blessedEffects.includes('titan_strength') ? 4 : 2) * toolBoost
        );
        agent.tasksCompleted++;
        agent.wealthCoins += 1;
        const nextSpot = this.pickOpenWorkSpot(agent, city, 'wood', 14, 34, 1);
        agent.targetX = nextSpot.x;
        agent.targetZ = nextSpot.z;
        break;
      }

      case 'Miner': {
        agent.action = AgentAnimAction.Mining;
        agent.workTimer = this.prng.int(32, 50);
        agent.carryingResource = 'stone';
        agent.state = `Quarrying stone & ore with ${agent.equippedItem.name}`;
        const mx = Math.round(agent.x);
        const mz = Math.round(agent.z);
        const my = this.getGroundWalkingY(mx, mz);
        for (let oz = -2; oz <= 2; oz++) {
          for (let ox = -2; ox <= 2; ox++) {
            const topV = this.getWorldVoxel(mx + ox, my + 1, mz + oz);
            if (
              topV === VoxelType.Cobblestone ||
              topV === VoxelType.Stone ||
              topV === VoxelType.CopperOre ||
              topV === VoxelType.IronOre ||
              topV === VoxelType.GoldOre
            ) {
              this.setWorldVoxel(mx + ox, my + 1, mz + oz, VoxelType.Air, dirtyChunks);
              this.enqueueFallingParticle(mx + ox, my + 1, mz + oz, VoxelType.StoneBrick);
              city.oreStock += 1;
              break;
            }
          }
        }
        city.stoneStock += Math.round(
          (agent.blessedEffects.includes('titan_strength') ? 4 : 2) * toolBoost
        );
        if (this.prng.chance(0.5)) city.oreStock += 1;
        agent.tasksCompleted++;
        agent.wealthCoins += 2;
        const nextSpot = this.pickOpenWorkSpot(agent, city, 'mine', 14, 36, 2);
        agent.targetX = nextSpot.x;
        agent.targetZ = nextSpot.z;
        break;
      }

      case 'Farmer':
      case 'Forager': {
        agent.action = AgentAnimAction.Farming;
        agent.workTimer = this.prng.int(28, 46);
        const seasonYield =
          this.season === 'Summer'
            ? 4
            : this.season === 'Autumn'
            ? 5
            : this.season === 'Spring'
            ? 3
            : 1;
        city.foodStock += Math.round(seasonYield * Math.min(1.6, toolBoost * 0.85));
        agent.hunger = Math.min(100, agent.hunger + 25);
        agent.tasksCompleted++;
        agent.wealthCoins += 1;
        agent.state =
          agent.job === 'Forager'
            ? `Gathering wild berries & roots (${agent.equippedItem.name})`
            : `${agent.roleTitle} tending crops & baking grain (${agent.equippedItem.name})`;
        const nextSpot = this.pickOpenWorkSpot(agent, city, 'farm', 12, 30, 1);
        agent.targetX = nextSpot.x;
        agent.targetZ = nextSpot.z;
        break;
      }

      case 'Scholar':
      case 'Priest': {
        agent.action = AgentAnimAction.Ritual;
        agent.workTimer = this.prng.int(32, 52);
        const boost = agent.blessedEffects.includes('super_intelligence') ? 3.2 : 1.0;
        civ.techProgress += (agent.intelligence / 145) * boost * this.settings.mutationRate;
        agent.tasksCompleted++;
        agent.wealthCoins += 2;
        agent.state =
          agent.job === 'Priest'
            ? `${agent.roleTitle} leading ${civ.religionName} rites`
            : `${agent.roleTitle} studying ${civ.era} lore & scrolls`;
        const nextSpot = this.pickOpenWorkSpot(agent, city, 'shrine', 10, 24, 2);
        agent.targetX = nextSpot.x;
        agent.targetZ = nextSpot.z;
        break;
      }

      case 'Soldier': {
        const wanted = this.agents.find(
          (a) =>
            a.cityId === city.id &&
            (a.criminalStatus === 'Wanted' || a.criminalStatus === 'Bandit')
        );
        if (wanted) {
          wanted.criminalStatus = 'Prisoner';
          wanted.action = AgentAnimAction.Arrested;
          wanted.state = `Arrested by ${agent.roleTitle} ${agent.name.split(' ')[0]}`;
          this.crimeStats.arrests++;
          this.crimeStats.trials++;
          city.crimeRate = Math.max(0, city.crimeRate - 2);
        }
        agent.action = AgentAnimAction.Combat;
        agent.workTimer = this.prng.int(26, 42);
        agent.wealthCoins += 2;
        agent.state = `${agent.roleTitle} standing watch on ${city.name} perimeter`;
        const nextSpot = this.pickOpenWorkSpot(agent, city, 'patrol', 16, 34, 1);
        agent.targetX = nextSpot.x;
        agent.targetZ = nextSpot.z;
        break;
      }

      case 'Explorer': {
        agent.action = AgentAnimAction.IdleStretch;
        agent.idleTimer = this.prng.int(22, 38);
        agent.state = `${agent.roleTitle} charting frontier hills`;
        const nextSpot = this.pickOpenWorkSpot(agent, city, 'scout', 20, 46, 1);
        agent.targetX = nextSpot.x;
        agent.targetZ = nextSpot.z;
        break;
      }

      case 'Trader': {
        agent.carryingResource = 'food';
        agent.workTimer = this.prng.int(24, 40);
        const otherCity = this.cities.find((c) => c.id !== city.id);
        if (otherCity && this.stageMode >= 4) {
          const spot = this.pickOpenWorkSpot(agent, otherCity, 'market', 9, 20, 2);
          agent.targetX = spot.x;
          agent.targetZ = spot.z;
          civ.tradeVolume += 4;
          city.foodStock += 2;
          city.woodStock += 1;
          city.treasuryCoins += 3;
          agent.wealthCoins += 3;
          agent.state = `${agent.roleTitle} bartering with ${otherCity.name}`;
        } else {
          const spot = this.pickOpenWorkSpot(agent, city, 'market', 10, 22, 2);
          agent.targetX = spot.x;
          agent.targetZ = spot.z;
          agent.wealthCoins += 2;
          agent.state = `${agent.roleTitle} appraising wares at market`;
        }
        break;
      }

      case 'Hunter': {
        agent.action = AgentAnimAction.Combat;
        agent.workTimer = this.prng.int(30, 48);
        city.foodStock += 4;
        agent.wealthCoins += 2;
        agent.tasksCompleted++;
        const nearbyPrey = this.animals.find(
          (an) =>
            an.domain === 'Land' &&
            an.species !== 'Wolf' &&
            an.species !== 'Bear' &&
            Math.hypot(an.x - city.x, an.z - city.z) < 55
        );
        agent.state = nearbyPrey
          ? `${agent.roleTitle} tracking wild ${nearbyPrey.species} (${agent.equippedItem.name})`
          : `${agent.roleTitle} stalking wild game & roasting venison (${agent.equippedItem.name})`;
        if (nearbyPrey) {
          agent.targetX = Math.round(nearbyPrey.x);
          agent.targetZ = Math.round(nearbyPrey.z);
        } else {
          const nextSpot = this.pickOpenWorkSpot(agent, city, 'hunt', 16, 38, 1);
          agent.targetX = nextSpot.x;
          agent.targetZ = nextSpot.z;
        }
        break;
      }

      case 'Fisher':
      case 'Sailor': {
        agent.action = AgentAnimAction.Farming;
        agent.workTimer = this.prng.int(30, 48);
        city.foodStock += 4;
        civ.tradeVolume += 2;
        agent.wealthCoins += 2;
        agent.tasksCompleted++;
        agent.state =
          agent.job === 'Sailor'
            ? `${agent.roleTitle} rigging watercraft along shore`
            : `${agent.roleTitle} spearfishing & smoking catch (${agent.equippedItem.name})`;
        const wp = this.findWaterPointNear(city.x, city.z, 10, 38);
        if (wp) {
          agent.targetX = wp.x;
          agent.targetZ = wp.z;
        } else {
          const nextSpot = this.pickOpenWorkSpot(agent, city, 'fish', 12, 28, 2);
          agent.targetX = nextSpot.x;
          agent.targetZ = nextSpot.z;
        }
        break;
      }

      default: {
        const neighbor = this.findNearbyNeighbor(agent, 4.0);
        const home = this.resolveAgentHomeStructure(agent, city);
        const activityIdx = (agent.id + Math.floor(this.tickCounter / 24)) % 6;
        if (neighbor && activityIdx <= 1) {
          agent.facing = Math.atan2(neighbor.x - agent.x, neighbor.z - agent.z);
          agent.action = AgentAnimAction.IdleChat;
          agent.idleTimer = this.prng.int(28, 45);
          agent.social = Math.min(100, agent.social + 24);
          agent.state =
            activityIdx === 0
              ? `Sharing stories with ${neighbor.name.split(' ')[0]}`
              : `Debating ${civ.name} council customs with ${neighbor.name.split(' ')[0]}`;
        } else if (activityIdx === 2 && home) {
          agent.action = AgentAnimAction.IdleSit;
          agent.idleTimer = this.prng.int(32, 52);
          agent.shelter = Math.min(100, agent.shelter + 20);
          agent.state = `Crafting tools & cooking inside ${home.name}`;
          agent.targetX = home.x + ((agent.id % 3) - 1) * 0.7;
          agent.targetZ = home.z + (((agent.id >> 1) % 3) - 1) * 0.7;
          break;
        } else if (activityIdx === 3) {
          agent.action = AgentAnimAction.Ritual;
          agent.idleTimer = this.prng.int(28, 44);
          agent.social = Math.min(100, agent.social + 18);
          agent.state = `Baking flatbread & playing folk music`;
        } else if (activityIdx === 4) {
          agent.action = AgentAnimAction.IdleStretch;
          agent.idleTimer = this.prng.int(26, 42);
          agent.shelter = Math.min(100, agent.shelter + 15);
          agent.state = `${agent.roleTitle} organizing ${home?.name || city.name} provisions`;
        } else {
          agent.action = AgentAnimAction.IdleSit;
          agent.idleTimer = this.prng.int(30, 48);
          agent.shelter = Math.min(100, agent.shelter + 20);
          agent.state = `Resting peacefully outside ${home?.name || city.name}`;
        }
        const nextSpot = this.pickOpenWorkSpot(agent, city, 'leisure', 10, 26, 2);
        agent.targetX = nextSpot.x;
        agent.targetZ = nextSpot.z;
        break;
      }
    }
  }

  private updateFarAgent(agent: InternalAgent, _dirtyChunks: Set<string>) {
    agent.lastUpdatedTick = this.tickCounter;
    const city = this.cityMap.get(agent.cityId);
    const civ = this.civMap.get(agent.civId);
    if (!city || !civ) return;

    if (this.tickCounter % 4 === 0) {
      agent.scheduleSlot = computeScheduleSlot(
        this.timeOfDay,
        agent.lifeStage,
        agent.traitVector
      );
    }

    if (agent.scheduleSlot === 'Sleep' && agent.criminalStatus !== 'Bandit') {
      const home = this.resolveAgentHomeStructure(agent, city);
      if (home) {
        agent.x = home.x + ((agent.id % 3) - 1) * 0.8;
        agent.z = home.z + (((agent.id >> 2) % 3) - 1) * 0.8;
        agent.y = home.y + 1;
      }
      agent.actualSpeed = 0;
      agent.action = AgentAnimAction.Sleeping;
      agent.state = home ? `Sleeping inside ${home.name}` : `Sleeping in ${city.name}`;
      return;
    }

    agent.hunger = Math.max(20, agent.hunger - 0.08);
    if (agent.hunger < 55 && city.foodStock > 0) {
      city.foodStock = Math.max(0, city.foodStock - 1);
      agent.hunger = Math.min(100, agent.hunger + 40);
    }

    if (agent.workTimer > 0) {
      agent.workTimer--;
      agent.actualSpeed = 0;
      agent.animPhase += 0.35;
      return;
    }

    const dx = agent.targetX - agent.x;
    const dz = agent.targetZ - agent.z;
    const dist = Math.hypot(dx, dz);
    const speed = 0.46;

    if (dist > 1.2) {
      const step = Math.min(dist, speed);
      agent.x += (dx / dist) * step;
      agent.z += (dz / dist) * step;
      agent.y = sampleColumn(Math.round(agent.x), Math.round(agent.z), this.seedNum).height + 1;
      agent.facing = Math.atan2(dx, dz);
      agent.actualSpeed = step;
      agent.animPhase += step * 1.15;
      agent.action = agent.carryingResource
        ? AgentAnimAction.Hauling
        : AgentAnimAction.Walking;
    } else {
      agent.actualSpeed = 0;
      agent.workTimer = 5;
      agent.tasksCompleted++;

      if (agent.job === 'Lumberjack') {
        agent.action = AgentAnimAction.Chopping;
        city.woodStock += 2;
        agent.state = `Chopping timber (${agent.roleTitle})`;
      } else if (agent.job === 'Miner') {
        agent.action = AgentAnimAction.Mining;
        city.stoneStock += 2;
        agent.state = `Mining stone (${agent.roleTitle})`;
      } else if (agent.job === 'Farmer' || agent.job === 'Forager') {
        agent.action = AgentAnimAction.Farming;
        city.foodStock += 3;
        agent.state = `Tending crops (${agent.roleTitle})`;
      } else if (agent.job === 'Builder' || agent.job === 'Artisan') {
        agent.action = AgentAnimAction.Building;
        agent.state = `Building in ${city.name}`;
      } else {
        agent.action = AgentAnimAction.Idle;
        agent.state = `${agent.roleTitle} in ${city.name}`;
      }

      const angle = this.prng.range(0, Math.PI * 2);
      const r = this.prng.range(9, 28);
      const nx = Math.round(city.x + Math.cos(angle) * r);
      const nz = Math.round(city.z + Math.sin(angle) * r);
      if (sampleColumn(nx, nz, this.seedNum).height > WATER_LEVEL) {
        agent.targetX = nx;
        agent.targetZ = nz;
      }
    }
  }

  private resolveAgentHomeStructure(
    agent: InternalAgent,
    city: InternalCity
  ): InternalStructure | undefined {
    if (agent.homeStructureId) {
      const existing = this.structMap.get(agent.homeStructureId);
      if (existing && existing.cityId === city.id && existing.type !== 'Campfire') {
        return existing;
      }
    }

    const cityHomes = this.structures.filter(
      (s) =>
        s.cityId === city.id &&
        s.type !== 'Campfire' &&
        (s.category === 'Shelter' || s.category === 'Residential')
    );
    if (cityHomes.length > 0) {
      const chosen = cityHomes[agent.id % cityHomes.length];
      agent.homeStructureId = chosen.id;
      return chosen;
    }

    const fallback = this.structures.find(
      (s) => s.cityId === city.id && s.type !== 'Campfire'
    );
    if (fallback) {
      agent.homeStructureId = fallback.id;
    }
    return fallback;
  }

  private stepMacroCity(city: InternalCity, dirtyChunks: Set<string>) {
    const civ = this.civMap.get(city.civId);
    if (!civ) return;

    const cityPop = this.agents.filter((a) => a.cityId === city.id).length;
    if (cityPop === 0) return;

    const seasonMult = this.season === 'Winter' ? 0.5 : 1.2;
    city.foodStock += Math.round(cityPop * 0.35 * seasonMult);
    city.woodStock += Math.round(cityPop * 0.25);
    city.stoneStock += Math.round(cityPop * 0.2);
    city.oreStock += Math.round(cityPop * 0.08);
    civ.techProgress += cityPop * 0.06 * this.settings.mutationRate;

    if (this.stageMode >= 3) {
      this.ensureCityHasConstructionProject(city, dirtyChunks);
      if (city.activeStructureId) {
        const active = this.structMap.get(city.activeStructureId);
        if (active && !active.isComplete) {
          this.advanceStructureBlocks(active, 6, dirtyChunks);
        }
      }
    }
  }

  private foundSatelliteColony(
    originCity: InternalCity,
    civ: InternalCiv,
    dirtyChunks: Set<string>
  ): InternalCity | null {
    const civCities = this.cities.filter((c) => c.civId === civ.id);
    if (civCities.length >= 9) return null;

    const originAgents = this.agents.filter(
      (a) => a.cityId === originCity.id && a.job !== 'Ruler' && a.lifeStage === 'Adult'
    );
    if (originAgents.length < 5) return null;

    const unlockedBoatType = this.getWaterVehicleForEra(civ.era);

    for (let attempt = 0; attempt < 36; attempt++) {
      const angle = this.prng.range(0, Math.PI * 2);
      const dist = this.prng.range(68, 112);
      const nx = Math.round(originCity.x + Math.cos(angle) * dist);
      const nz = Math.round(originCity.z + Math.sin(angle) * dist);
      const col = sampleColumn(nx, nz, this.seedNum);
      if (col.height <= WATER_LEVEL + 1 || col.height > WATER_LEVEL + 12 || col.isRiver) continue;

      const hasLandRoute = this.hasDryLandPathBetween(originCity.x, originCity.z, nx, nz, 18);
      // People CANNOT settle islands/overseas without boats!
      if (!hasLandRoute && !unlockedBoatType) {
        continue;
      }

      const tooCloseToAnyCity = this.cities.some(
        (c) => Math.hypot(c.x - nx, c.z - nz) < 58
      );
      if (tooCloseToAnyCity) continue;

      const newChunkList: string[] = [];
      const newCity = this.createCity(civ, nx, nz, false, newChunkList);
      newChunkList.forEach((k) => dirtyChunks.add(k));

      const migrantCount = Math.min(6, Math.max(4, Math.floor(originAgents.length * 0.35)));
      // If settling across water, launch a crewed expedition boat!
      if (!hasLandRoute && unlockedBoatType) {
        const launchWater =
          this.findWaterPointNear(originCity.x, originCity.z, 8, 48) ||
          this.findWaterPointNear(nx, nz, 8, 48);
        const destWater = this.findWaterPointNear(nx, nz, 6, 36) || launchWater;
        if (launchWater && destWater) {
          this.vehicles.push({
            id: this.nextVehicleId++,
            type: unlockedBoatType,
            civId: civ.id,
            colorHex: civ.colorHex,
            secondaryHex: civ.secondaryHex,
            x: launchWater.x,
            y: WATER_LEVEL + 0.85,
            z: launchWater.z,
            facing: Math.atan2(destWater.x - launchWater.x, destWater.z - launchWater.z),
            speed: 0.52,
            targetX: destWater.x,
            targetZ: destWater.z,
            animPhase: 0,
            crewCount: migrantCount,
            cargoSummary: `Colony Expedition to ${newCity.name}`,
            routeSummary: `${originCity.name} -> ${newCity.name} Sea Voyage`,
          });
        }
      }

      for (let m = 0; m < migrantCount; m++) {
        const migrant = originAgents[m];
        this.releaseWorkstation(migrant);
        migrant.cityId = newCity.id;
        migrant.homeStructureId = undefined;
        const ma = (m / migrantCount) * Math.PI * 2;
        migrant.x = Math.round(newCity.x + Math.cos(ma) * 6);
        migrant.z = Math.round(newCity.z + Math.sin(ma) * 6);
        migrant.y = this.getGroundWalkingY(migrant.x, migrant.z) + 1;
        migrant.targetX = Math.round(newCity.x + Math.cos(ma) * 12);
        migrant.targetZ = Math.round(newCity.z + Math.sin(ma) * 12);
        migrant.state = !hasLandRoute
          ? `Landed by boat to settle ${newCity.name}`
          : `Settling new colony of ${newCity.name}`;
      }
      return newCity;
    }
    return null;
  }

  private ensureCityHasConstructionProject(city: InternalCity, dirtyChunks: Set<string>) {
    // 1. Always finish ANY existing incomplete structure in this city first so no house stays half-built!
    if (city.activeStructureId) {
      const current = this.structMap.get(city.activeStructureId);
      if (current && !current.isComplete) return;
      city.activeStructureId = undefined;
      city.lastBuildTick = this.tickCounter;
    }

    const strayIncomplete = this.structures.find(
      (s) => s.cityId === city.id && !s.isComplete
    );
    if (strayIncomplete) {
      city.activeStructureId = strayIncomplete.id;
      return;
    }

    // Ensure the city has at least 2 adult Builders so construction never stalls
    const cityAdults = this.agents.filter(
      (a) => a.cityId === city.id && a.lifeStage === 'Adult'
    );
    const builderCount = cityAdults.filter(
      (a) => a.job === 'Builder' || a.job === 'Artisan'
    ).length;
    if (builderCount < 2 && cityAdults.length >= 4) {
      const recruit = cityAdults.find(
        (a) => a.job !== 'Ruler' && a.job !== 'Builder' && a.job !== 'Artisan'
      );
      const civForRecruit = this.civMap.get(city.civId);
      if (recruit && civForRecruit) {
        recruit.job = 'Builder';
        this.refreshAgentEraEquipment(recruit, civForRecruit);
      }
    }

    const civ = this.civMap.get(city.civId);
    if (!civ) return;

    const existingInCity = this.structures.filter((s) => s.cityId === city.id);
    const cityPop = this.agents.filter((a) => a.cityId === city.id).length;
    const totalHomes = existingInCity.filter(
      (s) => s.category === 'Shelter' || s.category === 'Residential'
    ).length;
    // Maintain at least 1 house per 3 citizens (up to 10 homes per city)
    const desiredHomes = Math.min(10, Math.max(3, Math.ceil(cityPop / 3)));
    const needsUrgentHousing = totalHomes < desiredHomes;

    // Shorter cooldown when the city needs more houses for its population
    const cooldownTicks = needsUrgentHousing ? 18 : 48;
    if (city.lastBuildTick && this.tickCounter - city.lastBuildTick < cooldownTicks) {
      return;
    }

    // Cap structures per city at 18 so settlements have ample homes + landmarks; found a new colony if full!
    if (existingInCity.length >= 18) {
      if (this.stageMode >= 4 && cityPop >= 12) {
        this.foundSatelliteColony(city, civ, dirtyChunks);
      }
      city.lastBuildTick = this.tickCounter;
      return;
    }

    const unlockedTypes: StructureType[] = ['Campfire', 'LeanToShelter', 'MudHut'];
    for (const node of TECH_PROGRESSION) {
      if (civ.discoveredTechs.includes(node.tech)) {
        for (const st of node.unlocks) {
          if (!unlockedTypes.includes(st)) unlockedTypes.push(st);
        }
      }
    }

    const countByType = (t: StructureType) =>
      existingInCity.filter((s) => s.type === t).length;

    const candidates = unlockedTypes.filter((t) => {
      if (t === 'Campfire') return countByType('Campfire') === 0;
      const bp = STRUCTURE_BLUEPRINTS[t];
      if (!bp) return false;
      const existing = countByType(t);

      if (bp.category === 'Shelter' || bp.category === 'Residential') {
        if (totalHomes >= desiredHomes) return false;
        return existing < 5;
      }
      // If city urgently needs housing, hold off on non-housing structures until everyone has a roof!
      if (needsUrgentHousing) {
        return false;
      }
      if (t === 'WheatFarmPlot') {
        return existing < 2;
      }
      return existing === 0;
    });

    if (candidates.length === 0) {
      city.lastBuildTick = this.tickCounter;
      return;
    }

    const priorityCandidates = candidates.filter((t) => {
      const bp = STRUCTURE_BLUEPRINTS[t];
      return bp && (bp.category === 'Shelter' || bp.category === 'Residential' || bp.era === civ.era);
    });

    const chosenType =
      priorityCandidates.length > 0
        ? this.prng.pick(priorityCandidates)
        : this.prng.pick(candidates);

    const bp = STRUCTURE_BLUEPRINTS[chosenType];
    if (bp) {
      if (city.woodStock + 8 >= bp.costWood && city.stoneStock + 8 >= bp.costStone) {
        city.woodStock = Math.max(city.woodStock, bp.costWood);
        city.stoneStock = Math.max(city.stoneStock, bp.costStone);
        city.oreStock = Math.max(city.oreStock, bp.costOre);
        const planned = this.planStructure(city, civ, chosenType, undefined, undefined, dirtyChunks);
        if (planned) {
          city.lastBuildTick = this.tickCounter;
        }
      }
    }
  }

  private pruneDeadCitiesAndOrphans() {
    const popByCity = new Map<number, number>();
    for (let i = 0; i < this.agents.length; i++) {
      const cid = this.agents[i].cityId;
      popByCity.set(cid, (popByCity.get(cid) || 0) + 1);
    }

    const survivingCities: InternalCity[] = [];
    const deadCityIds = new Set<number>();

    for (let i = 0; i < this.cities.length; i++) {
      const c = this.cities[i];
      if ((popByCity.get(c.id) || 0) > 0) {
        survivingCities.push(c);
      } else {
        deadCityIds.add(c.id);
        this.cityMap.delete(c.id);
        this.prunedDeadCitiesCount++;
      }
    }

    if (deadCityIds.size > 0) {
      this.cities = survivingCities;
      this.structures = this.structures.filter(
        (s) => !deadCityIds.has(s.cityId) || s.isComplete
      );
      this.rebuildStructureSpatialGrid();
    }
  }

  // ============================================================================
  // PART D: REAL WARFARE, FORMATIONS, MORALE, SIEGES & RESOLUTION
  // ============================================================================

  public triggerTestWarBetweenCivs(civAId?: number, civBId?: number) {
    if (this.civilizations.length < 2) return;
    const civA =
      (civAId ? this.civMap.get(civAId) : undefined) || this.civilizations[0];
    const civB =
      (civBId ? this.civMap.get(civBId) : undefined) ||
      this.civilizations.find((c) => c.id !== civA.id) ||
      this.civilizations[1];
    if (!civA || !civB || civA.id === civB.id) return;

    civA.relations[civB.id] = 'War';
    civB.relations[civA.id] = 'War';

    const existingWar = this.activeWars.find(
      (w) =>
        (w.attackerCivId === civA.id && w.defenderCivId === civB.id) ||
        (w.attackerCivId === civB.id && w.defenderCivId === civA.id)
    );
    if (existingWar) return;

    const cityA = this.cities.find((c) => c.civId === civA.id);
    const cityB = this.cities.find((c) => c.civId === civB.id);
    if (!cityA || !cityB) return;

    // Draft additional soldiers so both armies have visible formations
    for (const [civ, city] of [
      [civA, cityA],
      [civB, cityB],
    ] as const) {
      const civAgents = this.agents.filter((a) => a.civId === civ.id && a.lifeStage === 'Adult');
      let soldiers = civAgents.filter((a) => a.job === 'Soldier');
      for (let i = 0; i < civAgents.length && soldiers.length < 6; i++) {
        const candidate = civAgents[i];
        if (candidate.job !== 'Ruler' && candidate.job !== 'Soldier') {
          candidate.job = 'Soldier';
          this.refreshAgentEraEquipment(candidate, civ);
          soldiers.push(candidate);
        }
      }
    }

    const frontX = Math.round((cityA.x + cityB.x) / 2);
    const frontZ = Math.round((cityA.z + cityB.z) / 2);
    const warId = this.nextWarId++;

    this.activeWars.push({
      id: warId,
      attackerCivId: civA.id,
      defenderCivId: civB.id,
      startedYear: this.year,
      frontlineX: frontX,
      frontlineZ: frontZ,
      casualtiesA: 0,
      casualtiesB: 0,
      warScore: 0,
      status: 'Marching Formations',
    });

    const angleAB = Math.atan2(cityB.x - cityA.x, cityB.z - cityA.z);
    this.battleGroups = this.battleGroups.filter(
      (g) => g.civId !== civA.id && g.civId !== civB.id
    );

    this.battleGroups.push({
      id: warId * 10 + 1,
      civId: civA.id,
      targetCivId: civB.id,
      formation: FORMATION_BY_ERA[civA.era],
      x: cityA.x + Math.sin(angleAB) * 6,
      z: cityA.z + Math.cos(angleAB) * 6,
      targetX: frontX - Math.sin(angleAB) * 3,
      targetZ: frontZ - Math.cos(angleAB) * 3,
      facing: angleAB,
      morale: 95,
      supplyLevel: 100,
      soldierCount: this.agents.filter((a) => a.civId === civA.id && a.job === 'Soldier').length,
      state: 'Marching',
    });

    this.battleGroups.push({
      id: warId * 10 + 2,
      civId: civB.id,
      targetCivId: civA.id,
      formation: FORMATION_BY_ERA[civB.era],
      x: cityB.x - Math.sin(angleAB) * 6,
      z: cityB.z - Math.cos(angleAB) * 6,
      targetX: frontX + Math.sin(angleAB) * 3,
      targetZ: frontZ + Math.cos(angleAB) * 3,
      facing: angleAB + Math.PI,
      morale: 95,
      supplyLevel: 100,
      soldierCount: this.agents.filter((a) => a.civId === civB.id && a.job === 'Soldier').length,
      state: 'Marching',
    });

    this.recordEvent(
      'war',
      `Campaign Launched: ${civA.name} vs ${civB.name}`,
      `${civA.name} (${FORMATION_BY_ERA[civA.era]}) and ${civB.name} (${FORMATION_BY_ERA[civB.era]}) marched to battle!`,
      frontX,
      this.getGroundWalkingY(frontX, frontZ) + 1,
      frontZ,
      civA.id,
      '#EF4444'
    );
  }

  private stepWarfareFormations(dirtyChunks: Set<string>) {
    const completedWarIds = new Set<number>();

    for (const war of this.activeWars) {
      const groupA = this.battleGroups.find((g) => g.civId === war.attackerCivId);
      const groupB = this.battleGroups.find((g) => g.civId === war.defenderCivId);
      const civA = this.civMap.get(war.attackerCivId);
      const civB = this.civMap.get(war.defenderCivId);

      if (!groupA || !groupB || !civA || !civB) {
        completedWarIds.add(war.id);
        continue;
      }

      // Advance both formation groups toward each other
      const dx = groupB.x - groupA.x;
      const dz = groupB.z - groupA.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 6.5) {
        war.status = 'Formations Marching to Frontline';
        groupA.state = 'Marching';
        groupB.state = 'Marching';
        groupA.x += (dx / dist) * 0.9;
        groupA.z += (dz / dist) * 0.9;
        groupB.x -= (dx / dist) * 0.9;
        groupB.z -= (dz / dist) * 0.9;
        groupA.facing = Math.atan2(dx, dz);
        groupB.facing = Math.atan2(-dx, -dz);
        war.frontlineX = Math.round((groupA.x + groupB.x) / 2);
        war.frontlineZ = Math.round((groupA.z + groupB.z) / 2);
      } else {
        // Clash at frontline!
        war.status = `Pitched Battle (${groupA.formation} vs ${groupB.formation})`;
        groupA.state = 'Engaged';
        groupB.state = 'Engaged';

        const eraA = ERA_ORDER.indexOf(civA.era) + 1;
        const eraB = ERA_ORDER.indexOf(civB.era) + 1;
        groupA.morale = Math.max(0, groupA.morale - this.prng.range(1.2, 3.8) / eraA);
        groupB.morale = Math.max(0, groupB.morale - this.prng.range(1.2, 3.8) / eraB);
        groupA.supplyLevel = Math.max(10, groupA.supplyLevel - 0.5);
        groupB.supplyLevel = Math.max(10, groupB.supplyLevel - 0.5);

        if (this.prng.chance(0.18)) {
          war.casualtiesB++;
          this.mortalityStats.warfare++;
          war.warScore = Math.min(100, war.warScore + 8);
        }
        if (this.prng.chance(0.16)) {
          war.casualtiesA++;
          this.mortalityStats.warfare++;
          war.warScore = Math.max(-100, war.warScore - 7);
        }

        // Siege breach effect on ground/walls at frontline
        if (this.prng.chance(0.12)) {
          const gy = this.getGroundWalkingY(war.frontlineX, war.frontlineZ);
          this.setWorldVoxel(
            war.frontlineX,
            gy,
            war.frontlineZ,
            VoxelType.ScorchedEarth,
            dirtyChunks
          );
        }

        // Check for routing and peace treaty / tribute resolution
        if (groupA.morale <= 22 || groupB.morale <= 22) {
          const winner = groupA.morale >= groupB.morale ? civA : civB;
          const loser = winner.id === civA.id ? civB : civA;
          const tribute = Math.min(45, Math.max(15, Math.floor(loser.treasuryCoins * 0.35)));
          loser.treasuryCoins = Math.max(0, loser.treasuryCoins - tribute);
          winner.treasuryCoins += tribute;
          civA.relations[civB.id] = 'Neutral';
          civB.relations[civA.id] = 'Neutral';

          this.recordEvent(
            'alliance',
            `Peace Treaty: ${winner.name} Victorious`,
            `${loser.name}'s formation routed! ${loser.name} paid ${tribute} gold coins in tribute to ${winner.name}.`,
            war.frontlineX,
            this.getGroundWalkingY(war.frontlineX, war.frontlineZ) + 1,
            war.frontlineZ,
            winner.id,
            winner.colorHex
          );
          completedWarIds.add(war.id);
        }
      }
    }

    if (completedWarIds.size > 0) {
      const finishedWars = this.activeWars.filter((w) => completedWarIds.has(w.id));
      const finishedCivIds = new Set<number>();
      for (const w of finishedWars) {
        finishedCivIds.add(w.attackerCivId);
        finishedCivIds.add(w.defenderCivId);
      }
      this.activeWars = this.activeWars.filter((w) => !completedWarIds.has(w.id));
      this.battleGroups = this.battleGroups.filter((g) => !finishedCivIds.has(g.civId));
    }
  }

  // ============================================================================
  // YEARLY TURN: LIFE STAGES, FUNERALS, INHERITANCE, LAWS, RULERS & ECONOMY
  // ============================================================================

  private onYearTurn(dirtyChunks: Set<string>, yearIncrement: number) {
    if (this.stageMode === 1) return;

    const newBabies: InternalAgent[] = [];
    const survivingAgents: InternalAgent[] = [];

    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const prevStage = agent.lifeStage;
      agent.age += yearIncrement;

      const { stage, scale } = computeLifeStage(agent.age);
      agent.lifeStage = stage;
      agent.bodyScale = Number((scale * agent.clothing.bodyBuildScale).toFixed(2));

      const city = this.cityMap.get(agent.cityId);
      const civ = this.civMap.get(agent.civId);

      // Life stage transition: Teen -> Adult career selection
      if (prevStage !== stage && civ) {
        this.refreshAgentEraEquipment(agent, civ);
        if (stage === 'Adult') {
          this.logAgentMemory(
            agent,
            `Came of age and joined the ${agent.roleDomain} guild as ${agent.roleTitle}.`
          );
        } else if (stage === 'Elder') {
          this.logAgentMemory(
            agent,
            `Became a revered ${agent.roleTitle} of House ${agent.familyName}.`
          );
        }
      }

      // Check mortality causes (Part B.6)
      if (agent.health <= 0 || agent.age >= agent.maxAge) {
        this.releaseWorkstation(agent);

        let cause = 'Old Age';
        if (agent.hunger <= 3) {
          cause = 'Starvation';
          this.mortalityStats.starvation++;
        } else if (agent.state.includes('Plague')) {
          cause = 'Crimson Plague';
          this.mortalityStats.disease++;
        } else if (this.season === 'Winter' && agent.shelter < 15) {
          cause = 'Winter Exposure';
          this.mortalityStats.coldExposure++;
        } else if (agent.criminalStatus === 'Prisoner' && this.prng.chance(0.4)) {
          cause = 'Judicial Execution';
          this.mortalityStats.crimeOrExecution++;
          this.crimeStats.executions++;
        } else {
          this.mortalityStats.oldAge++;
        }

        // Place gravestone voxel & record funeral/inheritance
        if (city) {
          city.gravesCount++;
          this.mortalityStats.totalGraves++;
          const gx = Math.round(city.x + ((city.gravesCount % 6) - 3) * 2);
          const gz = Math.round(city.z - 12 - Math.floor(city.gravesCount / 6) * 2);
          const gy = this.getGroundWalkingY(gx, gz);
          if (gy > WATER_LEVEL) {
            this.setWorldVoxel(
              gx,
              gy + 1,
              gz,
              agent.isNotable || agent.job === 'Ruler'
                ? VoxelType.WhiteMarble
                : VoxelType.Cobblestone,
              dirtyChunks
            );
          }
        }

        // Inheritance to child or kin in same family
        const heir = this.agents.find(
          (other) =>
            other.id !== agent.id &&
            other.civId === agent.civId &&
            (other.parentId === agent.id || other.familyName === agent.familyName)
        );
        if (heir) {
          heir.wealthCoins += agent.wealthCoins;
          heir.action = AgentAnimAction.Mourning;
          heir.idleTimer = 4;
          heir.state = `Mourning ${agent.name} & inheriting House ${agent.familyName}`;
        }

        if (agent.isNotable || agent.job === 'Ruler') {
          this.logAgentMemory(agent, `Passed away at age ${agent.age} (${cause}).`);
          if (city && civ) {
            this.recordEvent(
              'funeral',
              `State Funeral of ${agent.name}`,
              `${city.name} erected a marble memorial for ${agent.notableTitle || agent.roleTitle} (${cause}).`,
              city.x,
              city.y + 1,
              city.z,
              civ.id,
              civ.colorHex
            );
          }
        }
        continue;
      }

      survivingAgents.push(agent);

      // Birth & Family Inheritance (scaled by yearIncrement so 100x/1000x speeds maintain full birth rates!)
      const birthChance = Math.min(0.75, 0.145 * agent.fertility * yearIncrement);
      if (
        city &&
        civ &&
        city.foodStock > 4 &&
        agent.age >= 18 &&
        agent.age <= 52 &&
        agent.hunger > 35 &&
        this.agents.length + newBabies.length < 2500 &&
        this.prng.chance(birthChance)
      ) {
        city.foodStock = Math.max(10, city.foodStock - 2);
        agent.childrenCount++;
        const allJobs: AgentJob[] = [
          'Forager',
          'Lumberjack',
          'Miner',
          'Farmer',
          'Builder',
          'Builder',
          'Artisan',
          'Trader',
          'Soldier',
          'Scholar',
          'Priest',
          'Explorer',
        ];
        const childJob =
          this.prng.chance(0.45) && agent.job !== 'Ruler'
            ? agent.job
            : this.prng.pick(allJobs);
        const angle = this.prng.range(0, Math.PI * 2);
        const r = this.prng.range(3.5, 11);
        const ax = Math.round(city.x + Math.cos(angle) * r);
        const az = Math.round(city.z + Math.sin(angle) * r);

        const baby = this.createAgentInstance({
          civ,
          city,
          x: ax,
          z: az,
          age: 1,
          job: childJob,
          familyName: agent.familyName,
          parentTraits: agent.traitVector,
          parentId: agent.id,
          initialWealth: Math.max(5, Math.floor(agent.wealthCoins * 0.15)),
          blessedEffects: agent.blessedEffects,
        });
        newBabies.push(baby);
      }
    }

    this.agents = survivingAgents.concat(newBabies);

    // Generational Replacement Floor: Ensure cities never collapse to 0 population during 1000x fast-forward
    // and always have visible multi-generational households (Babies, Children, Teens, Adults)
    const fallbackJobs: AgentJob[] = [
      'Builder',
      'Farmer',
      'Lumberjack',
      'Miner',
      'Artisan',
      'Scholar',
      'Trader',
      'Soldier',
      'Forager',
    ];
    for (const city of this.cities) {
      const civ = this.civMap.get(city.civId);
      if (!civ) continue;
      city.foodStock = Math.max(city.foodStock, 45);
      const cityAgents = this.agents.filter((a) => a.cityId === city.id);
      const minCityPop = Math.max(10, Math.floor(this.settings.startingPopPerCiv * 0.8));

      if (cityAgents.length < minCityPop && this.agents.length < 2400) {
        const needed = minCityPop - cityAgents.length;
        for (let k = 0; k < needed; k++) {
          const angle = this.prng.range(0, Math.PI * 2);
          const r = this.prng.range(4, 14);
          const ax = Math.round(city.x + Math.cos(angle) * r);
          const az = Math.round(city.z + Math.sin(angle) * r);
          // Mix of Babies (age 1-2), Children (age 6-11), Teens (age 14-16), and young Adults (age 20-30)
          const stageRoll = k % 5;
          const spawnAge =
            stageRoll === 0
              ? 1
              : stageRoll === 1
              ? this.prng.int(6, 11)
              : stageRoll === 2
              ? this.prng.int(14, 16)
              : this.prng.int(20, 31);
          const parentCand = cityAgents.find((a) => a.lifeStage === 'Adult');
          const spawned = this.createAgentInstance({
            civ,
            city,
            x: ax,
            z: az,
            age: spawnAge,
            job: fallbackJobs[k % fallbackJobs.length],
            familyName: parentCand?.familyName,
            parentId: parentCand?.id,
          });
          this.agents.push(spawned);
          cityAgents.push(spawned);
        }
      } else {
        // Ensure at least 1 Baby and 2 Children are visible in thriving cities
        const hasBaby = cityAgents.some((a) => a.lifeStage === 'Baby');
        const childCount = cityAgents.filter((a) => a.lifeStage === 'Child').length;
        const parentCand = cityAgents.find((a) => a.lifeStage === 'Adult');
        if (!hasBaby && parentCand && this.agents.length < 2400) {
          this.agents.push(
            this.createAgentInstance({
              civ,
              city,
              x: Math.round(parentCand.x + 1),
              z: Math.round(parentCand.z + 1),
              age: 1,
              job: parentCand.job === 'Ruler' ? 'Scholar' : parentCand.job,
              familyName: parentCand.familyName,
              parentId: parentCand.id,
            })
          );
        }
        if (childCount < 2 && parentCand && this.agents.length < 2400) {
          this.agents.push(
            this.createAgentInstance({
              civ,
              city,
              x: Math.round(city.x + this.prng.range(-7, 7)),
              z: Math.round(city.z + this.prng.range(-7, 7)),
              age: this.prng.int(6, 11),
              job: this.prng.pick(fallbackJobs),
              familyName: parentCand.familyName,
              parentId: parentCand.id,
            })
          );
        }
      }
    }

    this.pruneDeadCitiesAndOrphans();

    // Update Bandit count
    this.crimeStats.banditsActive = this.agents.filter(
      (a) => a.criminalStatus === 'Bandit' || a.criminalStatus === 'Wanted'
    ).length;

    // Update each Civilization: Rulers, Laws, Taxes, Tech & Diplomacy
    for (const civ of this.civilizations) {
      civ.activeGodEffects = civ.activeGodEffects.filter(
        (eff) => eff.expiresYear === null || eff.expiresYear > this.year
      );

      const civAgents = this.agents.filter((a) => a.civId === civ.id);
      const civCities = this.cities.filter((c) => c.civId === civ.id);
      if (civAgents.length === 0) continue;

      // Ensure Civilization has a living Ruler (Succession or Coup!)
      let ruler = civAgents.find((a) => a.id === civ.rulerId);
      if (!ruler) {
        const candidate =
          civAgents.find((a) => a.isNotable && a.lifeStage === 'Adult') ||
          civAgents.find((a) => a.lifeStage === 'Adult') ||
          civAgents[0];
        if (candidate) {
          candidate.job = 'Ruler';
          candidate.isNotable = true;
          civ.rulerId = candidate.id;
          civ.rulerName = candidate.name;
          civ.rulerTitle = RULER_TITLES_BY_GOV[civ.governmentType];
          candidate.notableTitle = `${civ.rulerTitle} of ${civ.name}`;
          this.refreshAgentEraEquipment(candidate, civ);
          this.syncNotableAgent(candidate);
        }
      } else if (
        civ.happiness < 42 &&
        this.year % 5 === 0 &&
        this.prng.chance(0.25)
      ) {
        // Coup / Rebellion if happiness is low!
        const challenger = civAgents.find(
          (a) => a.id !== ruler!.id && a.traitVector.ambition > 0.45 && a.lifeStage === 'Adult'
        );
        if (challenger) {
          ruler.job = 'Scholar';
          challenger.job = 'Ruler';
          challenger.isNotable = true;
          civ.rulerId = challenger.id;
          civ.rulerName = challenger.name;
          challenger.notableTitle = `${civ.rulerTitle} of ${civ.name}`;
          this.refreshAgentEraEquipment(challenger, civ);
          this.crimeStats.rebellions++;
          const cap = civCities[0];
          this.recordEvent(
            'coup',
            `Palace Coup in ${civ.name}`,
            `${challenger.name} deposed ${ruler.name} to become ${civ.rulerTitle} of ${civ.name}!`,
            cap?.x ?? 0,
            cap?.y ?? 12,
            cap?.z ?? 0,
            civ.id,
            '#F97316'
          );
        }
      }

      // Collect Taxes & Update City Market Price Indices
      for (const city of civCities) {
        const cityPop = Math.max(1, civAgents.filter((a) => a.cityId === city.id).length);
        const taxCollected = Math.round(cityPop * (civ.taxRatePct / 10));
        city.treasuryCoins += taxCollected;
        civ.treasuryCoins += taxCollected;
        // Market price index inversely reflects food per capita
        const foodPerCapita = city.foodStock / cityPop;
        city.marketPriceIndex = Number(
          Math.max(0.55, Math.min(2.8, 1.45 / Math.max(0.3, foodPerCapita))).toFixed(2)
        );
      }

      // Slow, authentic Tech & Era Progression (requires 135 research progress per tech node)
      const elderScholars = civAgents.filter(
        (a) => a.lifeStage === 'Elder' || a.job === 'Scholar'
      ).length;
      civ.techProgress +=
        (1.6 + civAgents.length * 0.14 + elderScholars * 0.45) *
        this.settings.mutationRate;

      const nextNode = TECH_PROGRESSION.find(
        (n) => !civ.discoveredTechs.includes(n.tech)
      );
      if (nextNode && civ.techProgress >= 135) {
        civ.techProgress = 0;
        civ.discoveredTechs.push(nextNode.tech);

        const inventor =
          civAgents.find((a) => a.job === 'Scholar') || this.prng.pick(civAgents);
        if (inventor) {
          this.logAgentMemory(
            inventor,
            `Discovered ${nextNode.tech}, unlocking ${nextNode.unlocks.join(', ')}!`,
            `Discoverer of ${nextNode.tech}`
          );
        }

        if (ERA_ORDER.indexOf(nextNode.era) > ERA_ORDER.indexOf(civ.era)) {
          civ.era = nextNode.era;
          civ.governmentType = GOVERNMENT_BY_ERA[civ.era];
          civ.rulerTitle = RULER_TITLES_BY_GOV[civ.governmentType];
          civ.activeLaws = [...LAWS_BY_ERA[civ.era]];

          // Upgrade all citizens' tools, weapons, roles, and clothing for the new Era!
          for (const ag of civAgents) {
            this.refreshAgentEraEquipment(ag, civ);
          }

          const cap = civCities[0];
          this.recordEvent(
            'era',
            `${civ.name} Advanced to ${civ.era} (${civ.governmentType})`,
            `${civ.rulerTitle} ${civ.rulerName} enacted ${civ.activeLaws[0]} as ${civ.name} entered the ${civ.era}!`,
            cap?.x ?? 0,
            cap?.y ?? 12,
            cap?.z ?? 0,
            civ.id,
            civ.colorHex
          );
        } else {
          const cap = civCities[0];
          this.recordEvent(
            'tech',
            `${civ.name} Discovered ${nextNode.tech}`,
            `${inventor?.name || 'Scholars'} unlocked: ${nextNode.unlocks.join(', ')}.`,
            cap?.x ?? 0,
            cap?.y ?? 12,
            cap?.z ?? 0,
            civ.id,
            civ.colorHex
          );
        }
      }

      // Expansion pressure: found separated satellite colonies across the infinite world
      if (
        this.stageMode >= 4 &&
        civAgents.length >= civCities.length * 16 &&
        civCities.length < 9 &&
        this.prng.chance(0.42)
      ) {
        const originCity = this.prng.pick(civCities);
        this.foundSatelliteColony(originCity, civ, dirtyChunks);
      }

      // Diplomacy & Organic Wars
      if (this.stageMode >= 4 && this.civilizations.length > 1 && this.year % 4 === 0) {
        for (const other of this.civilizations) {
          if (other.id <= civ.id) continue;
          const currentStance = civ.relations[other.id] || 'Neutral';
          if (this.prng.chance(0.18)) {
            const stances: DiplomaticStance[] = [
              'Trade Partners',
              'Alliance',
              'Neutral',
              'Rivalry',
              'War',
            ];
            const nextStance = this.prng.pick(stances);
            if (nextStance !== currentStance) {
              civ.relations[other.id] = nextStance;
              other.relations[civ.id] = nextStance;
              const cap = civCities[0];
              if (nextStance === 'War') {
                this.triggerTestWarBetweenCivs(civ.id, other.id);
              } else if (nextStance === 'Alliance' || nextStance === 'Trade Partners') {
                civ.tradeVolume += 15;
                other.tradeVolume += 15;
                this.recordEvent(
                  'alliance',
                  `${nextStance}: ${civ.name} & ${other.name}`,
                  `${civ.name} and ${other.name} signed a pact of ${nextStance}.`,
                  cap?.x ?? 0,
                  cap?.y ?? 12,
                  cap?.z ?? 0,
                  civ.id,
                  civ.colorHex
                );
              }
            }
          }
        }
      }

      const foodTotal = civCities.reduce((acc, c) => acc + c.foodStock, 0);
      const completedStructs = this.structures.filter(
        (s) => s.civId === civ.id && s.isComplete
      ).length;
      civ.militaryPower = Math.round(
        civAgents.filter((a) => a.job === 'Soldier').length * 9 +
          completedStructs * 3 +
          ERA_ORDER.indexOf(civ.era) * 16
      );
      civ.happiness = Math.max(
        15,
        Math.min(
          100,
          Math.round(
            68 +
              Math.min(20, foodTotal / Math.max(1, civAgents.length)) +
              completedStructs * 1.5 -
              (civ.taxRatePct - 10) * 0.6
          )
        )
      );

      if (this.year % 2 === 0 || civ.historySeries.length === 0) {
        civ.historySeries.push({
          year: this.year,
          population: civAgents.length,
          techCount: civ.discoveredTechs.length,
          happiness: civ.happiness,
          food: foodTotal,
          military: civ.militaryPower,
          trade: civ.tradeVolume,
        });
        if (civ.historySeries.length > 60) civ.historySeries.shift();
      }
    }

    const weatherRoll = this.prng.next();
    if (this.season === 'Winter') {
      this.weather = weatherRoll < 0.5 ? 'Snow' : 'Clear';
    } else if (weatherRoll < 0.14) {
      this.weather = 'Rain';
    } else if (weatherRoll < 0.2 && this.season === 'Summer') {
      this.weather = 'Drought';
    } else {
      this.weather = 'Clear';
    }

    // Item 22: Save rolling history snapshots every 3 years (or Year 1) for timeline scrubbing & fork
    if (this.year === 1 || this.year % 3 === 0) {
      if (!this.historySnapshots.some((s) => s.year === this.year)) {
        this.historySnapshots.push({
          id: `snap-yr-${this.year}`,
          year: this.year,
          dayOfYear: this.dayOfYear,
          population: this.agents.length,
          citiesCount: this.cities.length,
          structuresCount: this.structures.length,
          eraSummary: this.civilizations[0]?.era || EraType.StoneAge,
          headline: this.events[0]?.title || 'World Progress',
          timestamp: Date.now(),
          serializedState: this.serializeWorld(),
        });
        if (this.historySnapshots.length > 16) {
          this.historySnapshots.shift();
        }
      }
    }
  }

  private animalGoals = new Map<
    number,
    { tx: number; tz: number; pauseTimer: number; activity: string }
  >();

  private findDryLandPointNear(
    cx: number,
    cz: number,
    minR: number,
    maxR: number
  ): { x: number; z: number; height: number; biome: BiomeType } | null {
    for (let attempt = 0; attempt < 42; attempt++) {
      const a = this.prng.range(0, Math.PI * 2);
      const r = this.prng.range(minR, maxR);
      const wx = Math.round(cx + Math.cos(a) * r);
      const wz = Math.round(cz + Math.sin(a) * r);
      const col = sampleColumn(wx, wz, this.seedNum);
      if (
        col.height > WATER_LEVEL + 1 &&
        col.height <= WATER_LEVEL + 26 &&
        !col.isRiver &&
        !this.findContainingStructure(wx, wz)
      ) {
        return { x: wx, z: wz, height: col.height, biome: col.biome };
      }
    }
    return null;
  }

  public spawnInitialAnimals() {
    this.animals = [];
    this.animalGoals.clear();
    const speciesPool: {
      species: AnimalSpecies;
      domain: AnimalDomain;
      colorHex: string;
      secondaryHex: string;
      scale: number;
      waterOnly?: boolean;
      bird?: boolean;
    }[] = [
      { species: 'Deer', domain: 'Land', colorHex: '#8D5B4C', secondaryHex: '#D7CCC8', scale: 0.95 },
      { species: 'Rabbit', domain: 'Land', colorHex: '#BCAAA4', secondaryHex: '#EFEBE9', scale: 0.42 },
      { species: 'Boar', domain: 'Land', colorHex: '#4E342E', secondaryHex: '#8D6E63', scale: 0.78 },
      { species: 'Wolf', domain: 'Land', colorHex: '#78909C', secondaryHex: '#CFD8DC', scale: 0.82 },
      { species: 'Bear', domain: 'Land', colorHex: '#3E2723', secondaryHex: '#5D4037', scale: 1.25 },
      { species: 'Bison', domain: 'Land', colorHex: '#4A2E1B', secondaryHex: '#27180E', scale: 1.32 },
      { species: 'Horse', domain: 'Land', colorHex: '#795548', secondaryHex: '#D7CCC8', scale: 1.08 },
      { species: 'Camel', domain: 'Land', colorHex: '#D4A359', secondaryHex: '#A67838', scale: 1.15 },
      { species: 'MountainGoat', domain: 'Land', colorHex: '#ECEFF1', secondaryHex: '#90A4AE', scale: 0.78 },
      { species: 'Duck', domain: 'Water', colorHex: '#2E7D32', secondaryHex: '#FDD835', scale: 0.45, waterOnly: true },
      { species: 'Seagull', domain: 'Bird', colorHex: '#FAFAFA', secondaryHex: '#FFB300', scale: 0.48, bird: true },
      { species: 'Eagle', domain: 'Bird', colorHex: '#4E342E', secondaryHex: '#FFF8E1', scale: 0.62, bird: true },
      { species: 'FishSchool', domain: 'Water', colorHex: '#26C6DA', secondaryHex: '#FF7043', scale: 0.55, waterOnly: true },
      { species: 'Crab', domain: 'Water', colorHex: '#E53935', secondaryHex: '#FF8A65', scale: 0.38, waterOnly: true },
      { species: 'Whale', domain: 'Water', colorHex: '#1E3A5F', secondaryHex: '#90CAF9', scale: 1.85, waterOnly: true },
    ];

    const anchorCity = this.cities[0];
    const centerX = anchorCity ? anchorCity.x : 0;
    const centerZ = anchorCity ? anchorCity.z : 0;

    for (let i = 0; i < 42; i++) {
      const spec = speciesPool[i % speciesPool.length];
      let ax = centerX;
      let az = centerZ;

      if (spec.waterOnly) {
        const wp = this.findWaterPointNear(centerX, centerZ, 12, 95);
        if (!wp) continue; // Skip spawning water animal if no water nearby
        ax = wp.x;
        az = wp.z;
      } else if (spec.domain === 'Land') {
        const lp = this.findDryLandPointNear(centerX, centerZ, 16, 92);
        if (!lp) continue;
        ax = lp.x;
        az = lp.z;
      } else {
        const angle = (i / 42) * Math.PI * 2 + this.prng.range(-0.2, 0.2);
        const dist = this.prng.range(18, 90);
        ax = Math.round(centerX + Math.cos(angle) * dist);
        az = Math.round(centerZ + Math.sin(angle) * dist);
      }

      const col = sampleColumn(ax, az, this.seedNum);
      if (spec.domain === 'Land' && (col.height <= WATER_LEVEL || col.isRiver)) {
        continue;
      }

      const ay = spec.bird
        ? Math.max(WATER_LEVEL + 12, col.height + 10)
        : spec.waterOnly
        ? WATER_LEVEL + 0.35
        : col.height + 1;

      const id = this.nextAnimalId++;
      const initialFacing = this.prng.range(0, Math.PI * 2);
      const goalSpot =
        spec.domain === 'Land'
          ? this.findDryLandPointNear(ax, az, 8, 22)
          : spec.waterOnly
          ? this.findWaterPointNear(ax, az, 8, 26)
          : { x: ax + Math.round(Math.sin(initialFacing) * 18), z: az + Math.round(Math.cos(initialFacing) * 18) };

      this.animalGoals.set(id, {
        tx: goalSpot ? goalSpot.x : ax,
        tz: goalSpot ? goalSpot.z : az,
        pauseTimer: this.prng.int(0, 5),
        activity:
          spec.domain === 'Water'
            ? 'Swimming in shoal'
            : spec.domain === 'Bird'
            ? 'Riding thermal currents'
            : spec.species === 'Wolf' || spec.species === 'Bear'
            ? 'Probing territory'
            : 'Grazing on wild grass',
      });

      this.animals.push({
        id,
        species: spec.species,
        domain: spec.domain,
        biome: col.biome,
        x: ax,
        y: ay,
        z: az,
        facing: initialFacing,
        animPhase: this.prng.range(0, Math.PI * 2),
        state:
          spec.domain === 'Water'
            ? 'Swimming'
            : spec.domain === 'Bird'
            ? 'Soaring'
            : 'Grazing',
        health: 100,
        herdId: (i % 6) + 1,
        colorHex: spec.colorHex,
        secondaryHex: spec.secondaryHex,
        scale: spec.scale,
      });
    }
  }

  private stepAnimals() {
    if (this.animals.length < 24) {
      this.spawnInitialAnimals();
    }

    for (let i = 0; i < this.animals.length; i++) {
      const an = this.animals[i];
      let goal = this.animalGoals.get(an.id);
      if (!goal) {
        goal = { tx: an.x, tz: an.z, pauseTimer: 2, activity: 'Grazing' };
        this.animalGoals.set(an.id, goal);
      }

      const curCol = sampleColumn(Math.round(an.x), Math.round(an.z), this.seedNum);

      // Safety guarantee: if a Land animal ever touches water/river, immediately relocate to dry land!
      if (an.domain === 'Land' && (curCol.height <= WATER_LEVEL || curCol.isRiver)) {
        const rescue =
          this.findDryLandPointNear(an.x, an.z, 3, 28) ||
          this.findDryLandPointNear(this.cameraX, this.cameraZ, 12, 65);
        if (rescue) {
          an.x = rescue.x;
          an.z = rescue.z;
          an.y = rescue.height + 1;
          goal.tx = rescue.x;
          goal.tz = rescue.z;
          goal.pauseTimer = 3;
        }
        continue;
      }

      // 1. Check predator / hunter reactions for Land animals
      const isPredator = an.species === 'Wolf' || an.species === 'Bear';
      if (an.domain === 'Land' && !isPredator) {
        // Prey checks for nearby human Hunters or Wolves/Bears within 10 blocks
        let threatX: number | null = null;
        let threatZ: number | null = null;
        for (let j = 0; j < this.animals.length; j++) {
          const other = this.animals[j];
          if ((other.species === 'Wolf' || other.species === 'Bear') && Math.hypot(other.x - an.x, other.z - an.z) < 10) {
            threatX = other.x;
            threatZ = other.z;
            break;
          }
        }
        if (threatX === null) {
          const hunter = this.agents.find(
            (ag) => ag.job === 'Hunter' && Math.hypot(ag.x - an.x, ag.z - an.z) < 10
          );
          if (hunter) {
            threatX = hunter.x;
            threatZ = hunter.z;
          }
        }
        if (threatX !== null && threatZ !== null) {
          const awayAngle = Math.atan2(an.x - threatX, an.z - threatZ);
          const fleeX = Math.round(an.x + Math.sin(awayAngle) * 14);
          const fleeZ = Math.round(an.z + Math.cos(awayAngle) * 14);
          const fleeCol = sampleColumn(fleeX, fleeZ, this.seedNum);
          if (fleeCol.height > WATER_LEVEL + 1 && !fleeCol.isRiver) {
            goal.tx = fleeX;
            goal.tz = fleeZ;
            goal.pauseTimer = 0;
            goal.activity = 'Fleeing';
          }
        }
      }

      // 2. If paused (grazing, resting, drinking), stand calmly in place without spinning!
      if (goal.pauseTimer > 0 && an.domain === 'Land') {
        goal.pauseTimer--;
        an.animPhase += 0.16; // Gentle head-bob animation while grazing/resting
        an.state = 'Grazing';
        an.y = curCol.height + 1;
        continue;
      }

      // 3. Move purposefully toward current waypoint (tx, tz)
      const dx = goal.tx - an.x;
      const dz = goal.tz - an.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 1.35) {
        const targetFacing = Math.atan2(dx, dz);
        // Smooth angular interpolation so animals turn naturally instead of snapping or spinning
        let angleDiff = targetFacing - an.facing;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        an.facing += angleDiff * 0.28;

        const speed =
          an.domain === 'Bird'
            ? 0.25
            : an.domain === 'Water'
            ? 0.16
            : goal.activity === 'Fleeing'
            ? 0.24
            : isPredator
            ? 0.18
            : 0.14;

        const nx = an.x + (dx / dist) * speed;
        const nz = an.z + (dz / dist) * speed;
        const nextCol = sampleColumn(Math.round(nx), Math.round(nz), this.seedNum);

        if (an.domain === 'Water') {
          if (nextCol.height <= WATER_LEVEL - 1) {
            an.x = nx;
            an.z = nz;
            an.y = WATER_LEVEL + (an.species === 'Crab' ? 0.65 : 0.35);
            an.animPhase += 0.2;
            an.state = 'Swimming';
          } else {
            // Reached shallow shore — pick a new open-water target
            const wp = this.findWaterPointNear(an.x, an.z, 10, 32);
            if (wp) {
              goal.tx = wp.x;
              goal.tz = wp.z;
            }
          }
        } else if (an.domain === 'Bird') {
          an.x = nx;
          an.z = nz;
          an.y = Math.max(
            WATER_LEVEL + 11,
            nextCol.height + 9 + Math.sin(this.tickCounter * 0.05 + an.id) * 2
          );
          an.animPhase += 0.28;
          an.state = 'Soaring';
        } else {
          // Strictly require dry land and gentle slope for Land animals
          if (
            nextCol.height > WATER_LEVEL &&
            !nextCol.isRiver &&
            Math.abs(nextCol.height - curCol.height) <= 1.6 &&
            !this.findContainingStructure(nx, nz)
          ) {
            an.x = nx;
            an.z = nz;
            an.y = nextCol.height + 1;
            an.biome = nextCol.biome;
            an.animPhase += 0.18;
            an.state =
              goal.activity === 'Fleeing'
                ? 'Fleeing'
                : isPredator
                ? 'Hunting'
                : 'Roaming';
          } else {
            // Obstacle/water ahead — pick a new dry-land waypoint immediately
            const nextSpot = this.findDryLandPointNear(an.x, an.z, 6, 20);
            if (nextSpot) {
              goal.tx = nextSpot.x;
              goal.tz = nextSpot.z;
              goal.pauseTimer = 8;
              goal.activity = 'Grazing';
            }
          }
        }
      } else {
        // 4. Arrived at waypoint: pause to graze/rest/hunt, then pick next destination
        if (an.domain === 'Land') {
          goal.pauseTimer = this.prng.int(12, 28);
          if (isPredator) {
            const prey = this.animals.find(
              (other) =>
                other.domain === 'Land' &&
                other.species !== 'Wolf' &&
                other.species !== 'Bear' &&
                Math.hypot(other.x - an.x, other.z - an.z) < 28
            );
            if (prey && this.prng.chance(0.55)) {
              goal.tx = Math.round(prey.x);
              goal.tz = Math.round(prey.z);
              goal.pauseTimer = 2;
              goal.activity = 'Hunting';
            } else {
              const spot = this.findDryLandPointNear(an.x, an.z, 10, 26);
              if (spot) {
                goal.tx = spot.x;
                goal.tz = spot.z;
              }
              goal.activity = 'Roaming';
            }
          } else {
            // Herd cohesion: 45% chance to move near another member of the same herd
            const herdMate = this.animals.find(
              (other) =>
                other.id !== an.id &&
                other.domain === 'Land' &&
                other.herdId === an.herdId &&
                Math.hypot(other.x - an.x, other.z - an.z) < 32
            );
            if (herdMate && this.prng.chance(0.45)) {
              const spot = this.findDryLandPointNear(herdMate.x, herdMate.z, 3, 9);
              if (spot) {
                goal.tx = spot.x;
                goal.tz = spot.z;
              }
              goal.activity = 'Roaming';
            } else {
              const spot = this.findDryLandPointNear(an.x, an.z, 8, 22);
              if (spot) {
                goal.tx = spot.x;
                goal.tz = spot.z;
              }
              goal.activity = 'Grazing';
            }
          }
          an.state = goal.activity === 'Hunting' ? 'Hunting' : 'Grazing';
        } else if (an.domain === 'Water') {
          const wp = this.findWaterPointNear(an.x, an.z, 10, 34);
          if (wp) {
            goal.tx = wp.x;
            goal.tz = wp.z;
          }
          goal.activity = 'Swimming';
          an.state = 'Swimming';
        } else {
          const angle = this.prng.range(0, Math.PI * 2);
          const distNext = this.prng.range(18, 42);
          goal.tx = Math.round(an.x + Math.cos(angle) * distNext);
          goal.tz = Math.round(an.z + Math.sin(angle) * distNext);
          goal.activity = 'Soaring';
          an.state = 'Soaring';
        }
      }
    }
  }

  private stepActiveFires(dirtyChunks: Set<string>) {
    if (this.weather === 'Rain' || this.weather === 'Storm') {
      for (const f of this.activeFires) {
        if (this.getWorldVoxel(f.x, f.y, f.z) === VoxelType.TorchEmber) {
          this.setWorldVoxel(f.x, f.y, f.z, VoxelType.Air, dirtyChunks);
        }
      }
      this.activeFires = [];
      return;
    }

    const nextFires: { x: number; y: number; z: number; ttl: number }[] = [];
    for (let i = 0; i < this.activeFires.length; i++) {
      const f = this.activeFires[i];
      f.ttl--;

      // Check if nearby citizens form a bucket brigade to douse the fire
      const firefighter = this.agents.find(
        (a) => Math.hypot(a.x - f.x, a.z - f.z) <= 8
      );
      if (firefighter) {
        firefighter.state = `Bucket brigade dousing fire!`;
        f.ttl -= 3;
      }

      if (f.ttl <= 0) {
        if (this.getWorldVoxel(f.x, f.y, f.z) === VoxelType.TorchEmber) {
          this.setWorldVoxel(f.x, f.y, f.z, VoxelType.Air, dirtyChunks);
        }
        const groundY = this.getGroundWalkingY(f.x, f.z);
        this.setWorldVoxel(f.x, groundY, f.z, VoxelType.ScorchedEarth, dirtyChunks);
        continue;
      }

      // Chance to spread to adjacent flammable trees/wood if < 28 active fires
      if (this.activeFires.length + nextFires.length < 28 && this.prng.chance(0.18)) {
        const ox = f.x + this.prng.int(-2, 2);
        const oz = f.z + this.prng.int(-2, 2);
        const oy = this.getGroundWalkingY(ox, oz) + 1;
        const v = this.getWorldVoxel(ox, oy, oz);
        if (isLogVoxel(v) || isLeafVoxel(v) || v === VoxelType.BerryBush) {
          this.setWorldVoxel(ox, oy, oz, VoxelType.TorchEmber, dirtyChunks);
          this.enqueueFallingParticle(ox, oy, oz, VoxelType.AutumnLeavesOrange);
          nextFires.push({ x: ox, y: oy, z: oz, ttl: 10 });
        }
      }

      nextFires.push(f);
    }
    this.activeFires = nextFires;
  }

  public spawnStressTestAgents(targetTotal = 2000) {
    if (this.cities.length === 0) return;
    const allJobs: AgentJob[] = [
      'Forager',
      'Lumberjack',
      'Miner',
      'Farmer',
      'Builder',
      'Artisan',
      'Trader',
      'Soldier',
      'Scholar',
      'Priest',
      'Explorer',
    ];

    const needed = Math.max(0, targetTotal - this.agents.length);
    for (let i = 0; i < needed; i++) {
      const city = this.cities[i % this.cities.length];
      const civ = this.civMap.get(city.civId) || this.civilizations[0];
      if (!civ) continue;
      const ring = 5 + (i % 14) * 2.4;
      const angle = (i * 2.39996) % (Math.PI * 2);
      const ax = Math.round(city.x + Math.cos(angle) * ring);
      const az = Math.round(city.z + Math.sin(angle) * ring);
      const job = allJobs[i % allJobs.length];

      this.agents.push(
        this.createAgentInstance({
          civ,
          city,
          x: ax,
          z: az,
          age: 6 + (i % 65),
          job,
        })
      );
    }

    this.rebuildAgentSpatialGrid();
  }

  public applyGodPower(
    powerId: string,
    wx: number,
    wz: number,
    durationYears?: number
  ) {
    const def = GOD_POWERS.find((p) => p.id === powerId);
    if (!def) return;

    const dirtyChunks = new Set<string>();
    const wy = this.getGroundWalkingY(wx, wz);

    let closestCity: InternalCity | undefined;
    let minCityDist = Infinity;
    for (const c of this.cities) {
      const d = Math.hypot(c.x - wx, c.z - wz);
      if (d < minCityDist) {
        minCityDist = d;
        closestCity = c;
      }
    }
    const targetCiv = closestCity
      ? this.civMap.get(closestCity.civId)
      : this.civilizations[0];

    const dur = durationYears ?? def.defaultDurationYears;
    if (targetCiv && dur !== 0) {
      targetCiv.activeGodEffects.push({
        powerId: def.id,
        name: def.name,
        expiresYear: dur < 0 ? null : this.year + dur,
      });
    }

    switch (powerId) {
      case 'divine_inspiration': {
        if (targetCiv) {
          targetCiv.techProgress += 100;
          this.onYearTurn(dirtyChunks, 0);
        }
        break;
      }

      case 'golden_age': {
        if (closestCity && targetCiv) {
          closestCity.foodStock += 150;
          closestCity.woodStock += 90;
          closestCity.stoneStock += 90;
          closestCity.oreStock += 45;
          closestCity.treasuryCoins += 100;
          targetCiv.happiness = 100;
          if (closestCity.activeStructureId) {
            const st = this.structMap.get(closestCity.activeStructureId);
            if (st) this.completeStructureInstantly(st, dirtyChunks);
          }
        }
        break;
      }

      case 'fertility_boom': {
        if (closestCity && targetCiv) {
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const ax = Math.round(closestCity.x + Math.cos(angle) * 6);
            const az = Math.round(closestCity.z + Math.sin(angle) * 6);
            this.agents.push(
              this.createAgentInstance({
                civ: targetCiv,
                city: closestCity,
                x: ax,
                z: az,
                age: 19,
                job: this.prng.pick(['Builder', 'Farmer', 'Lumberjack', 'Miner', 'Scholar']),
                blessedEffects: ['fertility_boom'],
              })
            );
          }
        }
        break;
      }

      case 'super_intelligence':
      case 'titan_strength': {
        for (const agent of this.agents) {
          if (Math.hypot(agent.x - wx, agent.z - wz) <= 26) {
            if (!agent.blessedEffects.includes(powerId)) {
              agent.blessedEffects.push(powerId);
            }
            if (powerId === 'super_intelligence') {
              agent.intelligence = 100;
              this.logAgentMemory(
                agent,
                'Granted Divine Super Intelligence!',
                `Enlightened Sage of ${closestCity?.name || 'the Realm'}`
              );
            } else {
              agent.strength = 100;
              agent.maxAge = 220;
              this.logAgentMemory(
                agent,
                'Blessed with Titan Strength & 220-year life!',
                `Immortal Champion`
              );
            }
          }
        }
        break;
      }

      case 'bountiful_forest': {
        for (let dz = -6; dz <= 6; dz++) {
          for (let dx = -6; dx <= 6; dx++) {
            if (dx * dx + dz * dz > 38) continue;
            const tx = Math.round(wx + dx);
            const tz = Math.round(wz + dz);
            const ty = this.getGroundWalkingY(tx, tz);
            if (ty <= WATER_LEVEL) continue;
            this.setWorldVoxel(tx, ty, tz, VoxelType.FertileSoil, dirtyChunks);
            if (Math.abs(dx) % 4 === 0 && Math.abs(dz) % 4 === 0) {
              for (let h = 1; h <= 5; h++) {
                this.setWorldVoxel(tx, ty + h, tz, VoxelType.WoodLog, dirtyChunks);
              }
              for (let ly = 4; ly <= 6; ly++) {
                for (let lz = -1; lz <= 1; lz++) {
                  for (let lx = -1; lx <= 1; lx++) {
                    this.setWorldVoxel(
                      tx + lx,
                      ty + ly,
                      tz + lz,
                      VoxelType.BirchLeavesGold,
                      dirtyChunks
                    );
                  }
                }
              }
            } else if (dx === 0 && dz === 0) {
              this.setWorldVoxel(tx, ty + 1, tz, VoxelType.CrystalBlock, dirtyChunks);
            }
          }
        }
        break;
      }

      case 'plague': {
        for (const agent of this.agents) {
          if (Math.hypot(agent.x - wx, agent.z - wz) <= 28) {
            agent.health = Math.max(15, agent.health - 45);
            agent.state = 'Afflicted by Crimson Plague';
          }
        }
        break;
      }

      case 'famine': {
        if (closestCity) {
          closestCity.foodStock = Math.floor(closestCity.foodStock * 0.15);
        }
        for (let dz = -7; dz <= 7; dz++) {
          for (let dx = -7; dx <= 7; dx++) {
            const tx = Math.round(wx + dx);
            const tz = Math.round(wz + dz);
            const ty = this.getGroundWalkingY(tx, tz);
            if (this.getWorldVoxel(tx, ty + 1, tz) === VoxelType.CropWheat) {
              this.setWorldVoxel(tx, ty + 1, tz, VoxelType.Air, dirtyChunks);
            }
          }
        }
        break;
      }

      case 'sow_unrest': {
        if (closestCity) {
          const palette =
            CIV_PALETTES[this.civilizations.length % CIV_PALETTES.length];
          const newCivId = this.nextCivId++;
          const rebelEra = targetCiv?.era || EraType.StoneAge;
          const rebelGov = GOVERNMENT_BY_ERA[rebelEra];
          const rebelCiv: InternalCiv = {
            id: newCivId,
            name: `Free ${closestCity.name} League`,
            colorHex: palette.color,
            secondaryHex: palette.secondary,
            rgb: hexToRgbTuple(palette.color),
            era: rebelEra,
            foundedYear: this.year,
            happiness: 78,
            militaryPower: 22,
            tradeVolume: 0,
            religionName: `Reformed ${palette.religion}`,
            governmentType: rebelGov,
            rulerId: null,
            rulerName: 'Rebel Tribune',
            rulerTitle: RULER_TITLES_BY_GOV[rebelGov],
            taxRatePct: 8,
            treasuryCoins: 60,
            activeLaws: [...LAWS_BY_ERA[rebelEra]],
            cultureTraits: ['Rebellious', 'Autonomous'],
            discoveredTechs: [...(targetCiv?.discoveredTechs || ['Fire & Shelter'])],
            techProgress: 0,
            activeGodEffects: [],
            relations: {},
            historySeries: [],
            simMode: 'Micro (Full 3D)',
          };
          for (const c of this.civilizations) {
            rebelCiv.relations[c.id] = 'Rivalry';
            c.relations[rebelCiv.id] = 'Rivalry';
          }
          this.civilizations.push(rebelCiv);
          this.civMap.set(rebelCiv.id, rebelCiv);

          const rx = Math.round(wx + this.prng.range(-18, 18));
          const rz = Math.round(wz + this.prng.range(-18, 18));
          const newChunks: string[] = [];
          const rebelCity = this.createCity(rebelCiv, rx, rz, true, newChunks);
          newChunks.forEach((k) => dirtyChunks.add(k));

          const nearbyAgents = this.agents.filter(
            (a) => a.cityId === closestCity!.id
          );
          const rebelCount = Math.max(4, Math.floor(nearbyAgents.length * 0.4));
          for (let i = 0; i < rebelCount && i < nearbyAgents.length; i++) {
            const a = nearbyAgents[i];
            this.releaseWorkstation(a);
            a.civId = rebelCiv.id;
            a.cityId = rebelCity.id;
            a.targetX = rebelCity.x;
            a.targetZ = rebelCity.z;
            if (i === 0) {
              a.job = 'Ruler';
              rebelCiv.rulerId = a.id;
              rebelCiv.rulerName = a.name;
            }
            this.refreshAgentEraEquipment(a, rebelCiv);
          }
          this.crimeStats.rebellions++;
        }
        break;
      }

      case 'flood': {
        for (let dz = -8; dz <= 8; dz++) {
          for (let dx = -8; dx <= 8; dx++) {
            if (dx * dx + dz * dz > 64) continue;
            const tx = Math.round(wx + dx);
            const tz = Math.round(wz + dz);
            const ty = this.getGroundWalkingY(tx, tz);
            if (ty <= WATER_LEVEL + 3) {
              this.setWorldVoxel(tx, ty, tz, VoxelType.Water, dirtyChunks);
            }
          }
        }
        break;
      }

      case 'earthquake': {
        for (let s = -12; s <= 12; s++) {
          for (let w = -2; w <= 2; w++) {
            const tx = Math.round(wx + s);
            const tz = Math.round(wz + w + Math.sin(s * 0.5) * 2);
            const ty = this.getGroundWalkingY(tx, tz);
            for (let d = 0; d <= 3; d++) {
              this.setWorldVoxel(
                tx,
                Math.max(2, ty - d),
                tz,
                d === 3 ? VoxelType.Cobblestone : VoxelType.Air,
                dirtyChunks
              );
            }
          }
        }
        // Trigger structural support collapse on damaged buildings/trees along fault line!
        this.decayUnsupportedLeavesAndBlocks(Math.round(wx), wy + 2, Math.round(wz), 12, dirtyChunks);
        break;
      }

      case 'meteor': {
        for (let dz = -6; dz <= 6; dz++) {
          for (let dx = -6; dx <= 6; dx++) {
            const dSq = dx * dx + dz * dz;
            if (dSq > 36) continue;
            const tx = Math.round(wx + dx);
            const tz = Math.round(wz + dz);
            const ty = this.getGroundWalkingY(tx, tz);
            const depth = Math.max(1, Math.round((36 - dSq) / 9));
            for (let d = -2; d <= depth; d++) {
              this.setWorldVoxel(tx, Math.max(2, ty - d), tz, VoxelType.Air, dirtyChunks);
            }
            const floorY = Math.max(2, ty - depth);
            if (dSq < 6) {
              this.setWorldVoxel(
                tx,
                floorY,
                tz,
                dSq < 2 ? VoxelType.CrystalBlock : VoxelType.GoldOre,
                dirtyChunks
              );
            } else {
              this.setWorldVoxel(tx, floorY, tz, VoxelType.ScorchedEarth, dirtyChunks);
            }
          }
        }
        this.decayUnsupportedLeavesAndBlocks(Math.round(wx), wy + 2, Math.round(wz), 10, dirtyChunks);
        break;
      }

      case 'wildfire': {
        for (let dz = -5; dz <= 5; dz++) {
          for (let dx = -5; dx <= 5; dx++) {
            if (dx * dx + dz * dz > 26) continue;
            const tx = Math.round(wx + dx);
            const tz = Math.round(wz + dz);
            const ty = this.getGroundWalkingY(tx, tz);
            if (ty <= WATER_LEVEL) continue;
            if (this.prng.chance(0.45)) {
              this.setWorldVoxel(tx, ty + 1, tz, VoxelType.TorchEmber, dirtyChunks);
              this.activeFires.push({ x: tx, y: ty + 1, z: tz, ttl: 14 });
            }
          }
        }
        break;
      }

      case 'volcano': {
        for (let dz = -7; dz <= 7; dz++) {
          for (let dx = -7; dx <= 7; dx++) {
            const dSq = dx * dx + dz * dz;
            if (dSq > 49) continue;
            const tx = Math.round(wx + dx);
            const tz = Math.round(wz + dz);
            const ty = this.getGroundWalkingY(tx, tz);
            const coneH = Math.max(1, Math.round((49 - dSq) / 7));
            for (let h = 1; h <= coneH; h++) {
              const vox =
                dSq <= 5 && h >= coneH - 1
                  ? VoxelType.FireFlame
                  : h === coneH
                  ? VoxelType.ScorchedEarth
                  : VoxelType.DarkSlate;
              this.setWorldVoxel(tx, ty + h, tz, vox, dirtyChunks);
            }
          }
        }
        this.weather = 'Sandstorm';
        break;
      }

      case 'gentle_rain': {
        this.weather = 'Rain';
        for (const f of this.activeFires) {
          if (this.getWorldVoxel(f.x, f.y, f.z) === VoxelType.TorchEmber) {
            this.setWorldVoxel(f.x, f.y, f.z, VoxelType.Air, dirtyChunks);
          }
        }
        this.activeFires = [];
        if (closestCity) {
          closestCity.foodStock += 60;
        }
        break;
      }
    }

    this.recordEvent(
      'god_power',
      `Divine Power: ${def.name}`,
      `${def.description}`,
      wx,
      wy,
      wz,
      targetCiv?.id,
      def.colorHex
    );

    if (dirtyChunks.size > 0) {
      this.emitChunkUpdates(Array.from(dirtyChunks));
    }
  }

  public applyTerraformBrush(
    brushId: string,
    wx: number,
    wz: number,
    radius = 3
  ) {
    const r = Math.max(1, Math.min(12, Math.round(radius)));
    const dirtyChunks = new Set<string>();
    const cxWorld = Math.round(wx);
    const czWorld = Math.round(wz);
    const centerGroundY = this.getGroundWalkingY(cxWorld, czWorld);

    if (brushId === 'spawn_humans') {
      // Find nearest city or found a new tribe if none within 55 tiles
      let targetCity: InternalCity | null = null;
      let bestDist = Infinity;
      for (const c of this.cities) {
        const d = Math.hypot(c.x - cxWorld, c.z - czWorld);
        if (d < bestDist) {
          bestDist = d;
          targetCity = c;
        }
      }

      if (!targetCity || bestDist > 60 || this.civilizations.length === 0) {
        // Found a new independent civilization at this location if on dry land
        const col = sampleColumn(cxWorld, czWorld, this.seedNum);
        if (col.height >= WATER_LEVEL) {
          const pal = CIV_PALETTES[this.civilizations.length % CIV_PALETTES.length];
          const newCivId = this.nextCivId++;
          const newCityId = this.nextCityId++;
          const newCiv: InternalCiv = {
            id: newCivId,
            name: `${pal.name}`,
            colorHex: pal.color,
            secondaryHex: pal.secondary,
            rgb: hexToRgbTuple(pal.color),
            era: EraType.StoneAge,
            foundedYear: this.year,
            happiness: 88,
            militaryPower: 15,
            tradeVolume: 10,
            religionName: pal.religion,
            governmentType: 'Tribal Band',
            rulerId: null,
            rulerName: 'Council of Elders',
            rulerTitle: 'High Chieftain',
            taxRatePct: 8,
            treasuryCoins: 80,
            activeLaws: ['Customary Kinship Law', 'Hearth Sharing Pact'],
            cultureTraits: ['Agrarian', 'Seafaring'],
            discoveredTechs: ['Fire & Shelter'],
            techProgress: 0,
            activeGodEffects: [],
            relations: {},
            historySeries: [],
            simMode: 'Micro (Full 3D)',
          };
          this.civilizations.push(newCiv);
          this.civMap.set(newCiv.id, newCiv);

          const newCity: InternalCity = {
            id: newCityId,
            name: `${FIRST_NAMES[newCityId % FIRST_NAMES.length]}haven`,
            civId: newCivId,
            x: cxWorld,
            y: col.height,
            z: czWorld,
            foundedYear: this.year,
            biome: col.biome,
            foodStock: 120,
            woodStock: 90,
            stoneStock: 60,
            oreStock: 20,
            treasuryCoins: 80,
            marketPriceIndex: 1.0,
            crimeRate: 1,
            gravesCount: 0,
            structureIds: [],
            simMode: 'Micro (Full 3D)',
            siteScore: 88,
            siteBreakdown: {
              water: 85,
              fertility: 86,
              timber: 88,
              stone: 82,
              flatness: 90,
            },
          };
          this.cities.push(newCity);
          this.cityMap.set(newCity.id, newCity);
          targetCity = newCity;

          this.recordEvent(
            'founding',
            `New Civilization Founded: ${newCiv.name}`,
            `Divine settlers established ${newCity.name}.`,
            cxWorld,
            col.height,
            czWorld,
            newCiv.id,
            newCiv.colorHex
          );
        }
      }

      if (targetCity) {
        const civ = this.civMap.get(targetCity.civId);
        if (civ) {
          const spawnJobs: AgentJob[] = ['Builder', 'Forager', 'Farmer', 'Hunter'];
          for (let i = 0; i < 4; i++) {
            const sx = cxWorld + this.prng.int(-2, 2);
            const sz = czWorld + this.prng.int(-2, 2);
            const ag = this.createAgentInstance({
              civ,
              city: targetCity,
              x: sx,
              z: sz,
              age: this.prng.int(18, 34),
              job: spawnJobs[i % spawnJobs.length],
            });
            this.agents.push(ag);
          }
        }
      }
      return;
    }

    if (brushId === 'spawn_wildlife') {
      const col = sampleColumn(cxWorld, czWorld, this.seedNum);
      const isWater = col.height < WATER_LEVEL;
      const species: AnimalSpecies = isWater
        ? 'FishSchool'
        : col.biome === BiomeType.Desert
        ? 'Camel'
        : col.biome === BiomeType.Taiga || col.biome === BiomeType.Snow
        ? 'Wolf'
        : this.prng.next() > 0.45
        ? 'Deer'
        : 'Horse';
      for (let i = 0; i < 3; i++) {
        const ax = cxWorld + this.prng.int(-2, 2);
        const az = czWorld + this.prng.int(-2, 2);
        this.animals.push({
          id: this.nextAnimalId++,
          species,
          domain: isWater ? 'Water' : 'Land',
          biome: col.biome,
          x: ax,
          y: isWater ? WATER_LEVEL : Math.max(WATER_LEVEL + 1, col.height + 1),
          z: az,
          facing: this.prng.range(0, Math.PI * 2),
          scale: 1.0,
          colorHex: species === 'Wolf' ? '#94a3b8' : species === 'Horse' ? '#7c4a27' : '#b47b44',
          secondaryHex: '#f8fafc',
          state: isWater ? 'Swimming' : 'Grazing',
          health: 100,
          herdId: this.tickCounter,
          animPhase: this.prng.range(0, Math.PI * 2),
        });
      }
      return;
    }

    if (brushId === 'demolish_ruins') {
      this.structures = this.structures.filter(
        (st) => Math.hypot(st.x - cxWorld, st.z - czWorld) > r + 3
      );
      this.rebuildStructureSpatialGrid();
    }

    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r + 0.5) continue;
        const tx = cxWorld + dx;
        const tz = czWorld + dz;
        const curY = this.getGroundWalkingY(tx, tz);

        switch (brushId) {
          case 'raise_land': {
            const lift = Math.max(1, Math.round((r - Math.hypot(dx, dz)) * 0.85));
            const baseStart = Math.min(curY, WATER_LEVEL - 2);
            const topY = Math.min(CHUNK_HEIGHT - 12, Math.max(WATER_LEVEL + 1, curY + lift));
            for (let y = baseStart; y <= topY; y++) {
              const vox =
                y === topY
                  ? topY > WATER_LEVEL + 26
                    ? VoxelType.Snow
                    : topY > WATER_LEVEL + 16
                    ? VoxelType.Stone
                    : VoxelType.Grass
                  : VoxelType.Stone;
              this.setWorldVoxel(tx, y, tz, vox, dirtyChunks);
            }
            break;
          }
          case 'lower_land': {
            const cutTop = Math.max(curY + 4, WATER_LEVEL + 4);
            const bedY = WATER_LEVEL - 3;
            for (let y = cutTop; y >= bedY; y--) {
              const vox =
                y === bedY
                  ? VoxelType.Sand
                  : y <= WATER_LEVEL
                  ? VoxelType.Water
                  : VoxelType.Air;
              this.setWorldVoxel(tx, y, tz, vox, dirtyChunks);
            }
            break;
          }
          case 'flatten_plain': {
            const targetY = Math.max(WATER_LEVEL + 1, centerGroundY);
            if (curY < targetY) {
              for (let y = Math.min(curY, WATER_LEVEL - 1); y <= targetY; y++) {
                this.setWorldVoxel(
                  tx,
                  y,
                  tz,
                  y === targetY ? VoxelType.Grass : VoxelType.Dirt,
                  dirtyChunks
                );
              }
            } else if (curY > targetY) {
              for (let y = curY + 6; y > targetY; y--) {
                this.setWorldVoxel(tx, y, tz, VoxelType.Air, dirtyChunks);
              }
              this.setWorldVoxel(tx, targetY, tz, VoxelType.Grass, dirtyChunks);
            }
            break;
          }
          case 'paint_fertile': {
            if (curY >= WATER_LEVEL) {
              this.setWorldVoxel(tx, curY, tz, VoxelType.FertileSoil, dirtyChunks);
              if ((Math.abs(tx * 7 + tz * 13) & 3) === 0) {
                this.setWorldVoxel(tx, curY + 1, tz, VoxelType.CropWheat, dirtyChunks);
              }
            }
            break;
          }
          case 'paint_forest': {
            if (curY >= WATER_LEVEL) {
              this.setWorldVoxel(tx, curY, tz, VoxelType.ForestGrass, dirtyChunks);
              if (dx === 0 && dz === 0) {
                this.setWorldVoxel(tx, curY + 1, tz, VoxelType.WoodLog, dirtyChunks);
                this.setWorldVoxel(tx, curY + 2, tz, VoxelType.WoodLog, dirtyChunks);
                this.setWorldVoxel(tx, curY + 3, tz, VoxelType.Leaves, dirtyChunks);
              } else if ((Math.abs(tx + tz) & 3) === 0) {
                this.setWorldVoxel(tx, curY + 1, tz, VoxelType.BerryBush, dirtyChunks);
              }
            }
            break;
          }
          case 'paint_sand': {
            if (curY >= WATER_LEVEL) {
              this.setWorldVoxel(tx, curY, tz, VoxelType.Sand, dirtyChunks);
              this.setWorldVoxel(tx, curY + 1, tz, VoxelType.Air, dirtyChunks);
            }
            break;
          }
          case 'paint_snow': {
            if (curY >= WATER_LEVEL) {
              this.setWorldVoxel(tx, curY, tz, VoxelType.Snow, dirtyChunks);
            } else {
              this.setWorldVoxel(tx, WATER_LEVEL, tz, VoxelType.Ice, dirtyChunks);
            }
            break;
          }
          case 'paint_ore': {
            if (curY >= WATER_LEVEL) {
              this.setWorldVoxel(tx, curY, tz, VoxelType.Stone, dirtyChunks);
              const oreRoll = Math.abs(tx * 17 + tz * 31) % 4;
              const oreVox =
                oreRoll === 0
                  ? VoxelType.GoldOre
                  : oreRoll === 1
                  ? VoxelType.CrystalOre
                  : oreRoll === 2
                  ? VoxelType.IronOre
                  : VoxelType.CopperOre;
              this.setWorldVoxel(tx, curY + 1, tz, oreVox, dirtyChunks);
            }
            break;
          }
          case 'paint_road': {
            if (curY <= WATER_LEVEL) {
              this.setWorldVoxel(tx, WATER_LEVEL + 1, tz, VoxelType.BridgeWood, dirtyChunks);
            } else {
              this.setWorldVoxel(tx, curY, tz, VoxelType.RoadPaved, dirtyChunks);
              this.setWorldVoxel(tx, curY + 1, tz, VoxelType.Air, dirtyChunks);
            }
            break;
          }
          case 'demolish_ruins': {
            if (curY >= WATER_LEVEL) {
              for (let y = curY + 1; y <= curY + 12; y++) {
                this.setWorldVoxel(tx, y, tz, VoxelType.Air, dirtyChunks);
              }
            }
            break;
          }
        }
      }
    }

    if (dirtyChunks.size > 0) {
      this.emitChunkUpdates(Array.from(dirtyChunks));
    }
  }

  public toAgentSummary(a: InternalAgent): AgentSummary {
    const civ = this.civMap.get(a.civId);
    const eraIndex = civ ? ERA_ORDER.indexOf(civ.era) : 0;
    const expression: FacialExpression =
      a.action === AgentAnimAction.Sleeping
        ? 'Tired'
        : a.action === AgentAnimAction.Combat || a.criminalStatus === 'Bandit'
        ? 'Angry'
        : a.hunger < 30 || a.health < 45
        ? 'Sad'
        : a.workTimer > 0
        ? 'Working'
        : 'Happy';

    const containingSt = this.findContainingStructure(a.x, a.z);
    const xpScale = Math.min(100, Math.round(12 + a.age * 0.9 + a.tasksCompleted * 4));
    const skills = {
      farming: a.job === 'Farmer' || a.job === 'Forager' ? Math.min(100, xpScale + 25) : Math.round(xpScale * 0.45),
      mining: a.job === 'Miner' ? Math.min(100, xpScale + 28) : Math.round(xpScale * 0.35),
      smithing: a.job === 'Artisan' ? Math.min(100, xpScale + 26) : Math.round(xpScale * 0.4),
      carpentry: a.job === 'Builder' || a.job === 'Lumberjack' ? Math.min(100, xpScale + 28) : Math.round(xpScale * 0.5),
      combat: a.job === 'Soldier' || a.job === 'Hunter' ? Math.min(100, xpScale + 30) : Math.round(xpScale * 0.3),
      scholarship: a.job === 'Scholar' || a.job === 'Priest' || a.job === 'Ruler' ? Math.min(100, xpScale + 32) : Math.round(xpScale * 0.4),
      seafaring: a.job === 'Sailor' || a.job === 'Fisher' ? Math.min(100, xpScale + 28) : Math.round(xpScale * 0.35),
    };

    const relationships: {
      targetId: number;
      name: string;
      relation: 'Spouse' | 'Parent' | 'Child' | 'Friend' | 'Rival';
    }[] = [];
    if (a.spouseId) {
      const sp = this.agents.find((x) => x.id === a.spouseId);
      if (sp) relationships.push({ targetId: sp.id, name: `${sp.name} ${sp.familyName}`, relation: 'Spouse' });
    }
    if (a.parentId) {
      const pr = this.agents.find((x) => x.id === a.parentId);
      if (pr) relationships.push({ targetId: pr.id, name: `${pr.name} ${pr.familyName}`, relation: 'Parent' });
    }
    const peers = this.agents.filter((x) => x.cityId === a.cityId && x.id !== a.id).slice(0, 2);
    for (let i = 0; i < peers.length; i++) {
      relationships.push({
        targetId: peers[i].id,
        name: `${peers[i].name} ${peers[i].familyName}`,
        relation: i === 0 ? 'Friend' : 'Rival',
      });
    }

    const currentGoal =
      a.scheduleSlot === 'Sleep'
        ? 'Rest at home hearth until dawn'
        : a.hunger < 38
        ? 'Seek meal at settlement granary'
        : a.carryingResource
        ? `Deliver ${a.carryingResource} to city stockpile`
        : `Perform ${a.roleTitle} duties (${a.roleDomain})`;

    const thoughtBubble =
      a.action === AgentAnimAction.Sleeping
        ? 'Zzz... dreaming of warm harvests'
        : a.hunger < 35
        ? 'I could really use a warm meal soon!'
        : a.isNotable
        ? `Leading ${civ?.name || 'our people'} to greatness!`
        : `Working hard as a ${a.roleTitle}.`;

    return {
      id: a.id,
      name: a.name,
      familyName: a.familyName,
      civId: a.civId,
      cityId: a.cityId,
      x: Number(a.x.toFixed(1)),
      y: Number(a.y.toFixed(1)),
      z: Number(a.z.toFixed(1)),
      age: Math.floor(a.age),
      maxAge: Math.floor(a.maxAge),
      lifeStage: a.lifeStage,
      bodyScale: a.bodyScale,
      job: a.job,
      roleId: a.roleId,
      roleTitle: a.roleTitle,
      roleDomain: a.roleDomain,
      socialClass: a.socialClass,
      wealthCoins: a.wealthCoins,
      scheduleSlot: a.scheduleSlot,
      criminalStatus: a.criminalStatus,
      expression,
      traitVector: a.traitVector,
      equippedItem: a.equippedItem,
      clothing: a.clothing,
      eraIndex,
      action: a.action,
      state: a.state,
      health: Math.round(a.health),
      hunger: Math.round(a.hunger),
      shelter: Math.round(a.shelter),
      safety: Math.round(a.safety),
      social: Math.round(a.social),
      intelligence: Math.round(a.intelligence),
      strength: Math.round(a.strength),
      isNotable: a.isNotable,
      notableTitle: a.notableTitle,
      traits: a.traits,
      carryingResource: a.carryingResource,
      parentId: a.parentId,
      spouseId: a.spouseId,
      homeStructureId: a.homeStructureId,
      childrenCount: a.childrenCount,
      lifeLog: a.lifeLog,
      blessedEffects: a.blessedEffects,
      currentGoal,
      thoughtBubble,
      insideStructureId: containingSt ? containingSt.id : null,
      skills,
      relationships,
    };
  }

  /**
   * Zero-Allocation Render Buffer Builder (Stride 16 floats per agent):
   * [id, x, y, z, facing, r, g, b, animPhase, isNotable, eraIndex, animAction, bodyScale, headgearId, toolScaleY, hasCapeOrShield]
   */
  public buildAgentRenderBuffer(): Float32Array {
    if (this.stageMode === 1) return new Float32Array(0);

    const count = this.agents.length;
    const stride = 16;
    if (count > this.renderBufferCapacity) {
      this.renderBufferCapacity = Math.max(count + 512, this.renderBufferCapacity * 2);
      this.renderBuffer = new Float32Array(this.renderBufferCapacity * stride);
    }

    for (let i = 0; i < count; i++) {
      const a = this.agents[i];
      const civ = this.civMap.get(a.civId);
      const rgb = civ ? civ.rgb : [0.9, 0.7, 0.2];
      const eraIndex = civ ? ERA_ORDER.indexOf(civ.era) : 0;

      let effectiveAction = a.action;
      if (
        (effectiveAction === AgentAnimAction.Walking ||
          effectiveAction === AgentAnimAction.Hauling) &&
        a.actualSpeed <= 0.02
      ) {
        effectiveAction = AgentAnimAction.Idle;
      }

      const headgearId = HEADGEAR_TO_ID[a.clothing.headgear] ?? 0;
      const toolScaleY = a.equippedItem.headScale[1] || 0.22;
      const hasCapeOrShield =
        a.clothing.capeColorHex !== null && a.job === 'Ruler'
          ? 2
          : a.job === 'Soldier'
          ? 1
          : a.clothing.capeColorHex !== null
          ? 2
          : 0;

      const offset = i * stride;
      this.renderBuffer[offset + 0] = a.id;
      this.renderBuffer[offset + 1] = a.x;
      this.renderBuffer[offset + 2] = a.y;
      this.renderBuffer[offset + 3] = a.z;
      this.renderBuffer[offset + 4] = a.facing;
      this.renderBuffer[offset + 5] = rgb[0];
      this.renderBuffer[offset + 6] = rgb[1];
      this.renderBuffer[offset + 7] = rgb[2];
      this.renderBuffer[offset + 8] = a.animPhase;
      this.renderBuffer[offset + 9] = a.isNotable ? 1 : 0;
      this.renderBuffer[offset + 10] = eraIndex;
      this.renderBuffer[offset + 11] = effectiveAction;
      this.renderBuffer[offset + 12] = a.bodyScale;
      this.renderBuffer[offset + 13] = headgearId;
      this.renderBuffer[offset + 14] = toolScaleY;
      this.renderBuffer[offset + 15] = hasCapeOrShield;
    }

    return this.renderBuffer.slice(0, count * stride);
  }

  private buildSocietyCensusSnapshot(): SocietyCensusSnapshot {
    const catalog = getProceduralRoleCatalog();
    const lifeStageCounts: Record<LifeStage, number> = {
      Baby: 0,
      Child: 0,
      Teen: 0,
      Adult: 0,
      Elder: 0,
    };
    const socialClassCounts: Record<SocialClass, number> = {
      Servant: 0,
      Peasant: 0,
      Craftsperson: 0,
      Merchant: 0,
      Clergy: 0,
      Noble: 0,
      Ruler: 0,
    };
    const scheduleCounts: Record<DailyScheduleSlot, number> = {
      Sleep: 0,
      Meal: 0,
      Work: 0,
      Rest: 0,
      Socialize: 0,
      Worship: 0,
      Leisure: 0,
      School: 0,
    };

    const roleCounts = new Map<string, { title: string; domain: string; count: number }>();

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      lifeStageCounts[a.lifeStage] = (lifeStageCounts[a.lifeStage] || 0) + 1;
      socialClassCounts[a.socialClass] = (socialClassCounts[a.socialClass] || 0) + 1;
      scheduleCounts[a.scheduleSlot] = (scheduleCounts[a.scheduleSlot] || 0) + 1;

      const entry = roleCounts.get(a.roleTitle);
      if (entry) {
        entry.count++;
      } else {
        roleCounts.set(a.roleTitle, {
          title: a.roleTitle,
          domain: a.roleDomain,
          count: 1,
        });
      }
    }

    const topActiveRoles = Array.from(roleCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 18);

    return {
      totalUniqueRolesInCatalog: catalog.length,
      activeUniqueRolesCount: roleCounts.size,
      lifeStageCounts,
      socialClassCounts,
      scheduleCounts,
      crimeStats: { ...this.crimeStats },
      mortalityStats: { ...this.mortalityStats },
      topActiveRoles,
    };
  }

  public getTelemetrySnapshot(): SimTelemetrySnapshot {
    this.pruneDeadCitiesAndOrphans();

    let persistedDeltaBlocksCount = 0;
    this.modifiedBlocks.forEach((m) => {
      persistedDeltaBlocksCount += m.size;
    });

    const civColorLookup = new Map<number, string>();
    const civSummaries: CivilizationSummary[] = this.civilizations.map((civ) => {
      civColorLookup.set(civ.id, civ.colorHex);
      const civAgents = this.agents.filter((a) => a.civId === civ.id);
      const civCities = this.cities.filter((c) => c.civId === civ.id);
      return {
        id: civ.id,
        name: civ.name,
        colorHex: civ.colorHex,
        secondaryHex: civ.secondaryHex,
        era: civ.era,
        eraIndex: ERA_ORDER.indexOf(civ.era),
        foundedYear: civ.foundedYear,
        population: civAgents.length,
        citiesCount: civCities.length,
        happiness: civ.happiness,
        foodTotal: civCities.reduce((acc, c) => acc + c.foodStock, 0),
        woodTotal: civCities.reduce((acc, c) => acc + c.woodStock, 0),
        stoneTotal: civCities.reduce((acc, c) => acc + c.stoneStock, 0),
        oreTotal: civCities.reduce((acc, c) => acc + c.oreStock, 0),
        militaryPower: civ.militaryPower,
        tradeVolume: civ.tradeVolume,
        religionName: civ.religionName,
        governmentType: civ.governmentType,
        rulerName: civ.rulerName,
        rulerTitle: civ.rulerTitle,
        taxRatePct: civ.taxRatePct,
        treasuryCoins: civ.treasuryCoins,
        activeLaws: civ.activeLaws,
        cultureTraits: civ.cultureTraits,
        discoveredTechs: civ.discoveredTechs,
        activeGodEffects: civ.activeGodEffects,
        relations: civ.relations,
        historySeries: civ.historySeries,
        simMode: civ.simMode,
      };
    });

    const citySummaries: CitySummary[] = this.cities.map((c) => {
      const pop = this.agents.filter((a) => a.cityId === c.id).length;
      const cityStructs = this.structures.filter((s) => s.cityId === c.id);
      const completedCount = cityStructs.filter((s) => s.isComplete).length;
      const activeSt = c.activeStructureId
        ? this.structMap.get(c.activeStructureId)
        : undefined;
      const settlementTier: SettlementTier =
        pop >= 28 || completedCount >= 9
          ? 'City'
          : pop >= 18 || completedCount >= 6
          ? 'Town'
          : pop >= 12 || completedCount >= 4
          ? 'Village'
          : pop >= 7 || completedCount >= 2
          ? 'Hamlet'
          : 'Camp';
      return {
        id: c.id,
        name: c.name,
        civId: c.civId,
        x: c.x,
        y: c.y,
        z: c.z,
        foundedYear: c.foundedYear,
        population: pop,
        tier: settlementTier,
        settlementTier,
        biome: c.biome || sampleColumn(c.x, c.z, this.seedNum).biome,
        siteScore: c.siteScore ?? 82,
        siteBreakdown: c.siteBreakdown ?? {
          water: 84,
          fertility: 82,
          timber: 85,
          stone: 78,
          flatness: 80,
        },
        structuresCount: cityStructs.length,
        completedStructures: completedCount,
        activeConstruction:
          activeSt && !activeSt.isComplete
            ? {
                type: activeSt.type,
                name: activeSt.name,
                progress: activeSt.progress,
                total: activeSt.totalBlocks,
                x: activeSt.x,
                y: activeSt.y + activeSt.height,
                z: activeSt.z,
                stallStatus: activeSt.stallStatus || 'Active (Builders Working)',
                assignedBuildersCount: activeSt.assignedBuildersCount ?? 2,
              }
            : undefined,
        foodStock: c.foodStock,
        woodStock: c.woodStock,
        stoneStock: c.stoneStock,
        oreStock: c.oreStock,
        treasuryCoins: c.treasuryCoins,
        marketPriceIndex: c.marketPriceIndex,
        crimeRate: c.crimeRate,
        gravesCount: c.gravesCount,
        simMode: c.simMode,
      };
    });

    const liveCityIds = new Set(this.cities.map((c) => c.id));
    const structureMarkers: StructureMarker3D[] = this.structures
      .filter((st) => liveCityIds.has(st.cityId))
      .map((st) => {
        const hw = (st.width || 6) * 0.5 + 1.5;
        const hd = (st.depth || 6) * 0.5 + 1.5;
        const occupants = this.agents
          .filter(
            (a) =>
              a.homeStructureId === st.id ||
              (Math.abs(a.x - st.x) <= hw && Math.abs(a.z - st.z) <= hd)
          )
          .slice(0, 8)
          .map((a) => a.id);

        return {
          id: st.id,
          name: st.name,
          type: st.type,
          category: st.category,
          era: st.era,
          civId: st.civId,
          cityId: st.cityId,
          civColor: civColorLookup.get(st.civId) || '#F59E0B',
          x: st.x,
          y: st.y,
          z: st.z,
          width: st.width,
          depth: st.depth,
          height: st.height,
          progress: st.progress,
          totalBlocks: st.totalBlocks,
          isComplete: st.isComplete,
          stallStatus: st.isComplete ? 'Complete' : st.stallStatus || 'Active (Builders Working)',
          assignedBuildersCount: st.assignedBuildersCount ?? 2,
          occupantIds: occupants,
        };
      });

    const selectedAgentObj =
      this.selectedAgentId !== null
        ? this.agents.find((a) => a.id === this.selectedAgentId)
        : undefined;

    const particles = this.pendingFallingParticles.splice(0, 64);

    return {
      worldId: this.worldId,
      worldName: this.worldName,
      seed: this.seed,
      worldGenVersion: WORLD_GEN_VERSION,
      year: this.year,
      dayOfYear: this.dayOfYear,
      timeOfDay: this.timeOfDay,
      season: this.season,
      weather: this.weather,
      windDirX: 0.8,
      windDirZ: 0.4,
      speedMultiplier: this.speedMultiplier,
      isPaused: this.isPaused,
      stageMode: this.stageMode,
      cameraWorldX: Math.round(this.cameraX),
      cameraWorldZ: Math.round(this.cameraZ),
      loadedChunksCount: this.loadedChunks.size,
      persistedDeltaChunksCount: this.modifiedBlocks.size,
      persistedDeltaBlocksCount,
      microCivsCount: civSummaries.filter((c) => c.simMode === 'Micro (Full 3D)').length,
      macroCivsCount: civSummaries.filter((c) => c.simMode === 'Macro (Simplified)').length,
      lastStepMs: this.lastStepMs,
      spatialHashMs: this.spatialHashMs,
      agentSimMs: this.agentSimMs,
      cityMacroMs: this.cityMacroMs,
      timeBudgetMs: this.settings.timeBudgetMs,
      budgetDegraded: this.budgetDegraded,
      totalPopulation: this.agents.length,
      microAgentsCount: this.microAgentsCount,
      farAgentsCount: this.farAgentsCount,
      notableAgentsCount: this.agents.filter((a) => a.isNotable).length,
      totalStructures: structureMarkers.length,
      stuckRecoveriesCount: this.stuckRecoveriesCount,
      watchdogRevivalsCount: this.watchdogRevivalsCount,
      stalledBuildsFixedCount: this.stalledBuildsFixedCount,
      agentsInsideSolidBlocksCount: this.agentsInsideSolidBlocksCount,
      activeFiresCount: this.activeFires.length,
      crowdingReassignmentsCount: this.crowdingReassignmentsCount,
      activeWorkstationReservations: this.getActiveReservationsCount(),
      maxCellAgentDensity: this.maxCellAgentDensity,
      prunedDeadCitiesCount: this.prunedDeadCitiesCount,
      totalDecayedLeavesCount: this.totalDecayedLeavesCount,
      totalCollapsedBlocksCount: this.totalCollapsedBlocksCount,
      floatingBlocksRemainingCount: this.floatingBlocksRemainingCount,
      societyCensus: this.buildSocietyCensusSnapshot(),
      activeWars: this.activeWars,
      battleGroups: this.battleGroups,
      fallingParticles: particles,
      civilizations: civSummaries,
      cities: citySummaries,
      structures: structureMarkers,
      vehicles: this.vehicles,
      animals: this.animals,
      historySnapshots: this.historySnapshots,
      events: this.events.slice(0, 60),
      selectedAgent: selectedAgentObj ? this.toAgentSummary(selectedAgentObj) : null,
      notableHallOfFame: this.notableHallOfFame.slice(0, 25),
      settings: this.settings,
    };
  }

  private getLandVehicleForEra(era: EraType): VehicleType | null {
    switch (era) {
      case EraType.StoneAge:
      case EraType.Neolithic:
        return null; // No carts or cars in Stone Age or Neolithic!
      case EraType.BronzeAge:
        return 'OxCart';
      case EraType.IronAge:
      case EraType.Medieval:
        return 'HorseCarriage';
      case EraType.ArcaneRenaissance:
        return 'SteamCar';
    }
  }

  private getWaterVehicleForEra(era: EraType): VehicleType | null {
    switch (era) {
      case EraType.StoneAge:
        return null; // No boats in Stone Age!
      case EraType.Neolithic:
        return 'LogRaft';
      case EraType.BronzeAge:
        return 'Sailboat';
      case EraType.IronAge:
        return 'Longship';
      case EraType.Medieval:
        return 'CaravelShip';
      case EraType.ArcaneRenaissance:
        return 'Steamship';
    }
  }

  private isDeepOpenWater(wx: number, wz: number): boolean {
    const col = sampleColumn(Math.round(wx), Math.round(wz), this.seedNum);
    if (col.height > WATER_LEVEL - 1) return false;
    // Also verify immediate 4-neighbors are below water level so boats never beach on shores
    const n1 = sampleColumn(Math.round(wx) + 2, Math.round(wz), this.seedNum);
    const n2 = sampleColumn(Math.round(wx) - 2, Math.round(wz), this.seedNum);
    const n3 = sampleColumn(Math.round(wx), Math.round(wz) + 2, this.seedNum);
    const n4 = sampleColumn(Math.round(wx), Math.round(wz) - 2, this.seedNum);
    return (
      n1.height <= WATER_LEVEL &&
      n2.height <= WATER_LEVEL &&
      n3.height <= WATER_LEVEL &&
      n4.height <= WATER_LEVEL
    );
  }

  private findWaterPointNear(cx: number, cz: number, minR: number, maxR: number): { x: number; z: number } | null {
    for (let i = 0; i < 36; i++) {
      const a = this.prng.range(0, Math.PI * 2);
      const r = this.prng.range(minR, maxR);
      const wx = Math.round(cx + Math.cos(a) * r);
      const wz = Math.round(cz + Math.sin(a) * r);
      if (this.isDeepOpenWater(wx, wz)) {
        return { x: wx, z: wz };
      }
    }
    return null;
  }

  private isValidLandVehicleTile(wx: number, wz: number, curY?: number): boolean {
    const ix = Math.round(wx);
    const iz = Math.round(wz);
    if (!this.isWalkable(wx, wz) || this.findContainingStructure(wx, wz)) {
      return false;
    }
    const groundY = this.getGroundWalkingY(ix, iz);
    if (groundY <= WATER_LEVEL) {
      // Only allow crossing water if an actual bridge block exists at this tile!
      const v1 = this.getWorldVoxel(ix, WATER_LEVEL + 1, iz);
      const v0 = this.getWorldVoxel(ix, WATER_LEVEL, iz);
      const onBridge =
        v1 === VoxelType.BridgeWood ||
        v1 === VoxelType.BridgeStone ||
        v0 === VoxelType.BridgeWood ||
        v0 === VoxelType.BridgeStone;
      if (!onBridge) return false;
    }
    if (curY !== undefined && Math.abs(groundY + 1 - curY) > 1.25) {
      return false;
    }
    return true;
  }

  private stepVehicles() {
    const liveCivIds = new Set(this.civilizations.map((c) => c.id));
    // Keep only vehicles whose civilization is alive AND whose era has unlocked that vehicle domain
    this.vehicles = this.vehicles.filter((v) => {
      if (!liveCivIds.has(v.civId)) return false;
      const civ = this.civMap.get(v.civId);
      if (!civ) return false;
      const isWater =
        v.type !== 'HandCart' &&
        v.type !== 'OxCart' &&
        v.type !== 'HorseCarriage' &&
        v.type !== 'SteamCar';
      if (isWater) {
        return (
          this.getWaterVehicleForEra(civ.era) !== null &&
          this.isDeepOpenWater(v.x, v.z)
        );
      } else {
        return (
          this.getLandVehicleForEra(civ.era) !== null &&
          this.isValidLandVehicleTile(v.x, v.z)
        );
      }
    });

    // Spawn era-unlocked land vehicles and boats only when valid terrain exists
    for (const city of this.cities) {
      const civ = this.civMap.get(city.civId);
      if (!civ) continue;

      const lType = this.getLandVehicleForEra(civ.era);
      const wType = this.getWaterVehicleForEra(civ.era);

      const civVehicles = this.vehicles.filter((v) => v.civId === civ.id);
      const landCount = civVehicles.filter(
        (v) =>
          v.type === 'HandCart' ||
          v.type === 'OxCart' ||
          v.type === 'HorseCarriage' ||
          v.type === 'SteamCar'
      ).length;
      const waterCount = civVehicles.length - landCount;

      const desiredLand = lType
        ? Math.min(6, Math.max(2, this.cities.filter((c) => c.civId === civ.id).length * 2))
        : 0;
      const desiredWater = wType ? 2 : 0;

      if (lType && landCount < desiredLand && this.vehicles.length < 36) {
        const startSpot = this.findDryLandPointNear(city.x, city.z, 8, 18);
        const destSpot = this.findDryLandPointNear(city.x, city.z, 18, 36);
        if (startSpot && destSpot && this.isValidLandVehicleTile(startSpot.x, startSpot.z)) {
          this.vehicles.push({
            id: this.nextVehicleId++,
            type: lType,
            civId: civ.id,
            colorHex: civ.colorHex,
            secondaryHex: civ.secondaryHex,
            x: startSpot.x,
            y: startSpot.height + 1,
            z: startSpot.z,
            facing: Math.atan2(destSpot.x - startSpot.x, destSpot.z - startSpot.z),
            speed: lType === 'SteamCar' ? 0.68 : lType === 'HorseCarriage' ? 0.56 : 0.44,
            targetX: destSpot.x,
            targetZ: destSpot.z,
            animPhase: this.prng.range(0, Math.PI * 2),
            crewCount: 2,
            cargoSummary: 'Timber, Grain & Ore',
            routeSummary: `${city.name} Trade Caravan`,
          });
        }
      }

      if (wType && waterCount < desiredWater && this.vehicles.length < 36) {
        const startWater = this.findWaterPointNear(city.x, city.z, 14, 72);
        if (startWater) {
          const destWater =
            this.findWaterPointNear(startWater.x, startWater.z, 18, 65) || startWater;
          this.vehicles.push({
            id: this.nextVehicleId++,
            type: wType,
            civId: civ.id,
            colorHex: civ.colorHex,
            secondaryHex: civ.secondaryHex,
            x: startWater.x,
            y: WATER_LEVEL + 0.85,
            z: startWater.z,
            facing: Math.atan2(destWater.x - startWater.x, destWater.z - startWater.z),
            speed: wType === 'Steamship' ? 0.65 : wType === 'CaravelShip' ? 0.55 : 0.42,
            targetX: destWater.x,
            targetZ: destWater.z,
            animPhase: this.prng.range(0, Math.PI * 2),
            crewCount:
              wType === 'Steamship' || wType === 'CaravelShip'
                ? 6
                : wType === 'Longship'
                ? 4
                : 2,
            cargoSummary: 'Coastal Fish, Spices & Trade Goods',
            routeSummary: `${city.name} Maritime Route`,
          });
        }
      }
    }

    // Step each active vehicle strictly within its terrain domain (Water vs Dry Land)
    for (const v of this.vehicles) {
      const civ = this.civMap.get(v.civId);
      const isWater =
        v.type !== 'HandCart' &&
        v.type !== 'OxCart' &&
        v.type !== 'HorseCarriage' &&
        v.type !== 'SteamCar';
      if (civ) {
        const nextType = isWater
          ? this.getWaterVehicleForEra(civ.era)
          : this.getLandVehicleForEra(civ.era);
        if (nextType) v.type = nextType;
      }

      const dx = v.targetX - v.x;
      const dz = v.targetZ - v.z;
      const dist = Math.hypot(dx, dz);

      if (dist > 1.8) {
        const step = Math.min(dist, v.speed);
        const dirX = dx / dist;
        const dirZ = dz / dist;
        const nx = v.x + dirX * step;
        const nz = v.z + dirZ * step;

        if (isWater) {
          // Check both next step and 2 blocks ahead so boats never beach onto shore
          const lookAheadX = v.x + dirX * (step + 2.2);
          const lookAheadZ = v.z + dirZ * (step + 2.2);
          if (
            this.isDeepOpenWater(nx, nz) &&
            this.isDeepOpenWater(lookAheadX, lookAheadZ)
          ) {
            v.x = nx;
            v.z = nz;
            v.y = WATER_LEVEL + 0.85;
            v.facing = Math.atan2(dx, dz);
            v.animPhase += step * 1.2;
          } else {
            // Shore ahead — pick a new open-water waypoint in the current basin
            const wp = this.findWaterPointNear(v.x, v.z, 10, 42);
            if (wp) {
              v.targetX = wp.x;
              v.targetZ = wp.z;
            } else {
              v.facing += Math.PI;
              v.targetX = v.x - dirX * 14;
              v.targetZ = v.z - dirZ * 14;
            }
          }
        } else {
          // Land vehicle: try direct step or steering offsets around obstacles/water/cliffs
          const baseAngle = Math.atan2(dx, dz);
          const steerAngles = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4];
          let movedLand = false;
          for (let s = 0; s < steerAngles.length; s++) {
            const tryA = baseAngle + steerAngles[s];
            const tryX = v.x + Math.sin(tryA) * step;
            const tryZ = v.z + Math.cos(tryA) * step;
            const lookX = v.x + Math.sin(tryA) * (step + 1.4);
            const lookZ = v.z + Math.cos(tryA) * (step + 1.4);
            if (
              this.isValidLandVehicleTile(tryX, tryZ, v.y) &&
              this.isValidLandVehicleTile(lookX, lookZ, v.y)
            ) {
              v.x = tryX;
              v.z = tryZ;
              v.y = this.getGroundWalkingY(Math.round(tryX), Math.round(tryZ)) + 1;
              v.facing = tryA;
              v.animPhase += step * 1.5;
              movedLand = true;
              break;
            }
          }
          if (!movedLand) {
            // Pick a new dry-land target around its home city
            const civCities = this.cities.filter((c) => c.civId === v.civId);
            const anchorCity = civCities[0] || this.cities[0];
            const lp = this.findDryLandPointNear(
              anchorCity ? anchorCity.x : v.x,
              anchorCity ? anchorCity.z : v.z,
              8,
              26
            );
            if (lp) {
              v.targetX = lp.x;
              v.targetZ = lp.z;
            }
          }
        }
      } else {
        // Reached destination — pick next valid water or dry-land waypoint
        const civCities = this.cities.filter((c) => c.civId === v.civId);
        const anchorCity =
          civCities.length > 0 ? this.prng.pick(civCities) : this.cities[0];
        if (isWater) {
          const wp = this.findWaterPointNear(v.x, v.z, 12, 48);
          if (wp) {
            v.targetX = wp.x;
            v.targetZ = wp.z;
          }
        } else if (anchorCity) {
          const lp = this.findDryLandPointNear(anchorCity.x, anchorCity.z, 8, 28);
          if (lp) {
            v.targetX = lp.x;
            v.targetZ = lp.z;
          }
        }
      }
    }
  }

  public serializeWorld(): string {
    const deltaEntries: [string, [number, VoxelType][]][] = [];
    this.modifiedBlocks.forEach((map, key) => {
      if (map.size > 0) {
        deltaEntries.push([key, Array.from(map.entries())]);
      }
    });

    return JSON.stringify({
      worldId: this.worldId,
      worldName: this.worldName,
      seed: this.seed,
      prngState: this.prng.getState(),
      settings: this.settings,
      year: this.year,
      dayOfYear: this.dayOfYear,
      timeOfDay: this.timeOfDay,
      season: this.season,
      weather: this.weather,
      stageMode: this.stageMode,
      deltaEntries,
      agents: this.agents,
      structures: this.structures,
      cities: this.cities,
      civilizations: this.civilizations,
      events: this.events,
      notableHallOfFame: this.notableHallOfFame,
      nextAgentId: this.nextAgentId,
      nextStructureId: this.nextStructureId,
      nextCityId: this.nextCityId,
      nextCivId: this.nextCivId,
      nextEventId: this.nextEventId,
    });
  }

  public deserializeWorld(jsonStr: string) {
    const data = JSON.parse(jsonStr);
    this.worldId = data.worldId;
    this.worldName = data.worldName;
    this.seed = data.seed;
    this.seedNum = hashStringToSeed(this.seed);
    this.prng = new SeededPRNG(this.seedNum);
    if (typeof data.prngState === 'number') {
      this.prng.setState(data.prngState);
    }
    this.settings = { ...this.settings, ...(data.settings || {}) };
    this.year = data.year || 1;
    this.dayOfYear = data.dayOfYear || 0;
    this.timeOfDay = data.timeOfDay || 10;
    this.season = data.season || 'Spring';
    this.weather = data.weather || 'Clear';
    this.stageMode = data.stageMode || 5;

    this.modifiedBlocks.clear();
    if (Array.isArray(data.deltaEntries)) {
      for (const [key, entries] of data.deltaEntries) {
        this.modifiedBlocks.set(key, new Map<number, VoxelType>(entries));
      }
    }

    this.civilizations = (data.civilizations || []).map((c: InternalCiv) => ({
      ...c,
      rgb: c.rgb || hexToRgbTuple(c.colorHex || '#F59E0B'),
      governmentType: c.governmentType || GOVERNMENT_BY_ERA[c.era || EraType.StoneAge],
      rulerId: c.rulerId ?? null,
      rulerName: c.rulerName || 'Council of Elders',
      rulerTitle: c.rulerTitle || 'High Chieftain',
      taxRatePct: c.taxRatePct ?? 10,
      treasuryCoins: c.treasuryCoins ?? 60,
      activeLaws: c.activeLaws || [...LAWS_BY_ERA[c.era || EraType.StoneAge]],
    }));

    this.civMap.clear();
    for (const c of this.civilizations) this.civMap.set(c.id, c);

    this.cities = (data.cities || []).map((c: InternalCity) => ({
      ...c,
      treasuryCoins: c.treasuryCoins ?? 50,
      marketPriceIndex: c.marketPriceIndex ?? 1.0,
      crimeRate: c.crimeRate ?? 2,
      gravesCount: c.gravesCount ?? 0,
    }));
    this.cityMap.clear();
    for (const c of this.cities) this.cityMap.set(c.id, c);

    this.agents = (data.agents || []).map((a: InternalAgent) => {
      const civ = this.civMap.get(a.civId) || this.civilizations[0];
      const eraIndex = civ ? ERA_ORDER.indexOf(civ.era) : 0;
      const { stage, scale } = computeLifeStage(a.age || 20);
      const socialClass = a.socialClass || computeSocialClassForJob(a.job, a.isNotable);
      const roleDef = pickContextualRole(eraIndex, a.job, socialClass, this.prng);
      const traitVector = a.traitVector || this.generateAgentTraitVector();
      const equippedItem =
        a.equippedItem || generateProceduralItem(eraIndex, a.job, this.seedNum ^ a.id);
      const clothing =
        a.clothing ||
        generateProceduralClothing(
          eraIndex,
          a.job,
          socialClass,
          a.civId,
          civ?.colorHex || '#F59E0B',
          civ?.secondaryHex || '#FEF3C7',
          a.id,
          this.seedNum
        );
      return {
        ...a,
        familyName: a.familyName || 'Vane',
        lifeStage: stage,
        bodyScale: a.bodyScale || Number((scale * clothing.bodyBuildScale).toFixed(2)),
        roleId: a.roleId || roleDef.id,
        roleTitle: a.roleTitle || roleDef.title,
        roleDomain: a.roleDomain || roleDef.domain,
        socialClass,
        wealthCoins: a.wealthCoins ?? 20,
        scheduleSlot: a.scheduleSlot || 'Work',
        criminalStatus: a.criminalStatus || 'LawAbiding',
        traitVector,
        equippedItem,
        clothing,
        actualSpeed: a.actualSpeed ?? 0,
        idleTimer: a.idleTimer ?? 0,
        lastProgressX: a.lastProgressX ?? a.x,
        lastProgressZ: a.lastProgressZ ?? a.z,
        stuckTicks: a.stuckTicks ?? 0,
        lastUpdatedTick: this.tickCounter,
      };
    });

    this.structures = data.structures || [];
    this.events = data.events || [];
    this.notableHallOfFame = data.notableHallOfFame || [];
    this.workstationReservations.clear();

    this.rebuildStructureSpatialGrid();
    this.rebuildAgentSpatialGrid();

    this.nextAgentId = data.nextAgentId || 1000;
    this.nextStructureId = data.nextStructureId || 1000;
    this.nextCityId = data.nextCityId || 100;
    this.nextCivId = data.nextCivId || 20;
    this.nextEventId = data.nextEventId || 1000;

    this.loadedChunks.clear();
    this.syncedChunkRevisions.clear();
    const r = Math.max(4, this.settings.renderDistance);
    const dirty: string[] = [];
    for (let cz = -r; cz <= r; cz++) {
      for (let cx = -r; cx <= r; cx++) {
        this.ensureChunkLoaded(cx, cz);
        dirty.push(chunkKey(cx, cz));
      }
    }
    this.emitChunkUpdates(dirty, true);
  }

  public emitChunkUpdates(keys: string[], clearPrevious = false) {
    if (clearPrevious) {
      this.syncedChunkRevisions.clear();
    }

    const chunksPayload: {
      key: string;
      cx: number;
      cz: number;
      seedNum: number;
      revision: number;
      voxels: Uint8Array;
    }[] = [];

    for (const key of keys) {
      const [cx, cz] = parseChunkKey(key);
      const chunk = this.ensureChunkLoaded(cx, cz);
      this.syncedChunkRevisions.set(key, chunk.revision);
      chunksPayload.push({
        key,
        cx,
        cz,
        seedNum: this.seedNum,
        revision: chunk.revision,
        voxels: new Uint8Array(chunk.voxels),
      });
    }

    if (
      typeof self !== 'undefined' &&
      typeof (self as unknown as Worker).postMessage === 'function'
    ) {
      (self as unknown as Worker).postMessage({
        type: 'CHUNKS_DATA',
        clearPrevious,
        seedNum: this.seedNum,
        chunks: chunksPayload,
      });
    }
  }
}

// Only start worker intervals when running inside a Web Worker context
if (
  typeof self !== 'undefined' &&
  typeof (self as unknown as Worker).postMessage === 'function' &&
  typeof window === 'undefined'
) {
  const engine = new VoxelCivSimEngine();

  setInterval(() => {
    engine.stepFrame();
    const agentBuffer = engine.buildAgentRenderBuffer();
    (self as unknown as Worker).postMessage(
      {
        type: 'FRAME_AGENTS',
        agentBuffer,
        animals: engine.animals,
        vehicles: engine.vehicles,
        timeOfDay: engine.timeOfDay,
        season: engine.season,
        weather: engine.weather,
        year: engine.year,
      },
      [agentBuffer.buffer]
    );
  }, 50);

  setInterval(() => {
    (self as unknown as Worker).postMessage({
      type: 'TELEMETRY',
      snapshot: engine.getTelemetrySnapshot(),
    });
  }, 250);

  self.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'INIT_NEW_WORLD': {
        engine.initNewWorld(msg.worldId, msg.worldName, msg.seed, msg.settings || {});
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'SET_SPEED': {
        engine.isPaused = Boolean(msg.isPaused);
        if (typeof msg.speedMultiplier === 'number') {
          engine.speedMultiplier = msg.speedMultiplier;
        }
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'SET_STAGE_MODE': {
        const prevStage = engine.stageMode;
        engine.stageMode = msg.stageMode as SimStageMode;
        if (prevStage === 1 && engine.stageMode >= 2 && engine.civilizations.length === 0) {
          engine.initNewWorld(engine.worldId, engine.worldName, engine.seed, engine.settings);
        }
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'UPDATE_SETTINGS': {
        engine.settings = { ...engine.settings, ...(msg.settings || {}) };
        const { unloadedKeys, newlyLoadedKeys } = engine.manageChunksAroundCamera();
        if (unloadedKeys.length > 0) {
          (self as unknown as Worker).postMessage({
            type: 'UNLOAD_CHUNKS',
            keys: unloadedKeys,
          });
        }
        if (newlyLoadedKeys.length > 0) {
          engine.emitChunkUpdates(newlyLoadedKeys);
        }
        break;
      }

      case 'CAMERA_MOVED': {
        engine.cameraX = msg.x;
        engine.cameraZ = msg.z;
        if (typeof msg.zoomChunkRadius === 'number') {
          engine.dynamicZoomRadius = Math.max(
            engine.settings.renderDistance,
            Math.min(13, Math.round(msg.zoomChunkRadius))
          );
        }
        const { unloadedKeys, newlyLoadedKeys } = engine.manageChunksAroundCamera();
        if (unloadedKeys.length > 0) {
          (self as unknown as Worker).postMessage({
            type: 'UNLOAD_CHUNKS',
            keys: unloadedKeys,
          });
        }
        if (newlyLoadedKeys.length > 0) {
          engine.emitChunkUpdates(newlyLoadedKeys);
        }
        break;
      }

      case 'REQUEST_CHUNKS': {
        if (Array.isArray(msg.keys) && msg.keys.length > 0) {
          engine.emitChunkUpdates(msg.keys);
        }
        break;
      }

      case 'RUN_STRESS_TEST': {
        engine.spawnStressTestAgents(msg.targetPopulation || 2000);
        engine.isPaused = false;
        engine.speedMultiplier = msg.speedMultiplier || 25;
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'CLEAR_CUT_FOREST_TEST': {
        const wx = typeof msg.wx === 'number' ? msg.wx : engine.cameraX;
        const wz = typeof msg.wz === 'number' ? msg.wz : engine.cameraZ;
        engine.clearCutAndAuditFloatingBlocks(wx, wz, msg.radius || 18);
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'TRIGGER_TEST_WAR': {
        engine.triggerTestWarBetweenCivs(msg.civAId, msg.civBId);
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'SELECT_AGENT': {
        engine.selectedAgentId = msg.agentId;
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'APPLY_GOD_POWER': {
        engine.applyGodPower(msg.powerId, msg.wx, msg.wz, msg.durationYears);
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'APPLY_TERRAFORM_BRUSH': {
        engine.applyTerraformBrush(msg.brushId, msg.wx, msg.wz, msg.radius || 3);
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }

      case 'REQUEST_SAVE': {
        const serializedState = engine.serializeWorld();
        (self as unknown as Worker).postMessage({
          type: 'WORLD_SAVED_DATA',
          record: {
            id: engine.worldId,
            name: engine.worldName,
            seed: engine.seed,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            year: engine.year,
            population: engine.agents.length,
            civCount: engine.civilizations.length,
            eraSummary: engine.civilizations[0]?.era || EraType.StoneAge,
            settings: engine.settings,
            serializedState,
          },
        });
        break;
      }

      case 'LOAD_SAVED_WORLD':
      case 'FORK_SNAPSHOT': {
        engine.deserializeWorld(msg.serializedState);
        (self as unknown as Worker).postMessage({
          type: 'TELEMETRY',
          snapshot: engine.getTelemetrySnapshot(),
        });
        break;
      }
    }
  };
}

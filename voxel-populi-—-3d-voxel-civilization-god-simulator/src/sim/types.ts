/**
 * Core Types, Enums, Rich Voxel Palette, Era Definitions, Procedural Generator Specs,
 * Climate Biomes (WorldGen v3, 256 Max Height), Wildlife Ecosystem, Waterfronts,
 * Weather Fronts, Disasters, Construction Watchdog, and Worker Protocols
 */

export const WORLD_GEN_VERSION = 5;
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256;
export const SECTION_HEIGHT = 16;
export const SECTIONS_PER_CHUNK = 16; // 16 * 16 = 256
export const WATER_LEVEL = 14;

export enum VoxelType {
  Air = 0,
  Water = 1,
  Sand = 2,
  Grass = 3,
  ForestGrass = 4,
  Dirt = 5,
  FertileSoil = 6,
  CropWheat = 7,
  Snow = 8,
  Ice = 9,
  Stone = 10,
  Cobblestone = 11,
  CoalOre = 12,
  CopperOre = 13,
  IronOre = 14,
  GoldOre = 15,
  CrystalOre = 16,
  WoodLog = 17,
  Leaves = 18,
  PineLeaves = 19,
  Plank = 20,
  Thatch = 21,
  MudBrick = 22,
  ClayBrick = 23,
  StoneBrick = 24,
  RoofTileRed = 25,
  RoofTileSlate = 26,
  MarketCanopyRed = 27,
  MarketCanopyGold = 28,
  MarketCanopyBlue = 29,
  CrystalBlock = 30,
  GoldBlock = 31,
  RoadDirt = 32,
  RoadPaved = 33,
  BridgeWood = 34,
  BridgeStone = 35,
  TorchEmber = 36,
  GlassPane = 37,
  ScaffoldWood = 38,
  ScorchedEarth = 39,
  BirchLog = 40,
  BirchLeavesGold = 41,
  AutumnLeavesOrange = 42,
  BerryBush = 43,
  FlowerRed = 44,
  FlowerYellow = 45,
  DarkPlank = 46,
  WhiteMarble = 47,
  // Revision Pass 3 Additions: Biome & Architectural Blocks
  Sandstone = 48,
  Terracotta = 49,
  BambooStalk = 50,
  Cactus = 51,
  PalmLeaves = 52,
  CoralBlock = 53,
  DarkSlate = 54,
  LanternGlow = 55,
  FireFlame = 56,
}

export enum BiomeType {
  DeepOcean = 'Deep Ocean',
  Ocean = 'Ocean',
  Coast = 'Beach',
  River = 'River',
  Plains = 'Plains',
  Meadow = 'Meadow',
  Savanna = 'Savanna',
  Steppe = 'Steppe',
  Forest = 'Temperate Forest',
  BirchForest = 'Birch Forest',
  Taiga = 'Taiga',
  Tundra = 'Tundra',
  Snow = 'Snowy Plains',
  Glacier = 'Glacier',
  Desert = 'Desert',
  Oasis = 'Oasis',
  Badlands = 'Badlands',
  Jungle = 'Jungle',
  Swamp = 'Swamp',
  Alpine = 'Alpine',
  Mountains = 'Snowy Mountains',
  CoralReef = 'Coral Reef',
  VolcanicCaldera = 'Volcanic Highland',
}

export enum EraType {
  StoneAge = 'Stone Age',
  Neolithic = 'Neolithic Farming Age',
  BronzeAge = 'Bronze Age',
  IronAge = 'Iron Age',
  Medieval = 'Medieval Age',
  ArcaneRenaissance = 'Arcane & Renaissance Age',
}

export const ERA_ORDER: EraType[] = [
  EraType.StoneAge,
  EraType.Neolithic,
  EraType.BronzeAge,
  EraType.IronAge,
  EraType.Medieval,
  EraType.ArcaneRenaissance,
];

export type SeasonType = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export type WeatherType =
  | 'Clear'
  | 'Rain'
  | 'Thunderstorm'
  | 'Snow'
  | 'Blizzard'
  | 'Drought'
  | 'Sandstorm'
  | 'HeatWave'
  | 'Storm';

export type SimStageMode = 1 | 2 | 3 | 4 | 5;

export type AgentJob =
  | 'Forager'
  | 'Hunter'
  | 'Fisher'
  | 'Lumberjack'
  | 'Miner'
  | 'Farmer'
  | 'Builder'
  | 'Artisan'
  | 'Trader'
  | 'Sailor'
  | 'Soldier'
  | 'Scholar'
  | 'Priest'
  | 'Explorer'
  | 'Ruler';

export type LifeStage = 'Baby' | 'Child' | 'Teen' | 'Adult' | 'Elder';

export type FacialExpression =
  | 'Neutral'
  | 'Happy'
  | 'Working'
  | 'Tired'
  | 'Angry'
  | 'Sad';

export type SettlementTier = 'Camp' | 'Hamlet' | 'Village' | 'Town' | 'City';

export type SocialClass =
  | 'Servant'
  | 'Peasant'
  | 'Craftsperson'
  | 'Merchant'
  | 'Clergy'
  | 'Noble'
  | 'Ruler';

export type DailyScheduleSlot =
  | 'Sleep'
  | 'Meal'
  | 'Work'
  | 'Rest'
  | 'Socialize'
  | 'Worship'
  | 'Leisure'
  | 'School';

export type GovernmentType =
  | 'Tribal Band'
  | 'Chiefdom'
  | 'Kingdom'
  | 'Republic Council'
  | 'Imperial Dynasty'
  | 'Constitutional Realm';

export interface ContinuousTraits {
  diligence: number;
  curiosity: number;
  courage: number;
  honesty: number;
  generosity: number;
  ambition: number;
  loyalty: number;
  piety: number;
  rebelliousness: number;
}

export enum AgentAnimAction {
  Idle = 0,
  Walking = 1,
  Hauling = 2,
  Building = 3,
  Chopping = 4,
  Mining = 5,
  Farming = 6,
  Combat = 7,
  Ritual = 8,
  IdleStretch = 9,
  IdleSit = 10,
  IdleChat = 11,
  Mourning = 12,
  Arrested = 13,
  CrimeSteal = 14,
  Sleeping = 15,
  Hunting = 16,
  Fishing = 17,
}

export type QualityPreset = 'Low' | 'Medium' | 'High' | 'Ultra' | 'Auto';

export interface RendererPerfStats {
  fps: number;
  frameMs: number;
  renderMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  activeChunks: number;
  pendingMeshJobs: number;
  shadowMapSize: number;
  shadowFrustumSize: number;
  sunIntensity: number;
  ambientIntensity: number;
  qualityPreset: QualityPreset;
  cameraWorldX?: number;
  cameraWorldY?: number;
  cameraWorldZ?: number;
  cameraChunkX?: number;
  cameraChunkZ?: number;
  originRebaseX: number;
  originRebaseZ: number;
  rebaseCount?: number;
}

export type StructureCategory =
  | 'Shelter'
  | 'Residential'
  | 'Food'
  | 'Industry'
  | 'Craft'
  | 'Civic'
  | 'Trade'
  | 'Waterfront'
  | 'Military'
  | 'Spiritual'
  | 'Infrastructure'
  | 'Wonder';

export type StructureType =
  // Era 1: Stone Age
  | 'Campfire'
  | 'LeanToShelter'
  | 'MudHut'
  | 'FlintKnappingPit'
  | 'GatheringTotem'
  | 'BerryForageRack'
  | 'FishingStakes'
  | 'FishDryingRack'
  // Era 2: Neolithic
  | 'WoodHut'
  | 'WheatFarmPlot'
  | 'OrchardGrove'
  | 'GranarySilo'
  | 'DirtRoadSegment'
  | 'TimberFootbridge'
  | 'StandingStones'
  | 'LumberMillCamp'
  | 'WoodenPier'
  | 'FishingHut'
  // Era 3: Bronze Age
  | 'AdobeBrickHouse'
  | 'OpenQuarry'
  | 'CopperSmeltery'
  | 'PotteryKiln'
  | 'BarterMarketStall'
  | 'WoodenPalisade'
  | 'TimberWatchtower'
  | 'ZigguratShrine'
  | 'RiverWatermill'
  // Era 4: Iron Age
  | 'TimberFramedHouse'
  | 'IronBloomeryForge'
  | 'StoneBridge'
  | 'PavedStoneRoad'
  | 'BarracksCompound'
  | 'StoneCurtainWall'
  | 'StoneGuardTower'
  | 'CaravanTradingPost'
  | 'StoneHarbor'
  | 'CoastalLighthouse'
  // Era 5: Medieval Age
  | 'StoneManorHouse'
  | 'Windmill'
  | 'GrandMarketPlaza'
  | 'GuildWorkshop'
  | 'CathedralSanctuary'
  | 'HarborDock'
  | 'Shipyard'
  | 'CastleKeep'
  | 'AqueductSegment'
  // Era 6: Arcane & Renaissance Age
  | 'UniversityAcademy'
  | 'AlchemicalObservatory'
  | 'ClocktowerMonument'
  | 'CrystalSanctum'
  | 'GrandPantheonWonder';

export interface VoxelPlacementStep {
  dx: number;
  dy: number;
  dz: number;
  voxel: VoxelType;
}

export type BuildingStep = VoxelPlacementStep;

export interface StructureBlueprint {
  type: StructureType;
  name: string;
  era: EraType;
  category: StructureCategory;
  requiredTech?: string;
  isWaterfront?: boolean;
  width: number;
  depth: number;
  height: number;
  costWood: number;
  costStone: number;
  costOre: number;
  description: string;
  steps: VoxelPlacementStep[];
}

export interface WorldSettings {
  initialChunkRadius: number;
  renderDistance: number;
  simDetailRadius: number;
  startingCivs: number;
  startingPopPerCiv: number;
  resourceAbundance: number;
  disasterFrequency: number;
  mutationRate: number;
  timeBudgetMs: number;
  maxYears: number;
}

// ============================================================================
// PART C: PROCEDURAL GENERATORS (ROLES, ITEMS, CLOTHING, BUILDINGS)
// ============================================================================

export type ToolArchetype =
  | 'Hammer'
  | 'Axe'
  | 'Pickaxe'
  | 'Hoe'
  | 'Scythe'
  | 'Spear'
  | 'Sword'
  | 'Bow'
  | 'Shield'
  | 'Staff'
  | 'Scroll'
  | 'LoomShuttle'
  | 'AnvilTongs'
  | 'FishingRod'
  | 'FishingNet'
  | 'HuntingTrap'
  | 'Chisel'
  | 'Musket'
  | 'Scepter'
  | 'Crate';

export type MaterialTier =
  | 'Stone & Bone'
  | 'Copper'
  | 'Bronze'
  | 'Iron'
  | 'Steel'
  | 'Gilded Mythril';

export interface GeneratedRoleDef {
  id: string;
  title: string;
  domain: string;
  specialty: string;
  rank: string;
  baseJob: AgentJob;
  socialClass: SocialClass;
  eraIndex: number;
  toolArchetype: ToolArchetype;
  workplaceCategory: StructureCategory;
  product: string;
  baseWage: number;
}

export interface GeneratedItemSpec {
  id: string;
  name: string;
  archetype: ToolArchetype;
  material: MaterialTier;
  materialTier: MaterialTier;
  quality: number;
  speedMultiplier: number;
  workSpeedMultiplier: number;
  combatBonus: number;
  damageBonus: number;
  durability: number;
  headColorHex: string;
  handleColorHex: string;
  trimColorHex: string;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  headScale: [number, number, number];
}

export type HeadgearIdType =
  | 'none'
  | 'straw_hat'
  | 'hood'
  | 'helmet'
  | 'scholar_cap'
  | 'crown'
  | 'miter'
  | 'merchant_cap';

export interface GeneratedClothingSpec {
  id: string;
  name: string;
  summary: string;
  socialClass: SocialClass;
  climate: string;
  era: EraType;
  wealthTier: number;
  tunicColorHex: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  trimColorHex: string;
  beltColorHex: string;
  headgear: HeadgearIdType;
  hatStyle: HeadgearIdType;
  headgearType:
    | 'None'
    | 'HideBand'
    | 'StrawHat'
    | 'BronzeHelm'
    | 'IronHelm'
    | 'Hood'
    | 'NoblePlume'
    | 'RoyalCrown'
    | 'PriestMitre'
    | 'ScholarCap';
  headgearColorHex: string;
  hasCape: boolean;
  capeColorHex: string | null;
  skinToneHex: string;
  bodyBuildScale: number;
}

export interface ProceduralBuildingSpec {
  id: string;
  name: string;
  styleName: string;
  purpose: StructureCategory;
  archetypeName: string;
  cultureStyle: string;
  era: EraType;
  roofStyle:
    | 'ThatchedGable'
    | 'TimberGable'
    | 'ClayHip'
    | 'SlateSteep'
    | 'SandstoneFlat'
    | 'MarbleDome'
    | 'BattlementKeep';
  width: number;
  depth: number;
  height: number;
  stories: number;
  roomsCount: number;
  hasCourtyard: boolean;
  hasTower: boolean;
  hasChimney: boolean;
  hasPorch: boolean;
  furnitureItems: string[];
  steps: VoxelPlacementStep[];
  doorwayCoords?: [number, number][];
  validation: {
    isValid: boolean;
    hasConnectedDoorway: boolean;
    hasDoorway: boolean;
    floatingBlocks: number;
    floatingBlocksCount: number;
    enclosedRoomsReachable: boolean;
    roofCoveragePct: number;
    qualityScore: number;
  };
}

// ============================================================================
// PART 4: WILDLIFE ECOSYSTEM (LAND, BIRD, AND MARINE ANIMALS)
// ============================================================================

export type AnimalSpecies =
  | 'Deer'
  | 'Rabbit'
  | 'Boar'
  | 'Wolf'
  | 'Bear'
  | 'Bison'
  | 'Horse'
  | 'Camel'
  | 'MountainGoat'
  | 'Duck'
  | 'Seagull'
  | 'Eagle'
  | 'FishSchool'
  | 'Crab'
  | 'Whale';

export type AnimalDomain = 'Land' | 'Bird' | 'Water';

export interface AnimalMarker3D {
  id: number;
  species: AnimalSpecies;
  domain: AnimalDomain;
  biome: BiomeType;
  x: number;
  y: number;
  z: number;
  facing: number;
  scale: number;
  colorHex: string;
  secondaryHex: string;
  state: 'Grazing' | 'Roaming' | 'Fleeing' | 'Hunting' | 'Drinking' | 'Domesticated' | 'Swimming' | 'Soaring';
  health: number;
  herdId: number;
  domesticatedCityId?: number;
  animPhase: number;
}

// ============================================================================
// AGENT, SOCIETY, CRIME, GOVERNMENT, CONSTRUCTION WATCHDOG & WARFARE SUMMARIES
// ============================================================================

export interface AgentSummary {
  id: number;
  name: string;
  familyName: string;
  civId: number;
  cityId: number;
  x: number;
  y: number;
  z: number;
  age: number;
  maxAge: number;
  lifeStage: LifeStage;
  expression: FacialExpression;
  bodyScale: number;
  socialClass: SocialClass;
  job: AgentJob;
  roleId?: string;
  roleTitle: string;
  roleDomain: string;
  scheduleSlot: DailyScheduleSlot;
  wealth?: number;
  wealthCoins: number;
  criminalStatus: 'LawAbiding' | 'Suspect' | 'Wanted' | 'Prisoner' | 'Bandit';
  traitVector: ContinuousTraits;
  continuousTraits?: ContinuousTraits;
  eraIndex: number;
  action: AgentAnimAction;
  state: string;
  health: number;
  hunger: number;
  shelter: number;
  safety: number;
  social: number;
  intelligence: number;
  strength: number;
  isNotable: boolean;
  notableTitle?: string;
  traits: string[];
  equippedItem: GeneratedItemSpec;
  clothing: GeneratedClothingSpec;
  carryingResource?: string;
  spouseId?: number;
  parentId?: number;
  homeStructureId?: number;
  childrenCount: number;
  crimesCommitted?: number;
  lifeLog: string[];
  blessedEffects: string[];
  currentGoal?: string;
  thoughtBubble?: string;
  insideStructureId?: number | null;
  skills?: {
    farming: number;
    mining: number;
    smithing: number;
    carpentry: number;
    combat: number;
    scholarship: number;
    seafaring: number;
  };
  relationships?: {
    targetId: number;
    name: string;
    relation: 'Spouse' | 'Parent' | 'Child' | 'Friend' | 'Rival';
  }[];
}

export interface SocietyCensusSnapshot {
  totalUniqueRolesInCatalog: number;
  activeUniqueRolesCount: number;
  lifeStageCounts: Record<LifeStage, number>;
  socialClassCounts: Record<SocialClass, number>;
  scheduleCounts: Record<DailyScheduleSlot, number>;
  crimeStats: {
    thefts: number;
    arrests: number;
    trials: number;
    executions: number;
    banditsActive: number;
    rebellions: number;
  };
  mortalityStats: {
    oldAge: number;
    starvation: number;
    disease?: number;
    plague?: number;
    coldExposure: number;
    workAccident?: number;
    crimeOrExecution?: number;
    warfare: number;
    totalGraves: number;
  };
  topActiveRoles: {
    title: string;
    domain: string;
    count: number;
  }[];
}

export type FormationType =
  | 'Tribal Crowd'
  | 'Shield Wall'
  | 'Phalanx Spear Line'
  | 'Archer Volley Line'
  | 'Flanking Cavalry'
  | 'Siege Battery'
  | 'Gunpowder Line';

export interface BattleUnitGroup {
  id: number;
  civId: number;
  targetCivId: number;
  civName?: string;
  colorHex?: string;
  commanderName?: string;
  formation: FormationType;
  soldierCount: number;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  facing: number;
  morale: number;
  supplyLevel: number;
  supplies?: number;
  state:
    | 'Marching'
    | 'Forming Up'
    | 'Engaged'
    | 'Charging'
    | 'Flanking'
    | 'Sieging'
    | 'Routing'
    | 'Victorious';
  equipmentSummary?: string;
}

export interface ActiveWarSummary {
  id: number;
  attackerCivId: number;
  defenderCivId: number;
  attackerName?: string;
  defenderName?: string;
  attackerEra?: EraType;
  defenderEra?: EraType;
  startedYear: number;
  frontlineX: number;
  frontlineZ: number;
  casualtiesA: number;
  casualtiesB: number;
  warScore: number;
  status: string;
  outcomeSummary?: string;
}

export interface FallingVoxelParticle {
  x: number;
  y: number;
  z: number;
  voxel?: VoxelType;
  colorHex: string;
}

export type ConstructionStallStatus =
  | 'Complete'
  | 'Active (Builders Working)'
  | 'Waiting for Builder'
  | 'Waiting for Materials'
  | 'Auto-Reassigned by Watchdog';

export interface StructureMarker3D {
  id: number;
  name: string;
  type: StructureType;
  category: StructureCategory;
  era: EraType;
  civId?: number;
  cityId?: number;
  civColor: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  depth?: number;
  height: number;
  progress: number;
  totalBlocks: number;
  isComplete: boolean;
  isOnFire?: boolean;
  assignedBuildersCount?: number;
  stallStatus?: ConstructionStallStatus;
  ticksSinceProgress?: number;
  roofStyle?: string;
  cultureStyle?: string;
  occupantIds?: number[];
  interiorRooms?: {
    name: string;
    rx: number;
    rz: number;
    rw: number;
    rd: number;
    furniture: { kind: string; dx: number; dz: number }[];
  }[];
}

export interface CitySummary {
  id: number;
  name: string;
  civId: number;
  tier: SettlementTier;
  settlementTier?: SettlementTier;
  biome: BiomeType;
  siteScore: number;
  siteBreakdown?: {
    water: number;
    fertility: number;
    timber: number;
    stone: number;
    flatness: number;
  };
  x: number;
  y: number;
  z: number;
  foundedYear: number;
  population: number;
  governorName?: string;
  structuresCount: number;
  completedStructures: number;
  activeConstruction?: {
    type: StructureType;
    name: string;
    progress: number;
    total: number;
    x: number;
    y: number;
    z: number;
    status?: ConstructionStallStatus;
  };
  foodStock: number;
  woodStock: number;
  stoneStock: number;
  oreStock: number;
  fishStock?: number;
  meatStock?: number;
  peltStock?: number;
  treasuryCoins: number;
  goldTreasury?: number;
  marketPriceIndex: number;
  crimeRate: number;
  gravesCount: number;
  domesticatedCount?: number;
  isCoastal?: boolean;
  simMode: 'Micro (Full 3D)' | 'Macro (Simplified)';
}

export type DiplomaticStance =
  | 'Neutral'
  | 'Trade Partners'
  | 'Alliance'
  | 'Rivalry'
  | 'War';

export interface CivilizationSummary {
  id: number;
  name: string;
  colorHex: string;
  secondaryHex: string;
  era: EraType;
  eraIndex: number;
  governmentType: GovernmentType;
  rulerName: string;
  rulerTitle: string;
  rulerStyle?: 'Just' | 'Reformist' | 'Martial' | 'Tyrannical' | 'Mercantile';
  taxRatePct: number;
  treasuryCoins: number;
  treasuryTotal?: number;
  legitimacy?: number;
  activeLaws: string[];
  currencyName?: string;
  guilds?: string[];
  foundedYear: number;
  population: number;
  citiesCount: number;
  shipsCount?: number;
  happiness: number;
  foodTotal: number;
  woodTotal: number;
  stoneTotal: number;
  oreTotal: number;
  militaryPower: number;
  tradeVolume: number;
  religionName: string;
  cultureStyle?: string;
  cultureTraits: string[];
  discoveredTechs: string[];
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

export type WorldEventType =
  | 'founding'
  | 'era'
  | 'tech'
  | 'building'
  | 'war'
  | 'alliance'
  | 'trade'
  | 'religion'
  | 'plague'
  | 'famine'
  | 'disaster'
  | 'god_power'
  | 'schism'
  | 'collapse'
  | 'justice'
  | 'funeral'
  | 'succession'
  | 'coup'
  | 'exploration';

export interface WorldEventMarker {
  id: number;
  year: number;
  type: WorldEventType;
  title: string;
  description: string;
  x: number;
  y: number;
  z: number;
  civId?: number;
  colorHex?: string;
}

export type GodPowerTargetType = 'world' | 'terrain' | 'civ' | 'person';

export interface GodPowerDefinition {
  id: string;
  name: string;
  category: 'Blessing' | 'Miracle' | 'Disaster' | 'Intervention';
  targetType: GodPowerTargetType;
  description: string;
  defaultDurationYears: number;
  colorHex: string;
}

export const GOD_POWERS: GodPowerDefinition[] = [
  {
    id: 'divine_inspiration',
    name: 'Divine Inspiration',
    category: 'Blessing',
    targetType: 'terrain',
    description:
      'Grants an immediate breakthrough discovery and boosts scholarly invention speed.',
    defaultDurationYears: 15,
    colorHex: '#38BDF8',
  },
  {
    id: 'golden_age',
    name: 'Golden Age of Prosperity',
    category: 'Blessing',
    targetType: 'terrain',
    description:
      'Fills granaries, doubles construction speed, and elevates happiness to 100%.',
    defaultDurationYears: 20,
    colorHex: '#FBBF24',
  },
  {
    id: 'fertility_boom',
    name: 'Blessing of Fertility',
    category: 'Blessing',
    targetType: 'terrain',
    description:
      'Sparks a baby boom in the nearest settlement and increases population growth.',
    defaultDurationYears: 15,
    colorHex: '#34D399',
  },
  {
    id: 'gentle_rain',
    name: 'Gentle Monsoon Rain',
    category: 'Miracle',
    targetType: 'terrain',
    description:
      'Summons life-giving rain that extinguishes all fires and boosts crop harvests.',
    defaultDurationYears: 2,
    colorHex: '#60A5FA',
  },
  {
    id: 'super_intelligence',
    name: 'Crown of Genius',
    category: 'Miracle',
    targetType: 'terrain',
    description:
      'Blesses nearby citizens with 100 Intelligence and promotes them to Notable Scholars.',
    defaultDurationYears: -1,
    colorHex: '#A78BFA',
  },
  {
    id: 'titan_strength',
    name: 'Titan Endurance',
    category: 'Miracle',
    targetType: 'terrain',
    description:
      'Grants nearby workers 3x build/harvest speed and a 220-year lifespan.',
    defaultDurationYears: -1,
    colorHex: '#FB923C',
  },
  {
    id: 'bountiful_forest',
    name: 'Sacred Grove & Wildlife Sanctuary',
    category: 'Miracle',
    targetType: 'terrain',
    description:
      'Sprouts lush biome trees, fertile soil, rich ore veins, and wildlife herds.',
    defaultDurationYears: 0,
    colorHex: '#10B981',
  },
  {
    id: 'wildfire',
    name: 'Conflagration Wildfire',
    category: 'Disaster',
    targetType: 'terrain',
    description:
      'Ignites spreading flames across dry timber and roofs until quenched by rain or bucket brigades.',
    defaultDurationYears: 0,
    colorHex: '#EF4444',
  },
  {
    id: 'volcano',
    name: 'Volcanic Eruption',
    category: 'Disaster',
    targetType: 'terrain',
    description:
      'Raises a smoking volcanic cone that hurls magma blocks and scorches nearby land.',
    defaultDurationYears: 0,
    colorHex: '#DC2626',
  },
  {
    id: 'plague',
    name: 'Crimson Plague',
    category: 'Disaster',
    targetType: 'terrain',
    description:
      'Afflicts the target area with a contagious sickness that tests medical resilience.',
    defaultDurationYears: 10,
    colorHex: '#E11D48',
  },
  {
    id: 'famine',
    name: 'Locust Blight & Drought',
    category: 'Disaster',
    targetType: 'terrain',
    description:
      'Unleashes a locust swarm that withers farm plots and reduces local food stockpiles.',
    defaultDurationYears: 10,
    colorHex: '#D97706',
  },
  {
    id: 'sow_unrest',
    name: 'Spark Schism & Rebellion',
    category: 'Intervention',
    targetType: 'terrain',
    description:
      'Splits a settlement faction into a rival independent civilization.',
    defaultDurationYears: 0,
    colorHex: '#EC4899',
  },
  {
    id: 'flood',
    name: 'Deluge Flood',
    category: 'Disaster',
    targetType: 'terrain',
    description:
      'Inundates low-lying terrain with rising water blocks and washes away coastal paths.',
    defaultDurationYears: 0,
    colorHex: '#3B82F6',
  },
  {
    id: 'earthquake',
    name: 'Tectonic Earthquake & Landslide',
    category: 'Disaster',
    targetType: 'terrain',
    description:
      'Fractures the voxel terrain along a fault line and triggers cliff landslides.',
    defaultDurationYears: 0,
    colorHex: '#78716C',
  },
  {
    id: 'meteor',
    name: 'Starfall Meteor Strike',
    category: 'Disaster',
    targetType: 'terrain',
    description:
      'Hurls a blazing meteor that carves a voxel crater and leaves rare crystal & gold ore.',
    defaultDurationYears: 0,
    colorHex: '#F97316',
  },
];

export type MapOverlayMode =
  | 'none'
  | 'biomes'
  | 'territories'
  | 'fertility'
  | 'resources'
  | 'wealth'
  | 'crime'
  | 'happiness';

export type TerraformBrushId =
  | 'raise_land'
  | 'lower_land'
  | 'flatten_plain'
  | 'paint_fertile'
  | 'paint_forest'
  | 'paint_sand'
  | 'paint_snow'
  | 'paint_ore'
  | 'paint_road'
  | 'spawn_humans'
  | 'spawn_wildlife'
  | 'demolish_ruins';

export interface TerraformBrushDef {
  id: TerraformBrushId;
  name: string;
  category: 'Elevation' | 'Biome & Resources' | 'Life & Settlement';
  description: string;
  colorHex: string;
  defaultRadius: number;
}

export const TERRAFORM_BRUSHES: TerraformBrushDef[] = [
  {
    id: 'raise_land',
    name: 'Raise Terrain / Mountain',
    category: 'Elevation',
    description: 'Lifts seabed into coastal land, hills, or terraced alpine ridges.',
    colorHex: '#A8A29E',
    defaultRadius: 4,
  },
  {
    id: 'lower_land',
    name: 'Carve River / Sea Channel',
    category: 'Elevation',
    description: 'Lowers ground into navigable rivers, harbors, or deep sea trenches.',
    colorHex: '#38BDF8',
    defaultRadius: 3,
  },
  {
    id: 'flatten_plain',
    name: 'Level Building Plateau',
    category: 'Elevation',
    description: 'Grades uneven slopes into a smooth, walkable terrace for cities.',
    colorHex: '#84CC16',
    defaultRadius: 5,
  },
  {
    id: 'paint_fertile',
    name: 'Bless Fertile Loam & Meadow',
    category: 'Biome & Resources',
    description: 'Enriches soil fertility and sprouts wildflower meadows and berry bushes.',
    colorHex: '#22C55E',
    defaultRadius: 5,
  },
  {
    id: 'paint_forest',
    name: 'Plant Lush Timber Forest',
    category: 'Biome & Resources',
    description: 'Grows dense biome trees and woodland undergrowth for lumberjacks.',
    colorHex: '#15803D',
    defaultRadius: 5,
  },
  {
    id: 'paint_sand',
    name: 'Paint Warm Dunes & Beach',
    category: 'Biome & Resources',
    description: 'Transforms terrain into golden sand dunes, beaches, or desert oases.',
    colorHex: '#FBBF24',
    defaultRadius: 5,
  },
  {
    id: 'paint_snow',
    name: 'Freeze Permafrost & Snow',
    category: 'Biome & Resources',
    description: 'Coats the area in crisp winter snow and freezes shallow water into ice.',
    colorHex: '#E0F2FE',
    defaultRadius: 5,
  },
  {
    id: 'paint_ore',
    name: 'Seed Rich Ore & Crystal Veins',
    category: 'Biome & Resources',
    description: 'Deposits surface copper, iron, gold, and crystal ore outcrops.',
    colorHex: '#C084FC',
    defaultRadius: 3,
  },
  {
    id: 'paint_road',
    name: 'Pave Trade Road & Bridges',
    category: 'Life & Settlement',
    description: 'Lays high-speed stone roads on land and timber/stone bridges over water.',
    colorHex: '#D6D3D1',
    defaultRadius: 2,
  },
  {
    id: 'spawn_humans',
    name: 'Spawn Settlers / New Tribe',
    category: 'Life & Settlement',
    description: 'Spawns pioneer citizens who join the nearest civ or found a new settlement.',
    colorHex: '#F59E0B',
    defaultRadius: 2,
  },
  {
    id: 'spawn_wildlife',
    name: 'Spawn Biome Wildlife Herd',
    category: 'Life & Settlement',
    description: 'Populates the area with grazing deer, horses, boars, wolves, or fish schools.',
    colorHex: '#34D399',
    defaultRadius: 3,
  },
  {
    id: 'demolish_ruins',
    name: 'Clear Structures & Rubble',
    category: 'Life & Settlement',
    description: 'Clears buildings or ruins in the brush radius and restores natural ground.',
    colorHex: '#EF4444',
    defaultRadius: 3,
  },
];

export interface CivTraitModifierDef {
  id: string;
  name: string;
  description: string;
  foodMult: number;
  woodMult: number;
  stoneOreMult: number;
  techSpeedMult: number;
  navalSpeedMult: number;
  combatMoraleBonus: number;
  tradeIncomeMult: number;
}

export const CIV_TRAIT_MODIFIERS: Record<string, CivTraitModifierDef> = {
  Agrarian: {
    id: 'Agrarian',
    name: 'Agrarian Sun-Tillers',
    description: '+35% crop & orchard yields, faster granary construction.',
    foodMult: 1.35,
    woodMult: 1.0,
    stoneOreMult: 1.0,
    techSpeedMult: 1.0,
    navalSpeedMult: 1.0,
    combatMoraleBonus: 0,
    tradeIncomeMult: 1.05,
  },
  Seafaring: {
    id: 'Seafaring',
    name: 'Seafaring Wayfinders',
    description: '+40% ship speed, +30% fishing harvest, early coastal docks & overseas colonies.',
    foodMult: 1.2,
    woodMult: 1.1,
    stoneOreMult: 1.0,
    techSpeedMult: 1.05,
    navalSpeedMult: 1.4,
    combatMoraleBonus: 5,
    tradeIncomeMult: 1.25,
  },
  Industrious: {
    id: 'Industrious',
    name: 'Master Stone & Forge Guilds',
    description: '+35% mining & quarry output, superior tool quality and masonry speed.',
    foodMult: 1.0,
    woodMult: 1.15,
    stoneOreMult: 1.35,
    techSpeedMult: 1.1,
    navalSpeedMult: 1.0,
    combatMoraleBonus: 5,
    tradeIncomeMult: 1.1,
  },
  Scholarly: {
    id: 'Scholarly',
    name: 'Order of the Illuminated Codex',
    description: '+40% scientific discovery rate, early academies and observatories.',
    foodMult: 1.0,
    woodMult: 1.0,
    stoneOreMult: 1.0,
    techSpeedMult: 1.4,
    navalSpeedMult: 1.05,
    combatMoraleBonus: 0,
    tradeIncomeMult: 1.15,
  },
  Martial: {
    id: 'Martial',
    name: 'Iron Vanguard Discipline',
    description: '+20 army morale, disciplined shield walls, faster barracks & fortifications.',
    foodMult: 1.0,
    woodMult: 1.0,
    stoneOreMult: 1.15,
    techSpeedMult: 0.95,
    navalSpeedMult: 1.05,
    combatMoraleBonus: 20,
    tradeIncomeMult: 0.95,
  },
  Mercantile: {
    id: 'Mercantile',
    name: 'Golden Caravan League',
    description: '+45% trade route revenue, wealthier markets, and diplomatic treaties.',
    foodMult: 1.05,
    woodMult: 1.05,
    stoneOreMult: 1.05,
    techSpeedMult: 1.1,
    navalSpeedMult: 1.2,
    combatMoraleBonus: 0,
    tradeIncomeMult: 1.45,
  },
};

export type VehicleType =
  | 'LogRaft'
  | 'DugoutCanoe'
  | 'Sailboat'
  | 'Longship'
  | 'Galley'
  | 'CaravelShip'
  | 'Steamship'
  | 'HandCart'
  | 'OxCart'
  | 'HorseCarriage'
  | 'SteamCar';

export interface VehicleMarker3D {
  id: number;
  type: VehicleType;
  civId: number;
  colorHex: string;
  secondaryHex?: string;
  x: number;
  y: number;
  z: number;
  facing: number;
  speed: number;
  targetX: number;
  targetZ: number;
  animPhase: number;
  isWater?: boolean;
  eraIndex?: number;
  crewCount?: number;
  cargoSummary?: string;
  routeSummary?: string;
  mission?: 'Trade' | 'Fishing' | 'Exploration' | 'Colony' | 'NavalPatrol' | 'Shipwreck';
}

export interface WorldHistorySnapshot {
  id: string;
  year: number;
  dayOfYear: number;
  eraSummary: string;
  population: number;
  citiesCount: number;
  structuresCount: number;
  headline: string;
  timestamp: number;
  serializedState: string;
}

export interface SimTelemetrySnapshot {
  worldGenVersion: number;
  worldId: string;
  worldName: string;
  seed: string;
  year: number;
  dayOfYear: number;
  timeOfDay: number;
  season: SeasonType;
  weather: WeatherType;
  windDirX: number;
  windDirZ: number;
  speedMultiplier: number;
  isPaused: boolean;
  stageMode: SimStageMode;
  cameraWorldX: number;
  cameraWorldZ: number;
  loadedChunksCount: number;
  persistedDeltaChunksCount: number;
  persistedDeltaBlocksCount: number;
  microCivsCount: number;
  macroCivsCount: number;
  lastStepMs: number;
  spatialHashMs: number;
  agentSimMs: number;
  cityMacroMs: number;
  timeBudgetMs: number;
  budgetDegraded: boolean;
  totalPopulation: number;
  microAgentsCount: number;
  farAgentsCount: number;
  notableAgentsCount: number;
  totalStructures: number;
  stuckRecoveriesCount: number;
  watchdogRevivalsCount: number;
  stalledBuildsFixedCount: number;
  agentsInsideSolidBlocksCount: number;
  crowdingReassignmentsCount: number;
  activeWorkstationReservations: number;
  maxCellAgentDensity: number;
  prunedDeadCitiesCount: number;
  activeFiresCount: number;
  // Part A Structural & Infinite World Diagnostics
  totalDecayedLeavesCount: number;
  totalCollapsedBlocksCount: number;
  floatingBlocksRemainingCount: number;
  // Part B Society & Role Census
  societyCensus: SocietyCensusSnapshot;
  // Part D Active Wars & Battle Formations
  activeWars: ActiveWarSummary[];
  battleGroups: BattleUnitGroup[];
  fallingParticles: FallingVoxelParticle[];
  vehicles: VehicleMarker3D[];
  animals: AnimalMarker3D[];
  blockedNavTiles?: [number, number, number][]; // [wx, wz, isDoorway(0=wall,1=door)]
  civilizations: CivilizationSummary[];
  cities: CitySummary[];
  structures: StructureMarker3D[];
  events: WorldEventMarker[];
  historySnapshots: WorldHistorySnapshot[];
  selectedAgent?: AgentSummary | null;
  notableHallOfFame: AgentSummary[];
  settings: WorldSettings;
}

export interface SavedWorldRecord {
  id: string;
  name: string;
  seed: string;
  worldGenVersion?: number;
  createdAt: number;
  updatedAt: number;
  year: number;
  population: number;
  civCount: number;
  eraSummary: string;
  settings: WorldSettings;
  serializedState: string;
}

/**
 * Data-Driven Seeded Procedural Generators (Parts B & C)
 * 1. Composable Role Generator (1,500+ distinct roles across 15 domains, specialties, ranks & eras)
 * 2. Grammar & Module Procedural Building Generator with 3D Structural & Pathing Validator + Seed Cache
 * 3. Parametric Items, Tools & Weapons Generator (Stone/Bone -> Copper -> Bronze -> Iron -> Steel -> Mythril)
 * 4. Modular Clothing, Regalia & Genetic Appearance Generator
 */

import { hashStringToSeed, SeededPRNG } from './prng';
import {
   AgentJob,
  ERA_ORDER,
  EraType,
  GeneratedClothingSpec,
  GeneratedItemSpec,
  GeneratedRoleDef,
  MaterialTier,
  ProceduralBuildingSpec,
  SocialClass,
  StructureCategory,
  ToolArchetype,
  VoxelPlacementStep,
  VoxelType,
} from './types';

// ============================================================================
// 1. DATA-DRIVEN PROCEDURAL ROLE GENERATOR (1,500+ ROLES)
// ============================================================================

interface RoleDomainTemplate {
  domain: string;
  baseJob: AgentJob;
  workplace: StructureCategory;
  defaultClass: SocialClass;
  specialties: {
    name: string;
    minEra: number;
    tool: ToolArchetype;
    product: string;
    classOverride?: SocialClass;
  }[];
}

const ROLE_DOMAINS: RoleDomainTemplate[] = [
  {
    domain: 'Foraging & Gathering',
    baseJob: 'Forager',
    workplace: 'Food',
    defaultClass: 'Peasant',
    specialties: [
      { name: 'Root & Berry Gatherer', minEra: 0, tool: 'Hoe', product: 'Wild Berries' },
      { name: 'Mushroom & Herb Forager', minEra: 0, tool: 'Hoe', product: 'Medicinal Herbs' },
      { name: 'Orchard & Wild Grain Gatherer', minEra: 0, tool: 'Scythe', product: 'Wild Seeds & Fruit' },
      { name: 'Reed & Marsh Basket Gatherer', minEra: 0, tool: 'Chisel', product: 'Woven Reeds' },
    ],
  },
  {
    domain: 'Wild Game Hunting & Trapping',
    baseJob: 'Hunter',
    workplace: 'Food',
    defaultClass: 'Peasant',
    specialties: [
      { name: 'Stalker & Flint Spear Hunter', minEra: 0, tool: 'Spear', product: 'Venison & Rawhide' },
      { name: 'Snare & Deadfall Trapper', minEra: 0, tool: 'HuntingTrap', product: 'Rabbit Pelts & Meat' },
      { name: 'Boar & Megafauna Tracker', minEra: 0, tool: 'Spear', product: 'Tusk Ivory & Meat' },
      { name: 'Composite Bow Huntsman', minEra: 1, tool: 'Bow', product: 'Prime Game & Antlers' },
      { name: 'Wolf & Bear Warden', minEra: 2, tool: 'Spear', product: 'Thick Furs' },
      { name: 'Falconer & Royal Huntsman', minEra: 3, tool: 'Bow', product: 'Courtly Venison', classOverride: 'Craftsperson' },
    ],
  },
  {
    domain: 'Coastal & Riverine Fishing',
    baseJob: 'Fisher',
    workplace: 'Waterfront',
    defaultClass: 'Peasant',
    specialties: [
      { name: 'Tidal Weir & Spear Fisher', minEra: 0, tool: 'Spear', product: 'Shoreline Fish' },
      { name: 'Riverbank Line Angler', minEra: 0, tool: 'FishingRod', product: 'Freshwater Trout' },
      { name: 'Crab Pot & Shellfish Gatherer', minEra: 1, tool: 'FishingNet', product: 'Crabs & Oysters' },
      { name: 'Cast-Net & Pier Fisher', minEra: 1, tool: 'FishingNet', product: 'Smoked Herring' },
      { name: 'Deep Lagoon Trawler', minEra: 2, tool: 'FishingNet', product: 'Salted Cod & Oil', classOverride: 'Craftsperson' },
    ],
  },
  {
    domain: 'Seafaring & Maritime Navigation',
    baseJob: 'Sailor',
    workplace: 'Waterfront',
    defaultClass: 'Craftsperson',
    specialties: [
      { name: 'Dugout Canoe Paddler', minEra: 1, tool: 'Spear', product: 'River Ferrying', classOverride: 'Peasant' },
      { name: 'Coastal Sailboat Helmsman', minEra: 2, tool: 'FishingNet', product: 'Coastal Trade' },
      { name: 'Galley Oarsman & Pilot', minEra: 2, tool: 'Sword', product: 'Sea Patrols' },
      { name: 'Oceanic Caravel Navigator', minEra: 4, tool: 'Scroll', product: 'Charted Islands', classOverride: 'Merchant' },
      { name: 'Steamship & Clipper Captain', minEra: 5, tool: 'Scroll', product: 'Global Trade Routes', classOverride: 'Merchant' },
    ],
  },
  {
    domain: 'Agriculture & Husbandry',
    baseJob: 'Farmer',
    workplace: 'Food',
    defaultClass: 'Peasant',
    specialties: [
      { name: 'Barley & Einkorn Tiller', minEra: 1, tool: 'Hoe', product: 'Barley Grain' },
      { name: 'Wheat Field Reaper', minEra: 1, tool: 'Scythe', product: 'Wheat Sheaves' },
      { name: 'Orchard Pruner & Vintner', minEra: 1, tool: 'Scythe', product: 'Orchard Fruit' },
      { name: 'Shepherd & Wool Herder', minEra: 1, tool: 'Staff', product: 'Fleece & Mutton' },
      { name: 'Cattle Drover & Dairyman', minEra: 1, tool: 'Staff', product: 'Milk & Cheese' },
      { name: 'Irrigation Ditch Warden', minEra: 2, tool: 'Hoe', product: 'Irrigated Plots' },
      { name: 'Apiarist & Beekeeper', minEra: 2, tool: 'Crate', product: 'Honey & Wax' },
      { name: 'Stablehand & Horse Breeder', minEra: 3, tool: 'Scythe', product: 'Warhorses', classOverride: 'Craftsperson' },
      { name: 'Agronomist & Crop Breeder', minEra: 5, tool: 'Scroll', product: 'Hybrid Seeds', classOverride: 'Craftsperson' },
    ],
  },
  {
    domain: 'Forestry & Timbercraft',
    baseJob: 'Lumberjack',
    workplace: 'Industry',
    defaultClass: 'Peasant',
    specialties: [
      { name: 'Deadwood Gatherer', minEra: 0, tool: 'Axe', product: 'Firewood' },
      { name: 'Oak Feller', minEra: 0, tool: 'Axe', product: 'Hardwood Logs' },
      { name: 'Pine & Resin Forester', minEra: 1, tool: 'Axe', product: 'Pine Timber & Pitch' },
      { name: 'Charcoal Burner', minEra: 2, tool: 'Hoe', product: 'Smelting Charcoal' },
      { name: 'Sawyer & Plank Splitter', minEra: 2, tool: 'Axe', product: 'Seasoned Planks', classOverride: 'Craftsperson' },
      { name: 'Cooper & Barrel Wright', minEra: 3, tool: 'Hammer', product: 'Oak Casks', classOverride: 'Craftsperson' },
      { name: 'Bowyer & Fletcher', minEra: 2, tool: 'Chisel', product: 'Yew Longbows', classOverride: 'Craftsperson' },
    ],
  },
  {
    domain: 'Mining & Quarrying',
    baseJob: 'Miner',
    workplace: 'Industry',
    defaultClass: 'Peasant',
    specialties: [
      { name: 'Flint Knapper & Delver', minEra: 0, tool: 'Pickaxe', product: 'Flint Cores' },
      { name: 'Clay Pit Digger', minEra: 1, tool: 'Hoe', product: 'River Clay' },
      { name: 'Limestone Quarryman', minEra: 2, tool: 'Pickaxe', product: 'Cut Limestone' },
      { name: 'Copper Seam Prospector', minEra: 2, tool: 'Pickaxe', product: 'Malachite Ore' },
      { name: 'Tin & Bronze Delver', minEra: 2, tool: 'Pickaxe', product: 'Cassiterite Ore' },
      { name: 'Deep Iron Shaft Miner', minEra: 3, tool: 'Pickaxe', product: 'Hematite Ore' },
      { name: 'Coal Pit Collier', minEra: 3, tool: 'Pickaxe', product: 'Bituminous Coal' },
      { name: 'Marble Cutter', minEra: 4, tool: 'Chisel', product: 'Polished Marble', classOverride: 'Craftsperson' },
      { name: 'Gold & Crystal Vein Delver', minEra: 4, tool: 'Pickaxe', product: 'Auric & Aether Ore', classOverride: 'Craftsperson' },
    ],
  },
  {
    domain: 'Architecture & Masonry',
    baseJob: 'Builder',
    workplace: 'Civic',
    defaultClass: 'Craftsperson',
    specialties: [
      { name: 'Wattle & Daub Erector', minEra: 0, tool: 'Hammer', product: 'Mud Walls', classOverride: 'Peasant' },
      { name: 'Thatcher & Reed Weaver', minEra: 1, tool: 'Scythe', product: 'Thatched Roofs' },
      { name: 'Timber Frame Carpenter', minEra: 1, tool: 'Hammer', product: 'Joined Beams' },
      { name: 'Mudbrick Layer', minEra: 2, tool: 'Chisel', product: 'Adobe Coursework' },
      { name: 'Freemason & Archwright', minEra: 3, tool: 'Hammer', product: 'Vaulted Stonework' },
      { name: 'Slate & Terracotta Tiler', minEra: 3, tool: 'Hammer', product: 'Tiled Roofs' },
      { name: 'Pavior & Bridge Engineer', minEra: 3, tool: 'Pickaxe', product: 'Cobbled Viaducts' },
      { name: 'Cathedral Master Builder', minEra: 4, tool: 'Scroll', product: 'Grand Sanctuaries', classOverride: 'Noble' },
    ],
  },
  {
    domain: 'Metallurgy & Smithing',
    baseJob: 'Artisan',
    workplace: 'Industry',
    defaultClass: 'Craftsperson',
    specialties: [
      { name: 'Stone & Bone Toolmaker', minEra: 0, tool: 'Hammer', product: 'Bone Awls & Axes' },
      { name: 'Copper Smelter', minEra: 2, tool: 'AnvilTongs', product: 'Copper Ingots' },
      { name: 'Bronze Founder & Caster', minEra: 2, tool: 'AnvilTongs', product: 'Bronze Tools' },
      { name: 'Iron Bloomery Blacksmith', minEra: 3, tool: 'Hammer', product: 'Wrought Iron Gear' },
      { name: 'Bladesmith & Weaponsmith', minEra: 3, tool: 'Hammer', product: 'Tempered Blades' },
      { name: 'Armorer & Mailmaker', minEra: 4, tool: 'Hammer', product: 'Plate & Chainmail' },
      { name: 'Locksmith & Bellfounder', minEra: 4, tool: 'Chisel', product: 'Precision Locks & Bells' },
      { name: 'Goldsmith & Royal Jeweler', minEra: 4, tool: 'Chisel', product: 'Crowns & Regalia', classOverride: 'Merchant' },
    ],
  },
  {
    domain: 'Textiles, Pottery & Crafts',
    baseJob: 'Artisan',
    workplace: 'Industry',
    defaultClass: 'Craftsperson',
    specialties: [
      { name: 'Hide Tanner & Currier', minEra: 0, tool: 'Chisel', product: 'Supple Leather' },
      { name: 'Earthenware Potter', minEra: 1, tool: 'Chisel', product: 'Storage Amphorae' },
      { name: 'Flax Spinner & Linen Weaver', minEra: 1, tool: 'LoomShuttle', product: 'Linen Tunics' },
      { name: 'Wool Fuller & Dyer', minEra: 2, tool: 'LoomShuttle', product: 'Dyed Broadcloth' },
      { name: 'Cobbler & Bootmaker', minEra: 2, tool: 'Hammer', product: 'Sturdy Boots' },
      { name: 'Glassblower & Glazier', minEra: 4, tool: 'AnvilTongs', product: 'Stained Glass Windows' },
      { name: 'Master Tailor & Tapestry Weaver', minEra: 4, tool: 'LoomShuttle', product: 'Courtly Robes' },
      { name: 'Clockmaker & Lens Grinder', minEra: 5, tool: 'Chisel', product: 'Chronometers & Optics', classOverride: 'Merchant' },
    ],
  },
  {
    domain: 'Culinary, Milling & Brewing',
    baseJob: 'Artisan',
    workplace: 'Food',
    defaultClass: 'Craftsperson',
    specialties: [
      { name: 'Campfire Roast Tender', minEra: 0, tool: 'Spear', product: 'Roasted Rations', classOverride: 'Peasant' },
      { name: 'Quern & Windmill Miller', minEra: 1, tool: 'Crate', product: 'Milled Flour' },
      { name: 'Hearth Baker', minEra: 1, tool: 'Crate', product: 'Sourdough Loaves' },
      { name: 'Butcher & Salter', minEra: 2, tool: 'Axe', product: 'Cured Provisions' },
      { name: 'Mead & Ale Brewer', minEra: 2, tool: 'Crate', product: 'Barley Ale' },
      { name: 'Tavern Innkeeper', minEra: 3, tool: 'Crate', product: 'Hospitality & Feasts', classOverride: 'Merchant' },
      { name: 'Royal Banquet Chef', minEra: 4, tool: 'Chisel', product: 'Courtly Feasts', classOverride: 'Merchant' },
    ],
  },
  {
    domain: 'Commerce, Banking & Logistics',
    baseJob: 'Trader',
    workplace: 'Trade',
    defaultClass: 'Merchant',
    specialties: [
      { name: 'Tribal Barter Runner', minEra: 1, tool: 'Crate', product: 'Bartered Goods', classOverride: 'Peasant' },
      { name: 'Market Stall Peddler', minEra: 2, tool: 'Crate', product: 'Retail Wares' },
      { name: 'Pack-Mule Caravan Driver', minEra: 2, tool: 'Staff', product: 'Overland Freight' },
      { name: 'Maritime Dock Factor', minEra: 4, tool: 'Scroll', product: 'Naval Cargo' },
      { name: 'Spice & Silk Importer', minEra: 4, tool: 'Crate', product: 'Luxury Imports' },
      { name: 'Guild Master & Assayer', minEra: 4, tool: 'Scroll', product: 'Trade Charters', classOverride: 'Noble' },
      { name: 'Exchequer & Coin Minter', minEra: 4, tool: 'Hammer', product: 'Minted Currency', classOverride: 'Noble' },
    ],
  },
  {
    domain: 'Medicine, Care & Education',
    baseJob: 'Scholar',
    workplace: 'Civic',
    defaultClass: 'Craftsperson',
    specialties: [
      { name: 'Tribal Bone-Setter & Midwife', minEra: 0, tool: 'Staff', product: 'Births & Poultices' },
      { name: 'Herbalist & Apothecary', minEra: 2, tool: 'Scroll', product: 'Healing Tonics' },
      { name: 'Village Schoolmaster', minEra: 3, tool: 'Scroll', product: 'Literate Youth' },
      { name: 'Barber-Surgeon', minEra: 3, tool: 'Chisel', product: 'Wound Treatment' },
      { name: 'Plague Physician', minEra: 4, tool: 'Staff', product: 'Quarantine Care', classOverride: 'Merchant' },
      { name: 'University Professor', minEra: 5, tool: 'Scroll', product: 'Treatises & Degrees', classOverride: 'Noble' },
    ],
  },
  {
    domain: 'Scholarship, Science & Arcane',
    baseJob: 'Scholar',
    workplace: 'Civic',
    defaultClass: 'Clergy',
    specialties: [
      { name: 'Oral Lorekeeper & Storyteller', minEra: 0, tool: 'Staff', product: 'Tribal Chronicles' },
      { name: 'Clay Tablet Scribe', minEra: 2, tool: 'Chisel', product: 'Ledger Tablets' },
      { name: 'Cartographer & Surveyor', minEra: 3, tool: 'Scroll', product: 'World Maps' },
      { name: 'Illuminator & Chronicler', minEra: 4, tool: 'Scroll', product: 'Codex Histories' },
      { name: 'Astronomer & Navigator', minEra: 5, tool: 'Staff', product: 'Star Charts', classOverride: 'Noble' },
      { name: 'Alchemist & Natural Philosopher', minEra: 5, tool: 'Scroll', product: 'Blackpowder & Elixirs', classOverride: 'Noble' },
      { name: 'Crystal Resonator Savant', minEra: 5, tool: 'Staff', product: 'Aether Matrices', classOverride: 'Noble' },
    ],
  },
  {
    domain: 'Religion & Spiritual Rites',
    baseJob: 'Priest',
    workplace: 'Spiritual',
    defaultClass: 'Clergy',
    specialties: [
      { name: 'Animist Shaman', minEra: 0, tool: 'Staff', product: 'Ancestral Blessings' },
      { name: 'Megalith Druid & Augur', minEra: 1, tool: 'Staff', product: 'Solstice Rites' },
      { name: 'Ziggurat Temple Priest', minEra: 2, tool: 'Staff', product: 'Sacred Offerings' },
      { name: 'Funerary Prelate & Gravekeeper', minEra: 2, tool: 'Hoe', product: 'Consecrated Burials' },
      { name: 'Monastic Scribe & Abbot', minEra: 4, tool: 'Scroll', product: 'Sacred Manuscripts' },
      { name: 'High Pontiff & Cardinal', minEra: 4, tool: 'Scepter', product: 'Synod Decrees', classOverride: 'Noble' },
    ],
  },
  {
    domain: 'Law, Watch & Military',
    baseJob: 'Soldier',
    workplace: 'Military',
    defaultClass: 'Craftsperson',
    specialties: [
      { name: 'Tribal Club & Spear Braves', minEra: 0, tool: 'Spear', product: 'Camp Defense', classOverride: 'Peasant' },
      { name: 'Palisade Bowman', minEra: 2, tool: 'Bow', product: 'Ranged Overwatch' },
      { name: 'Bronze Shield Phalangite', minEra: 2, tool: 'Spear', product: 'Phalanx Line' },
      { name: 'City Watch Constable', minEra: 3, tool: 'Spear', product: 'Public Order & Arrests' },
      { name: 'Prisoner Warden & Bailiff', minEra: 3, tool: 'Sword', product: 'Dungeon Custody' },
      { name: 'Heavy Iron Legionary', minEra: 3, tool: 'Sword', product: 'Shield Wall' },
      { name: 'Lancer Cavalryman', minEra: 4, tool: 'Spear', product: 'Flanking Charge', classOverride: 'Noble' },
      { name: 'Siege Sappers & Trebuchet Crew', minEra: 4, tool: 'Hammer', product: 'Wall Breaches' },
      { name: 'Arquebusier & Musketeer', minEra: 5, tool: 'Musket', product: 'Volley Fire' },
      { name: 'Lord Marshal & Strategos', minEra: 4, tool: 'Sword', product: 'Battle Command', classOverride: 'Noble' },
    ],
  },
  {
    domain: 'Exploration & Frontier',
    baseJob: 'Explorer',
    workplace: 'Infrastructure',
    defaultClass: 'Peasant',
    specialties: [
      { name: 'Ridge Pathfinder', minEra: 0, tool: 'Staff', product: 'Scouted Passes' },
      { name: 'River Ford Pioneer', minEra: 1, tool: 'Axe', product: 'River Crossings' },
      { name: 'Outpost Settler & Vanguard', minEra: 2, tool: 'Pickaxe', product: 'New Colonies' },
      { name: 'Maritime Clipper Navigator', minEra: 4, tool: 'Scroll', product: 'Sea Routes', classOverride: 'Merchant' },
    ],
  },
  {
    domain: 'Governance, Court & Nobility',
    baseJob: 'Ruler',
    workplace: 'Civic',
    defaultClass: 'Noble',
    specialties: [
      { name: 'Clan Elder & Arbiter', minEra: 0, tool: 'Staff', product: 'Customary Law' },
      { name: 'Tribal Chieftain', minEra: 1, tool: 'Spear', product: 'Tribal Command', classOverride: 'Ruler' },
      { name: 'Tax Collector & Reeve', minEra: 2, tool: 'Scroll', product: 'Tax Revenue' },
      { name: 'Magistrate & Royal Judge', minEra: 3, tool: 'Scroll', product: 'Court Verdicts' },
      { name: 'Provincial Governor', minEra: 3, tool: 'Scepter', product: 'City Administration' },
      { name: 'Chancellor & Envoy', minEra: 4, tool: 'Scroll', product: 'Treaties & Alliances' },
      { name: 'Sovereign Monarch / Archon', minEra: 2, tool: 'Scepter', product: 'Royal Edicts', classOverride: 'Ruler' },
    ],
  },
];

const ROLE_RANKS = [
  { prefix: 'Novice', wageMult: 0.7, minEraOffset: 0 },
  { prefix: 'Apprentice', wageMult: 0.85, minEraOffset: 0 },
  { prefix: 'Journeyman', wageMult: 1.0, minEraOffset: 0 },
  { prefix: 'Sworn', wageMult: 1.15, minEraOffset: 0 },
  { prefix: 'Senior', wageMult: 1.3, minEraOffset: 1 },
  { prefix: 'Guild', wageMult: 1.45, minEraOffset: 2 },
  { prefix: 'Master', wageMult: 1.75, minEraOffset: 1 },
  { prefix: 'High', wageMult: 2.0, minEraOffset: 2 },
  { prefix: 'Grandmaster', wageMult: 2.35, minEraOffset: 3 },
  { prefix: 'Royal', wageMult: 2.7, minEraOffset: 2 },
];

const REGIONAL_QUALIFIERS = [
  'Highland',
  'Riverine',
  'Coastal',
  'Lowland',
  'Hearth',
  'Citadel',
  'Frontier',
  'Imperial',
  'Chartered',
  'Sovereign',
];

let _cachedRoleCatalog: GeneratedRoleDef[] | null = null;

/**
 * Deterministically builds the full catalog of 1,500+ roles from composable domain, specialty,
 * rank, and regional/guild templates.
 */
export function getProceduralRoleCatalog(): GeneratedRoleDef[] {
  if (_cachedRoleCatalog) return _cachedRoleCatalog;
  const catalog: GeneratedRoleDef[] = [];

  for (const dom of ROLE_DOMAINS) {
    for (const spec of dom.specialties) {
      for (let rIdx = 0; rIdx < ROLE_RANKS.length; rIdx++) {
        const rank = ROLE_RANKS[rIdx];
        const eraIdx = Math.min(5, spec.minEra + (rank.minEraOffset > 1 ? 1 : 0));
        for (let qIdx = 0; qIdx < 2; qIdx++) {
          const qual = qIdx === 0 ? '' : `${REGIONAL_QUALIFIERS[(rIdx + qIdx) % REGIONAL_QUALIFIERS.length]} `;
          const title = `${rank.prefix} ${qual}${spec.name}`;
          const id = `${dom.baseJob}:${spec.name}:${rank.prefix}:${qIdx}`
            .toLowerCase()
            .replace(/[^a-z0-9:]+/g, '_');

          catalog.push({
            id,
            title,
            domain: dom.domain,
            specialty: spec.name,
            rank: rank.prefix,
            baseJob: dom.baseJob,
            socialClass: spec.classOverride || dom.defaultClass,
            eraIndex: eraIdx,
            toolArchetype: spec.tool,
            workplaceCategory: dom.workplace,
            product: spec.product,
            baseWage: Math.round((4 + eraIdx * 3) * rank.wageMult),
          });
        }
      }
    }
  }

  _cachedRoleCatalog = catalog;
  return catalog;
}

/**
 * Picks a contextually appropriate role for an agent based on their eraIndex, baseJob, socialClass/age, and PRNG
 */
export function pickContextualRole(
  arg1: number | AgentJob,
  arg2: AgentJob | number,
  arg3: SocialClass | number,
  prng: SeededPRNG
): GeneratedRoleDef {
  const eraIndex = typeof arg1 === 'number' ? arg1 : (arg2 as number);
  const baseJob = (typeof arg1 === 'string' ? arg1 : arg2) as AgentJob;
  const socialClass = typeof arg3 === 'string' ? arg3 : undefined;
  const age = typeof arg3 === 'number' ? arg3 : 28;

  const catalog = getProceduralRoleCatalog();
  const desiredRank =
    age < 16
      ? 'Apprentice'
      : age < 22
      ? 'Journeyman'
      : age > 52
      ? 'Master'
      : undefined;

  const candidates = catalog.filter(
    (r) =>
      r.baseJob === baseJob &&
      r.eraIndex <= eraIndex &&
      (!socialClass || r.socialClass === socialClass || r.baseJob === baseJob) &&
      (!desiredRank || r.rank === desiredRank || r.rank === 'Guild')
  );

  if (candidates.length > 0) {
    return prng.pick(candidates);
  }
  const fallback = catalog.filter((r) => r.baseJob === baseJob && r.eraIndex <= eraIndex);
  return fallback.length > 0 ? prng.pick(fallback) : catalog[0];
}

// ============================================================================
// 2. PARAMETRIC ITEMS, TOOLS & WEAPONS GENERATOR (PART C - ITEM 11)
// ============================================================================

const MATERIAL_TIERS: {
  tier: MaterialTier;
  minEra: number;
  speedMult: number;
  durability: number;
  headHex: string;
  handleHex: string;
  trimHex: string;
}[] = [
  {
    tier: 'Stone & Bone',
    minEra: 0,
    speedMult: 1.0,
    durability: 45,
    headHex: '#78716C',
    handleHex: '#78350F',
    trimHex: '#D6D3D1',
  },
  {
    tier: 'Copper',
    minEra: 1,
    speedMult: 1.32,
    durability: 70,
    headHex: '#EA580C',
    handleHex: '#92400E',
    trimHex: '#FDBA74',
  },
  {
    tier: 'Bronze',
    minEra: 2,
    speedMult: 1.68,
    durability: 110,
    headHex: '#D97706',
    handleHex: '#78350F',
    trimHex: '#FDE047',
  },
  {
    tier: 'Iron',
    minEra: 3,
    speedMult: 2.05,
    durability: 160,
    headHex: '#94A3B8',
    handleHex: '#451A03',
    trimHex: '#CBD5E1',
  },
  {
    tier: 'Steel',
    minEra: 4,
    speedMult: 2.5,
    durability: 230,
    headHex: '#E2E8F0',
    handleHex: '#3B2618',
    trimHex: '#FBBF24',
  },
  {
    tier: 'Gilded Mythril',
    minEra: 5,
    speedMult: 3.1,
    durability: 350,
    headHex: '#38BDF8',
    handleHex: '#1E293B',
    trimHex: '#FDE047',
  },
];

const QUALITY_ADJECTIVES = [
  'Crude',
  'Sturdy',
  'Well-Balanced',
  'Fine Guild',
  'Masterwork',
  'Legendary',
];

const JOB_TO_DEFAULT_TOOL: Record<AgentJob, ToolArchetype> = {
  Forager: 'Hoe',
  Hunter: 'Spear',
  Fisher: 'FishingRod',
  Sailor: 'FishingNet',
  Lumberjack: 'Axe',
  Miner: 'Pickaxe',
  Farmer: 'Scythe',
  Builder: 'Hammer',
  Artisan: 'AnvilTongs',
  Trader: 'Crate',
  Soldier: 'Sword',
  Scholar: 'Scroll',
  Priest: 'Staff',
  Explorer: 'Spear',
  Ruler: 'Scepter',
};

const _itemCache = new Map<string, GeneratedItemSpec>();

export function generateProceduralItem(
  arg1: number | ToolArchetype,
  arg2: AgentJob | string | number,
  arg3: number | string,
  arg4?: string | number
): GeneratedItemSpec {
  let archetype: ToolArchetype = 'Hammer';
  let eraIndex = 0;
  let wealthTier = 2;
  let seedKey: string | number = 1;

  if (typeof arg1 === 'number' && typeof arg2 === 'string') {
    // Called as (eraIndex, job, seedKey) or (seed, eraStr, category, quality)
    if (ERA_ORDER.includes(arg2 as EraType) || String(arg2).includes('Age')) {
      seedKey = arg1;
      const foundEra = ERA_ORDER.findIndex((e) => e.includes(String(arg2).split(' ')[0]));
      eraIndex = foundEra >= 0 ? foundEra : 3;
      archetype = String(arg3) === 'Weapon' ? 'Sword' : 'Hammer';
      wealthTier = typeof arg4 === 'number' ? Math.round(arg4 * 5) : 3;
    } else {
      eraIndex = arg1;
      archetype = JOB_TO_DEFAULT_TOOL[arg2 as AgentJob] || 'Hammer';
      seedKey = arg3;
    }
  } else {
    archetype = (arg1 as ToolArchetype) || 'Hammer';
    eraIndex = typeof arg2 === 'number' ? arg2 : 0;
    wealthTier = typeof arg3 === 'number' ? arg3 : 2;
    seedKey = arg4 ?? arg3;
  }

  const cacheKey = `${archetype}:${eraIndex}:${wealthTier}:${seedKey}`;
  const existing = _itemCache.get(cacheKey);
  if (existing) return existing;

  const prng = new SeededPRNG(hashStringToSeed(cacheKey));
  const matIdx = Math.min(MATERIAL_TIERS.length - 1, Math.max(0, eraIndex));
  const mat = MATERIAL_TIERS[matIdx];

  const quality = Math.min(
    100,
    Math.max(15, Math.round(35 + eraIndex * 8 + wealthTier * 10 + prng.range(-10, 15)))
  );
  const qTier = Math.min(
    QUALITY_ADJECTIVES.length - 1,
    Math.floor((quality / 100) * QUALITY_ADJECTIVES.length)
  );
  const adj = QUALITY_ADJECTIVES[qTier];

  const speedMultiplier = Number(
    (mat.speedMult * (0.85 + (quality / 100) * 0.45)).toFixed(2)
  );
  const combatBonus = Math.round(4 + eraIndex * 6 + (quality / 100) * 12);

  let scaleX = 0.16;
  let scaleY = 0.24;
  let scaleZ = 0.16;
  if (archetype === 'Spear' || archetype === 'Staff' || archetype === 'FishingRod') {
    scaleX = 0.12;
    scaleY = 0.36;
    scaleZ = 0.12;
  } else if (archetype === 'Shield' || archetype === 'Crate') {
    scaleX = 0.26;
    scaleY = 0.22;
    scaleZ = 0.22;
  } else if (archetype === 'Sword' || archetype === 'Scythe' || archetype === 'Musket') {
    scaleX = 0.14;
    scaleY = 0.32;
    scaleZ = 0.18;
  }

  const spec: GeneratedItemSpec = {
    id: cacheKey,
    name: `${adj} ${mat.tier} ${archetype}`,
    archetype,
    material: mat.tier,
    materialTier: mat.tier,
    quality,
    speedMultiplier,
    workSpeedMultiplier: speedMultiplier,
    combatBonus,
    damageBonus: combatBonus,
    durability: Math.round(mat.durability * (quality / 70)),
    headColorHex: mat.headHex,
    handleColorHex: mat.handleHex,
    trimColorHex: mat.trimHex,
    scaleX,
    scaleY,
    scaleZ,
    headScale: [scaleX, scaleY, scaleZ],
  };

  if (_itemCache.size > 4000) _itemCache.clear();
  _itemCache.set(cacheKey, spec);
  return spec;
}

// ============================================================================
// 3. MODULAR CLOTHING & GENETIC APPEARANCE GENERATOR (PART C - ITEM 12)
// ============================================================================

const SKIN_TONES = [
  '#F7D7C4',
  '#F2BFA0',
  '#E0A37E',
  '#C6865A',
  '#9E623C',
  '#6E4228',
];

const _clothingCache = new Map<string, GeneratedClothingSpec>();

export function generateProceduralClothing(
  arg1: number | string,
  arg2: AgentJob | string,
  arg3: SocialClass,
  arg4: number | AgentJob,
  arg5: string | number,
  arg6: string,
  arg7?: number,
  arg8?: number
): GeneratedClothingSpec {
  let eraIndex = 0;
  let baseJob: AgentJob = 'Builder';
  let socialClass: SocialClass = 'Peasant';
  let civColorHex = '#F59E0B';
  let secondaryHex = '#FEF3C7';
  let climate = 'Temperate';
  let agentId = 1;

  if (typeof arg1 === 'number' && typeof arg2 === 'string' && typeof arg5 === 'string' && arg5.startsWith('#')) {
    // Called as (eraIndex, job, socialClass, civId, civColorHex, secondaryHex, agentId, seedNum)
    eraIndex = arg1;
    baseJob = arg2 as AgentJob;
    socialClass = arg3;
    civColorHex = arg5;
    secondaryHex = arg6;
    agentId = arg7 ?? 1;
  } else if (typeof arg1 === 'number') {
    // Called as (seed, eraStr, socialClass, job, lifeStage, temp)
    agentId = arg1;
    const foundEra = ERA_ORDER.findIndex((e) => e.includes(String(arg2).split(' ')[0]));
    eraIndex = foundEra >= 0 ? foundEra : 4;
    socialClass = arg3;
    baseJob = (arg4 as AgentJob) || 'Soldier';
  } else {
    civColorHex = String(arg1);
    secondaryHex = String(arg2);
    socialClass = arg3;
    baseJob = arg4 as AgentJob;
    eraIndex = Number(arg5) || 0;
    climate = arg6 || 'Temperate';
    agentId = arg7 ?? 1;
  }

  const cacheKey = `${civColorHex}:${socialClass}:${baseJob}:${eraIndex}:${climate}:${agentId % 64}:${arg8 ?? 0}`;
  const existing = _clothingCache.get(cacheKey);
  if (existing) return existing;

  const prng = new SeededPRNG(hashStringToSeed(cacheKey));
  const era = ERA_ORDER[Math.min(ERA_ORDER.length - 1, Math.max(0, eraIndex))];

  const wealthMap: Record<SocialClass, number> = {
    Servant: 1,
    Peasant: 2,
    Craftsperson: 3,
    Merchant: 4,
    Clergy: 4,
    Noble: 5,
    Ruler: 6,
  };
  const wealthTier = wealthMap[socialClass] || 2;

  const STONE_AGE_TUNICS = ['#785233', '#8B5E3C', '#6B4423', '#9A714C', '#5C4033', '#A47551'];
  const NEOLITHIC_TUNICS = ['#A68A64', '#8C6D46', '#7F6044', '#B59B7C', '#6E5A44', '#947755'];

  let tunicColorHex =
    eraIndex === 0
      ? STONE_AGE_TUNICS[Math.abs(agentId + (arg8 ?? 0)) % STONE_AGE_TUNICS.length]
      : eraIndex === 1
      ? NEOLITHIC_TUNICS[Math.abs(agentId + (arg8 ?? 0)) % NEOLITHIC_TUNICS.length]
      : civColorHex;
  let beltColorHex = '#451A03';
  let headgearType: GeneratedClothingSpec['headgearType'] = 'None';
  let headgear: GeneratedClothingSpec['headgear'] = 'none';
  let headgearColorHex = '#27170C';
  let hasCape = false;
  let capeColorHex: string | null = null;

  if (eraIndex === 0) {
    // Stone Age: Authentic cured hide, fur wraps, and bone/leather bindings — no crowns, miters, or pastel shirts
    beltColorHex = '#3E2723';
    headgearType = socialClass === 'Ruler' ? 'HideBand' : 'None';
    headgear = 'none';
    headgearColorHex = '#5D4037';
    hasCape = socialClass === 'Ruler';
    capeColorHex = hasCape ? '#5C4033' : null;
  } else if (eraIndex === 1) {
    // Neolithic: Woven flax/hemp tunics, straw sun-hats for farmers, fur mantle for chieftain
    if (socialClass === 'Ruler') {
      tunicColorHex = civColorHex;
      beltColorHex = '#B45309';
      headgearType = 'HideBand';
      headgear = 'hood';
      headgearColorHex = '#78350F';
      hasCape = true;
      capeColorHex = '#78350F';
    } else if (baseJob === 'Farmer' || baseJob === 'Forager') {
      headgearType = 'StrawHat';
      headgear = 'straw_hat';
      headgearColorHex = '#D97706';
    } else {
      headgearType = 'None';
      headgear = 'none';
    }
  } else if (socialClass === 'Ruler') {
    tunicColorHex = civColorHex;
    beltColorHex = '#FBBF24';
    headgearType = 'RoyalCrown';
    headgear = 'crown';
    headgearColorHex = '#FBBF24';
    hasCape = true;
    capeColorHex = '#DC2626';
  } else if (socialClass === 'Noble') {
    tunicColorHex = civColorHex;
    beltColorHex = '#FBBF24';
    headgearType = 'NoblePlume';
    headgear = 'merchant_cap';
    headgearColorHex = secondaryHex;
    hasCape = true;
    capeColorHex = civColorHex;
  } else if (socialClass === 'Clergy' || baseJob === 'Priest') {
    tunicColorHex = secondaryHex;
    beltColorHex = '#F59E0B';
    headgearType = 'PriestMitre';
    headgear = 'miter';
    headgearColorHex = '#FEF08A';
    hasCape = eraIndex >= 2;
    capeColorHex = hasCape ? secondaryHex : null;
  } else if (baseJob === 'Soldier') {
    tunicColorHex = civColorHex;
    beltColorHex = eraIndex >= 3 ? '#94A3B8' : '#B45309';
    headgearType = eraIndex >= 3 ? 'IronHelm' : 'BronzeHelm';
    headgear = 'helmet';
    headgearColorHex = eraIndex >= 3 ? '#64748B' : '#D97706';
    hasCape = eraIndex >= 4;
    capeColorHex = hasCape ? civColorHex : null;
  } else if (baseJob === 'Scholar') {
    headgearType = 'ScholarCap';
    headgear = 'scholar_cap';
    headgearColorHex = '#1E293B';
    beltColorHex = '#38BDF8';
  } else if (baseJob === 'Farmer' || baseJob === 'Forager') {
    headgearType = 'StrawHat';
    headgear = 'straw_hat';
    headgearColorHex = '#EAB308';
  } else if (socialClass === 'Merchant' || baseJob === 'Trader') {
    headgearType = 'NoblePlume';
    headgear = 'merchant_cap';
    headgearColorHex = secondaryHex;
  } else if (eraIndex >= 4) {
    headgearType = 'Hood';
    headgear = 'hood';
    headgearColorHex = civColorHex;
  }

  const garbNames: Record<SocialClass, string> = {
    Servant: eraIndex === 0 ? 'Rawhide & Fur Pelt Wrap' : 'Coarse Hemp Tunic',
    Peasant: eraIndex === 0 ? 'Cured Deerhide Tunic' : eraIndex === 1 ? 'Woven Flax & Hide Wraps' : 'Woven Homespun Work Tunic',
    Craftsperson: eraIndex === 0 ? 'Sinew-Stitched Leather Apron' : 'Leather-Aproned Guild Attire',
    Merchant: eraIndex <= 1 ? 'Beaded Hide Trader Mantle' : 'Embroidered Broadcloth Coat',
    Clergy: eraIndex <= 1 ? 'Shaman Antler & Fur Vestments' : 'Consecrated Vestments & Stole',
    Noble: eraIndex <= 1 ? 'Great Bearskin Clan Mantle' : 'Velvet Doublet & Heraldic Mantle',
    Ruler: eraIndex === 0 ? 'Elder Mammoth-Fur Mantle' : eraIndex === 1 ? 'Chieftain Hide & Amber Regalia' : 'Sovereign Regalia, Crown & Royal Mantle',
  };

  const fullName = `${era} ${garbNames[socialClass]}`;

  const spec: GeneratedClothingSpec = {
    id: cacheKey,
    name: fullName,
    summary: `${fullName} · ${headgear === 'none' ? 'Bareheaded' : headgear.replace('_', ' ')}`,
    socialClass,
    climate,
    era,
    wealthTier,
    tunicColorHex,
    primaryColorHex: tunicColorHex,
    secondaryColorHex: secondaryHex,
    trimColorHex: beltColorHex,
    beltColorHex,
    headgear,
    hatStyle: headgear,
    headgearType,
    headgearColorHex,
    hasCape,
    capeColorHex,
    skinToneHex: SKIN_TONES[Math.abs(agentId) % SKIN_TONES.length],
    bodyBuildScale: Number(prng.range(0.93, 1.08).toFixed(2)),
  };

  if (_clothingCache.size > 4000) _clothingCache.clear();
  _clothingCache.set(cacheKey, spec);
  return spec;
}

// ============================================================================
// 4. GRAMMAR & MODULE PROCEDURAL BUILDING GENERATOR (PART C - ITEM 10)
// ============================================================================

export const CULTURE_STYLES = [
  'Nordic Timber & Slate',
  'Mediterranean Terracotta',
  'Desert Adobe & Dome',
  'Imperial Ashlar & Battlement',
  'Arcane Marble & Crystal',
];

export const BUILDING_ARCHETYPES: {
  archetypeName: string;
  purpose: StructureCategory;
  minEra: number;
  baseW: number;
  baseD: number;
  baseH: number;
  stories: number;
  furniture: string[];
}[] = [
  {
    archetypeName: 'Hearth Hovel',
    purpose: 'Shelter',
    minEra: 0,
    baseW: 5,
    baseD: 5,
    baseH: 4,
    stories: 1,
    furniture: ['Sleeping Straw Mat', 'Central Firepit', 'Storage Pot'],
  },
  {
    archetypeName: 'Timber Homestead Cottage',
    purpose: 'Residential',
    minEra: 1,
    baseW: 7,
    baseD: 7,
    baseH: 5,
    stories: 1,
    furniture: ['Timber Frame Bed', 'Hearth & Chimney', 'Oak Table'],
  },
  {
    archetypeName: 'Terraced Farmstead & Barn',
    purpose: 'Food',
    minEra: 1,
    baseW: 9,
    baseD: 7,
    baseH: 5,
    stories: 1,
    furniture: ['Grain Bins', 'Hay Loft', 'Water Trough', 'Fenced Paddock'],
  },
  {
    archetypeName: 'Blacksmith & Smeltery Forge',
    purpose: 'Craft',
    minEra: 2,
    baseW: 7,
    baseD: 7,
    baseH: 5,
    stories: 1,
    furniture: ['Heavy Iron Anvil', 'Blast Smelting Furnace', 'Quenching Trough', 'Tool Rack'],
  },
  {
    archetypeName: 'Covered Bazaar & Market Hall',
    purpose: 'Trade',
    minEra: 2,
    baseW: 9,
    baseD: 9,
    baseH: 5,
    stories: 1,
    furniture: ['Canopy Stalls', 'Merchant Scales', 'Trade Chests', 'Caravan Hitch'],
  },
  {
    archetypeName: 'Wayfarer Tavern & Inn',
    purpose: 'Trade',
    minEra: 3,
    baseW: 9,
    baseD: 7,
    baseH: 7,
    stories: 2,
    furniture: ['Long Trestle Tables', 'Ale Casks', 'Hearth Spit', 'Upstairs Guest Beds'],
  },
  {
    archetypeName: 'Magistrate Court & Dungeon Prison',
    purpose: 'Civic',
    minEra: 3,
    baseW: 9,
    baseD: 9,
    baseH: 7,
    stories: 2,
    furniture: ['Judge Bench', 'Iron-Barred Holding Cells', 'Law Codex Pedestal', 'Pillory'],
  },
  {
    archetypeName: 'Garrison Barracks & Watchtower',
    purpose: 'Military',
    minEra: 3,
    baseW: 9,
    baseD: 9,
    baseH: 9,
    stories: 2,
    furniture: ['Armory Racks', 'Soldier Bunks', 'Crenellated Watch Platform', 'Signal Brazier'],
  },
  {
    archetypeName: 'Sanctuary Temple & Cloister',
    purpose: 'Spiritual',
    minEra: 2,
    baseW: 9,
    baseD: 11,
    baseH: 8,
    stories: 2,
    furniture: ['Sacred Altar', 'Sanctuary Pillars', 'Votive Braziers', 'Bell Belfry'],
  },
  {
    archetypeName: 'Scholarly Library & Academy School',
    purpose: 'Civic',
    minEra: 3,
    baseW: 9,
    baseD: 9,
    baseH: 8,
    stories: 2,
    furniture: ['Scroll & Codex Shelves', 'Lecture Desks', 'Astrolabe Stand', 'Reading Lamps'],
  },
  {
    archetypeName: 'Noble Manor & Courtyard Villa',
    purpose: 'Residential',
    minEra: 4,
    baseW: 11,
    baseD: 9,
    baseH: 8,
    stories: 2,
    furniture: ['Canopied Four-Poster Bed', 'Banquet Hall Table', 'Fountain Courtyard', 'Balcony'],
  },
  {
    archetypeName: 'Citadel Castle Keep & Gatehouse',
    purpose: 'Military',
    minEra: 4,
    baseW: 13,
    baseD: 13,
    baseH: 11,
    stories: 3,
    furniture: ['Curtain Wall & Portcullis', 'Corner Guard Towers', 'Great Hall Throne', 'Inner Ward Courtyard'],
  },
  {
    archetypeName: 'Sovereign Royal Palace & Pantheon',
    purpose: 'Wonder',
    minEra: 5,
    baseW: 13,
    baseD: 13,
    baseH: 13,
    stories: 3,
    furniture: ['Imperial Golden Throne', 'Grand Marble Colonnade', 'Crystal Dome', 'Treasury Vault'],
  },
];

const _buildingCache = new Map<string, ProceduralBuildingSpec>();

/**
 * Validates a procedural building's voxel steps:
 * - Verifies 0 floating blocks (every block at dy > 0 is supported from below or adjacent to a supported pillar)
 * - Verifies connected ground-floor doorway opening
 * - Verifies interior reachability & roof coverage
 * - Computes a 0..100 architectural quality score
 */
export function validateBuildingSteps(
  steps: VoxelPlacementStep[],
  width = 9,
  depth = 9,
  height = 8
): ProceduralBuildingSpec['validation'] {
  const coordMap = new Map<string, VoxelType>();
  for (const s of steps) {
    if (s.voxel !== VoxelType.Air) {
      coordMap.set(`${s.dx},${s.dy},${s.dz}`, s.voxel);
    }
  }

  // BFS from dy === 0 foundation blocks to verify structural support
  const supported = new Set<string>();
  const queue: [number, number, number][] = [];

  coordMap.forEach((_v, key) => {
    const parts = key.split(',').map(Number);
    if (parts[1] <= 0) {
      supported.add(key);
      queue.push([parts[0], parts[1], parts[2]]);
    }
  });

  const dirs = [
    [0, 1, 0],
    [0, -1, 0],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  let head = 0;
  while (head < queue.length) {
    const [cx, cy, cz] = queue[head++];
    for (const [ox, oy, oz] of dirs) {
      const nk = `${cx + ox},${cy + oy},${cz + oz}`;
      if (coordMap.has(nk) && !supported.has(nk)) {
        supported.add(nk);
        queue.push([cx + ox, cy + oy, cz + oz]);
      }
    }
  }

  const floatingBlocks = coordMap.size - supported.size;

  const halfD = Math.floor(depth / 2);
  let hasConnectedDoorway = false;
  for (let dx = -2; dx <= 2; dx++) {
    if (
      !coordMap.has(`${dx},1,${halfD}`) ||
      !coordMap.has(`${dx},1,${-halfD}`)
    ) {
      hasConnectedDoorway = true;
      break;
    }
  }

  const halfW = Math.floor(width / 2);
  let coveredColumns = 0;
  let totalColumns = 0;
  for (let dz = -halfD + 1; dz <= halfD - 1; dz++) {
    for (let dx = -halfW + 1; dx <= halfW - 1; dx++) {
      totalColumns++;
      for (let dy = 2; dy <= height + 2; dy++) {
        if (coordMap.has(`${dx},${dy},${dz}`)) {
          coveredColumns++;
          break;
        }
      }
    }
  }
  const roofCoveragePct =
    totalColumns > 0 ? Math.round((coveredColumns / totalColumns) * 100) : 100;

  const isValid = floatingBlocks === 0 && hasConnectedDoorway && roofCoveragePct >= 65;
  const qualityScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        55 +
          (hasConnectedDoorway ? 15 : 0) +
          (floatingBlocks === 0 ? 18 : -floatingBlocks * 5) +
          Math.min(12, Math.floor(steps.length / 22))
      )
    )
  );

  return {
    isValid,
    hasConnectedDoorway,
    hasDoorway: hasConnectedDoorway,
    floatingBlocks,
    floatingBlocksCount: floatingBlocks,
    enclosedRoomsReachable: hasConnectedDoorway,
    roofCoveragePct,
    qualityScore,
  };
}

/**
 * Generates a complete, structurally validated multi-module voxel building from culture, era,
 * archetype, wealth, and seed. Supports both object params and positional arguments.
 */
export function generateProceduralBuilding(
  arg1:
    | {
        seed: string | number;
        cultureStyle?: string;
        eraIndex: number;
        archetypeIndex?: number;
        wealthTier?: number;
      }
    | EraType
    | string
    | number,
  arg2?: StructureCategory | string,
  arg3?: number | StructureCategory,
  arg4?: number
): ProceduralBuildingSpec {
  let seed: string | number = 1;
  let eraIndex = 0;
  let wealthTier = 3;
  let requestedCategory: StructureCategory | undefined;
  let requestedCultureStyle: string | undefined;
  let archetypeIndex: number | undefined;

  if (typeof arg1 === 'object' && arg1 !== null) {
    seed = arg1.seed;
    eraIndex = arg1.eraIndex;
    wealthTier = arg1.wealthTier ?? 3;
    requestedCultureStyle = arg1.cultureStyle;
    archetypeIndex = arg1.archetypeIndex;
  } else if (typeof arg1 === 'number') {
    // Called as (seed, eraStr, category, wealthRatio)
    seed = arg1;
    const foundEra = ERA_ORDER.findIndex((e) => e.includes(String(arg2).split(' ')[0]));
    eraIndex = foundEra >= 0 ? foundEra : 4;
    requestedCategory = arg3 as StructureCategory;
    wealthTier = typeof arg4 === 'number' ? Math.max(1, Math.round(arg4 * 6)) : 4;
  } else {
    // Called as (era, category, seed, civId)
    const foundEra = ERA_ORDER.indexOf(arg1 as EraType);
    eraIndex = foundEra >= 0 ? foundEra : 0;
    requestedCategory = arg2 as StructureCategory;
    seed = arg3 ?? 1;
    if (typeof arg4 === 'number') {
      requestedCultureStyle = CULTURE_STYLES[Math.abs(arg4) % CULTURE_STYLES.length];
    }
  }

  const prng = new SeededPRNG(hashStringToSeed(`${seed}:${eraIndex}:${wealthTier}:${requestedCategory ?? ''}`));
  const cultureStyle = requestedCultureStyle || prng.pick(CULTURE_STYLES);

  const normalizedCat =
    requestedCategory === 'Shelter'
      ? 'Residential'
      : requestedCategory === 'Industry'
      ? 'Craft'
      : requestedCategory;

  const validArchetypes = BUILDING_ARCHETYPES.filter(
    (a) =>
      a.minEra <= eraIndex &&
      (!normalizedCat || a.purpose === normalizedCat || a.purpose === requestedCategory)
  );
  const eraArchetypes = BUILDING_ARCHETYPES.filter((a) => a.minEra <= eraIndex);
  const arch =
    archetypeIndex !== undefined && BUILDING_ARCHETYPES[archetypeIndex]
      ? BUILDING_ARCHETYPES[archetypeIndex]
      : prng.pick(
          validArchetypes.length > 0
            ? validArchetypes
            : eraArchetypes.length > 0
            ? eraArchetypes
            : BUILDING_ARCHETYPES
        );

  const cacheKey = `${seed}:${cultureStyle}:${eraIndex}:${arch.archetypeName}:${wealthTier}`;
  const cached = _buildingCache.get(cacheKey);
  if (cached) return cached;

  const era = ERA_ORDER[Math.min(ERA_ORDER.length - 1, Math.max(0, eraIndex))];

  let foundationVoxel = VoxelType.Cobblestone;
  let wallVoxel = VoxelType.Plank;
  let pillarVoxel = VoxelType.WoodLog;
  let roofVoxel = VoxelType.Thatch;
  let roofStyle: ProceduralBuildingSpec['roofStyle'] = 'ThatchedGable';

  if (eraIndex === 0) {
    foundationVoxel = VoxelType.Cobblestone;
    wallVoxel = VoxelType.MudBrick;
    pillarVoxel = VoxelType.WoodLog;
    roofVoxel = VoxelType.Thatch;
    roofStyle = 'ThatchedGable';
  } else if (cultureStyle.includes('Desert')) {
    foundationVoxel = VoxelType.StoneBrick;
    wallVoxel = eraIndex >= 3 ? VoxelType.WhiteMarble : VoxelType.MudBrick;
    pillarVoxel = VoxelType.DarkPlank;
    roofVoxel = eraIndex >= 4 ? VoxelType.RoofTileRed : VoxelType.MudBrick;
    roofStyle = eraIndex >= 3 ? 'ClayHip' : 'SandstoneFlat';
  } else if (cultureStyle.includes('Mediterranean')) {
    foundationVoxel = VoxelType.StoneBrick;
    wallVoxel = eraIndex >= 3 ? VoxelType.WhiteMarble : VoxelType.ClayBrick;
    pillarVoxel = VoxelType.StoneBrick;
    roofVoxel = VoxelType.RoofTileRed;
    roofStyle = 'ClayHip';
  } else if (cultureStyle.includes('Imperial')) {
    foundationVoxel = VoxelType.StoneBrick;
    wallVoxel = eraIndex >= 4 ? VoxelType.WhiteMarble : VoxelType.StoneBrick;
    pillarVoxel = VoxelType.Cobblestone;
    roofVoxel = VoxelType.RoofTileSlate;
    roofStyle = arch.purpose === 'Military' ? 'BattlementKeep' : 'SlateSteep';
  } else if (cultureStyle.includes('Arcane')) {
    foundationVoxel = VoxelType.StoneBrick;
    wallVoxel = VoxelType.WhiteMarble;
    pillarVoxel = VoxelType.DarkPlank;
    roofVoxel = VoxelType.RoofTileSlate;
    roofStyle = arch.purpose === 'Wonder' ? 'MarbleDome' : 'SlateSteep';
  } else {
    foundationVoxel = VoxelType.Cobblestone;
    wallVoxel = eraIndex >= 3 ? VoxelType.Plank : VoxelType.MudBrick;
    pillarVoxel = VoxelType.WoodLog;
    roofVoxel = eraIndex >= 3 ? VoxelType.RoofTileSlate : VoxelType.Thatch;
    roofStyle = 'TimberGable';
  }

  const sizeBonus = wealthTier >= 5 ? 2 : 0;
  const width = arch.baseW + sizeBonus;
  const depth = arch.baseD + sizeBonus;
  const stories = Math.min(3, arch.stories + (wealthTier >= 6 ? 1 : 0));
  const storyHeight = 3;
  const wallTopY = stories * storyHeight;

  const hasChimney =
    eraIndex >= 1 &&
    (arch.purpose === 'Shelter' ||
      arch.purpose === 'Residential' ||
      arch.purpose === 'Industry' ||
      arch.purpose === 'Craft' ||
      arch.purpose === 'Trade');
  const hasPorch = eraIndex >= 1 && prng.chance(0.65);
  const hasTower =
    arch.purpose === 'Military' ||
    arch.purpose === 'Wonder' ||
    (eraIndex >= 4 && prng.chance(0.35));
  const hasCourtyard = width >= 11 && depth >= 11;

  const stepMap = new Map<string, VoxelPlacementStep>();
  const setVoxel = (dx: number, dy: number, dz: number, voxel: VoxelType) => {
    const k = `${dx},${dy},${dz}`;
    if (voxel === VoxelType.Air) {
      stepMap.delete(k);
    } else {
      stepMap.set(k, { dx, dy, dz, voxel });
    }
  };

  const hw = Math.floor(width / 2);
  const hd = Math.floor(depth / 2);

  for (let dz = -hd; dz <= hd; dz++) {
    for (let dx = -hw; dx <= hw; dx++) {
      const isEdge = Math.abs(dx) === hw || Math.abs(dz) === hd;
      setVoxel(dx, 0, dz, isEdge ? foundationVoxel : VoxelType.Plank);
    }
  }

  for (let s = 0; s < stories; s++) {
    const baseY = s * storyHeight + 1;
    for (let ly = 0; ly < storyHeight; ly++) {
      const dy = baseY + ly;
      for (let dz = -hd; dz <= hd; dz++) {
        for (let dx = -hw; dx <= hw; dx++) {
          const isCorner = Math.abs(dx) === hw && Math.abs(dz) === hd;
          const isPerimeter = Math.abs(dx) === hw || Math.abs(dz) === hd;

          if (hasCourtyard && Math.abs(dx) <= 2 && Math.abs(dz) <= 2) {
            continue;
          }

          if (isCorner) {
            setVoxel(dx, dy, dz, pillarVoxel);
          } else if (isPerimeter) {
            if (
              ly === 1 &&
              eraIndex >= 2 &&
              ((Math.abs(dx) % 2 === 0 && Math.abs(dz) === hd && dx !== 0) ||
                (Math.abs(dz) % 2 === 0 && Math.abs(dx) === hw && dz !== 0))
            ) {
              setVoxel(dx, dy, dz, VoxelType.GlassPane);
            } else if (ly === storyHeight - 1 && eraIndex >= 2) {
              // Horizontal timber or stone ring-beam under eaves/floors
              setVoxel(dx, dy, dz, pillarVoxel);
            } else {
              setVoxel(dx, dy, dz, wallVoxel);
            }
          } else if (ly === storyHeight - 1 && s < stories - 1) {
            if (!(dx === hw - 1 && dz === -hd + 1)) {
              setVoxel(dx, dy, dz, VoxelType.Plank);
            }
          }
        }
      }
    }

    if (s < stories - 1) {
      for (let stepY = 1; stepY <= storyHeight; stepY++) {
        setVoxel(
          hw - 1,
          s * storyHeight + stepY,
          -hd + Math.min(depth - 2, stepY),
          VoxelType.DarkPlank
        );
      }
    }
  }

  setVoxel(0, 1, hd, VoxelType.Air);
  setVoxel(0, 2, hd, VoxelType.Air);
  setVoxel(-1, 1, hd, pillarVoxel);
  setVoxel(1, 1, hd, pillarVoxel);
  setVoxel(-1, 2, hd, pillarVoxel);
  setVoxel(1, 2, hd, pillarVoxel);
  setVoxel(0, 0, hd + 1, foundationVoxel);

  const doorwayCoords: [number, number][] = [
    [0, hd],
    [0, hd + 1],
    [0, hd - 1],
  ];

  if (hasPorch && hd + 2 <= 8) {
    for (let px = -1; px <= 1; px++) {
      setVoxel(px, 0, hd + 1, foundationVoxel);
      setVoxel(px, 3, hd + 1, roofVoxel);
    }
    setVoxel(-1, 1, hd + 1, VoxelType.WoodLog);
    setVoxel(-1, 2, hd + 1, VoxelType.WoodLog);
    setVoxel(1, 1, hd + 1, VoxelType.WoodLog);
    setVoxel(1, 2, hd + 1, VoxelType.WoodLog);
  }

  // Interior furniture blocks (using natural wood/stone/marble, never raw glowing TorchEmber at dy=1)
  if (arch.purpose === 'Shelter' || arch.purpose === 'Residential') {
    setVoxel(-hw + 1, 1, -hd + 1, VoxelType.DarkPlank);
    setVoxel(hw - 1, 1, -hd + 1, VoxelType.Plank);
  } else if (arch.purpose === 'Industry' || arch.purpose === 'Craft') {
    setVoxel(-hw + 1, 1, 0, VoxelType.IronOre);
    setVoxel(hw - 1, 1, 0, VoxelType.Cobblestone);
  } else if (arch.purpose === 'Spiritual' || arch.purpose === 'Wonder') {
    setVoxel(0, 1, -hd + 2, VoxelType.WhiteMarble);
  } else if (arch.purpose === 'Trade') {
    setVoxel(-hw + 1, 1, hd - 1, VoxelType.Plank);
    setVoxel(hw - 1, 1, hd - 1, VoxelType.DarkPlank);
  }

  let maxRoofY = wallTopY + 1;
  if (roofStyle === 'BattlementKeep' || roofStyle === 'SandstoneFlat') {
    for (let dz = -hd; dz <= hd; dz++) {
      for (let dx = -hw; dx <= hw; dx++) {
        if (hasCourtyard && Math.abs(dx) <= 1 && Math.abs(dz) <= 1) continue;
        setVoxel(dx, wallTopY + 1, dz, foundationVoxel);
        const isEdge = Math.abs(dx) === hw || Math.abs(dz) === hd;
        if (isEdge && (dx + dz) % 2 === 0) {
          setVoxel(dx, wallTopY + 2, dz, pillarVoxel);
        }
      }
    }
    maxRoofY = wallTopY + 2;
  } else if (roofStyle === 'MarbleDome') {
    const domeLayers = Math.max(2, Math.min(4, hw));
    for (let l = 0; l < domeLayers; l++) {
      const r = hw - l;
      const ry = wallTopY + 1 + l;
      maxRoofY = ry;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz <= r * r + 1) {
            setVoxel(dx, ry, dz, l === domeLayers - 1 ? VoxelType.WhiteMarble : roofVoxel);
          }
        }
      }
    }
  } else {
    const layers = Math.max(2, Math.min(4, hw));
    for (let l = 0; l < layers; l++) {
      const rx = hw - l;
      const rz = roofStyle === 'ClayHip' ? Math.max(1, hd - l) : hd;
      const ry = wallTopY + 1 + l;
      maxRoofY = ry;
      for (let dz = -rz; dz <= rz; dz++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const isGableTrim =
            roofStyle !== 'ClayHip' && (Math.abs(dz) === rz || dx === 0);
          setVoxel(
            dx,
            ry,
            dz,
            isGableTrim && l === layers - 1 ? VoxelType.DarkPlank : roofVoxel
          );
        }
      }
    }
  }

  if (hasTower) {
    const tx = -hw;
    const tz = -hd;
    for (let ty = 1; ty <= maxRoofY + 3; ty++) {
      for (let dz = 0; dz <= 2; dz++) {
        for (let dx = 0; dx <= 2; dx++) {
          setVoxel(tx + dx, ty, tz + dz, pillarVoxel);
        }
      }
    }
    setVoxel(tx + 1, maxRoofY + 4, tz + 1, VoxelType.TorchEmber);
    maxRoofY += 4;
  }

  if (hasChimney) {
    for (let cy = 1; cy <= maxRoofY + 1; cy++) {
      setVoxel(hw, cy, -hd + 1, VoxelType.ClayBrick);
    }
    setVoxel(hw, maxRoofY + 2, -hd + 1, VoxelType.TorchEmber);
  }

  const steps = Array.from(stepMap.values()).sort(
    (a, b) => a.dy - b.dy || a.dz - b.dz || a.dx - b.dx
  );

  const validation = validateBuildingSteps(steps, width, depth, maxRoofY);
  const roomsCount = Math.max(1, stories * (width >= 9 ? 2 : 1) + (hasTower ? 1 : 0));

  const spec: ProceduralBuildingSpec = {
    id: cacheKey,
    name: `${cultureStyle.split(' ')[0]} ${arch.archetypeName}`,
    styleName: cultureStyle,
    purpose: arch.purpose,
    archetypeName: arch.archetypeName,
    cultureStyle,
    era,
    roofStyle,
    width,
    depth,
    height: maxRoofY,
    stories,
    roomsCount,
    hasCourtyard,
    hasTower,
    hasChimney,
    hasPorch,
    furnitureItems: arch.furniture,
    steps,
    doorwayCoords,
    validation,
  };

  if (_buildingCache.size > 1500) _buildingCache.clear();
  _buildingCache.set(cacheKey, spec);
  return spec;
}

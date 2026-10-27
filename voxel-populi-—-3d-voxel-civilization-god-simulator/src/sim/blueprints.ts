/**
 * High-Detail Procedural Voxel Blueprints Across All 6 Civilization Eras (43 Distinct Structures)
 * Every blueprint features multi-block architectural details (foundations, timber pillars, windows,
 * doorways, overhanging pitched gables, chimneys, canopies, arches, and spires) ordered bottom-up.
 */

import {
  EraType,
  StructureBlueprint,
  StructureCategory,
  StructureType,
  VoxelPlacementStep,
  VoxelType,
} from './types';

function sortStepsBottomUp(steps: VoxelPlacementStep[]): VoxelPlacementStep[] {
  const map = new Map<string, VoxelPlacementStep>();
  for (const s of steps) {
    map.set(`${s.dx},${s.dy},${s.dz}`, s);
  }
  return Array.from(map.values()).sort(
    (a, b) => a.dy - b.dy || a.dz - b.dz || a.dx - b.dx
  );
}

function addBox(
  steps: VoxelPlacementStep[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  voxel: VoxelType,
  hollow = false
) {
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (
          hollow &&
          x > x0 &&
          x < x1 &&
          y > y0 &&
          y < y1 &&
          z > z0 &&
          z < z1
        ) {
          continue;
        }
        steps.push({ dx: x, dy: y, dz: z, voxel });
      }
    }
  }
}

function addFramedWallsWithDoorAndWindows(
  steps: VoxelPlacementStep[],
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  wallVoxel: VoxelType,
  pillarVoxel: VoxelType,
  windowVoxel: VoxelType = VoxelType.GlassPane
) {
  const doorX = Math.round((x0 + x1) / 2);
  const midY = Math.round((y0 + y1) / 2);

  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const isEdgeX = x === x0 || x === x1;
        const isEdgeZ = z === z0 || z === z1;
        if (!isEdgeX && !isEdgeZ) continue;

        // Front doorway opening (2 blocks tall)
        if (z === z0 && x === doorX && (y === y0 || y === y0 + 1)) {
          continue;
        }

        const isCorner = isEdgeX && isEdgeZ;
        if (isCorner) {
          steps.push({ dx: x, dy: y, dz: z, voxel: pillarVoxel });
        } else if (
          y === midY &&
          ((isEdgeX && (z - z0) % 2 === 1) || (z === z1 && (x - x0) % 2 === 1))
        ) {
          steps.push({ dx: x, dy: y, dz: z, voxel: windowVoxel });
        } else {
          steps.push({ dx: x, dy: y, dz: z, voxel: wallVoxel });
        }
      }
    }
  }
}

function addOverhangingGableRoof(
  steps: VoxelPlacementStep[],
  x0: number,
  yBase: number,
  z0: number,
  x1: number,
  z1: number,
  roofVoxel: VoxelType,
  gableVoxel: VoxelType,
  ridgeVoxel: VoxelType = VoxelType.DarkPlank
) {
  const rx0 = x0 - 1;
  const rx1 = x1 + 1;
  const rz0 = z0 - 1;
  const rz1 = z1 + 1;
  const halfSpan = Math.ceil((rx1 - rx0) / 2);

  for (let layer = 0; layer <= halfSpan; layer++) {
    const lx0 = rx0 + layer;
    const lx1 = rx1 - layer;
    if (lx0 > lx1) break;
    const y = yBase + layer;
    for (let z = rz0; z <= rz1; z++) {
      const v = lx0 === lx1 ? ridgeVoxel : roofVoxel;
      steps.push({ dx: lx0, dy: y, dz: z, voxel: v });
      steps.push({ dx: lx1, dy: y, dz: z, voxel: v });
      if (z === z0 || z === z1) {
        for (let gx = lx0 + 1; gx < lx1; gx++) {
          steps.push({ dx: gx, dy: y, dz: z, voxel: gableVoxel });
        }
      }
    }
  }
}

function buildBlueprint(
  type: StructureType,
  name: string,
  era: EraType,
  category: StructureCategory,
  width: number,
  depth: number,
  height: number,
  costWood: number,
  costStone: number,
  costOre: number,
  description: string,
  requiredTech: string | undefined,
  generator: (steps: VoxelPlacementStep[]) => void
): StructureBlueprint {
  const rawSteps: VoxelPlacementStep[] = [];
  generator(rawSteps);
  return {
    type,
    name,
    era,
    category,
    requiredTech,
    width,
    depth,
    height,
    costWood,
    costStone,
    costOre,
    description,
    steps: sortStepsBottomUp(rawSteps),
  };
}

export const STRUCTURE_BLUEPRINTS: Record<StructureType, StructureBlueprint> = {
  // ============================================================================
  // ERA 1: STONE AGE (6 Detailed Multi-Block Structures)
  // ============================================================================
  Campfire: buildBlueprint(
    'Campfire',
    'Tribal Hearth Plaza',
    EraType.StoneAge,
    'Civic',
    7,
    7,
    4,
    6,
    6,
    0,
    'Sacred communal stone hearth ring surrounded by log benches and totem torches.',
    undefined,
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.RoadDirt);
      addBox(s, -1, 0, -1, 1, 0, 1, VoxelType.Cobblestone);
      s.push({ dx: 0, dy: 1, dz: 0, voxel: VoxelType.WoodLog });
      s.push({ dx: 0, dy: 2, dz: 0, voxel: VoxelType.TorchEmber });
      // Sitting log benches around fire
      addBox(s, -2, 1, -3, 2, 1, -3, VoxelType.WoodLog);
      addBox(s, -2, 1, 3, 2, 1, 3, VoxelType.WoodLog);
      addBox(s, -3, 1, -1, -3, 1, 1, VoxelType.WoodLog);
      addBox(s, 3, 1, -1, 3, 1, 1, VoxelType.WoodLog);
      // Corner bone/timber torch posts
      for (const [cx, cz] of [
        [-3, -3],
        [3, -3],
        [-3, 3],
        [3, 3],
      ]) {
        s.push({ dx: cx, dy: 1, dz: cz, voxel: VoxelType.WoodLog });
        s.push({ dx: cx, dy: 2, dz: cz, voxel: VoxelType.WoodLog });
        s.push({ dx: cx, dy: 3, dz: cz, voxel: VoxelType.TorchEmber });
      }
    }
  ),

  LeanToShelter: buildBlueprint(
    'LeanToShelter',
    'Timber & Thatch Lean-To',
    EraType.StoneAge,
    'Shelter',
    6,
    5,
    5,
    10,
    4,
    0,
    'Slanted timber A-frame windbreak with layered reed thatch and a warm bedside hearth.',
    'Fire & Shelter',
    (s) => {
      addBox(s, -2, 0, -2, 2, 0, 2, VoxelType.Dirt);
      // Side A-frame poles
      for (let x = -2; x <= 2; x++) {
        const isFrame = x === -2 || x === 2;
        s.push({
          dx: x,
          dy: 1,
          dz: 2,
          voxel: isFrame ? VoxelType.WoodLog : VoxelType.Thatch,
        });
        s.push({
          dx: x,
          dy: 2,
          dz: 1,
          voxel: isFrame ? VoxelType.WoodLog : VoxelType.Thatch,
        });
        s.push({
          dx: x,
          dy: 3,
          dz: 0,
          voxel: isFrame ? VoxelType.WoodLog : VoxelType.Thatch,
        });
        s.push({
          dx: x,
          dy: 4,
          dz: -1,
          voxel: isFrame ? VoxelType.WoodLog : VoxelType.Thatch,
        });
      }
      // Front support posts & warm hearth
      s.push({ dx: -2, dy: 1, dz: -1, voxel: VoxelType.WoodLog });
      s.push({ dx: -2, dy: 2, dz: -1, voxel: VoxelType.WoodLog });
      s.push({ dx: -2, dy: 3, dz: -1, voxel: VoxelType.WoodLog });
      s.push({ dx: 2, dy: 1, dz: -1, voxel: VoxelType.WoodLog });
      s.push({ dx: 2, dy: 2, dz: -1, voxel: VoxelType.WoodLog });
      s.push({ dx: 2, dy: 3, dz: -1, voxel: VoxelType.WoodLog });
      s.push({ dx: 0, dy: 1, dz: -2, voxel: VoxelType.TorchEmber });
    }
  ),

  MudHut: buildBlueprint(
    'MudHut',
    'Domed Adobe & Reed Hut',
    EraType.StoneAge,
    'Shelter',
    7,
    7,
    6,
    12,
    10,
    0,
    'Rounded earthen dwelling with timber door lintel, windows, and a tiered thatch dome.',
    'Fire & Shelter',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.Cobblestone);
      addFramedWallsWithDoorAndWindows(
        s,
        -2,
        1,
        -2,
        2,
        3,
        2,
        VoxelType.MudBrick,
        VoxelType.WoodLog,
        VoxelType.Plank
      );
      addBox(s, -2, 4, -2, 2, 4, 2, VoxelType.Thatch);
      addBox(s, -1, 5, -1, 1, 5, 1, VoxelType.Thatch);
    }
  ),

  FlintKnappingPit: buildBlueprint(
    'FlintKnappingPit',
    'Stone Toolmakers Yard',
    EraType.StoneAge,
    'Industry',
    6,
    6,
    4,
    8,
    12,
    0,
    'Paved work yard with flint boulders, tool racks, and shaded canopy awning.',
    'Flint Toolmaking',
    (s) => {
      addBox(s, -2, 0, -2, 2, 0, 2, VoxelType.Cobblestone);
      addBox(s, -2, 1, 1, -1, 2, 2, VoxelType.Stone);
      addBox(s, 1, 1, 1, 2, 1, 2, VoxelType.CopperOre);
      // Canopy posts
      for (const [px, pz] of [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ]) {
        s.push({ dx: px, dy: 1, dz: pz, voxel: VoxelType.WoodLog });
        s.push({ dx: px, dy: 2, dz: pz, voxel: VoxelType.WoodLog });
      }
      addBox(s, -2, 3, -2, 2, 3, 2, VoxelType.Thatch);
    }
  ),

  GatheringTotem: buildBlueprint(
    'GatheringTotem',
    'Ancestral Spirit Sanctuary',
    EraType.StoneAge,
    'Spiritual',
    7,
    7,
    8,
    14,
    8,
    0,
    'Towering carved wooden spirit totem with outstretched wings and four ritual fire pillars.',
    'Oral Traditions',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.Cobblestone);
      addBox(s, -1, 1, -1, 1, 1, 1, VoxelType.StoneBrick);
      for (let y = 2; y <= 7; y++) {
        s.push({ dx: 0, dy: y, dz: 0, voxel: VoxelType.WoodLog });
      }
      // Totem wings
      addBox(s, -2, 5, 0, 2, 5, 0, VoxelType.MarketCanopyGold);
      addBox(s, -1, 6, 0, 1, 6, 0, VoxelType.MarketCanopyRed);
      s.push({ dx: 0, dy: 8, dz: 0, voxel: VoxelType.TorchEmber });
      for (const [px, pz] of [
        [-3, -3],
        [3, -3],
        [-3, 3],
        [3, 3],
      ]) {
        s.push({ dx: px, dy: 1, dz: pz, voxel: VoxelType.Stone });
        s.push({ dx: px, dy: 2, dz: pz, voxel: VoxelType.Stone });
        s.push({ dx: px, dy: 3, dz: pz, voxel: VoxelType.TorchEmber });
      }
    }
  ),

  BerryForageRack: buildBlueprint(
    'BerryForageRack',
    'Tribal Curing & Storage Pavilion',
    EraType.StoneAge,
    'Food',
    6,
    5,
    4,
    12,
    4,
    0,
    'Timber pavilion with hanging curing racks and woven food baskets.',
    'Foraging Mastery',
    (s) => {
      addBox(s, -2, 0, -2, 2, 0, 2, VoxelType.RoadDirt);
      for (const [px, pz] of [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ]) {
        s.push({ dx: px, dy: 1, dz: pz, voxel: VoxelType.WoodLog });
        s.push({ dx: px, dy: 2, dz: pz, voxel: VoxelType.WoodLog });
      }
      addBox(s, -2, 3, -2, 2, 3, 2, VoxelType.Thatch);
      addBox(s, -1, 1, 0, 1, 1, 0, VoxelType.Plank);
      s.push({ dx: -1, dy: 2, dz: 0, voxel: VoxelType.BerryBush });
      s.push({ dx: 1, dy: 2, dz: 0, voxel: VoxelType.CropWheat });
    }
  ),

  // ============================================================================
  // ERA 2: NEOLITHIC FARMING AGE (8 Detailed Multi-Block Structures)
  // ============================================================================
  WoodHut: buildBlueprint(
    'WoodHut',
    'Timber-Beam Longhouse Cottage',
    EraType.Neolithic,
    'Shelter',
    9,
    9,
    8,
    22,
    12,
    0,
    'Spacious Neolithic timber cottage with cobblestone foundation, porch, windows, and overhanging thatch gable roof.',
    'Carpentry',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.Cobblestone);
      addFramedWallsWithDoorAndWindows(
        s,
        -3,
        1,
        -3,
        3,
        3,
        3,
        VoxelType.Plank,
        VoxelType.WoodLog,
        VoxelType.GlassPane
      );
      addOverhangingGableRoof(
        s,
        -3,
        4,
        -3,
        3,
        3,
        VoxelType.Thatch,
        VoxelType.Plank,
        VoxelType.WoodLog
      );
    }
  ),

  WheatFarmPlot: buildBlueprint(
    'WheatFarmPlot',
    'Fenced Irrigated Wheat Estate',
    EraType.Neolithic,
    'Food',
    9,
    9,
    3,
    12,
    6,
    0,
    'Fenced agricultural estate with central irrigation canal, scarecrow, and lush rows of golden wheat.',
    'Agriculture',
    (s) => {
      for (let z = -4; z <= 4; z++) {
        for (let x = -4; x <= 4; x++) {
          const isBorder =
            x === -4 || x === 4 || z === -4 || z === 4;
          if (isBorder) {
            s.push({ dx: x, dy: 0, dz: z, voxel: VoxelType.RoadDirt });
            if ((x + z) % 2 === 0 && !(z === -4 && x === 0)) {
              s.push({ dx: x, dy: 1, dz: z, voxel: VoxelType.Plank });
            }
          } else if (x === 0) {
            s.push({ dx: x, dy: 0, dz: z, voxel: VoxelType.Water });
          } else {
            s.push({ dx: x, dy: 0, dz: z, voxel: VoxelType.FertileSoil });
            s.push({ dx: x, dy: 1, dz: z, voxel: VoxelType.CropWheat });
          }
        }
      }
      // Small bridge & scarecrow in center
      s.push({ dx: 0, dy: 1, dz: 0, voxel: VoxelType.BridgeWood });
      s.push({ dx: 0, dy: 2, dz: 0, voxel: VoxelType.WoodLog });
      s.push({ dx: 0, dy: 3, dz: 0, voxel: VoxelType.Thatch });
    }
  ),

  OrchardGrove: buildBlueprint(
    'OrchardGrove',
    'Walled Fruit & Berry Orchard',
    EraType.Neolithic,
    'Food',
    9,
    9,
    6,
    16,
    8,
    0,
    'Walled botanical orchard with four blossoming fruit trees and berry hedges.',
    'Agriculture',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.Grass);
      for (const [tx, tz] of [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ]) {
        for (let y = 1; y <= 3; y++) {
          s.push({ dx: tx, dy: y, dz: tz, voxel: VoxelType.WoodLog });
        }
        addBox(s, tx - 1, 4, tz - 1, tx + 1, 5, tz + 1, VoxelType.Leaves);
        s.push({ dx: tx, dy: 4, dz: tz - 1, voxel: VoxelType.FlowerRed });
      }
      addBox(s, -1, 0, -4, 1, 0, 4, VoxelType.RoadDirt);
    }
  ),

  GranarySilo: buildBlueprint(
    'GranarySilo',
    'Elevated Timber Granary & Barn',
    EraType.Neolithic,
    'Food',
    8,
    8,
    8,
    24,
    16,
    0,
    'High-capacity timber storehouse raised on stone piers with a peaked roof.',
    'Pottery & Storage',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.Cobblestone);
      addFramedWallsWithDoorAndWindows(
        s,
        -2,
        1,
        -2,
        2,
        4,
        2,
        VoxelType.Plank,
        VoxelType.WoodLog,
        VoxelType.DarkPlank
      );
      addOverhangingGableRoof(
        s,
        -2,
        5,
        -2,
        2,
        2,
        VoxelType.Thatch,
        VoxelType.Plank
      );
    }
  ),

  DirtRoadSegment: buildBlueprint(
    'DirtRoadSegment',
    'Lantern-Lit Village Avenue',
    EraType.Neolithic,
    'Infrastructure',
    7,
    5,
    4,
    6,
    8,
    0,
    'Wide trodden thoroughfare bordered by cobblestone curbs and timber torch posts.',
    'Wheel & Trails',
    (s) => {
      addBox(s, -3, 0, -1, 3, 0, 1, VoxelType.RoadDirt);
      addBox(s, -3, 0, -2, 3, 0, -2, VoxelType.Cobblestone);
      addBox(s, -3, 0, 2, 3, 0, 2, VoxelType.Cobblestone);
      s.push({ dx: 0, dy: 1, dz: -2, voxel: VoxelType.WoodLog });
      s.push({ dx: 0, dy: 2, dz: -2, voxel: VoxelType.WoodLog });
      s.push({ dx: 0, dy: 3, dz: -2, voxel: VoxelType.TorchEmber });
    }
  ),

  TimberFootbridge: buildBlueprint(
    'TimberFootbridge',
    'Covered Timber River Bridge',
    EraType.Neolithic,
    'Infrastructure',
    9,
    5,
    5,
    20,
    8,
    0,
    'Sturdy timber truss bridge with side railings and lantern posts spanning rivers.',
    'Carpentry',
    (s) => {
      addBox(s, -4, 0, -1, 4, 0, 1, VoxelType.BridgeWood);
      for (let x = -4; x <= 4; x++) {
        s.push({ dx: x, dy: 1, dz: -2, voxel: VoxelType.Plank });
        s.push({ dx: x, dy: 1, dz: 2, voxel: VoxelType.Plank });
        if (x % 2 === 0) {
          s.push({ dx: x, dy: 2, dz: -2, voxel: VoxelType.WoodLog });
          s.push({ dx: x, dy: 2, dz: 2, voxel: VoxelType.WoodLog });
        }
      }
      s.push({ dx: 0, dy: 3, dz: -2, voxel: VoxelType.TorchEmber });
      s.push({ dx: 0, dy: 3, dz: 2, voxel: VoxelType.TorchEmber });
    }
  ),

  StandingStones: buildBlueprint(
    'StandingStones',
    'Grand Megalithic Henge Ring',
    EraType.Neolithic,
    'Spiritual',
    9,
    9,
    6,
    8,
    36,
    0,
    'Sacred ring of giant stone trilithons with horizontal lintels and a central solstice altar.',
    'Megalithic Rituals',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.Cobblestone);
      // 4 Trilithon Arches
      for (const [ax, az, dx, dz] of [
        [0, -3, 1, 0],
        [0, 3, 1, 0],
        [-3, 0, 0, 1],
        [3, 0, 0, 1],
      ]) {
        for (let y = 1; y <= 4; y++) {
          s.push({ dx: ax - dx, dy: y, dz: az - dz, voxel: VoxelType.Stone });
          s.push({ dx: ax + dx, dy: y, dz: az + dz, voxel: VoxelType.Stone });
        }
        for (let k = -1; k <= 1; k++) {
          s.push({
            dx: ax + dx * k,
            dy: 5,
            dz: az + dz * k,
            voxel: VoxelType.StoneBrick,
          });
        }
      }
      addBox(s, -1, 1, -1, 1, 1, 1, VoxelType.StoneBrick);
      s.push({ dx: 0, dy: 2, dz: 0, voxel: VoxelType.TorchEmber });
    }
  ),

  LumberMillCamp: buildBlueprint(
    'LumberMillCamp',
    'Forester Sawmill & Timber Yard',
    EraType.Neolithic,
    'Industry',
    8,
    7,
    6,
    22,
    12,
    0,
    'Covered sawmill shed with stacked oak/birch timber piles and carpentry workbenches.',
    'Carpentry',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.Cobblestone);
      addFramedWallsWithDoorAndWindows(
        s,
        -3,
        1,
        -2,
        0,
        3,
        2,
        VoxelType.Plank,
        VoxelType.WoodLog
      );
      addOverhangingGableRoof(
        s,
        -3,
        4,
        -2,
        0,
        2,
        VoxelType.RoofTileRed,
        VoxelType.Plank
      );
      // Stacked log pyramid in yard
      addBox(s, 1, 1, -2, 3, 1, 2, VoxelType.WoodLog);
      addBox(s, 2, 2, -1, 3, 2, 1, VoxelType.BirchLog);
    }
  ),

  // ============================================================================
  // ERA 3: BRONZE AGE (8 Detailed Multi-Block Structures)
  // ============================================================================
  AdobeBrickHouse: buildBlueprint(
    'AdobeBrickHouse',
    'Terraced Clay-Brick Villa',
    EraType.BronzeAge,
    'Shelter',
    9,
    9,
    8,
    18,
    28,
    4,
    'Two-level fired-brick residence with rooftop garden terrace, columns, and red clay roof tiles.',
    'Masonry & Brickmaking',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -3,
        1,
        -3,
        3,
        4,
        3,
        VoxelType.ClayBrick,
        VoxelType.MudBrick,
        VoxelType.GlassPane
      );
      addBox(s, -3, 5, -3, 3, 5, 3, VoxelType.RoofTileRed);
      addFramedWallsWithDoorAndWindows(
        s,
        -2,
        6,
        -2,
        2,
        7,
        2,
        VoxelType.MudBrick,
        VoxelType.WoodLog
      );
      addBox(s, -2, 8, -2, 2, 8, 2, VoxelType.RoofTileRed);
    }
  ),

  OpenQuarry: buildBlueprint(
    'OpenQuarry',
    'Excavated Quarry & Timber Crane',
    EraType.BronzeAge,
    'Industry',
    9,
    9,
    8,
    20,
    24,
    6,
    'Terraced stone and copper excavation pit with a tall rotating timber hoist crane.',
    'Masonry & Brickmaking',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.Cobblestone);
      addBox(s, -3, 1, -3, 3, 1, 3, VoxelType.Stone, true);
      // Exposed ore veins
      s.push({ dx: 2, dy: 1, dz: 2, voxel: VoxelType.CopperOre });
      s.push({ dx: -2, dy: 1, dz: 2, voxel: VoxelType.IronOre });
      s.push({ dx: 0, dy: 1, dz: 2, voxel: VoxelType.GoldOre });
      // Tall Timber Hoist Crane
      for (let y = 1; y <= 7; y++) {
        s.push({ dx: -3, dy: y, dz: -3, voxel: VoxelType.WoodLog });
      }
      addBox(s, -3, 7, -3, 2, 7, -3, VoxelType.Plank);
      s.push({ dx: 2, dy: 6, dz: -3, voxel: VoxelType.WoodLog });
      s.push({ dx: 2, dy: 5, dz: -3, voxel: VoxelType.StoneBrick });
    }
  ),

  CopperSmeltery: buildBlueprint(
    'CopperSmeltery',
    'Twin-Chimney Bronze Foundry',
    EraType.BronzeAge,
    'Industry',
    8,
    8,
    9,
    16,
    30,
    10,
    'Brick foundry hall with twin smoking blast chimneys and glowing bronze casting crucibles.',
    'Bronze Metallurgy',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -3,
        1,
        -3,
        3,
        3,
        3,
        VoxelType.ClayBrick,
        VoxelType.StoneBrick
      );
      addBox(s, -3, 4, -3, 3, 4, 3, VoxelType.RoofTileSlate);
      // Twin Smelting Chimneys
      for (const cx of [-2, 2]) {
        addBox(s, cx, 1, 1, cx + 1, 7, 2, VoxelType.StoneBrick);
        s.push({ dx: cx, dy: 8, dz: 1, voxel: VoxelType.TorchEmber });
      }
    }
  ),

  PotteryKiln: buildBlueprint(
    'PotteryKiln',
    'Ceramics Workshop & Dome Kilns',
    EraType.BronzeAge,
    'Industry',
    8,
    7,
    6,
    14,
    22,
    4,
    'Artisan courtyard featuring beehive brick kilns and colorful glazed amphorae.',
    'Pottery & Storage',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.MudBrick);
      addBox(s, -3, 1, -2, -1, 3, 1, VoxelType.ClayBrick, true);
      addBox(s, -2, 4, -1, -1, 4, 0, VoxelType.RoofTileRed);
      s.push({ dx: -2, dy: 5, dz: -1, voxel: VoxelType.TorchEmber });
      // Covered drying rack
      addBox(s, 1, 1, -2, 3, 3, 2, VoxelType.Plank, true);
      addBox(s, 1, 4, -2, 3, 4, 2, VoxelType.MarketCanopyGold);
    }
  ),

  BarterMarketStall: buildBlueprint(
    'BarterMarketStall',
    'Twin-Canopy Bazaar Pavilion',
    EraType.BronzeAge,
    'Trade',
    9,
    7,
    6,
    20,
    14,
    4,
    'Vibrant paved bazaar with striped red-and-gold cloth awnings and merchant counters.',
    'Barter & Trade',
    (s) => {
      addBox(s, -4, 0, -3, 4, 0, 3, VoxelType.RoadPaved);
      for (const [px, pz] of [
        [-4, -3],
        [0, -3],
        [4, -3],
        [-4, 3],
        [0, 3],
        [4, 3],
      ]) {
        for (let y = 1; y <= 3; y++) {
          s.push({ dx: px, dy: y, dz: pz, voxel: VoxelType.WoodLog });
        }
      }
      addBox(s, -3, 1, 0, 3, 1, 1, VoxelType.Plank);
      for (let z = -3; z <= 3; z++) {
        for (let x = -4; x <= 4; x++) {
          const v =
            (x + z) % 2 === 0
              ? VoxelType.MarketCanopyRed
              : VoxelType.MarketCanopyGold;
          s.push({ dx: x, dy: 4, dz: z, voxel: v });
        }
      }
    }
  ),

  WoodenPalisade: buildBlueprint(
    'WoodenPalisade',
    'Fortified Timber Gatehouse & Wall',
    EraType.BronzeAge,
    'Military',
    9,
    4,
    6,
    26,
    8,
    0,
    'Log rampart with an elevated walkway and central arched gatehouse.',
    'Palisade Defense',
    (s) => {
      addBox(s, -4, 0, -1, 4, 0, 1, VoxelType.Cobblestone);
      for (let x = -4; x <= 4; x++) {
        if (Math.abs(x) <= 1) {
          // Gate arch
          s.push({ dx: x, dy: 4, dz: 0, voxel: VoxelType.WoodLog });
          s.push({ dx: x, dy: 5, dz: 0, voxel: VoxelType.Thatch });
        } else {
          for (let y = 1; y <= 4; y++) {
            s.push({ dx: x, dy: y, dz: 0, voxel: VoxelType.WoodLog });
          }
          s.push({ dx: x, dy: 3, dz: 1, voxel: VoxelType.Plank });
        }
      }
    }
  ),

  TimberWatchtower: buildBlueprint(
    'TimberWatchtower',
    'Tall Frontier Signal Watchtower',
    EraType.BronzeAge,
    'Military',
    7,
    7,
    11,
    30,
    16,
    4,
    'Soaring timber lookout tower with cantilevered balcony, pitched roof, and warning brazier.',
    'Palisade Defense',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.Cobblestone);
      addBox(s, -2, 1, -2, 2, 2, 2, VoxelType.StoneBrick, true);
      for (let y = 3; y <= 8; y++) {
        for (const [px, pz] of [
          [-2, -2],
          [2, -2],
          [-2, 2],
          [2, 2],
        ]) {
          s.push({ dx: px, dy: y, dz: pz, voxel: VoxelType.WoodLog });
        }
      }
      addBox(s, -3, 7, -3, 3, 7, 3, VoxelType.Plank);
      addOverhangingGableRoof(
        s,
        -2,
        9,
        -2,
        2,
        2,
        VoxelType.RoofTileRed,
        VoxelType.Plank
      );
      s.push({ dx: 0, dy: 8, dz: -3, voxel: VoxelType.TorchEmber });
    }
  ),

  ZigguratShrine: buildBlueprint(
    'ZigguratShrine',
    'Monumental Stepped Bronze Ziggurat',
    EraType.BronzeAge,
    'Spiritual',
    11,
    11,
    10,
    18,
    55,
    14,
    'Four-tiered monumental brick pyramid with grand central staircase and golden sun sanctuary.',
    'Organized Priesthood',
    (s) => {
      addBox(s, -5, 0, -5, 5, 1, 5, VoxelType.MudBrick);
      addBox(s, -4, 2, -4, 4, 3, 4, VoxelType.ClayBrick);
      addBox(s, -3, 4, -3, 3, 5, 3, VoxelType.MudBrick);
      addBox(s, -2, 6, -2, 2, 7, 2, VoxelType.GoldBlock);
      // Central staircase up the front (-Z)
      for (let step = 0; step < 6; step++) {
        s.push({
          dx: 0,
          dy: step + 1,
          dz: -5 + step,
          voxel: VoxelType.StoneBrick,
        });
      }
      s.push({ dx: 0, dy: 8, dz: 0, voxel: VoxelType.TorchEmber });
      s.push({ dx: -1, dy: 8, dz: -1, voxel: VoxelType.CrystalBlock });
      s.push({ dx: 1, dy: 8, dz: -1, voxel: VoxelType.CrystalBlock });
    }
  ),

  // ============================================================================
  // ERA 4: IRON AGE (8 Detailed Multi-Block Structures)
  // ============================================================================
  TimberFramedHouse: buildBlueprint(
    'TimberFramedHouse',
    'Two-Story Tudor Timber Townhouse',
    EraType.IronAge,
    'Shelter',
    10,
    9,
    10,
    32,
    30,
    8,
    'Classic two-story half-timbered house (matching reference village!) with stone lower walls, overhanging upper timber floor, red tile gable roof, and tall chimney.',
    'Ironworking',
    (s) => {
      addBox(s, -4, 0, -3, 4, 0, 3, VoxelType.StoneBrick);
      // Ground floor masonry
      addFramedWallsWithDoorAndWindows(
        s,
        -3,
        1,
        -3,
        3,
        3,
        3,
        VoxelType.Cobblestone,
        VoxelType.WoodLog,
        VoxelType.GlassPane
      );
      // Jettying 2nd floor timber frame
      addBox(s, -4, 4, -4, 4, 4, 4, VoxelType.DarkPlank);
      addFramedWallsWithDoorAndWindows(
        s,
        -4,
        5,
        -3,
        4,
        6,
        3,
        VoxelType.Plank,
        VoxelType.WoodLog,
        VoxelType.GlassPane
      );
      addOverhangingGableRoof(
        s,
        -4,
        7,
        -3,
        4,
        3,
        VoxelType.RoofTileRed,
        VoxelType.Plank,
        VoxelType.DarkPlank
      );
      // Tall stone chimney with glowing ember top
      for (let y = 1; y <= 10; y++) {
        s.push({ dx: 4, dy: y, dz: 0, voxel: VoxelType.StoneBrick });
      }
      s.push({ dx: 4, dy: 11, dz: 0, voxel: VoxelType.TorchEmber });
    }
  ),

  IronBloomeryForge: buildBlueprint(
    'IronBloomeryForge',
    'Master Blacksmith & Ironworks',
    EraType.IronAge,
    'Industry',
    9,
    9,
    9,
    24,
    38,
    20,
    'Stone-and-timber smithy with outdoor anvil courtyard, quenching trough, and roaring blast furnace.',
    'Ironworking',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.Cobblestone);
      addFramedWallsWithDoorAndWindows(
        s,
        -4,
        1,
        -3,
        1,
        4,
        3,
        VoxelType.StoneBrick,
        VoxelType.WoodLog
      );
      addOverhangingGableRoof(
        s,
        -4,
        5,
        -3,
        1,
        3,
        VoxelType.RoofTileSlate,
        VoxelType.StoneBrick
      );
      // Blast furnace stack & outdoor anvil yard
      addBox(s, 2, 1, 0, 4, 7, 2, VoxelType.StoneBrick);
      s.push({ dx: 3, dy: 8, dz: 1, voxel: VoxelType.TorchEmber });
      s.push({ dx: 3, dy: 1, dz: -2, voxel: VoxelType.Water });
      s.push({ dx: 2, dy: 1, dz: -2, voxel: VoxelType.IronOre });
    }
  ),

  StoneBridge: buildBlueprint(
    'StoneBridge',
    'Arched Ashlar Masonry Bridge',
    EraType.IronAge,
    'Infrastructure',
    11,
    6,
    5,
    10,
    40,
    6,
    'Grand arched cobblestone river bridge with crenellated stone parapets and road lanterns.',
    'Arch Engineering',
    (s) => {
      addBox(s, -5, 0, -2, 5, 0, 2, VoxelType.BridgeStone);
      addBox(s, -3, 1, -2, 3, 1, 2, VoxelType.RoadPaved);
      for (let x = -5; x <= 5; x++) {
        const y = Math.abs(x) <= 3 ? 2 : 1;
        s.push({ dx: x, dy: y, dz: -2, voxel: VoxelType.StoneBrick });
        s.push({ dx: x, dy: y, dz: 2, voxel: VoxelType.StoneBrick });
      }
      s.push({ dx: 0, dy: 3, dz: -2, voxel: VoxelType.TorchEmber });
      s.push({ dx: 0, dy: 3, dz: 2, voxel: VoxelType.TorchEmber });
    }
  ),

  PavedStoneRoad: buildBlueprint(
    'PavedStoneRoad',
    'Imperial Cobblestone Boulevard',
    EraType.IronAge,
    'Infrastructure',
    8,
    6,
    4,
    4,
    20,
    4,
    'Wide stone-paved avenue flanked by marble curbs, flower boxes, and iron streetlamps.',
    'Arch Engineering',
    (s) => {
      addBox(s, -3, 0, -1, 3, 0, 1, VoxelType.RoadPaved);
      addBox(s, -3, 0, -2, 3, 0, -2, VoxelType.StoneBrick);
      addBox(s, -3, 0, 2, 3, 0, 2, VoxelType.StoneBrick);
      for (const lx of [-2, 2]) {
        s.push({ dx: lx, dy: 1, dz: -2, voxel: VoxelType.Cobblestone });
        s.push({ dx: lx, dy: 2, dz: -2, voxel: VoxelType.Cobblestone });
        s.push({ dx: lx, dy: 3, dz: -2, voxel: VoxelType.TorchEmber });
      }
    }
  ),

  BarracksCompound: buildBlueprint(
    'BarracksCompound',
    'Fortified Legion Barracks',
    EraType.IronAge,
    'Military',
    10,
    10,
    8,
    28,
    46,
    22,
    'Walled military garrison with armory hall, crimson banners, and courtyard training grounds.',
    'Standing Army',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -4,
        1,
        -4,
        4,
        4,
        1,
        VoxelType.StoneBrick,
        VoxelType.Cobblestone
      );
      addOverhangingGableRoof(
        s,
        -4,
        5,
        -4,
        4,
        1,
        VoxelType.RoofTileRed,
        VoxelType.StoneBrick
      );
      // Courtyard perimeter wall & banners
      addBox(s, -4, 1, 4, 4, 2, 4, VoxelType.StoneBrick);
      s.push({ dx: -3, dy: 3, dz: 4, voxel: VoxelType.MarketCanopyRed });
      s.push({ dx: 3, dy: 3, dz: 4, voxel: VoxelType.MarketCanopyRed });
    }
  ),

  StoneCurtainWall: buildBlueprint(
    'StoneCurtainWall',
    'Battlemented Stone Curtain Wall',
    EraType.IronAge,
    'Military',
    10,
    4,
    7,
    8,
    44,
    8,
    'Thick ashlar defensive rampart with crenels, merlons, and a defender parapet walk.',
    'Fortification Masonry',
    (s) => {
      addBox(s, -4, 0, -1, 4, 4, 1, VoxelType.StoneBrick);
      for (let x = -4; x <= 4; x += 2) {
        s.push({ dx: x, dy: 5, dz: -1, voxel: VoxelType.StoneBrick });
        s.push({ dx: x, dy: 5, dz: 1, voxel: VoxelType.StoneBrick });
      }
    }
  ),

  StoneGuardTower: buildBlueprint(
    'StoneGuardTower',
    'Crenellated Bastion Watchtower',
    EraType.IronAge,
    'Military',
    8,
    8,
    13,
    20,
    60,
    16,
    'Commanding stone bastion tower with overhanging machicolations, slate spire, and beacon.',
    'Fortification Masonry',
    (s) => {
      addBox(s, -3, 0, -3, 3, 0, 3, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -2,
        1,
        -2,
        2,
        8,
        2,
        VoxelType.StoneBrick,
        VoxelType.Cobblestone
      );
      addBox(s, -3, 9, -3, 3, 9, 3, VoxelType.StoneBrick);
      for (let x = -3; x <= 3; x += 2) {
        for (let z = -3; z <= 3; z += 2) {
          if (Math.abs(x) === 3 || Math.abs(z) === 3) {
            s.push({ dx: x, dy: 10, dz: z, voxel: VoxelType.StoneBrick });
          }
        }
      }
      addBox(s, -1, 10, -1, 1, 11, 1, VoxelType.RoofTileSlate);
      s.push({ dx: 0, dy: 12, dz: 0, voxel: VoxelType.TorchEmber });
    }
  ),

  CaravanTradingPost: buildBlueprint(
    'CaravanTradingPost',
    'Merchant Caravan Guild & Stables',
    EraType.IronAge,
    'Trade',
    10,
    9,
    8,
    32,
    34,
    12,
    'bustling trade hub with timber warehouse, colorful merchant awnings, and cargo wagons.',
    'Caravan Trade Routes',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.RoadPaved);
      addFramedWallsWithDoorAndWindows(
        s,
        -4,
        1,
        -3,
        1,
        4,
        3,
        VoxelType.Plank,
        VoxelType.WoodLog
      );
      addOverhangingGableRoof(
        s,
        -4,
        5,
        -3,
        1,
        3,
        VoxelType.RoofTileRed,
        VoxelType.Plank
      );
      // Outdoor trade stall canopy
      addBox(s, 2, 1, -2, 4, 3, 2, VoxelType.WoodLog, true);
      addBox(s, 2, 4, -2, 4, 4, 2, VoxelType.MarketCanopyBlue);
    }
  ),

  // ============================================================================
  // ERA 5: MEDIEVAL AGE (8 Detailed Multi-Block Structures)
  // ============================================================================
  StoneManorHouse: buildBlueprint(
    'StoneManorHouse',
    'Grand Lordly Slate-Roofed Manor',
    EraType.Medieval,
    'Shelter',
    11,
    10,
    11,
    40,
    55,
    18,
    'Multi-winged noble manor with white marble pillars, leaded glass windows, and steep slate gables.',
    'Feudal Architecture',
    (s) => {
      addBox(s, -5, 0, -4, 5, 0, 4, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -4,
        1,
        -3,
        4,
        3,
        3,
        VoxelType.StoneBrick,
        VoxelType.WhiteMarble,
        VoxelType.GlassPane
      );
      addFramedWallsWithDoorAndWindows(
        s,
        -4,
        4,
        -3,
        4,
        6,
        3,
        VoxelType.Plank,
        VoxelType.DarkPlank,
        VoxelType.GlassPane
      );
      addOverhangingGableRoof(
        s,
        -4,
        7,
        -3,
        4,
        3,
        VoxelType.RoofTileSlate,
        VoxelType.WhiteMarble,
        VoxelType.GoldBlock
      );
    }
  ),

  Windmill: buildBlueprint(
    'Windmill',
    'Tall Hilltop Grain Windmill',
    EraType.Medieval,
    'Food',
    11,
    11,
    15,
    44,
    42,
    14,
    'Iconic stone-and-timber windmill tower with four grand canvas sails (matching the reference village!).',
    'Mechanical Windpower',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.Cobblestone);
      // Octagonal/square tapered stone base
      addFramedWallsWithDoorAndWindows(
        s,
        -3,
        1,
        -3,
        3,
        4,
        3,
        VoxelType.Cobblestone,
        VoxelType.StoneBrick
      );
      // Timber upper mill house
      addFramedWallsWithDoorAndWindows(
        s,
        -2,
        5,
        -2,
        2,
        10,
        2,
        VoxelType.Plank,
        VoxelType.WoodLog
      );
      addOverhangingGableRoof(
        s,
        -2,
        11,
        -2,
        2,
        2,
        VoxelType.RoofTileRed,
        VoxelType.Plank
      );
      // Grand Windmill Sails on front (-Z = -3)
      s.push({ dx: 0, dy: 9, dz: -3, voxel: VoxelType.WoodLog });
      s.push({ dx: 0, dy: 9, dz: -4, voxel: VoxelType.GoldBlock });
      for (let d = 1; d <= 5; d++) {
        // 4 diagonal timber spars + white/gold canvas sails
        s.push({ dx: d, dy: 9 + d, dz: -3, voxel: VoxelType.WoodLog });
        s.push({ dx: d - 1, dy: 9 + d, dz: -3, voxel: VoxelType.WhiteMarble });
        s.push({ dx: -d, dy: 9 - d, dz: -3, voxel: VoxelType.WoodLog });
        s.push({ dx: -d + 1, dy: 9 - d, dz: -3, voxel: VoxelType.WhiteMarble });
        s.push({ dx: -d, dy: 9 + d, dz: -3, voxel: VoxelType.WoodLog });
        s.push({ dx: -d, dy: 9 + d - 1, dz: -3, voxel: VoxelType.WhiteMarble });
        s.push({ dx: d, dy: 9 - d, dz: -3, voxel: VoxelType.WoodLog });
        s.push({ dx: d, dy: 9 - d + 1, dz: -3, voxel: VoxelType.WhiteMarble });
      }
    }
  ),

  GrandMarketPlaza: buildBlueprint(
    'GrandMarketPlaza',
    'Royal Festival Market Square',
    EraType.Medieval,
    'Trade',
    13,
    13,
    7,
    46,
    50,
    18,
    'Sprawling cobblestone market plaza with central marble fountain and 4 colorful merchant pavilions.',
    'Merchant Guilds',
    (s) => {
      addBox(s, -6, 0, -6, 6, 0, 6, VoxelType.RoadPaved);
      // Central Marble Fountain
      addBox(s, -1, 1, -1, 1, 1, 1, VoxelType.WhiteMarble);
      s.push({ dx: 0, dy: 1, dz: 0, voxel: VoxelType.Water });
      for (let y = 2; y <= 4; y++) {
        s.push({ dx: 0, dy: y, dz: 0, voxel: VoxelType.WhiteMarble });
      }
      s.push({ dx: 0, dy: 5, dz: 0, voxel: VoxelType.CrystalBlock });

      // 4 Colorful Corner Market Stalls (Red, Gold, Blue, Emerald)
      const stalls: [number, number, VoxelType][] = [
        [-5, -5, VoxelType.MarketCanopyRed],
        [3, -5, VoxelType.MarketCanopyGold],
        [-5, 3, VoxelType.MarketCanopyBlue],
        [3, 3, VoxelType.MarketCanopyRed],
      ];
      for (const [sx, sz, canopy] of stalls) {
        for (const [px, pz] of [
          [sx, sz],
          [sx + 2, sz],
          [sx, sz + 2],
          [sx + 2, sz + 2],
        ]) {
          s.push({ dx: px, dy: 1, dz: pz, voxel: VoxelType.WoodLog });
          s.push({ dx: px, dy: 2, dz: pz, voxel: VoxelType.WoodLog });
        }
        addBox(s, sx, 1, sz + 1, sx + 2, 1, sz + 1, VoxelType.Plank);
        addBox(s, sx, 3, sz, sx + 2, 3, sz + 2, canopy);
      }
    }
  ),

  GuildWorkshop: buildBlueprint(
    'GuildWorkshop',
    'Master Artisans & Engineers Guildhall',
    EraType.Medieval,
    'Industry',
    10,
    9,
    10,
    42,
    46,
    22,
    'Ornate timber-and-stone guildhall with belfry gable and outdoor crane.',
    'Merchant Guilds',
    (s) => {
      addBox(s, -4, 0, -4, 4, 0, 4, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -4,
        1,
        -3,
        4,
        5,
        3,
        VoxelType.Plank,
        VoxelType.WoodLog,
        VoxelType.GlassPane
      );
      addOverhangingGableRoof(
        s,
        -4,
        6,
        -3,
        4,
        3,
        VoxelType.RoofTileRed,
        VoxelType.DarkPlank,
        VoxelType.GoldBlock
      );
    }
  ),

  CathedralSanctuary: buildBlueprint(
    'CathedralSanctuary',
    'Twin-Spired Gothic Cathedral',
    EraType.Medieval,
    'Spiritual',
    11,
    13,
    16,
    40,
    85,
    30,
    'Majestic stone cathedral with flying buttresses, stained-glass rose windows, and soaring golden bell spires.',
    'Theology & Bellcasting',
    (s) => {
      addBox(s, -5, 0, -6, 5, 0, 6, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -4,
        1,
        -5,
        4,
        6,
        5,
        VoxelType.StoneBrick,
        VoxelType.WhiteMarble,
        VoxelType.GlassPane
      );
      addOverhangingGableRoof(
        s,
        -4,
        7,
        -5,
        4,
        5,
        VoxelType.RoofTileSlate,
        VoxelType.StoneBrick,
        VoxelType.GoldBlock
      );
      // Front Bell Tower Spire
      addFramedWallsWithDoorAndWindows(
        s,
        -2,
        7,
        -5,
        2,
        12,
        -2,
        VoxelType.StoneBrick,
        VoxelType.WhiteMarble
      );
      addBox(s, -1, 13, -4, 1, 14, -3, VoxelType.RoofTileSlate);
      s.push({ dx: 0, dy: 15, dz: -3, voxel: VoxelType.GoldBlock });
    }
  ),

  HarborDock: buildBlueprint(
    'HarborDock',
    'Maritime Trade Wharf & Galleon Pier',
    EraType.Medieval,
    'Trade',
    11,
    8,
    7,
    44,
    30,
    12,
    'Extended timber wharf with harbor master house, cargo crane, and moored merchant vessel.',
    'Navigation & Shipbuilding',
    (s) => {
      addBox(s, -5, 0, -3, 5, 0, 3, VoxelType.BridgeWood);
      addFramedWallsWithDoorAndWindows(
        s,
        -5,
        1,
        -2,
        -1,
        3,
        2,
        VoxelType.Plank,
        VoxelType.WoodLog
      );
      addOverhangingGableRoof(
        s,
        -5,
        4,
        -2,
        -1,
        2,
        VoxelType.RoofTileRed,
        VoxelType.Plank
      );
      // Small moored sailboat at +X end of pier
      addBox(s, 2, 1, -1, 5, 1, 1, VoxelType.DarkPlank);
      for (let y = 2; y <= 6; y++) {
        s.push({ dx: 3, dy: y, dz: 0, voxel: VoxelType.WoodLog });
      }
      addBox(s, 3, 3, -2, 3, 5, 2, VoxelType.WhiteMarble);
    }
  ),

  CastleKeep: buildBlueprint(
    'CastleKeep',
    'Royal Four-Turret Citadel Keep',
    EraType.Medieval,
    'Military',
    13,
    13,
    15,
    50,
    110,
    45,
    'Colossal fortified stone castle with four corner towers, crenellated curtain walls, and royal keep.',
    'Siegecraft & Citadels',
    (s) => {
      addBox(s, -6, 0, -6, 6, 0, 6, VoxelType.StoneBrick);
      // Inner Royal Keep
      addFramedWallsWithDoorAndWindows(
        s,
        -3,
        1,
        -3,
        3,
        9,
        3,
        VoxelType.StoneBrick,
        VoxelType.WhiteMarble,
        VoxelType.GlassPane
      );
      addBox(s, -3, 10, -3, 3, 10, 3, VoxelType.RoofTileSlate);
      s.push({ dx: 0, dy: 11, dz: 0, voxel: VoxelType.GoldBlock });

      // 4 Corner Turrets
      for (const [tx, tz] of [
        [-6, -6],
        [4, -6],
        [-6, 4],
        [4, 4],
      ]) {
        addBox(s, tx, 1, tz, tx + 2, 11, tz + 2, VoxelType.StoneBrick, true);
        addBox(s, tx, 12, tz, tx + 2, 13, tz + 2, VoxelType.RoofTileRed);
        s.push({ dx: tx + 1, dy: 14, dz: tz + 1, voxel: VoxelType.GoldBlock });
      }
    }
  ),

  AqueductSegment: buildBlueprint(
    'AqueductSegment',
    'Monumental Two-Tier Stone Aqueduct',
    EraType.Medieval,
    'Infrastructure',
    11,
    5,
    9,
    14,
    60,
    12,
    'Soaring Romanesque stone arches carrying an elevated fresh mountain water channel.',
    'Hydraulic Engineering',
    (s) => {
      for (const px of [-4, 0, 4]) {
        addBox(s, px - 1, 0, -1, px + 1, 6, 1, VoxelType.StoneBrick);
      }
      addBox(s, -5, 7, -1, 5, 7, 1, VoxelType.StoneBrick);
      addBox(s, -5, 8, -1, 5, 8, -1, VoxelType.WhiteMarble);
      addBox(s, -5, 8, 1, 5, 8, 1, VoxelType.WhiteMarble);
      addBox(s, -5, 8, 0, 5, 8, 0, VoxelType.Water);
    }
  ),

  // ============================================================================
  // ERA 6: ARCANE & RENAISSANCE AGE (5 Detailed Multi-Block Wonders)
  // ============================================================================
  UniversityAcademy: buildBlueprint(
    'UniversityAcademy',
    'Grand Marble & Azure Dome University',
    EraType.ArcaneRenaissance,
    'Civic',
    13,
    11,
    13,
    60,
    95,
    45,
    'Colonnaded marble palace of learning crowned by a crystalline azure dome and golden finial.',
    'Scientific Method',
    (s) => {
      addBox(s, -6, 0, -5, 6, 0, 5, VoxelType.WhiteMarble);
      addFramedWallsWithDoorAndWindows(
        s,
        -5,
        1,
        -4,
        5,
        6,
        4,
        VoxelType.WhiteMarble,
        VoxelType.GoldBlock,
        VoxelType.GlassPane
      );
      addBox(s, -5, 7, -4, 5, 7, 4, VoxelType.RoofTileSlate);
      addBox(s, -3, 8, -3, 3, 10, 3, VoxelType.GlassPane, true);
      addBox(s, -1, 11, -1, 1, 11, 1, VoxelType.GoldBlock);
      s.push({ dx: 0, dy: 12, dz: 0, voxel: VoxelType.CrystalBlock });
    }
  ),

  AlchemicalObservatory: buildBlueprint(
    'AlchemicalObservatory',
    'Celestial Telescope & Arcane Observatory',
    EraType.ArcaneRenaissance,
    'Industry',
    11,
    11,
    14,
    45,
    80,
    55,
    'Octagonal marble tower with a rotating glass observatory dome and golden brass telescope.',
    'Astronomy & Optics',
    (s) => {
      addBox(s, -5, 0, -5, 5, 0, 5, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -3,
        1,
        -3,
        3,
        8,
        3,
        VoxelType.WhiteMarble,
        VoxelType.StoneBrick,
        VoxelType.GlassPane
      );
      addBox(s, -4, 9, -4, 4, 9, 4, VoxelType.GoldBlock);
      addBox(s, -3, 10, -3, 3, 12, 3, VoxelType.GlassPane, true);
      // Giant golden telescope barrel extending outward
      for (let d = 1; d <= 4; d++) {
        s.push({
          dx: 0,
          dy: 11 + Math.floor(d / 2),
          dz: -2 - d,
          voxel: VoxelType.GoldBlock,
        });
      }
      s.push({ dx: 0, dy: 13, dz: 0, voxel: VoxelType.CrystalBlock });
    }
  ),

  ClocktowerMonument: buildBlueprint(
    'ClocktowerMonument',
    'Imperial Golden Clocktower Spire',
    EraType.ArcaneRenaissance,
    'Civic',
    9,
    9,
    18,
    50,
    90,
    60,
    'Soaring 18-level civic clocktower with four illuminated gold clock faces and crystal belfry.',
    'Clockwork Precision',
    (s) => {
      addBox(s, -4, 0, -4, 4, 1, 4, VoxelType.StoneBrick);
      addFramedWallsWithDoorAndWindows(
        s,
        -2,
        2,
        -2,
        2,
        12,
        2,
        VoxelType.WhiteMarble,
        VoxelType.StoneBrick
      );
      // 4 Golden Clock Faces at y = 10..11
      for (const [cx, cz] of [
        [0, -3],
        [0, 3],
        [-3, 0],
        [3, 0],
      ]) {
        s.push({ dx: cx, dy: 10, dz: cz, voxel: VoxelType.GoldBlock });
        s.push({ dx: cx, dy: 11, dz: cz, voxel: VoxelType.CrystalBlock });
      }
      addBox(s, -3, 13, -3, 3, 13, 3, VoxelType.GoldBlock);
      addBox(s, -2, 14, -2, 2, 15, 2, VoxelType.RoofTileSlate);
      addBox(s, -1, 16, -1, 1, 16, 1, VoxelType.GoldBlock);
      s.push({ dx: 0, dy: 17, dz: 0, voxel: VoxelType.CrystalBlock });
    }
  ),

  CrystalSanctum: buildBlueprint(
    'CrystalSanctum',
    'Radiant Arcane Crystal Sanctum',
    EraType.ArcaneRenaissance,
    'Spiritual',
    13,
    13,
    14,
    50,
    100,
    80,
    'Iconic stepped stone and marble sanctuary (featured in your reference image!) with glowing cyan rune pillars and a floating central crystal monolith.',
    'Arcane Crystallography',
    (s) => {
      addBox(s, -6, 0, -6, 6, 0, 6, VoxelType.StoneBrick);
      addBox(s, -5, 1, -5, 5, 1, 5, VoxelType.WhiteMarble);
      addBox(s, -3, 2, -3, 3, 2, 3, VoxelType.StoneBrick);

      // Ring of 12 Glowing Crystal Rune Pillars around perimeter
      for (const [px, pz] of [
        [-6, -6],
        [-2, -6],
        [2, -6],
        [6, -6],
        [-6, 6],
        [-2, 6],
        [2, 6],
        [6, 6],
        [-6, -2],
        [-6, 2],
        [6, -2],
        [6, 2],
      ]) {
        s.push({ dx: px, dy: 1, dz: pz, voxel: VoxelType.StoneBrick });
        s.push({ dx: px, dy: 2, dz: pz, voxel: VoxelType.WhiteMarble });
        s.push({ dx: px, dy: 3, dz: pz, voxel: VoxelType.CrystalBlock });
      }

      // Inner Marble Arch Shrine Frame
      for (let y = 3; y <= 8; y++) {
        for (const [ax, az] of [
          [-2, -2],
          [2, -2],
          [-2, 2],
          [2, 2],
        ]) {
          s.push({ dx: ax, dy: y, dz: az, voxel: VoxelType.WhiteMarble });
        }
      }
      addBox(s, -2, 9, -2, 2, 9, 2, VoxelType.GoldBlock);

      // Central Towering Radiant Cyan Crystal Spire
      for (let y = 3; y <= 13; y++) {
        s.push({ dx: 0, dy: y, dz: 0, voxel: VoxelType.CrystalBlock });
      }
      for (let y = 4; y <= 10; y += 2) {
        s.push({ dx: -1, dy: y, dz: 0, voxel: VoxelType.CrystalBlock });
        s.push({ dx: 1, dy: y, dz: 0, voxel: VoxelType.CrystalBlock });
        s.push({ dx: 0, dy: y, dz: -1, voxel: VoxelType.CrystalBlock });
        s.push({ dx: 0, dy: y, dz: 1, voxel: VoxelType.CrystalBlock });
      }
    }
  ),

  GrandPantheonWonder: buildBlueprint(
    'GrandPantheonWonder',
    'Supreme Pantheon of Eternal Civilizations',
    EraType.ArcaneRenaissance,
    'Wonder',
    15,
    15,
    17,
    80,
    140,
    95,
    'Ultimate architectural wonder of white marble colonnades, golden domes, and radiant crystal spires.',
    'Monumental Wonders',
    (s) => {
      addBox(s, -7, 0, -7, 7, 1, 7, VoxelType.WhiteMarble);
      addFramedWallsWithDoorAndWindows(
        s,
        -6,
        2,
        -6,
        6,
        8,
        6,
        VoxelType.WhiteMarble,
        VoxelType.GoldBlock,
        VoxelType.GlassPane
      );
      addBox(s, -6, 9, -6, 6, 9, 6, VoxelType.GoldBlock);
      addBox(s, -4, 10, -4, 4, 13, 4, VoxelType.GlassPane, true);
      addBox(s, -2, 14, -2, 2, 15, 2, VoxelType.GoldBlock);
      s.push({ dx: 0, dy: 16, dz: 0, voxel: VoxelType.CrystalBlock });
    }
  ),

  // ============================================================================
  // PART 4 (ITEM 14): WATERFRONT, FISHING & MARITIME STRUCTURES
  // ============================================================================
  FishingStakes: {
    ...buildBlueprint(
      'FishingStakes',
      'Lagoon Fishing Weir & Traps',
      EraType.StoneAge,
      'Waterfront',
      7,
      5,
      3,
      6,
      2,
      0,
      'V-shaped timber weir stakes and woven reed fish traps set in shallow coastal/river waters.',
      'Foraging Mastery',
      (s) => {
        for (let x = -3; x <= 3; x++) {
          const z = Math.abs(x) - 1;
          s.push({ dx: x, dy: 0, dz: z, voxel: VoxelType.WoodLog });
          s.push({ dx: x, dy: 1, dz: z, voxel: VoxelType.WoodLog });
          if (x % 2 === 0) {
            s.push({ dx: x, dy: 2, dz: z, voxel: VoxelType.Thatch });
          }
        }
        addBox(s, -1, 0, -2, 1, 0, 0, VoxelType.BridgeWood);
      }
    ),
    isWaterfront: true,
  },

  FishDryingRack: {
    ...buildBlueprint(
      'FishDryingRack',
      'Shoreline Fish Curing & Smoking Racks',
      EraType.StoneAge,
      'Waterfront',
      6,
      5,
      4,
      8,
      4,
      0,
      'Timber A-frame racks for sun-drying and smoking river trout and ocean fish.',
      'Foraging Mastery',
      (s) => {
        addBox(s, -2, 0, -2, 2, 0, 2, VoxelType.Sand);
        for (const x of [-2, 0, 2]) {
          s.push({ dx: x, dy: 1, dz: -1, voxel: VoxelType.WoodLog });
          s.push({ dx: x, dy: 2, dz: -1, voxel: VoxelType.WoodLog });
          s.push({ dx: x, dy: 1, dz: 1, voxel: VoxelType.WoodLog });
          s.push({ dx: x, dy: 2, dz: 1, voxel: VoxelType.WoodLog });
        }
        addBox(s, -2, 3, -1, 2, 3, 1, VoxelType.Plank);
        s.push({ dx: 0, dy: 1, dz: 0, voxel: VoxelType.Cobblestone });
      }
    ),
    isWaterfront: true,
  },

  WoodenPier: {
    ...buildBlueprint(
      'WoodenPier',
      'Timber Boat Jetty & Angler Pier',
      EraType.Neolithic,
      'Waterfront',
      9,
      5,
      5,
      16,
      6,
      0,
      'Pile-driven timber pier extending over the water with mooring bollards and net racks.',
      'Carpentry',
      (s) => {
        for (const x of [-4, -2, 0, 2, 4]) {
          s.push({ dx: x, dy: 0, dz: -1, voxel: VoxelType.WoodLog });
          s.push({ dx: x, dy: 0, dz: 1, voxel: VoxelType.WoodLog });
        }
        addBox(s, -4, 1, -1, 4, 1, 1, VoxelType.BridgeWood);
        for (const x of [-4, 0, 4]) {
          s.push({ dx: x, dy: 2, dz: -1, voxel: VoxelType.WoodLog });
          s.push({ dx: x, dy: 2, dz: 1, voxel: VoxelType.WoodLog });
        }
        s.push({ dx: 4, dy: 3, dz: -1, voxel: VoxelType.LanternGlow });
        s.push({ dx: 4, dy: 3, dz: 1, voxel: VoxelType.LanternGlow });
      }
    ),
    isWaterfront: true,
  },

  FishingHut: {
    ...buildBlueprint(
      'FishingHut',
      'Overwater Stilt Lagoon Fishing Hut',
      EraType.Neolithic,
      'Waterfront',
      8,
      8,
      8,
      20,
      8,
      0,
      'Tropical/coastal stilt house raised on timber pilings with a stepped thatch roof and boat deck (matching reference photo!).',
      'Carpentry',
      (s) => {
        // Stilt pilings
        for (const [px, pz] of [
          [-3, -3],
          [0, -3],
          [3, -3],
          [-3, 0],
          [3, 0],
          [-3, 3],
          [0, 3],
          [3, 3],
        ]) {
          s.push({ dx: px, dy: 0, dz: pz, voxel: VoxelType.WoodLog });
          s.push({ dx: px, dy: 1, dz: pz, voxel: VoxelType.WoodLog });
        }
        // Elevated wrap-around deck
        addBox(s, -3, 2, -3, 3, 2, 3, VoxelType.BridgeWood);
        addFramedWallsWithDoorAndWindows(
          s,
          -2,
          3,
          -2,
          2,
          5,
          2,
          VoxelType.Plank,
          VoxelType.WoodLog,
          VoxelType.GlassPane
        );
        // Stepped pyramidal thatch roof
        addBox(s, -3, 6, -3, 3, 6, 3, VoxelType.Thatch);
        addBox(s, -2, 7, -2, 2, 7, 2, VoxelType.Thatch);
        addBox(s, -1, 8, -1, 1, 8, 1, VoxelType.DarkPlank);
      }
    ),
    isWaterfront: true,
  },

  RiverWatermill: {
    ...buildBlueprint(
      'RiverWatermill',
      'Hydro-Wheel River Grain Mill',
      EraType.BronzeAge,
      'Waterfront',
      9,
      8,
      8,
      26,
      24,
      4,
      'Stone-and-timber millhouse beside flowing water with a large paddle waterwheel.',
      'Masonry & Brickmaking',
      (s) => {
        addBox(s, -3, 0, -3, 3, 0, 2, VoxelType.Cobblestone);
        addFramedWallsWithDoorAndWindows(
          s,
          -3,
          1,
          -2,
          2,
          4,
          2,
          VoxelType.Plank,
          VoxelType.WoodLog,
          VoxelType.GlassPane
        );
        addOverhangingGableRoof(
          s,
          -3,
          5,
          -2,
          2,
          2,
          VoxelType.RoofTileRed,
          VoxelType.Plank
        );
        // Side Waterwheel at x = 3..4
        s.push({ dx: 3, dy: 2, dz: 0, voxel: VoxelType.WoodLog });
        for (const [dy, dz] of [
          [1, -1],
          [1, 0],
          [1, 1],
          [2, -2],
          [2, 2],
          [3, -2],
          [3, 2],
          [4, -1],
          [4, 0],
          [4, 1],
        ]) {
          s.push({ dx: 4, dy, dz, voxel: VoxelType.DarkPlank });
        }
      }
    ),
    isWaterfront: true,
  },

  StoneHarbor: {
    ...buildBlueprint(
      'StoneHarbor',
      'Imperial Stone Quay & Customs Wharf',
      EraType.IronAge,
      'Waterfront',
      11,
      9,
      8,
      28,
      48,
      10,
      'Masonry sea wall, craneway, and customs warehouse for maritime trade ships.',
      'Arch Engineering',
      (s) => {
        addBox(s, -5, 0, -4, 5, 1, 4, VoxelType.StoneBrick);
        addFramedWallsWithDoorAndWindows(
          s,
          -5,
          2,
          -3,
          0,
          5,
          2,
          VoxelType.StoneBrick,
          VoxelType.WhiteMarble,
          VoxelType.GlassPane
        );
        addOverhangingGableRoof(
          s,
          -5,
          6,
          -3,
          0,
          2,
          VoxelType.RoofTileRed,
          VoxelType.StoneBrick
        );
        // Quay crane on +X side
        for (let y = 2; y <= 6; y++) {
          s.push({ dx: 3, dy: y, dz: 0, voxel: VoxelType.WoodLog });
        }
        addBox(s, 3, 6, 0, 5, 6, 0, VoxelType.DarkPlank);
      }
    ),
    isWaterfront: true,
  },

  CoastalLighthouse: {
    ...buildBlueprint(
      'CoastalLighthouse',
      'Grand Pharos Beacon Lighthouse',
      EraType.IronAge,
      'Waterfront',
      9,
      9,
      17,
      20,
      65,
      18,
      'Towering striped stone-and-marble coastal beacon guiding ships safely through night and storms.',
      'Fortification Masonry',
      (s) => {
        addBox(s, -4, 0, -4, 4, 1, 4, VoxelType.StoneBrick);
        for (let y = 2; y <= 13; y++) {
          const r = y <= 6 ? 2 : 1;
          const v = y % 3 === 0 ? VoxelType.ClayBrick : VoxelType.WhiteMarble;
          addBox(s, -r, y, -r, r, y, r, v, true);
        }
        addBox(s, -2, 14, -2, 2, 14, 2, VoxelType.StoneBrick);
        addBox(s, -1, 15, -1, 1, 16, 1, VoxelType.LanternGlow);
        s.push({ dx: 0, dy: 17, dz: 0, voxel: VoxelType.RoofTileRed });
      }
    ),
    isWaterfront: true,
  },

  Shipyard: {
    ...buildBlueprint(
      'Shipyard',
      'Royal Naval Drydock & Shipyard',
      EraType.Medieval,
      'Waterfront',
      13,
      10,
      9,
      54,
      46,
      20,
      'Timber slipway and gantry frames constructing ocean-going caravels, galleys, and steamships.',
      'Navigation & Shipbuilding',
      (s) => {
        addBox(s, -6, 0, -4, 6, 0, 4, VoxelType.StoneBrick);
        addBox(s, -5, 1, -2, 5, 1, 2, VoxelType.BridgeWood);
        // Gantry ribs over the hull slipway
        for (const x of [-4, 0, 4]) {
          for (let y = 1; y <= 7; y++) {
            s.push({ dx: x, dy: y, dz: -3, voxel: VoxelType.WoodLog });
            s.push({ dx: x, dy: y, dz: 3, voxel: VoxelType.WoodLog });
          }
          addBox(s, x, 7, -3, x, 7, 3, VoxelType.DarkPlank);
        }
        // Keel & ribs of a ship under construction in the slipway
        addBox(s, -3, 2, -1, 3, 3, 1, VoxelType.Plank, true);
      }
    ),
    isWaterfront: true,
  },
};

export const ALL_BLUEPRINTS_LIST: StructureBlueprint[] = Object.values(
  STRUCTURE_BLUEPRINTS
);

export function getBlueprintsForEra(era: EraType): StructureBlueprint[] {
  return ALL_BLUEPRINTS_LIST.filter((b) => b.era === era);
}


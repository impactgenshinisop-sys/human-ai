/**
 * Dedicated Chunk Meshing Web Worker (Separate from Simulation Worker)
 * - Supports 256-block vertical worlds (CHUNK_HEIGHT = 256) with fast section-skipping
 *   so empty air above terrain/mountains is skipped in O(1)
 * - Zero-allocation TypedArray scratch buffers (eliminates per-chunk GC array churn)
 * - Deterministic cross-chunk border lookup via seeded sampleColumn (culls 100% of hidden
 *   underground chunk border walls while keeping cliff seams watertight)
 * - Performs sRGB-to-Linear color conversion so Three.js SRGBColorSpace renders rich colors
 * - Computes 4-corner Per-Vertex Voxel Ambient Occlusion (AO) for deep 3D shadow creases
 * - Encodes water depth & shoreline proximity in water vertex colors for the stylized
 *   tropical lagoon water shader (turquoise-to-navy depth gradient + shore foam)
 */

import { generateChunkVoxels, sampleColumnHeight } from '../sim/terrain';
import { CHUNK_HEIGHT, CHUNK_SIZE, VoxelType, WATER_LEVEL } from '../sim/types';

export interface MeshChunkRequest {
  type: 'MESH_CHUNK';
  key: string;
  cx: number;
  cz: number;
  seedNum: number;
  lod: 0 | 1 | 2;
  revision: number;
  voxels: Uint8Array;
}

export interface MeshChunkResponse {
  type: 'CHUNK_MESHED';
  key: string;
  cx: number;
  cz: number;
  lod: 0 | 1 | 2;
  revision: number;
  buildMs: number;
  opaquePositions: Float32Array;
  opaqueNormals: Float32Array;
  opaqueColors: Float32Array;
  opaqueUvs: Float32Array;
  opaqueIndices: Uint32Array;
  waterPositions: Float32Array;
  waterNormals: Float32Array;
  waterColors: Float32Array;
  waterIndices: Uint32Array;
}

// Pre-allocated scratch buffers so buildChunkMesh allocates 0 intermediate JS number[] arrays
const MAX_OPAQUE_VERTS = 96000;
const MAX_OPAQUE_INDICES = 144000;
const MAX_WATER_VERTS = 24000;
const MAX_WATER_INDICES = 36000;

const _opPos = new Float32Array(MAX_OPAQUE_VERTS * 3);
const _opNorm = new Float32Array(MAX_OPAQUE_VERTS * 3);
const _opCol = new Float32Array(MAX_OPAQUE_VERTS * 3);
const _opUv = new Float32Array(MAX_OPAQUE_VERTS * 2);
const _opIdx = new Uint32Array(MAX_OPAQUE_INDICES);

const _waPos = new Float32Array(MAX_WATER_VERTS * 3);
const _waNorm = new Float32Array(MAX_WATER_VERTS * 3);
const _waCol = new Float32Array(MAX_WATER_VERTS * 3);
const _waIdx = new Uint32Array(MAX_WATER_INDICES);

// Cached border column heights for the 4 edges of the current chunk (-1 and CHUNK_SIZE)
const _borderGroundY = new Int16Array((CHUNK_SIZE + 2) * (CHUNK_SIZE + 2));

/** Vibrant, natural sRGB palette (converted to Linear-sRGB before sending to GPU) */
const VOXEL_SRGB: Record<number, [number, number, number]> = {
  [VoxelType.Water]: [0.1, 0.56, 0.78],
  [VoxelType.Sand]: [0.87, 0.79, 0.58],
  [VoxelType.Grass]: [0.31, 0.62, 0.24],
  [VoxelType.ForestGrass]: [0.23, 0.52, 0.19],
  [VoxelType.Dirt]: [0.46, 0.33, 0.21],
  [VoxelType.FertileSoil]: [0.35, 0.24, 0.16],
  [VoxelType.CropWheat]: [0.88, 0.72, 0.29],
  [VoxelType.Snow]: [0.94, 0.97, 1.0],
  [VoxelType.Ice]: [0.62, 0.82, 0.95],
  [VoxelType.Stone]: [0.51, 0.53, 0.56],
  [VoxelType.Cobblestone]: [0.42, 0.43, 0.46],
  [VoxelType.CoalOre]: [0.2, 0.21, 0.24],
  [VoxelType.CopperOre]: [0.76, 0.45, 0.28],
  [VoxelType.IronOre]: [0.64, 0.54, 0.48],
  [VoxelType.GoldOre]: [0.9, 0.72, 0.26],
  [VoxelType.CrystalOre]: [0.34, 0.74, 0.82],
  [VoxelType.WoodLog]: [0.38, 0.25, 0.15],
  [VoxelType.Leaves]: [0.24, 0.54, 0.2],
  [VoxelType.PineLeaves]: [0.16, 0.41, 0.24],
  [VoxelType.Plank]: [0.67, 0.49, 0.31],
  [VoxelType.Thatch]: [0.8, 0.66, 0.36],
  [VoxelType.MudBrick]: [0.64, 0.47, 0.34],
  [VoxelType.ClayBrick]: [0.71, 0.39, 0.28],
  [VoxelType.StoneBrick]: [0.64, 0.65, 0.68],
  [VoxelType.RoofTileRed]: [0.68, 0.31, 0.23],
  [VoxelType.RoofTileSlate]: [0.29, 0.36, 0.45],
  [VoxelType.MarketCanopyRed]: [0.74, 0.26, 0.24],
  [VoxelType.MarketCanopyGold]: [0.86, 0.68, 0.31],
  [VoxelType.MarketCanopyBlue]: [0.24, 0.48, 0.74],
  [VoxelType.CrystalBlock]: [0.36, 0.66, 0.74],
  [VoxelType.GoldBlock]: [0.82, 0.66, 0.32],
  [VoxelType.RoadDirt]: [0.55, 0.41, 0.28],
  [VoxelType.RoadPaved]: [0.52, 0.51, 0.49],
  [VoxelType.BridgeWood]: [0.54, 0.37, 0.21],
  [VoxelType.BridgeStone]: [0.56, 0.57, 0.6],
  [VoxelType.TorchEmber]: [0.98, 0.64, 0.2],
  [VoxelType.GlassPane]: [0.68, 0.84, 0.93],
  [VoxelType.ScaffoldWood]: [0.72, 0.57, 0.37],
  [VoxelType.ScorchedEarth]: [0.19, 0.16, 0.15],
  [VoxelType.BirchLog]: [0.86, 0.83, 0.77],
  [VoxelType.BirchLeavesGold]: [0.82, 0.65, 0.24],
  [VoxelType.AutumnLeavesOrange]: [0.81, 0.42, 0.19],
  [VoxelType.BerryBush]: [0.24, 0.49, 0.21],
  [VoxelType.FlowerRed]: [0.84, 0.27, 0.3],
  [VoxelType.FlowerYellow]: [0.92, 0.78, 0.25],
  [VoxelType.DarkPlank]: [0.33, 0.22, 0.14],
  [VoxelType.WhiteMarble]: [0.91, 0.89, 0.84],
  [VoxelType.Sandstone]: [0.84, 0.69, 0.46],
  [VoxelType.Terracotta]: [0.76, 0.42, 0.28],
  [VoxelType.BambooStalk]: [0.44, 0.66, 0.28],
  [VoxelType.Cactus]: [0.22, 0.55, 0.26],
  [VoxelType.PalmLeaves]: [0.29, 0.63, 0.24],
  [VoxelType.CoralBlock]: [0.88, 0.42, 0.58],
  [VoxelType.DarkSlate]: [0.28, 0.3, 0.35],
  [VoxelType.LanternGlow]: [0.99, 0.78, 0.34],
  [VoxelType.FireFlame]: [0.99, 0.38, 0.12],
};

function getAtlasTileIndex(v: VoxelType, faceIndex: number, buriedGrass: boolean): number {
  if (buriedGrass) return 1;
  switch (v) {
    case VoxelType.Grass:
    case VoxelType.ForestGrass:
    case VoxelType.FlowerRed:
    case VoxelType.FlowerYellow:
      return faceIndex === 0 ? 0 : 1;
    case VoxelType.Dirt:
    case VoxelType.FertileSoil:
    case VoxelType.RoadDirt:
    case VoxelType.ScorchedEarth:
      return 1;
    case VoxelType.Stone:
    case VoxelType.DarkSlate:
      return 2;
    case VoxelType.Cobblestone:
    case VoxelType.BridgeStone:
      return 3;
    case VoxelType.StoneBrick:
    case VoxelType.WhiteMarble:
    case VoxelType.Sandstone:
      return 4;
    case VoxelType.MudBrick:
    case VoxelType.ClayBrick:
    case VoxelType.Terracotta:
      return 5;
    case VoxelType.WoodLog:
    case VoxelType.BirchLog:
    case VoxelType.BambooStalk:
    case VoxelType.Cactus:
      return faceIndex <= 1 ? 7 : 6;
    case VoxelType.Plank:
    case VoxelType.DarkPlank:
    case VoxelType.BridgeWood:
    case VoxelType.ScaffoldWood:
      return 7;
    case VoxelType.Leaves:
    case VoxelType.PineLeaves:
    case VoxelType.PalmLeaves:
    case VoxelType.BirchLeavesGold:
    case VoxelType.AutumnLeavesOrange:
    case VoxelType.BerryBush:
    case VoxelType.CoralBlock:
      return 8;
    case VoxelType.Thatch:
    case VoxelType.CropWheat:
      return 9;
    case VoxelType.RoofTileRed:
    case VoxelType.RoofTileSlate:
      return 10;
    case VoxelType.Sand:
    case VoxelType.Snow:
    case VoxelType.Ice:
      return 11;
    case VoxelType.CoalOre:
    case VoxelType.CopperOre:
    case VoxelType.IronOre:
    case VoxelType.GoldOre:
    case VoxelType.CrystalOre:
      return 12;
    case VoxelType.CrystalBlock:
    case VoxelType.GoldBlock:
    case VoxelType.GlassPane:
      return 13;
    case VoxelType.MarketCanopyRed:
    case VoxelType.MarketCanopyGold:
    case VoxelType.MarketCanopyBlue:
      return 14;
    case VoxelType.RoadPaved:
    case VoxelType.TorchEmber:
    case VoxelType.LanternGlow:
    case VoxelType.FireFlame:
      return 15;
    default:
      return 2;
  }
}

const _srgbLut = new Float32Array(1024);
for (let i = 0; i < 1024; i++) {
  const c = i / 1023;
  _srgbLut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function srgbToLinear(c: number): number {
  const idx = (c * 1023) | 0;
  return _srgbLut[idx < 0 ? 0 : idx > 1023 ? 1023 : idx];
}

const FACES = [
  {
    // +Y (Top)
    dir: [0, 1, 0],
    shade: 1.0,
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    // -Y (Bottom)
    dir: [0, -1, 0],
    shade: 0.5,
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    // +X (Right)
    dir: [1, 0, 0],
    shade: 0.86,
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
  },
  {
    // -X (Left)
    dir: [-1, 0, 0],
    shade: 0.78,
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    // +Z (Front)
    dir: [0, 0, 1],
    shade: 0.92,
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    // -Z (Back)
    dir: [0, 0, -1],
    shade: 0.75,
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
];

const FACE_UVS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

function precomputeColumnSurfaceHeights(
  voxels: Uint8Array,
  baseWx: number,
  baseWz: number,
  seedNum: number
): number {
  const stride = CHUNK_SIZE + 2;
  let maxBorderY = WATER_LEVEL + 4;

  // 1. Border skirt columns (-1 and CHUNK_SIZE) via deterministic sampleColumn
  for (let z = -1; z <= CHUNK_SIZE; z++) {
    for (let x = -1; x <= CHUNK_SIZE; x++) {
      if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
        // Interior column: find lowest contiguous solid height from bottom y=1 upward
        let solidTop = 1;
        for (let y = 1; y < CHUNK_HEIGHT - 1; y++) {
          const v = voxels[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x] as VoxelType;
          if (v === VoxelType.Air || v === VoxelType.Water || v === VoxelType.GlassPane) {
            break;
          }
          solidTop = y;
        }
        _borderGroundY[(z + 1) * stride + (x + 1)] = solidTop;
        if (solidTop > maxBorderY) maxBorderY = solidTop;
      } else {
        const h = sampleColumnHeight(baseWx + x, baseWz + z, seedNum);
        _borderGroundY[(z + 1) * stride + (x + 1)] = h;
        if (h > maxBorderY) maxBorderY = h;
      }
    }
  }
  return maxBorderY;
}

/**
 * Finds the highest non-air Y layer in the chunk by scanning 16-block vertical sections
 * from top to bottom so low-lying chunks don't waste time iterating empty air up to Y=255.
 */
function findMaxOccupiedY(voxels: Uint8Array, minStart = WATER_LEVEL + 4): number {
  const sliceLen = CHUNK_SIZE * CHUNK_SIZE;
  for (let y = CHUNK_HEIGHT - 1; y > minStart; y--) {
    const baseOffset = y * sliceLen;
    for (let i = 0; i < sliceLen; i += 4) {
      if (
        (voxels[baseOffset + i] |
          voxels[baseOffset + i + 1] |
          voxels[baseOffset + i + 2] |
          voxels[baseOffset + i + 3]) !==
        0
      ) {
        return Math.min(CHUNK_HEIGHT - 1, y + 2);
      }
    }
  }
  return Math.min(CHUNK_HEIGHT - 1, minStart + 2);
}

/**
 * Reads voxel inside chunk or deterministically samples the 1-voxel neighbor border skirt
 * so underground faces between chunks are properly culled and chunk borders are seamless.
 */
function getVoxelSeamless(
  voxels: Uint8Array,
  x: number,
  y: number,
  z: number
): VoxelType {
  if (y <= 0) return VoxelType.Stone;
  if (y >= CHUNK_HEIGHT) return VoxelType.Air;
  if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
    return voxels[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x] as VoxelType;
  }
  if (x >= -1 && x <= CHUNK_SIZE && z >= -1 && z <= CHUNK_SIZE) {
    const stride = CHUNK_SIZE + 2;
    const gY = _borderGroundY[(z + 1) * stride + (x + 1)];
    if (y <= gY) return VoxelType.Stone;
    if (y <= WATER_LEVEL) return VoxelType.Water;
  }
  return VoxelType.Air;
}

function isTranslucent(v: VoxelType): boolean {
  return v === VoxelType.Water || v === VoxelType.GlassPane;
}

/**
 * Clamps out-of-chunk coordinates to the chunk's edge column when computing AO
 * so chunk borders never bake dark seam creases from mismatched neighbor skirts.
 */
function isSolidOccluderAO(voxels: Uint8Array, x: number, y: number, z: number): number {
  if (y <= 0) return 1;
  if (y >= CHUNK_HEIGHT) return 0;
  const cx = x < 0 ? 0 : x >= CHUNK_SIZE ? CHUNK_SIZE - 1 : x;
  const cz = z < 0 ? 0 : z >= CHUNK_SIZE ? CHUNK_SIZE - 1 : z;
  const v = voxels[(y * CHUNK_SIZE + cz) * CHUNK_SIZE + cx] as VoxelType;
  return v !== VoxelType.Air && !isTranslucent(v) ? 1 : 0;
}

/**
 * Computes gentle per-vertex Voxel Ambient Occlusion factor in [0.76, 1.0]
 * Softened so 1-block grass elevation steps don't form harsh dark contour rings.
 */
function vertexAO(
  voxels: Uint8Array,
  x: number,
  y: number,
  z: number,
  dir: number[],
  corner: number[]
): number {
  const cx = corner[0] === 1 ? 1 : -1;
  const cy = corner[1] === 1 ? 1 : -1;
  const cz = corner[2] === 1 ? 1 : -1;

  let occ = 0;
  if (dir[1] !== 0) {
    const ny = y + dir[1];
    const s1 = isSolidOccluderAO(voxels, x + cx, ny, z);
    const s2 = isSolidOccluderAO(voxels, x, ny, z + cz);
    const c = s1 && s2 ? 1 : isSolidOccluderAO(voxels, x + cx, ny, z + cz);
    occ = s1 + s2 + c;
  } else if (dir[0] !== 0) {
    const nx = x + dir[0];
    const s1 = isSolidOccluderAO(voxels, nx, y + cy, z);
    const s2 = isSolidOccluderAO(voxels, nx, y, z + cz);
    const c = s1 && s2 ? 1 : isSolidOccluderAO(voxels, nx, y + cy, z + cz);
    occ = s1 + s2 + c;
  } else {
    const nz = z + dir[2];
    const s1 = isSolidOccluderAO(voxels, x + cx, y, nz);
    const s2 = isSolidOccluderAO(voxels, x, y + cy, nz);
    const c = s1 && s2 ? 1 : isSolidOccluderAO(voxels, x + cx, y + cy, nz);
    occ = s1 + s2 + c;
  }

  return 1.0 - occ * 0.075;
}

/**
 * Computes water column depth (1..10 blocks) and shoreline adjacency (0..1)
 * for the stylized tropical lagoon water shader.
 */
function computeWaterMetrics(
  voxels: Uint8Array,
  x: number,
  y: number,
  z: number
): [number, number] {
  let depthBlocks = 1;
  for (let dy = 1; dy <= 10; dy++) {
    const by = y - dy;
    if (by <= 0) break;
    const bv = getVoxelSeamless(voxels, x, by, z);
    if (bv === VoxelType.Water) {
      depthBlocks++;
    } else {
      break;
    }
  }
  const depthNorm = Math.min(1.0, (depthBlocks - 1) / 7.5);

  // Check 4 cardinal neighbors and 4 diagonals at surface level for solid shoreline blocks
  let solidNeighbors = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  for (let i = 0; i < dirs.length; i++) {
    const nv = getVoxelSeamless(voxels, x + dirs[i][0], y, z + dirs[i][1]);
    if (nv !== VoxelType.Water && nv !== VoxelType.Air) {
      solidNeighbors += i < 4 ? 1.0 : 0.45;
    }
  }
  const shoreFoam = Math.min(1.0, solidNeighbors * 0.34);
  return [depthNorm, shoreFoam];
}

function sampleRepresentativeVoxel(
  voxels: Uint8Array,
  x: number,
  y: number,
  z: number,
  stepX: number,
  stepY: number
): VoxelType {
  const v0 = voxels[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x] as VoxelType;
  if (stepX === 1 || v0 !== VoxelType.Air) return v0;

  // Prefer visible foliage/surface blocks inside the coarse LOD cell
  const maxDY = Math.min(stepY, 2);
  const maxDX = Math.min(stepX, 3);
  for (let dy = maxDY - 1; dy >= 0; dy--) {
    const py = y + dy;
    if (py >= CHUNK_HEIGHT) continue;
    for (let dz = 0; dz < maxDX; dz++) {
      const pz = z + dz;
      if (pz >= CHUNK_SIZE) continue;
      for (let dx = 0; dx < maxDX; dx++) {
        const px = x + dx;
        if (px >= CHUNK_SIZE) continue;
        const sv = voxels[(py * CHUNK_SIZE + pz) * CHUNK_SIZE + px] as VoxelType;
        if (sv !== VoxelType.Air) return sv;
      }
    }
  }
  return VoxelType.Air;
}

export function buildChunkMesh(req: MeshChunkRequest): MeshChunkResponse {
  const t0 = performance.now();
  const { cx, cz, seedNum, lod, key, revision } = req;
  const effectiveSeed = seedNum || 1337;

  // If voxels buffer is empty (procedural horizon chunk), synthesize on the fly
  const voxels =
    req.voxels && req.voxels.length > 0
      ? req.voxels
      : generateChunkVoxels(cx, cz, effectiveSeed);

  const baseWx = cx * CHUNK_SIZE;
  const baseWz = cz * CHUNK_SIZE;

  const maxBorderY = precomputeColumnSurfaceHeights(voxels, baseWx, baseWz, effectiveSeed);
  const maxChunkY = findMaxOccupiedY(voxels, maxBorderY);
  const stride = CHUNK_SIZE + 2;

  let opVerts = 0;
  let opInds = 0;
  let waVerts = 0;
  let waInds = 0;

  // Full 1x1 voxel detail everywhere with O(1) underground solid-column skipping
  for (let z = 0; z < CHUNK_SIZE; z++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const idxCenter = (z + 1) * stride + (x + 1);
      const sSelf = _borderGroundY[idxCenter];
      const sEast = _borderGroundY[idxCenter + 1];
      const sWest = _borderGroundY[idxCenter - 1];
      const sSouth = _borderGroundY[idxCenter + stride];
      const sNorth = _borderGroundY[idxCenter - stride];
      const minSurfaceY = Math.max(
        1,
        Math.min(sSelf, sEast, sWest, sSouth, sNorth)
      );

      for (let y = minSurfaceY; y <= maxChunkY; y++) {
        const v = voxels[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x] as VoxelType;
        if (v === VoxelType.Air) continue;

        const translucent = isTranslucent(v);
        const srgb = VOXEL_SRGB[v] || [0.65, 0.65, 0.65];

        let th = Math.imul((x + baseWx) | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca6b);
        th = Math.imul(th ^ (th >>> 15), 0xc2b2ae35) ^ Math.imul((z + baseWz) | 0, 0x27d4eb2d);
        const tintHash = (th ^ (th >>> 13)) & 31;
        const jitter = (tintHash / 31 - 0.5) * 0.024;


        const yScale = v === VoxelType.RoadDirt || v === VoxelType.RoadPaved ? 0.92 : 1.0;

        for (let f = 0; f < 6; f++) {
          // Never render downward (-Y) faces at or below water level
          if (f === 1 && y <= WATER_LEVEL + 2) continue;

          const face = FACES[f];
          const nx = x + face.dir[0];
          const ny = y + face.dir[1];
          const nz = z + face.dir[2];

          const neighbor = getVoxelSeamless(voxels, nx, ny, nz);

          if (translucent) {
            if (neighbor === v || (neighbor !== VoxelType.Air && f !== 0)) continue;
          } else {
            if (neighbor !== VoxelType.Air && !isTranslucent(neighbor)) continue;
          }

          let faceSrgb = srgb;
          const buriedGrass =
            (v === VoxelType.Grass || v === VoxelType.ForestGrass) &&
            f >= 2 &&
            getVoxelSeamless(voxels, x, y + 1, z) !== VoxelType.Air;
          if (buriedGrass) {
            faceSrgb = VOXEL_SRGB[VoxelType.Dirt];
          }

          if (translucent) {
            if (waVerts + 4 >= MAX_WATER_VERTS || waInds + 6 >= MAX_WATER_INDICES) {
              continue;
            }
            const vertOffset = waVerts;
            const isGlass = v === VoxelType.GlassPane;
            const [depthNorm, shoreFoam] = isGlass
              ? [0.5, 0.0]
              : computeWaterMetrics(voxels, x, y, z);

            for (let c = 0; c < 4; c++) {
              const corner = face.corners[c];
              const vx = baseWx + x + corner[0];
              const vy =
                y +
                corner[1] *
                  (v === VoxelType.Water && corner[1] === 1 ? 0.9 : yScale);
              const vz = baseWz + z + corner[2];

              const v3 = waVerts * 3;
              _waPos[v3] = vx;
              _waPos[v3 + 1] = vy;
              _waPos[v3 + 2] = vz;
              _waNorm[v3] = face.dir[0];
              _waNorm[v3 + 1] = face.dir[1];
              _waNorm[v3 + 2] = face.dir[2];

              // Encode [depthNorm, shoreFoam, isGlassFlag] for the custom water shader
              _waCol[v3] = depthNorm;
              _waCol[v3 + 1] = shoreFoam;
              _waCol[v3 + 2] = isGlass ? 1.0 : 0.0;
              waVerts++;
            }
            _waIdx[waInds++] = vertOffset;
            _waIdx[waInds++] = vertOffset + 1;
            _waIdx[waInds++] = vertOffset + 2;
            _waIdx[waInds++] = vertOffset;
            _waIdx[waInds++] = vertOffset + 2;
            _waIdx[waInds++] = vertOffset + 3;
          } else {
            if (opVerts + 4 >= MAX_OPAQUE_VERTS || opInds + 6 >= MAX_OPAQUE_INDICES) {
              continue;
            }
            const tileIdx = getAtlasTileIndex(v, f, buriedGrass);
            const tileCol = tileIdx & 3;
            const tileRow = (tileIdx >> 2) & 3;
            const uBase = tileCol * 0.25 + 0.024;
            const vBase = tileRow * 0.25 + 0.024;
            const uvSpan = 0.202;

            const vertOffset = opVerts;
            for (let c = 0; c < 4; c++) {
              const corner = face.corners[c];
              const vx = baseWx + x + corner[0];
              const vy = y + corner[1] * yScale;
              const vz = baseWz + z + corner[2];

              const ao = vertexAO(voxels, x, y, z, face.dir, corner);
              const isEmissiveBlock =
                v === VoxelType.TorchEmber ||
                v === VoxelType.LanternGlow ||
                v === VoxelType.FireFlame;
              const shade = isEmissiveBlock ? 1.15 : face.shade * ao;

              const lr = srgbToLinear(Math.max(0, Math.min(1, (faceSrgb[0] + jitter) * shade)));
              const lg = srgbToLinear(Math.max(0, Math.min(1, (faceSrgb[1] + jitter) * shade)));
              const lb = srgbToLinear(Math.max(0, Math.min(1, (faceSrgb[2] + jitter) * shade)));

              const v3 = opVerts * 3;
              const v2 = opVerts * 2;
              _opPos[v3] = vx;
              _opPos[v3 + 1] = vy;
              _opPos[v3 + 2] = vz;
              _opNorm[v3] = face.dir[0];
              _opNorm[v3 + 1] = face.dir[1];
              _opNorm[v3 + 2] = face.dir[2];
              _opCol[v3] = lr;
              _opCol[v3 + 1] = lg;
              _opCol[v3 + 2] = lb;
              _opUv[v2] = uBase + FACE_UVS[c][0] * uvSpan;
              _opUv[v2 + 1] = vBase + FACE_UVS[c][1] * uvSpan;
              opVerts++;
            }
            _opIdx[opInds++] = vertOffset;
            _opIdx[opInds++] = vertOffset + 1;
            _opIdx[opInds++] = vertOffset + 2;
            _opIdx[opInds++] = vertOffset;
            _opIdx[opInds++] = vertOffset + 2;
            _opIdx[opInds++] = vertOffset + 3;
          }
        }
      }
    }
  }

  const buildMs = Number((performance.now() - t0).toFixed(2));

  return {
    type: 'CHUNK_MESHED',
    key,
    cx,
    cz,
    lod,
    revision,
    buildMs,
    opaquePositions: _opPos.slice(0, opVerts * 3),
    opaqueNormals: _opNorm.slice(0, opVerts * 3),
    opaqueColors: _opCol.slice(0, opVerts * 3),
    opaqueUvs: _opUv.slice(0, opVerts * 2),
    opaqueIndices: _opIdx.slice(0, opInds),
    waterPositions: _waPos.slice(0, waVerts * 3),
    waterNormals: _waNorm.slice(0, waVerts * 3),
    waterColors: _waCol.slice(0, waVerts * 3),
    waterIndices: _waIdx.slice(0, waInds),
  };
}

self.onmessage = (e: MessageEvent<MeshChunkRequest>) => {
  const data = e.data;
  if (data && data.type === 'MESH_CHUNK') {
    const res = buildChunkMesh(data);
    (self as unknown as Worker).postMessage(res, [
      res.opaquePositions.buffer,
      res.opaqueNormals.buffer,
      res.opaqueColors.buffer,
      res.opaqueUvs.buffer,
      res.opaqueIndices.buffer,
      res.waterPositions.buffer,
      res.waterNormals.buffer,
      res.waterColors.buffer,
      res.waterIndices.buffer,
    ]);
  }
};

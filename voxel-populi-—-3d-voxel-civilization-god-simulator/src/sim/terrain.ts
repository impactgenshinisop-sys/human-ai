/**
 * WorldGen v3: Unbounded Seeded Climate-Based Biome & Ridged Multifractal Mountain Generator
 * - 256-Block Max Height (16 vertical 16x16x16 sections) with section-culling metadata
 * - 19 Large-Scale Climate Biomes driven by Continentalness, Temperature, Humidity, and Altitude:
 *   Deep Ocean, Ocean, Beach, River, Plains, Meadow, Savanna, Steppe, Temperate Forest,
 *   Birch Forest, Taiga, Tundra, Snowy Plains, Glacier, Desert, Oasis, Badlands, Jungle,
 *   Swamp, Alpine, and Snowy Mountains.
 * - Ridged multifractal mountain chains, foothills, passes, steep rock cliff faces,
 *   temperature-dependent snowlines, canyon ravines, and 3D underground caves with ore seams.
 */

import { fbm2D, hashCoords, noise2D } from './prng';
import {
  BiomeType,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  VoxelType,
  WATER_LEVEL,
} from './types';

export function chunkKey(cx: number, cz: number): string {
  return `${Math.trunc(cx)},${Math.trunc(cz)}`;
}

export function parseChunkKey(key: string): [number, number] {
  const idx = key.indexOf(',');
  return [parseInt(key.slice(0, idx), 10), parseInt(key.slice(idx + 1), 10)];
}

export function voxelIndex(lx: number, y: number, lz: number): number {
  return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
}

export interface ColumnSample {
  height: number;
  riverbedY: number;
  waterDepth: number;
  biome: BiomeType;
  isRiver: boolean;
  isRavine: boolean;
  continentalness: number;
  temperature: number;
  moisture: number;
  slope: number;
  flowDirX: number;
  flowDirZ: number;
  topVoxel: VoxelType;
}

/**
 * Ridged multifractal noise in [0, 1] for sharp alpine mountain crests and ridges
 */
function ridgedMultifractal2D(
  x: number,
  z: number,
  seedNum: number,
  octaves = 4
): number {
  let sum = 0;
  let freq = 1.0;
  let amp = 0.5;
  let weight = 1.0;
  for (let i = 0; i < octaves; i++) {
    let n = 1.0 - Math.abs(noise2D(x * freq, z * freq, seedNum + i * 1609));
    n = n * n * weight;
    weight = Math.max(0.15, Math.min(1.0, n * 1.85));
    sum += n * amp;
    freq *= 2.08;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Core elevation & climate sampling without slope derivative (used internally & for slope checks)
 */
function sampleColumnCore(wx: number, wz: number, seedNum: number) {
  const distFromOrigin = Math.hypot(wx, wz);
  // Guarantee a broad, hospitable temperate continent around (0,0) for initial settlements
  const originLandingBoost =
    distFromOrigin < 220 ? (1.0 - distFromOrigin / 220) * 0.36 : 0.0;

  // Gentle macro domain warp so coastlines and biome borders have natural rough turns without tight loops
  const warpX = fbm2D(wx * 0.0016, wz * 0.0016, seedNum + 19, 2) * 11;
  const warpZ = fbm2D(wx * 0.0016 + 43, wz * 0.0016 - 29, seedNum + 37, 2) * 11;
  const wwx = wx + warpX;
  const wwz = wz + warpZ;

  // 1. Large-Scale Continentalness — 80%+ continuous landmass with rare seas and inland lakes
  const macroContinent = fbm2D(wwx * 0.00065, wwz * 0.00065, seedNum + 53, 3, 2.0, 0.5);
  const mesoContinent = fbm2D(wwx * 0.0015, wwz * 0.0015, seedNum + 101, 2, 2.0, 0.45);
  let cont = macroContinent * 0.7 + mesoContinent * 0.3 + 0.34 + originLandingBoost;

  // Rare inland lake basins where rivers can naturally originate or terminate
  const lakeNoise = fbm2D(wwx * 0.0019, wwz * 0.0019, seedNum + 829, 2);
  const isLakeBasin = distFromOrigin > 85 && lakeNoise > 0.62;
  if (isLakeBasin) {
    const lakeDepthFactor = Math.min(1.0, (lakeNoise - 0.62) / 0.14);
    cont -= lakeDepthFactor * 0.48;
  }

  // 2. Smooth Macro Climate: Temperature & Humidity (wide regional transitions, zero random snow spots)
  const latitudeWave = Math.sin((wwz - 1100) * 0.00024) * 0.36;
  const regionalTemp = fbm2D(wwx * 0.00038, wwz * 0.00038, seedNum + 911, 2) * 0.44;
  const temperateGuard = distFromOrigin < 950 ? (1.0 - distFromOrigin / 950) * 0.3 : 0.0;
  const baseTemp = Math.max(
    distFromOrigin < 950 ? -0.15 : -0.85,
    regionalTemp + latitudeWave + temperateGuard
  );
  const baseMoisture = fbm2D(wwx * 0.00055, wwz * 0.00055, seedNum + 1201, 2);

  // 3. Gradual Rolling Hills, Foothills & Ridged Multifractal Mountain Chains
  const rollingHills = fbm2D(wwx * 0.0065, wwz * 0.0065, seedNum + 211, 3, 2.0, 0.45);
  const detail = fbm2D(wx * 0.015, wz * 0.015, seedNum + 307, 2, 2.0, 0.45);

  // Mountain chains form along deep inland tectonic belts
  const tectonicBelt = ridgedMultifractal2D(wwx * 0.0019, wwz * 0.0019, seedNum + 509, 4);
  const localPeaks = ridgedMultifractal2D(wx * 0.0058, wz * 0.0058, seedNum + 613, 3);
  const inlandMask = Math.max(0, (cont - 0.36) * 1.65);
  const mountainMask = Math.pow(inlandMask, 1.5) * Math.max(0, tectonicBelt - 0.34);

  // Pass valleys cut through mountain ranges so traders & explorers can traverse passes
  const mountainPassNoise = Math.abs(fbm2D(wwx * 0.004, wwz * 0.004, seedNum + 677, 2));
  const passCarve = mountainPassNoise < 0.06 ? 0.42 + (mountainPassNoise / 0.06) * 0.58 : 1.0;

  // 4. Fewer, Rougher Angular Rivers (low-curvature stepped turns that connect to lakes & seas)
  const rawWarpX = fbm2D(wx * 0.0012, wz * 0.0012, seedNum + 701, 1);
  const rawWarpZ = fbm2D(wx * 0.0012 + 59, wz * 0.0012 - 41, seedNum + 733, 1);
  // Quantize domain warp slightly to produce rough, angular Minecraft-style river bends instead of smooth S-loops
  const rWarpX = Math.round(rawWarpX * 4.5) * 3.2;
  const rWarpZ = Math.round(rawWarpZ * 4.5) * 3.2;
  const primaryRiverField = Math.abs(
    fbm2D((wx + rWarpX) * 0.00105, (wz + rWarpZ) * 0.00105, seedNum + 773, 2, 2.0, 0.42)
  );
  // Secondary regional gate so rivers only appear in ~45% of regions and terminate into lakes/estuaries
  const riverRegionGate = fbm2D(wwx * 0.0008, wwz * 0.0008, seedNum + 853, 2);
  const riverActiveMask = Math.max(0, Math.min(1, (riverRegionGate + 0.12) * 3.5));

  const estuaryExpand = cont >= -0.04 && cont < 0.06 ? (0.06 - Math.max(0, cont)) * 0.06 : 0.0;
  const riverThreshold = (0.0145 + estuaryExpand) * riverActiveMask;

  const isRiver =
    riverThreshold > 0.004 &&
    primaryRiverField < riverThreshold &&
    cont > -0.04 &&
    mountainMask < 0.38;

  // Rare Canyon Ravines only in dry badlands highlands
  const ravineField = Math.abs(fbm2D(wwx * 0.0065, wwz * 0.0065, seedNum + 1999, 2));
  const isRavine =
    !isRiver &&
    cont > 0.44 &&
    baseTemp > 0.34 &&
    baseMoisture < -0.22 &&
    ravineField < 0.007;

  // Compute raw elevation (2..230 within 256-block world height)
  // C1-continuous across cont = 0 so there are NEVER vertical cliff cutoff walls at coastlines or biome borders!
  let rawHeight: number;
  if (cont < -0.24) {
    // Deep Ocean Basin
    const oceanDepth = Math.min(10, Math.round((-0.24 - cont) * 22 + (1 - detail) * 1.0));
    rawHeight = Math.max(2, WATER_LEVEL - 5 - oceanDepth);
  } else if (cont < 0.0) {
    // Smooth Continental Shelf & Lake Shallows: rises continuously up to WATER_LEVEL at cont = 0
    const shelfT = (cont + 0.24) / 0.24;
    const smoothShelf = shelfT * shelfT * (3 - 2 * shelfT);
    rawHeight = WATER_LEVEL - 5.0 + smoothShelf * 5.0;
  } else {
    // Land: Smoothly ramps from WATER_LEVEL + 1 at the shore into gradual rolling hills and inland peaks
    const landRampT = Math.max(0, Math.min(1, cont / 0.18));
    const smoothLandRamp = landRampT * landRampT * (3 - 2 * landRampT);
    const inlandRise = Math.min(0.6, cont) * 7.2;
    const hillsAdd = Math.max(0, rollingHills + 0.15) * (2.6 + inlandMask * 4.5);
    const mountainAdd =
      mountainMask * passCarve * (36.0 + localPeaks * 66.0 + Math.max(0, tectonicBelt - 0.5) * 58.0);
    rawHeight =
      WATER_LEVEL +
      1.0 +
      smoothLandRamp * (inlandRise + hillsAdd + detail * 0.45) +
      mountainAdd;
  }

  // Carve angular river channels & wide gentle riverbanks so rivers never have sheer vertical walls
  const bankSpan = 0.065;
  const bankThreshold = riverThreshold + bankSpan;
  if (isRiver) {
    const centerFactor = Math.max(0, 1.0 - primaryRiverField / Math.max(0.001, riverThreshold));
    const riverBed = WATER_LEVEL - 2 - Math.round(centerFactor * 2);
    rawHeight = Math.min(rawHeight, riverBed);
  } else if (
    riverThreshold > 0.004 &&
    primaryRiverField < bankThreshold &&
    rawHeight > WATER_LEVEL + 1 &&
    cont >= 0
  ) {
    const bankT = Math.max(0, Math.min(1, (primaryRiverField - riverThreshold) / bankSpan));
    const smoothBank = bankT * bankT * (3 - 2 * bankT);
    rawHeight = WATER_LEVEL + 1 + (rawHeight - (WATER_LEVEL + 1)) * smoothBank;
  }

  // Carve dramatic narrow canyon ravines only in dry badlands
  if (isRavine && rawHeight > WATER_LEVEL + 6) {
    const ravineDepth = Math.min(14, Math.round((0.007 - ravineField) * 1600));
    rawHeight = Math.max(WATER_LEVEL + 2, rawHeight - ravineDepth);
  }

  // Desert Oasis depression (only in hot, dry desert interiors)
  const oasisNoise = fbm2D(wx * 0.015, wz * 0.015, seedNum + 3191, 2);
  const isOasisCandidate =
    baseTemp > 0.42 &&
    baseMoisture < -0.22 &&
    cont > 0.22 &&
    mountainMask < 0.1 &&
    oasisNoise > 0.72;
  if (isOasisCandidate) {
    rawHeight = oasisNoise > 0.77 ? WATER_LEVEL - 2 : WATER_LEVEL + 1;
  }

  const height = Math.max(2, Math.min(CHUNK_HEIGHT - 16, Math.round(rawHeight)));

  // Altitude cooling only kicks in on real mountains (height > WATER_LEVEL + 26)
  const altitudeCooling = Math.max(0, height - (WATER_LEVEL + 26)) * 0.024;
  const temperature = baseTemp - altitudeCooling;
  const moisture = isRiver || isOasisCandidate ? Math.max(0.45, baseMoisture + 0.45) : baseMoisture;

  return {
    height,
    cont,
    temperature,
    moisture,
    baseTemp,
    baseMoisture,
    isRiver,
    isRavine,
    isOasisCandidate,
    detail,
  };
}

// Fast direct-mapped 32,768-slot height cache so slope derivatives (wx±2, wz±2) and chunk borders hit in O(1)
const HEIGHT_CACHE_MASK = 32767;
const _hCacheWx = new Int32Array(32768).fill(0x7fffffff);
const _hCacheWz = new Int32Array(32768).fill(0x7fffffff);
const _hCacheSeed = new Int32Array(32768).fill(0);
const _hCacheVal = new Int16Array(32768);

export function sampleColumnHeight(wx: number, wz: number, seedNum: number): number {
  const ix = wx | 0;
  const iz = wz | 0;
  const s = seedNum | 0;
  const slot = (Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663) ^ s) & HEIGHT_CACHE_MASK;
  if (_hCacheWx[slot] === ix && _hCacheWz[slot] === iz && _hCacheSeed[slot] === s) {
    return _hCacheVal[slot];
  }
  const h = sampleColumnCore(ix, iz, s).height;
  _hCacheWx[slot] = ix;
  _hCacheWz[slot] = iz;
  _hCacheSeed[slot] = s;
  _hCacheVal[slot] = h;
  return h;
}

/**
 * Samples full terrain column at ANY world coordinate (wx, wz) with slope, flow vector,
 * water depth, and 19-biome classification.
 */
export function sampleColumn(
  wx: number,
  wz: number,
  seedNum: number
): ColumnSample {
  const core = sampleColumnCore(wx, wz, seedNum);
  const { height, cont, temperature, moisture, isRiver, isRavine, isOasisCandidate, detail } =
    core;

  // Seed the direct-mapped height cache with this column's height
  const ix = wx | 0;
  const iz = wz | 0;
  const s = seedNum | 0;
  const slot = (Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663) ^ s) & HEIGHT_CACHE_MASK;
  _hCacheWx[slot] = ix;
  _hCacheWz[slot] = iz;
  _hCacheSeed[slot] = s;
  _hCacheVal[slot] = height;

  // Compute local terrain slope from cardinal neighbors using O(1) cached heights
  const hE = sampleColumnHeight(ix + 2, iz, s);
  const hW = sampleColumnHeight(ix - 2, iz, s);
  const hN = sampleColumnHeight(ix, iz - 2, s);
  const hS = sampleColumnHeight(ix, iz + 2, s);
  const gradX = (hE - hW) * 0.25;
  const gradZ = (hS - hN) * 0.25;
  const slope = Math.hypot(gradX, gradZ);

  // Downhill water flow vector
  const flowLen = Math.hypot(gradX, gradZ) || 1;
  const flowDirX = isRiver ? -gradX / flowLen : Math.cos(wx * 0.02 + seedNum * 0.001) * 0.5;
  const flowDirZ = isRiver ? -gradZ / flowLen : Math.sin(wz * 0.02 + seedNum * 0.001) * 0.5;

  // Classify into 19 Climate Biomes with smooth macro transitions
  // Narrow coastal sandy beach ONLY right along ocean/lake shorelines (0 <= cont <= 0.022 and !isRiver)
  const isOceanShore =
    !isRiver &&
    height >= WATER_LEVEL &&
    height <= WATER_LEVEL + 1 &&
    cont >= 0.0 &&
    cont <= 0.022 &&
    slope < 0.9;

  let biome: BiomeType = BiomeType.Plains;
  if (isOasisCandidate) {
    biome = BiomeType.Oasis;
  } else if (isRiver) {
    biome = BiomeType.River;
  } else if (height <= WATER_LEVEL - 5) {
    biome = BiomeType.DeepOcean;
  } else if (height < WATER_LEVEL) {
    if (height >= WATER_LEVEL - 2 && core.baseTemp > 0.25 && detail > 0.22) {
      biome = BiomeType.CoralReef;
    } else {
      biome = BiomeType.Ocean;
    }
  } else if (isOceanShore) {
    biome = core.baseTemp < -0.58 ? BiomeType.Glacier : BiomeType.Coast;
  } else if (height >= WATER_LEVEL + 38 && core.baseTemp > 0.28 && detail > 0.35) {
    biome = BiomeType.VolcanicCaldera;
  } else if (height >= WATER_LEVEL + 34 || (height >= WATER_LEVEL + 28 && temperature < -0.35)) {
    biome = BiomeType.Mountains; // High Snowy Mountains
  } else if (height >= WATER_LEVEL + 22) {
    biome = BiomeType.Alpine;
  } else if (core.baseTemp < -0.62) {
    biome = moisture > 0.15 ? BiomeType.Glacier : BiomeType.Snow;
  } else if (core.baseTemp < -0.38) {
    biome = moisture > -0.15 ? BiomeType.Taiga : BiomeType.Tundra;
  } else if (core.baseTemp > 0.42) {
    if (moisture < -0.24) {
      biome = detail > 0.38 ? BiomeType.Badlands : BiomeType.Desert;
    } else if (moisture < 0.14) {
      biome = BiomeType.Savanna;
    } else {
      biome = BiomeType.Jungle;
    }
  } else {
    // Broad Temperate Band
    if (moisture > 0.44 && height <= WATER_LEVEL + 3) {
      biome = BiomeType.Swamp;
    } else if (moisture > 0.10) {
      biome = detail > 0.25 ? BiomeType.BirchForest : BiomeType.Forest;
    } else if (moisture > -0.22) {
      biome = detail > 0.18 ? BiomeType.Meadow : BiomeType.Plains;
    } else {
      biome = BiomeType.Steppe;
    }
  }

  // Snowline strictly on high mountain peaks (height >= WATER_LEVEL + 33) or far-polar regions
  const snowlineHeight = WATER_LEVEL + 34 + Math.round(core.baseTemp * 10);
  const isSteepCliff = slope >= 1.95 && height > WATER_LEVEL + 10 && !isRiver;

  let topVoxel = VoxelType.Grass;
  if (height < WATER_LEVEL) {
    topVoxel = biome === BiomeType.CoralReef ? VoxelType.CoralBlock : VoxelType.Sand;
  } else if (biome === BiomeType.VolcanicCaldera) {
    topVoxel = detail > 0.52 ? VoxelType.TorchEmber : VoxelType.DarkSlate;
  } else if (isSteepCliff) {
    if (biome === BiomeType.Badlands) {
      topVoxel = height % 3 === 0 ? VoxelType.Terracotta : VoxelType.ClayBrick;
    } else if (biome === BiomeType.Desert) {
      topVoxel = VoxelType.Sandstone;
    } else {
      topVoxel = height > WATER_LEVEL + 28 ? VoxelType.DarkSlate : VoxelType.Stone;
    }
  } else if (height >= snowlineHeight && slope < 1.6) {
    topVoxel = VoxelType.Snow;
  } else {
    switch (biome) {
      case BiomeType.Coast:
      case BiomeType.Desert:
        topVoxel = VoxelType.Sand;
        break;
      case BiomeType.Oasis:
        topVoxel = height <= WATER_LEVEL + 2 ? VoxelType.Grass : VoxelType.Sand;
        break;
      case BiomeType.Badlands:
        topVoxel =
          height % 4 === 0
            ? VoxelType.Terracotta
            : height % 4 === 1
            ? VoxelType.ClayBrick
            : VoxelType.Sandstone;
        break;
      case BiomeType.Glacier:
        topVoxel = VoxelType.Ice;
        break;
      case BiomeType.Snow:
      case BiomeType.Mountains:
        topVoxel = VoxelType.Snow;
        break;
      case BiomeType.Tundra:
        topVoxel = VoxelType.ForestGrass;
        break;
      case BiomeType.Alpine:
        topVoxel = height >= WATER_LEVEL + 27 && detail > 0.25 ? VoxelType.Stone : VoxelType.ForestGrass;
        break;
      case BiomeType.Taiga:
      case BiomeType.Forest:
      case BiomeType.Jungle:
      case BiomeType.Swamp:
        topVoxel = detail > 0.15 ? VoxelType.Grass : VoxelType.ForestGrass;
        break;
      case BiomeType.Savanna:
      case BiomeType.Steppe:
        topVoxel = detail > -0.15 ? VoxelType.Grass : VoxelType.ForestGrass;
        break;
      default:
        topVoxel = VoxelType.Grass;
        break;
    }
  }

  const waterDepth = Math.max(0, WATER_LEVEL - height);

  return {
    height,
    riverbedY: height,
    waterDepth,
    biome,
    isRiver,
    isRavine,
    continentalness: cont,
    temperature,
    moisture,
    slope,
    flowDirX,
    flowDirZ,
    topVoxel,
  };
}

function setLocalIfAir(
  voxels: Uint8Array,
  lx: number,
  y: number,
  lz: number,
  v: VoxelType
) {
  if (
    lx >= 0 &&
    lx < CHUNK_SIZE &&
    y >= 1 &&
    y < CHUNK_HEIGHT &&
    lz >= 0 &&
    lz < CHUNK_SIZE
  ) {
    const idx = voxelIndex(lx, y, lz);
    if (voxels[idx] === VoxelType.Air) {
      voxels[idx] = v;
    }
  }
}

function setLocalSolid(
  voxels: Uint8Array,
  lx: number,
  y: number,
  lz: number,
  v: VoxelType
) {
  if (
    lx >= 0 &&
    lx < CHUNK_SIZE &&
    y >= 1 &&
    y < CHUNK_HEIGHT &&
    lz >= 0 &&
    lz < CHUNK_SIZE
  ) {
    voxels[voxelIndex(lx, y, lz)] = v;
  }
}

/**
 * Helper to place a natural rounded 3D foliage cluster (never a flat box or cross)
 */
function placeLeafCluster(
  voxels: Uint8Array,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  leafType: VoxelType
) {
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dz = -rz; dz <= rz; dz++) {
      for (let dx = -rx; dx <= rx; dx++) {
        const normDist =
          (dx * dx) / Math.max(1, (rx + 0.45) * (rx + 0.45)) +
          (dy * dy) / Math.max(1, (ry + 0.45) * (ry + 0.45)) +
          (dz * dz) / Math.max(1, (rz + 0.45) * (rz + 0.45));
        if (normDist <= 1.05) {
          setLocalIfAir(voxels, cx + dx, cy + dy, cz + dz, leafType);
        }
      }
    }
  }
}

/**
 * Computes organic, non-overlapping tree coordinates for a virtual cell (cxCell, czCell)
 * with wider 8-block Poisson spacing and inner margin so tree canopies never collide.
 */
function getCellTreeCandidate(
  cxCell: number,
  czCell: number,
  seedNum: number
): { twx: number; twz: number; roll: number; varietyRoll: number } {
  const CELL = 8;
  const h1 = hashCoords(cxCell, czCell, seedNum + 1409);
  const h2 = hashCoords(cxCell, czCell, seedNum + 1709);
  const twx = cxCell * CELL + 1 + Math.floor(h1 * (CELL - 2));
  const twz = czCell * CELL + 1 + Math.floor(h2 * (CELL - 2));
  const roll = hashCoords(twx, twz, seedNum + 2027);
  const varietyRoll = hashCoords(twx + 19, twz - 31, seedNum + 5501);
  return { twx, twz, roll, varietyRoll };
}

/**
 * Generates a 16x256x16 chunk deterministically from seedNum and overlays persisted block deltas.
 * Includes ridged mountains, canyon ravines, and organic, non-overlapping multi-branch trees and bushes.
 */
export function generateChunkVoxels(
  cx: number,
  cz: number,
  seedNum: number,
  resourceAbundance = 1.0,
  deltaMap?: Map<number, VoxelType>
): Uint8Array {
  const voxels = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  const baseWx = cx * CHUNK_SIZE;
  const baseWz = cz * CHUNK_SIZE;

  // Pass 1: Terrain strata, ridged mountains, ravines, and ore veins (crystal-clear shallow water with zero protruding cubes)
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseWx + lx;
      const wz = baseWz + lz;
      const col = sampleColumn(wx, wz, seedNum);
      const h = col.height;
      const maxColumnY = Math.max(h, WATER_LEVEL);

      for (let y = 0; y <= maxColumnY; y++) {
        let v = VoxelType.Air;
        if (y === 0) {
          v = VoxelType.DarkSlate;
        } else if (y < h - 2) {
          v = y < 10 ? VoxelType.DarkSlate : VoxelType.Stone;
        } else if (y < h) {
          if (col.biome === BiomeType.Desert || col.biome === BiomeType.Coast) {
            v = y === h - 1 ? VoxelType.Sand : VoxelType.Sandstone;
          } else if (col.biome === BiomeType.Badlands) {
            v = y % 2 === 0 ? VoxelType.Terracotta : VoxelType.Sandstone;
          } else if (
            col.biome === BiomeType.Mountains ||
            col.biome === BiomeType.Alpine ||
            col.slope >= 1.95
          ) {
            v = VoxelType.Stone;
          } else {
            v = VoxelType.Dirt;
          }
        } else if (y === h) {
          if (
            (col.biome === BiomeType.Mountains || col.biome === BiomeType.Alpine) &&
            col.topVoxel === VoxelType.Stone
          ) {
            const outRoll = hashCoords(wx, wz, seedNum + 8803);
            if (outRoll < 0.09 * resourceAbundance) v = VoxelType.IronOre;
            else if (outRoll < 0.18 * resourceAbundance) v = VoxelType.CopperOre;
            else v = col.topVoxel;
          } else {
            v = col.topVoxel;
          }
        } else if (y <= WATER_LEVEL) {
          // Only freeze surface water in true polar Glacier biomes
          const isFreezing = col.biome === BiomeType.Glacier && col.temperature < -0.62;
          v = isFreezing && y === WATER_LEVEL ? VoxelType.Ice : VoxelType.Water;
        }

        if (v !== VoxelType.Air) {
          voxels[voxelIndex(lx, y, lz)] = v;
        }
      }
    }
  }

  // Pass 2: Organic Non-Overlapping Poisson Trees & Shrubs (8-block cell + 5.5-block neighbor rejection)
  const CELL = 8;
  const minCellX = Math.floor((baseWx - 4) / CELL);
  const maxCellX = Math.floor((baseWx + CHUNK_SIZE + 4) / CELL);
  const minCellZ = Math.floor((baseWz - 4) / CELL);
  const maxCellZ = Math.floor((baseWz + CHUNK_SIZE + 4) / CELL);

  for (let czCell = minCellZ; czCell <= maxCellZ; czCell++) {
    for (let cxCell = minCellX; cxCell <= maxCellX; cxCell++) {
      const { twx, twz, roll, varietyRoll } = getCellTreeCandidate(cxCell, czCell, seedNum);

      const lx = twx - baseWx;
      const lz = twz - baseWz;
      if (lx < -3 || lx >= CHUNK_SIZE + 3 || lz < -3 || lz >= CHUNK_SIZE + 3) continue;

      // Poisson minimum-distance check against earlier neighbor cells so tree canopies NEVER overlap!
      let tooClose = false;
      for (let ndz = -1; ndz <= 0 && !tooClose; ndz++) {
        for (let ndx = -1; ndx <= 1; ndx++) {
          if (ndz === 0 && ndx >= 0) break;
          const nb = getCellTreeCandidate(cxCell + ndx, czCell + ndz, seedNum);
          const dx = twx - nb.twx;
          const dz = twz - nb.twz;
          if (dx * dx + dz * dz < 32) {
            tooClose = true;
            break;
          }
        }
      }
      if (tooClose) continue;

      const col = sampleColumn(twx, twz, seedNum);
      if (
        col.height <= WATER_LEVEL + 1 ||
        col.height >= CHUNK_HEIGHT - 20 ||
        col.isRiver ||
        col.isRavine ||
        col.slope >= 1.25 ||
        col.biome === BiomeType.Coast
      ) {
        continue;
      }

      // Multi-scale forest patch & meadow clearing noise so forests form organic groves and glades
      const macroGrove = fbm2D(twx * 0.014, twz * 0.014, seedNum + 6101, 2);
      const microGlade = fbm2D(twx * 0.045, twz * 0.045, seedNum + 6421, 2);
      const groveFactor = macroGrove * 0.7 + microGlade * 0.3;

      let treeChance = 0;
      switch (col.biome) {
        case BiomeType.Jungle:
          treeChance = Math.max(0.08, (0.44 + groveFactor * 0.32) * resourceAbundance);
          break;
        case BiomeType.Forest:
        case BiomeType.BirchForest:
        case BiomeType.Taiga:
          treeChance =
            groveFactor < -0.22
              ? 0.04 * resourceAbundance
              : (0.32 + groveFactor * 0.34) * resourceAbundance;
          break;
        case BiomeType.Swamp:
        case BiomeType.Oasis:
          treeChance = (0.22 + groveFactor * 0.18) * resourceAbundance;
          break;
        case BiomeType.Alpine:
        case BiomeType.Snow:
          treeChance = Math.max(0, (0.13 + groveFactor * 0.15) * resourceAbundance);
          break;
        case BiomeType.Savanna:
        case BiomeType.Meadow:
        case BiomeType.Plains:
          treeChance =
            groveFactor > 0.18
              ? (0.12 + groveFactor * 0.12) * resourceAbundance
              : 0.022 * resourceAbundance;
          break;
        case BiomeType.Desert:
          treeChance = 0.025 * resourceAbundance;
          break;
        default:
          treeChance = 0;
      }

      if (roll >= treeChance) {
        // Place organic low woodland bushes/shrubs in forest glades and meadows
        if (
          roll < treeChance + 0.09 &&
          lx >= 1 &&
          lx < CHUNK_SIZE - 1 &&
          lz >= 1 &&
          lz < CHUNK_SIZE - 1 &&
          (col.biome === BiomeType.Forest ||
            col.biome === BiomeType.BirchForest ||
            col.biome === BiomeType.Meadow ||
            col.biome === BiomeType.Plains ||
            col.biome === BiomeType.Taiga)
        ) {
          const bushLeaf =
            col.biome === BiomeType.Taiga
              ? VoxelType.PineLeaves
              : varietyRoll > 0.72
              ? VoxelType.BerryBush
              : VoxelType.Leaves;
          setLocalIfAir(voxels, lx, col.height + 1, lz, bushLeaf);
          if (varietyRoll > 0.45) {
            setLocalIfAir(voxels, lx + (varietyRoll > 0.7 ? 1 : -1), col.height + 1, lz, bushLeaf);
          }
        }
        continue;
      }

      if (col.biome === BiomeType.Desert) {
        // Low Desert Scrub Bush or Date Palm (never a cactus cross)
        const trunkH = 4 + (Math.floor(roll * 313) % 2);
        for (let ty = 1; ty <= trunkH; ty++) {
          setLocalSolid(voxels, lx, col.height + ty, lz, VoxelType.WoodLog);
        }
        placeLeafCluster(voxels, lx, col.height + trunkH + 1, lz, 2, 1, 2, VoxelType.PalmLeaves);
      } else if (col.biome === BiomeType.Oasis) {
        // Graceful Curved Oasis Palm Tree with drooping multi-block arching fronds
        const trunkH = 6 + (Math.floor(roll * 419) % 3);
        const leanDirX = varietyRoll > 0.5 ? 1 : -1;
        for (let ty = 1; ty <= trunkH; ty++) {
          const shift = ty >= trunkH - 2 ? leanDirX : 0;
          setLocalSolid(voxels, lx + shift, col.height + ty, lz, VoxelType.WoodLog);
        }
        const topX = lx + leanDirX;
        const topY = col.height + trunkH;
        placeLeafCluster(voxels, topX, topY + 1, lz, 1, 1, 1, VoxelType.PalmLeaves);
        const frondDirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
        ];
        for (const [fdx, fdz] of frondDirs) {
          setLocalIfAir(voxels, topX + fdx * 2, topY, lz + fdz * 2, VoxelType.PalmLeaves);
          setLocalIfAir(voxels, topX + fdx * 3, topY - 1, lz + fdz * 3, VoxelType.PalmLeaves);
        }
      } else if (col.biome === BiomeType.Savanna) {
        // Multi-Branch Flat-Topped Savanna Acacia Tree
        const trunkH = 5 + (Math.floor(roll * 521) % 3);
        for (let ty = 1; ty <= trunkH - 1; ty++) {
          setLocalSolid(voxels, lx, col.height + ty, lz, VoxelType.WoodLog);
        }
        // Diagonal forks supporting dual flat canopy tiers
        for (const [bx, bz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [-1, -1],
        ]) {
          setLocalSolid(voxels, lx + bx, col.height + trunkH, lz + bz, VoxelType.WoodLog);
        }
        placeLeafCluster(voxels, lx + 1, col.height + trunkH + 1, lz, 3, 1, 2, VoxelType.Leaves);
        placeLeafCluster(voxels, lx - 1, col.height + trunkH, lz - 1, 2, 1, 2, VoxelType.Leaves);
      } else if (
        col.biome === BiomeType.Taiga ||
        col.biome === BiomeType.Alpine ||
        col.biome === BiomeType.Snow ||
        (col.biome === BiomeType.Forest && varietyRoll < 0.18)
      ) {
        // Tall Layered Conifer / Alpine Spruce (stepped boughs, never a lollipop)
        const trunkH = 7 + (Math.floor(roll * 997) % 4);
        for (let ty = 1; ty <= trunkH; ty++) {
          setLocalSolid(voxels, lx, col.height + ty, lz, VoxelType.WoodLog);
        }
        for (let layer = 2; layer <= trunkH + 1; layer++) {
          const progress = (layer - 2) / Math.max(1, trunkH - 1);
          const maxRad = progress < 0.35 ? 3 : progress < 0.72 ? 2 : 1;
          const rad = layer % 2 === 0 ? maxRad : Math.max(1, maxRad - 1);
          for (let dz = -rad; dz <= rad; dz++) {
            for (let dx = -rad; dx <= rad; dx++) {
              if (dx * dx + dz * dz > rad * rad + 1) continue;
              setLocalIfAir(
                voxels,
                lx + dx,
                col.height + layer,
                lz + dz,
                VoxelType.PineLeaves
              );
            }
          }
        }
        setLocalIfAir(voxels, lx, col.height + trunkH + 2, lz, VoxelType.PineLeaves);
        setLocalIfAir(voxels, lx, col.height + trunkH + 3, lz, VoxelType.PineLeaves);
      } else if (col.biome === BiomeType.Swamp) {
        // Gnarled Swamp Willow with wide canopy and hanging leaf vines
        const trunkH = 6;
        for (let ty = 1; ty <= trunkH; ty++) {
          setLocalSolid(voxels, lx, col.height + ty, lz, VoxelType.WoodLog);
        }
        setLocalIfAir(voxels, lx + 1, col.height + 1, lz, VoxelType.WoodLog);
        setLocalIfAir(voxels, lx - 1, col.height + 1, lz, VoxelType.WoodLog);
        placeLeafCluster(voxels, lx, col.height + trunkH, lz, 3, 2, 3, VoxelType.Leaves);
        for (const [vx, vz] of [
          [2, 2],
          [-2, 2],
          [2, -2],
          [-2, -2],
          [3, 0],
          [-3, 0],
          [0, 3],
          [0, -3],
        ]) {
          setLocalIfAir(voxels, lx + vx, col.height + trunkH - 2, lz + vz, VoxelType.Leaves);
          setLocalIfAir(voxels, lx + vx, col.height + trunkH - 3, lz + vz, VoxelType.Leaves);
        }
      } else if (col.biome === BiomeType.BirchForest || (col.biome === BiomeType.Forest && varietyRoll < 0.46)) {
        // Multi-Clustered Silver Birch or Autumn Maple (asymmetric secondary boughs, zero lollipop shapes)
        const trunkH = 6 + (Math.floor(roll * 541) % 3);
        const isBirch = col.biome === BiomeType.BirchForest || varietyRoll < 0.28;
        const leafType = isBirch
          ? VoxelType.BirchLeavesGold
          : varietyRoll < 0.36
          ? VoxelType.AutumnLeavesOrange
          : VoxelType.Leaves;
        const logType = isBirch ? VoxelType.BirchLog : VoxelType.WoodLog;

        for (let ty = 1; ty <= trunkH; ty++) {
          setLocalSolid(voxels, lx, col.height + ty, lz, logType);
        }
        // Side branches at different heights
        const bDir = varietyRoll > 0.25 ? 1 : -1;
        setLocalSolid(voxels, lx + bDir, col.height + trunkH - 2, lz, logType);
        setLocalSolid(voxels, lx, col.height + trunkH - 1, lz - bDir, logType);

        // 3 overlapping asymmetric foliage clusters
        placeLeafCluster(voxels, lx, col.height + trunkH + 1, lz, 2, 2, 2, leafType);
        placeLeafCluster(voxels, lx + bDir, col.height + trunkH - 1, lz, 2, 1, 2, leafType);
        placeLeafCluster(voxels, lx, col.height + trunkH, lz - bDir, 2, 1, 2, leafType);
      } else {
        // Majestic Multi-Branch Oak / Jungle Emergent Hardwood
        const isJungle = col.biome === BiomeType.Jungle;
        const trunkH = (isJungle ? 8 : 6) + (Math.floor(roll * 773) % 3);
        for (let ty = 1; ty <= trunkH; ty++) {
          setLocalSolid(voxels, lx, col.height + ty, lz, VoxelType.WoodLog);
        }
        // Root buttresses at base for organic trunk silhouette
        if (trunkH >= 7) {
          setLocalIfAir(voxels, lx + 1, col.height + 1, lz, VoxelType.WoodLog);
          setLocalIfAir(voxels, lx - 1, col.height + 1, lz, VoxelType.WoodLog);
        }
        // Outward-reaching timber limbs
        for (const [bx, by, bz] of [
          [1, trunkH - 2, 0],
          [2, trunkH - 1, 0],
          [-1, trunkH - 1, 1],
          [0, trunkH - 2, -1],
        ]) {
          setLocalSolid(voxels, lx + bx, col.height + by, lz + bz, VoxelType.WoodLog);
        }
        // Asymmetric multi-dome crown
        placeLeafCluster(voxels, lx, col.height + trunkH + 1, lz, 2, 2, 2, VoxelType.Leaves);
        placeLeafCluster(voxels, lx + 2, col.height + trunkH, lz, 2, 1, 2, VoxelType.Leaves);
        placeLeafCluster(voxels, lx - 1, col.height + trunkH, lz + 1, 2, 1, 2, VoxelType.Leaves);
        placeLeafCluster(voxels, lx, col.height + trunkH - 1, lz - 1, 2, 1, 2, VoxelType.Leaves);
      }
    }
  }

  // Pass 3: Rare Mossy Ore Outcrops & Berry Bushes
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseWx + lx;
      const wz = baseWz + lz;
      const col = sampleColumn(wx, wz, seedNum);
      if (
        col.height <= WATER_LEVEL + 1 ||
        col.height >= CHUNK_HEIGHT - 10 ||
        col.isRiver ||
        col.slope >= 1.4
      ) {
        continue;
      }

      const floraRoll = hashCoords(wx * 13 + 7, wz * 17 - 11, seedNum + 3391);
      const subRoll = hashCoords(wx - 23, wz + 41, seedNum + 7717);

      if (
        col.biome === BiomeType.Forest ||
        col.biome === BiomeType.BirchForest ||
        col.biome === BiomeType.Plains ||
        col.biome === BiomeType.Meadow ||
        col.biome === BiomeType.Taiga
      ) {
        if (floraRoll > 0.994) {
          // Miner surface rock & ore outcrop
          setLocalIfAir(voxels, lx, col.height + 1, lz, VoxelType.Stone);
          if (subRoll > 0.4) {
            setLocalIfAir(
              voxels,
              lx + 1,
              col.height + 1,
              lz,
              subRoll > 0.7 ? VoxelType.IronOre : VoxelType.CopperOre
            );
          }
        }
      }
    }
  }

  // Pass 4: Apply persisted delta modifications
  if (deltaMap && deltaMap.size > 0) {
    deltaMap.forEach((voxelVal, idx) => {
      if (idx >= 0 && idx < voxels.length) {
        voxels[idx] = voxelVal;
      }
    });
  }

  return voxels;
}

export enum Prop2DType {
  None = 0,
  OakTree = 1,
  BirchTree = 2,
  PineTree = 3,
  PalmTree = 4,
  AcaciaTree = 5,
  SwampWillow = 6,
  JungleTree = 7,
  BerryBush = 8,
  WildflowerPatch = 9,
  StoneBoulder = 10,
  CopperOreNode = 11,
  IronOreNode = 12,
  GoldOreNode = 13,
  CrystalOreNode = 14,
  WheatCrop = 15,
  TorchPost = 16,
  CampfireFlame = 17,
  CoralReefProp = 18,
  CactusProp = 19,
  ReedClump = 20,
}

export interface Chunk2DSurfaceData {
  cx: number;
  cz: number;
  revision: number;
  groundVoxels: Uint8Array; // 16x16 top terrain/road/bridge block
  elevations: Uint8Array; // 16x16 terrain elevation
  waterDepths: Uint8Array; // 16x16 water depth (0 if dry land or bridge)
  props: Uint8Array; // 16x16 Prop2DType
  propVariants: Uint8Array; // 16x16 deterministic 0..255 variant hash
  fertility: Uint8Array; // 16x16 0..100 soil fertility
}

/**
 * Extracts a compact 2D top-down surface & flora map from a 16x16 chunk (using its 3D voxel buffer if provided,
 * or deterministically from sampleColumn when streaming far chunks).
 */
export function extractChunk2DSurface(
  cx: number,
  cz: number,
  seedNum: number,
  revision = 0,
  voxels?: Uint8Array
): Chunk2DSurfaceData {
  const groundVoxels = new Uint8Array(256);
  const elevations = new Uint8Array(256);
  const waterDepths = new Uint8Array(256);
  const props = new Uint8Array(256);
  const propVariants = new Uint8Array(256);
  const fertility = new Uint8Array(256);

  const baseWx = cx * CHUNK_SIZE;
  const baseWz = cz * CHUNK_SIZE;
  const hasVoxels = Boolean(voxels && voxels.byteLength >= CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);

  // Precompute deterministic tree anchors in this chunk
  const treeAnchors = new Map<number, Prop2DType>();
  const CELL = 8;
  const minCellX = Math.floor((baseWx - 2) / CELL);
  const maxCellX = Math.floor((baseWx + CHUNK_SIZE + 2) / CELL);
  const minCellZ = Math.floor((baseWz - 2) / CELL);
  const maxCellZ = Math.floor((baseWz + CHUNK_SIZE + 2) / CELL);

  for (let czCell = minCellZ; czCell <= maxCellZ; czCell++) {
    for (let cxCell = minCellX; cxCell <= maxCellX; cxCell++) {
      const { twx, twz, roll, varietyRoll } = getCellTreeCandidate(cxCell, czCell, seedNum);
      const lx = twx - baseWx;
      const lz = twz - baseWz;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;

      let tooClose = false;
      for (let ndz = -1; ndz <= 0 && !tooClose; ndz++) {
        for (let ndx = -1; ndx <= 1; ndx++) {
          if (ndz === 0 && ndx >= 0) break;
          const nb = getCellTreeCandidate(cxCell + ndx, czCell + ndz, seedNum);
          const dx = twx - nb.twx;
          const dz = twz - nb.twz;
          if (dx * dx + dz * dz < 32) {
            tooClose = true;
            break;
          }
        }
      }
      if (tooClose) continue;

      const col = sampleColumn(twx, twz, seedNum);
      if (
        col.height <= WATER_LEVEL + 1 ||
        col.isRiver ||
        col.isRavine ||
        col.slope >= 1.25 ||
        col.biome === BiomeType.Coast
      ) {
        continue;
      }

      const macroGrove = fbm2D(twx * 0.014, twz * 0.014, seedNum + 6101, 2);
      const microGlade = fbm2D(twx * 0.045, twz * 0.045, seedNum + 6421, 2);
      const groveFactor = macroGrove * 0.7 + microGlade * 0.3;

      let treeChance = 0;
      switch (col.biome) {
        case BiomeType.Jungle:
          treeChance = Math.max(0.08, 0.44 + groveFactor * 0.32);
          break;
        case BiomeType.Forest:
        case BiomeType.BirchForest:
        case BiomeType.Taiga:
          treeChance = groveFactor < -0.22 ? 0.04 : 0.32 + groveFactor * 0.34;
          break;
        case BiomeType.Swamp:
        case BiomeType.Oasis:
          treeChance = 0.22 + groveFactor * 0.18;
          break;
        case BiomeType.Alpine:
        case BiomeType.Snow:
          treeChance = Math.max(0, 0.13 + groveFactor * 0.15);
          break;
        case BiomeType.Savanna:
        case BiomeType.Meadow:
        case BiomeType.Plains:
          treeChance = groveFactor > 0.18 ? 0.12 + groveFactor * 0.12 : 0.022;
          break;
        case BiomeType.Desert:
          treeChance = 0.03;
          break;
        default:
          treeChance = 0;
      }

      if (roll < treeChance) {
        let tType = Prop2DType.OakTree;
        if (col.biome === BiomeType.Desert) {
          tType = varietyRoll > 0.45 ? Prop2DType.CactusProp : Prop2DType.PalmTree;
        } else if (col.biome === BiomeType.Oasis) {
          tType = Prop2DType.PalmTree;
        } else if (col.biome === BiomeType.Savanna) {
          tType = Prop2DType.AcaciaTree;
        } else if (
          col.biome === BiomeType.Taiga ||
          col.biome === BiomeType.Alpine ||
          col.biome === BiomeType.Snow
        ) {
          tType = Prop2DType.PineTree;
        } else if (col.biome === BiomeType.Swamp) {
          tType = Prop2DType.SwampWillow;
        } else if (col.biome === BiomeType.Jungle) {
          tType = Prop2DType.JungleTree;
        } else if (
          col.biome === BiomeType.BirchForest ||
          (col.biome === BiomeType.Forest && varietyRoll < 0.42)
        ) {
          tType = Prop2DType.BirchTree;
        }
        treeAnchors.set(lz * CHUNK_SIZE + lx, tType);
      } else if (
        roll < treeChance + 0.09 &&
        (col.biome === BiomeType.Forest ||
          col.biome === BiomeType.BirchForest ||
          col.biome === BiomeType.Meadow ||
          col.biome === BiomeType.Plains)
      ) {
        treeAnchors.set(lz * CHUNK_SIZE + lx, Prop2DType.BerryBush);
      }
    }
  }

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const idx2D = lz * CHUNK_SIZE + lx;
      const wx = baseWx + lx;
      const wz = baseWz + lz;
      const col = sampleColumn(wx, wz, seedNum);
      const varHash = Math.floor(hashCoords(wx * 31, wz * 17, seedNum + 907) * 255) & 255;
      propVariants[idx2D] = varHash;

      const fertScore = Math.max(
        5,
        Math.min(
          100,
          Math.round(
            (col.moisture + 0.65) * 58 +
              (1 - Math.abs(col.temperature - 0.12)) * 28 -
              col.slope * 18
          )
        )
      );
      fertility[idx2D] = col.height < WATER_LEVEL ? 0 : fertScore;

      let groundV = col.height < WATER_LEVEL ? VoxelType.Water : col.topVoxel;
      let elev = col.height;
      let wDepth = col.waterDepth;
      let prop = Prop2DType.None;

      if (hasVoxels && voxels) {
        // Scan around expected column height for roads, bridges, crops, felled trees, or terraforming
        const scanMaxY = Math.min(CHUNK_HEIGHT - 2, Math.max(col.height + 16, WATER_LEVEL + 6));
        const scanMinY = Math.max(1, Math.min(col.height - 6, WATER_LEVEL - 6));
        let foundSolidY = -1;
        let topSolidV = VoxelType.Air;
        let hasTrunkAbove = false;
        let aboveV = VoxelType.Air;

        for (let y = scanMaxY; y >= scanMinY; y--) {
          const v = voxels[voxelIndex(lx, y, lz)];
          if (v === VoxelType.Air) continue;
          if (
            v === VoxelType.Leaves ||
            v === VoxelType.PineLeaves ||
            v === VoxelType.BirchLeavesGold ||
            v === VoxelType.AutumnLeavesOrange ||
            v === VoxelType.PalmLeaves
          ) {
            continue;
          }
          if (v === VoxelType.WoodLog || v === VoxelType.BirchLog) {
            hasTrunkAbove = true;
            continue;
          }
          if (
            v === VoxelType.CropWheat ||
            v === VoxelType.BerryBush ||
            v === VoxelType.TorchEmber ||
            v === VoxelType.FireFlame ||
            v === VoxelType.CopperOre ||
            v === VoxelType.IronOre ||
            v === VoxelType.GoldOre ||
            v === VoxelType.CrystalOre
          ) {
            aboveV = v;
            continue;
          }
          foundSolidY = y;
          topSolidV = v;
          break;
        }

        if (foundSolidY > 0) {
          elev = foundSolidY;
          groundV = topSolidV;
          if (
            topSolidV === VoxelType.BridgeWood ||
            topSolidV === VoxelType.BridgeStone ||
            topSolidV === VoxelType.Plank ||
            topSolidV === VoxelType.RoadPaved ||
            topSolidV === VoxelType.RoadDirt
          ) {
            wDepth = 0;
          } else if (topSolidV === VoxelType.Water) {
            wDepth = Math.max(1, WATER_LEVEL - col.height);
          } else if (foundSolidY >= WATER_LEVEL) {
            wDepth = 0;
          }
        }

        if (aboveV === VoxelType.CropWheat) prop = Prop2DType.WheatCrop;
        else if (aboveV === VoxelType.BerryBush) prop = Prop2DType.BerryBush;
        else if (aboveV === VoxelType.TorchEmber) prop = Prop2DType.TorchPost;
        else if (aboveV === VoxelType.FireFlame) prop = Prop2DType.CampfireFlame;
        else if (aboveV === VoxelType.CopperOre) prop = Prop2DType.CopperOreNode;
        else if (aboveV === VoxelType.IronOre) prop = Prop2DType.IronOreNode;
        else if (aboveV === VoxelType.GoldOre) prop = Prop2DType.GoldOreNode;
        else if (aboveV === VoxelType.CrystalOre) prop = Prop2DType.CrystalOreNode;
        else if (hasTrunkAbove && treeAnchors.has(idx2D)) {
          prop = treeAnchors.get(idx2D)!;
        } else if (!hasTrunkAbove && treeAnchors.get(idx2D) === Prop2DType.BerryBush) {
          prop = Prop2DType.BerryBush;
        }
      } else {
        if (treeAnchors.has(idx2D)) {
          prop = treeAnchors.get(idx2D)!;
        }
      }

      // Natural wildflowers, reeds, coral reefs, and surface ore outcrops when tile has no tree/building
      if (
        prop === Prop2DType.None &&
        groundV !== VoxelType.RoadDirt &&
        groundV !== VoxelType.RoadPaved &&
        groundV !== VoxelType.BridgeWood &&
        groundV !== VoxelType.BridgeStone &&
        groundV !== VoxelType.Plank
      ) {
        if (col.biome === BiomeType.CoralReef && wDepth > 0 && varHash < 65) {
          prop = Prop2DType.CoralReefProp;
        } else if (
          wDepth === 0 &&
          elev === WATER_LEVEL + 1 &&
          (col.isRiver || col.biome === BiomeType.Swamp || col.biome === BiomeType.Oasis) &&
          varHash < 42
        ) {
          prop = Prop2DType.ReedClump;
        } else if (
          wDepth === 0 &&
          (col.biome === BiomeType.Meadow ||
            col.biome === BiomeType.Plains ||
            col.biome === BiomeType.Forest ||
            col.biome === BiomeType.BirchForest) &&
          varHash > 222
        ) {
          prop = Prop2DType.WildflowerPatch;
        } else if (
          wDepth === 0 &&
          (col.biome === BiomeType.Mountains ||
            col.biome === BiomeType.Alpine ||
            col.biome === BiomeType.Badlands) &&
          varHash > 236
        ) {
          prop =
            varHash > 250
              ? Prop2DType.GoldOreNode
              : varHash > 244
              ? Prop2DType.IronOreNode
              : varHash > 239
              ? Prop2DType.CopperOreNode
              : Prop2DType.StoneBoulder;
        }
      }

      groundVoxels[idx2D] = groundV;
      elevations[idx2D] = Math.max(0, Math.min(255, elev));
      waterDepths[idx2D] = Math.max(0, Math.min(255, wDepth));
      props[idx2D] = prop;
    }
  }

  return {
    cx,
    cz,
    revision,
    groundVoxels,
    elevations,
    waterDepths,
    props,
    propVariants,
    fertility,
  };
}



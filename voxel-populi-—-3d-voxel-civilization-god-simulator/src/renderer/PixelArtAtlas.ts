/**
 * Procedural 2D Pixel-Art Sprite, Tile & Paper-Doll Renderer
 * Art Direction: "WorldBox meets Stardew Valley"
 * - Medium-detail, charming, readable pixel art with soft color palettes
 * - Colored outlines (warm umber, deep forest, slate navy — never harsh black)
 * - Subtle 2-tone dithering, highlights, and soft drop shadows
 * - Modular buildings with full interior furniture + smooth roof cutaway
 * - Expressive 16-24px layered paper-doll characters + wildlife + ships
 */

import { Prop2DType } from '../sim/terrain';
import {
  AgentAnimAction,
  AnimalMarker3D,
  EraType,
  SeasonType,
  StructureMarker3D,
  VehicleMarker3D,
  VoxelType,
} from '../sim/types';

export interface TilePalette {
  base: string;
  ditherA: string;
  ditherB: string;
  edge: string;
  cliffFace: string;
  cliffShadow: string;
}

const VOXEL_PALETTES: Record<number, TilePalette> = {
  [VoxelType.Grass]: {
    base: '#68a357',
    ditherA: '#74b061',
    ditherB: '#5c944b',
    edge: '#467538',
    cliffFace: '#7a6855',
    cliffShadow: '#544638',
  },
  [VoxelType.ForestGrass]: {
    base: '#4f8a49',
    ditherA: '#5a9653',
    ditherB: '#447a3e',
    edge: '#356130',
    cliffFace: '#6e5d4c',
    cliffShadow: '#4a3e32',
  },
  [VoxelType.Sand]: {
    base: '#e6ca8a',
    ditherA: '#f0d699',
    ditherB: '#d9bc7b',
    edge: '#bda060',
    cliffFace: '#c29f61',
    cliffShadow: '#9c7d46',
  },
  [VoxelType.Dirt]: {
    base: '#9c7452',
    ditherA: '#a87f5c',
    ditherB: '#8c6646',
    edge: '#6e4e34',
    cliffFace: '#78563c',
    cliffShadow: '#573d29',
  },
  [VoxelType.FertileSoil]: {
    base: '#6b4930',
    ditherA: '#785338',
    ditherB: '#5c3d27',
    edge: '#472e1c',
    cliffFace: '#5c3d27',
    cliffShadow: '#3d2718',
  },
  [VoxelType.CropWheat]: {
    base: '#7a5638',
    ditherA: '#cfa042',
    ditherB: '#66462c',
    edge: '#523721',
    cliffFace: '#66462c',
    cliffShadow: '#47301d',
  },
  [VoxelType.Snow]: {
    base: '#eef5fc',
    ditherA: '#f8fbff',
    ditherB: '#dce8f5',
    edge: '#b5c9de',
    cliffFace: '#8c9eb3',
    cliffShadow: '#64768c',
  },
  [VoxelType.Ice]: {
    base: '#9ad1f5',
    ditherA: '#b3dffb',
    ditherB: '#82bfe8',
    edge: '#5ea2d1',
    cliffFace: '#5ea2d1',
    cliffShadow: '#427ba3',
  },
  [VoxelType.Stone]: {
    base: '#8c929c',
    ditherA: '#9ba1ab',
    ditherB: '#7d838d',
    edge: '#5e646e',
    cliffFace: '#6d737d',
    cliffShadow: '#4d5259',
  },
  [VoxelType.DarkSlate]: {
    base: '#59606e',
    ditherA: '#666e7d',
    ditherB: '#4c525e',
    edge: '#383d47',
    cliffFace: '#454b57',
    cliffShadow: '#2e323b',
  },
  [VoxelType.Sandstone]: {
    base: '#d4ab6a',
    ditherA: '#dfba7b',
    ditherB: '#c49b5a',
    edge: '#9e7940',
    cliffFace: '#b3894c',
    cliffShadow: '#876534',
  },
  [VoxelType.Terracotta]: {
    base: '#c46d4e',
    ditherA: '#d1795a',
    ditherB: '#b35f42',
    edge: '#8c462e',
    cliffFace: '#9e5036',
    cliffShadow: '#733824',
  },
  [VoxelType.ClayBrick]: {
    base: '#b5634a',
    ditherA: '#c26f55',
    ditherB: '#a3553d',
    edge: '#7d3e2b',
    cliffFace: '#8f4934',
    cliffShadow: '#663222',
  },
  [VoxelType.RoadDirt]: {
    base: '#b88c61',
    ditherA: '#c4986d',
    ditherB: '#a67b51',
    edge: '#805c38',
    cliffFace: '#805c38',
    cliffShadow: '#5e4227',
  },
  [VoxelType.RoadPaved]: {
    base: '#9ca0a8',
    ditherA: '#aeb2ba',
    ditherB: '#878b94',
    edge: '#646870',
    cliffFace: '#646870',
    cliffShadow: '#494c52',
  },
  [VoxelType.Cobblestone]: {
    base: '#8a8e96',
    ditherA: '#9b9fa8',
    ditherB: '#787c85',
    edge: '#595c63',
    cliffFace: '#595c63',
    cliffShadow: '#404347',
  },
  [VoxelType.BridgeWood]: {
    base: '#9e6b43',
    ditherA: '#ad784e',
    ditherB: '#8a5a35',
    edge: '#5e3b20',
    cliffFace: '#5e3b20',
    cliffShadow: '#422814',
  },
  [VoxelType.BridgeStone]: {
    base: '#989da6',
    ditherA: '#a9aeb8',
    ditherB: '#838891',
    edge: '#5e6269',
    cliffFace: '#5e6269',
    cliffShadow: '#43464b',
  },
  [VoxelType.Plank]: {
    base: '#ab784b',
    ditherA: '#ba8556',
    ditherB: '#96663d',
    edge: '#6b4627',
    cliffFace: '#6b4627',
    cliffShadow: '#4d311a',
  },
  [VoxelType.CoralBlock]: {
    base: '#3ab5c9',
    ditherA: '#f27999',
    ditherB: '#f5b851',
    edge: '#23899e',
    cliffFace: '#23899e',
    cliffShadow: '#186475',
  },
  [VoxelType.TorchEmber]: {
    base: '#e85d2a',
    ditherA: '#ff9b42',
    ditherB: '#bd3b14',
    edge: '#7a2208',
    cliffFace: '#52291d',
    cliffShadow: '#361a12',
  },
};

export function getTilePalette(voxel: number, season: SeasonType): TilePalette {
  if (voxel === VoxelType.Grass || voxel === VoxelType.ForestGrass) {
    if (season === 'Autumn') {
      return voxel === VoxelType.ForestGrass
        ? {
            base: '#7d8c42',
            ditherA: '#949c49',
            ditherB: '#6b7a37',
            edge: '#505c27',
            cliffFace: '#75624e',
            cliffShadow: '#524334',
          }
        : {
            base: '#8fa650',
            ditherA: '#a3b85c',
            ditherB: '#7c9142',
            edge: '#5d6e30',
            cliffFace: '#7a6855',
            cliffShadow: '#544638',
          };
    }
    if (season === 'Winter') {
      return {
        base: '#9eb8a8',
        ditherA: '#b8d1c2',
        ditherB: '#87a191',
        edge: '#678071',
        cliffFace: '#78828c',
        cliffShadow: '#545d66',
      };
    }
    if (season === 'Spring') {
      return voxel === VoxelType.ForestGrass
        ? VOXEL_PALETTES[VoxelType.ForestGrass]
        : {
            base: '#70b35d',
            ditherA: '#80c46b',
            ditherB: '#60a14e',
            edge: '#478038',
            cliffFace: '#7a6855',
            cliffShadow: '#544638',
          };
    }
  }
  return VOXEL_PALETTES[voxel] || VOXEL_PALETTES[VoxelType.Grass];
}

/**
 * Draws a crisp Stardew/WorldBox-style tree or flora prop at (cx, cy) in world pixel coordinates
 */
export function drawProp2D(
  ctx: CanvasRenderingContext2D,
  prop: Prop2DType,
  variant: number,
  px: number,
  py: number,
  tilePx: number,
  season: SeasonType,
  windSway: number,
  sunOffX: number,
  sunOffY: number
) {
  if (prop === Prop2DType.None) return;

  const s = tilePx / 16; // Normalized scale relative to a 16x16 pixel tile

  switch (prop) {
    case Prop2DType.WildflowerPatch: {
      const flowerColors = ['#f43f5e', '#facc15', '#a855f7', '#fb923c', '#38bdf8', '#f472b6'];
      const col1 = flowerColors[variant % flowerColors.length];
      const col2 = flowerColors[(variant >> 2) % flowerColors.length];
      ctx.fillStyle = '#3f7a38';
      ctx.fillRect(px - 3 * s, py - 1 * s, 2 * s, 2 * s);
      ctx.fillRect(px + 2 * s, py + 1 * s, 2 * s, 2 * s);
      ctx.fillStyle = col1;
      ctx.fillRect(px - 3 * s, py - 2 * s, 2.2 * s, 2.2 * s);
      ctx.fillStyle = col2;
      ctx.fillRect(px + 2 * s, py, 2.2 * s, 2.2 * s);
      if ((variant & 3) === 0) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(px, py - 3 * s, 2 * s, 2 * s);
      }
      break;
    }

    case Prop2DType.WheatCrop: {
      // Tilled soil rows + golden swaying wheat stalks
      ctx.fillStyle = '#5c3c24';
      ctx.fillRect(px - 6 * s, py - 5 * s, 12 * s, 10 * s);
      const sway = windSway * 1.4 * s;
      const stalkCol = season === 'Spring' ? '#84cc16' : '#eab308';
      const tipCol = season === 'Spring' ? '#bef264' : '#fef08a';
      for (let rx = -4; rx <= 4; rx += 4) {
        for (let rz = -3; rz <= 3; rz += 3) {
          ctx.fillStyle = stalkCol;
          ctx.fillRect(px + rx * s, py + rz * s - 3 * s, 1.8 * s, 4 * s);
          ctx.fillStyle = tipCol;
          ctx.fillRect(px + rx * s + sway, py + rz * s - 5 * s, 2.2 * s, 2.2 * s);
        }
      }
      break;
    }

    case Prop2DType.BerryBush: {
      // Shadow
      ctx.fillStyle = 'rgba(20, 30, 18, 0.28)';
      ctx.beginPath();
      ctx.ellipse(px + sunOffX * 0.4, py + 3 * s, 6 * s, 3.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bush outline & body
      ctx.fillStyle = '#284f26';
      ctx.beginPath();
      ctx.arc(px, py, 5.5 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = season === 'Autumn' ? '#9a6b32' : '#4a853b';
      ctx.beginPath();
      ctx.arc(px - 1 * s, py - 1 * s, 4.2 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = season === 'Autumn' ? '#b88442' : '#68ab54';
      ctx.beginPath();
      ctx.arc(px - 1.5 * s, py - 2 * s, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();

      // Red/purple berries
      if (season !== 'Winter') {
        ctx.fillStyle = '#e11d48';
        ctx.fillRect(px - 2.5 * s, py - 1.5 * s, 1.8 * s, 1.8 * s);
        ctx.fillRect(px + 1.2 * s, py - 0.5 * s, 1.8 * s, 1.8 * s);
        ctx.fillRect(px - 0.5 * s, py + 1.2 * s, 1.8 * s, 1.8 * s);
      }
      break;
    }

    case Prop2DType.ReedClump: {
      const sway = windSway * 1.2 * s;
      ctx.fillStyle = '#3f6e3a';
      ctx.fillRect(px - 3 * s, py - 5 * s, 1.5 * s, 7 * s);
      ctx.fillRect(px, py - 6 * s, 1.5 * s, 8 * s);
      ctx.fillRect(px + 2.5 * s, py - 4 * s, 1.5 * s, 6 * s);
      ctx.fillStyle = '#78472a';
      ctx.fillRect(px + sway - 0.2 * s, py - 7.5 * s, 2 * s, 3 * s);
      ctx.fillRect(px - 3 * s + sway, py - 6.5 * s, 2 * s, 2.5 * s);
      break;
    }

    case Prop2DType.CoralReefProp: {
      const coralCols = ['#f472b6', '#fb923c', '#a855f7', '#2dd4bf', '#facc15'];
      ctx.fillStyle = coralCols[variant % coralCols.length];
      ctx.beginPath();
      ctx.arc(px - 2 * s, py, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = coralCols[(variant + 2) % coralCols.length];
      ctx.beginPath();
      ctx.arc(px + 2 * s, py - 1 * s, 2.6 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case Prop2DType.StoneBoulder:
    case Prop2DType.CopperOreNode:
    case Prop2DType.IronOreNode:
    case Prop2DType.GoldOreNode:
    case Prop2DType.CrystalOreNode: {
      // Ground shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
      ctx.beginPath();
      ctx.ellipse(px + 1.5 * s, py + 3.5 * s, 6.5 * s, 3.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Colored outline rock base
      ctx.fillStyle = '#3b4048';
      ctx.beginPath();
      ctx.arc(px, py, 6.2 * s, 0, Math.PI * 2);
      ctx.fill();

      // Mid stone body
      ctx.fillStyle = '#6c737f';
      ctx.beginPath();
      ctx.arc(px - 0.5 * s, py - 0.6 * s, 5.1 * s, 0, Math.PI * 2);
      ctx.fill();

      // Top highlight facet
      ctx.fillStyle = '#9aa1ad';
      ctx.beginPath();
      ctx.arc(px - 1.5 * s, py - 1.8 * s, 3.0 * s, 0, Math.PI * 2);
      ctx.fill();

      // Sparkling ore veins
      if (prop !== Prop2DType.StoneBoulder) {
        const oreColor =
          prop === Prop2DType.CopperOreNode
            ? '#f97316'
            : prop === Prop2DType.IronOreNode
            ? '#cbd5e1'
            : prop === Prop2DType.GoldOreNode
            ? '#facc15'
            : '#c084fc';
        const glintColor =
          prop === Prop2DType.CopperOreNode
            ? '#fdba74'
            : prop === Prop2DType.IronOreNode
            ? '#ffffff'
            : prop === Prop2DType.GoldOreNode
            ? '#fef08a'
            : '#f3e8ff';
        ctx.fillStyle = oreColor;
        ctx.fillRect(px - 3 * s, py - 2 * s, 2.4 * s, 2.4 * s);
        ctx.fillRect(px + 1 * s, py - 1 * s, 2.4 * s, 2.4 * s);
        ctx.fillRect(px - 1 * s, py + 1.5 * s, 2.2 * s, 2.2 * s);
        ctx.fillStyle = glintColor;
        ctx.fillRect(px - 2.5 * s, py - 1.5 * s, 1.1 * s, 1.1 * s);
        ctx.fillRect(px + 1.5 * s, py - 0.5 * s, 1.1 * s, 1.1 * s);
      }
      break;
    }

    case Prop2DType.CactusProp: {
      // Saguaro cactus with colored outline and arms
      ctx.fillStyle = 'rgba(30, 25, 15, 0.25)';
      ctx.beginPath();
      ctx.ellipse(px + sunOffX * 0.5, py + 4 * s, 5 * s, 2.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1f4d2b';
      ctx.fillRect(px - 2.8 * s, py - 11 * s, 5.6 * s, 14 * s);
      ctx.fillRect(px - 6.5 * s, py - 7 * s, 4 * s, 2.8 * s);
      ctx.fillRect(px - 6.5 * s, py - 10 * s, 2.8 * s, 5 * s);
      ctx.fillRect(px + 2.5 * s, py - 5.5 * s, 4 * s, 2.8 * s);
      ctx.fillRect(px + 3.7 * s, py - 9 * s, 2.8 * s, 5.5 * s);

      ctx.fillStyle = '#3b8549';
      ctx.fillRect(px - 1.8 * s, py - 10 * s, 3.6 * s, 12.5 * s);
      ctx.fillStyle = '#62ad6b';
      ctx.fillRect(px - 1.0 * s, py - 9.5 * s, 1.4 * s, 11 * s);
      break;
    }

    case Prop2DType.TorchPost:
    case Prop2DType.CampfireFlame: {
      // Glowing hearth / torch
      ctx.fillStyle = '#5c3a21';
      ctx.fillRect(px - 1.5 * s, py - 3 * s, 3 * s, 5 * s);
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(px + windSway * s, py - 4 * s, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(px + windSway * 0.5 * s, py - 4 * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    default: {
      // Multi-clustered Stardew/WorldBox Trees (Oak, Birch, Pine, Palm, Acacia, Willow, Jungle)
      const sway = windSway * 1.8 * s;
      const scaleVar = 0.88 + (variant % 5) * 0.06;
      const ts = s * scaleVar;

      // 1. Directional Soft Drop Shadow on Ground
      ctx.fillStyle = 'rgba(15, 25, 18, 0.28)';
      ctx.beginPath();
      ctx.ellipse(
        px + sunOffX * 0.85 * ts,
        py + (4 + sunOffY * 0.45) * ts,
        10.5 * ts,
        6.0 * ts,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // 2. Tree Trunk with Root Flare & Bark Shading
      const isBirch = prop === Prop2DType.BirchTree;
      ctx.fillStyle = isBirch ? '#524b44' : '#3d2616';
      ctx.fillRect(px - 2.8 * ts, py - 8 * ts, 5.6 * ts, 11 * ts);
      ctx.fillStyle = isBirch ? '#e7e2da' : '#6e472b';
      ctx.fillRect(px - 1.8 * ts, py - 8 * ts, 3.6 * ts, 10.5 * ts);
      if (isBirch) {
        ctx.fillStyle = '#3f3a34';
        ctx.fillRect(px - 1.5 * ts, py - 5 * ts, 2.2 * ts, 1.0 * ts);
        ctx.fillRect(px - 0.5 * ts, py - 2 * ts, 2.0 * ts, 1.0 * ts);
      }

      // 3. Seasonal & Biome Canopy Palette (Outline, Shadow, Midtone, Highlight)
      let colOutline = '#1e3f24';
      let colShadow = '#2d5c34';
      let colMid = '#468246';
      let colHigh = '#68ab58';

      if (prop === Prop2DType.PineTree) {
        colOutline = '#163026';
        colShadow = '#1f4737';
        colMid = '#2d634c';
        colHigh = season === 'Winter' ? '#e2f1fa' : '#438266';
      } else if (prop === Prop2DType.BirchTree) {
        if (season === 'Autumn') {
          colOutline = '#5c2d16';
          colShadow = '#9e4a1e';
          colMid = '#d97724';
          colHigh = '#f5b041';
        } else if (season === 'Spring' && (variant & 3) === 0) {
          // Cherry / Spring Blossom Tree!
          colOutline = '#5c2842';
          colShadow = '#ad4c78';
          colMid = '#e87ea8';
          colHigh = '#fbcfe8';
        } else {
          colOutline = '#284a26';
          colShadow = '#44753b';
          colMid = '#689e54';
          colHigh = '#90c474';
        }
      } else if (prop === Prop2DType.PalmTree) {
        colOutline = '#244721';
        colShadow = '#3a6e32';
        colMid = '#589646';
        colHigh = '#82bd64';
      } else if (prop === Prop2DType.AcaciaTree) {
        colOutline = '#334a1e';
        colShadow = '#506e2c';
        colMid = '#73913d';
        colHigh = '#98b354';
      } else if (prop === Prop2DType.SwampWillow) {
        colOutline = '#1f3829';
        colShadow = '#31543d';
        colMid = '#487353';
        colHigh = '#66946e';
      } else if (season === 'Autumn') {
        const isCrimson = (variant & 1) === 1;
        colOutline = isCrimson ? '#4a1818' : '#573214';
        colShadow = isCrimson ? '#822727' : '#94561e';
        colMid = isCrimson ? '#b83b3b' : '#c97d28';
        colHigh = isCrimson ? '#e06358' : '#ebb044';
      }

      if (season === 'Winter' && prop !== Prop2DType.PalmTree && prop !== Prop2DType.AcaciaTree) {
        colHigh = '#e8f3fc';
      }

      const cx = px + sway;
      const cy = py - 11 * ts;

      if (prop === Prop2DType.PineTree) {
        // Tiered triangular pixel conifer boughs
        const tiers = [
          { yOff: 3 * ts, w: 10.5 * ts, h: 7 * ts },
          { yOff: -2 * ts, w: 8.5 * ts, h: 6.5 * ts },
          { yOff: -6.5 * ts, w: 6.0 * ts, h: 6.0 * ts },
        ];
        for (const t of tiers) {
          // Colored outline
          ctx.fillStyle = colOutline;
          ctx.beginPath();
          ctx.moveTo(cx, cy + t.yOff - t.h);
          ctx.lineTo(cx - t.w, cy + t.yOff + 2 * ts);
          ctx.lineTo(cx + t.w, cy + t.yOff + 2 * ts);
          ctx.closePath();
          ctx.fill();

          // Mid foliage
          ctx.fillStyle = colMid;
          ctx.beginPath();
          ctx.moveTo(cx, cy + t.yOff - t.h + 1.2 * ts);
          ctx.lineTo(cx - t.w + 1.4 * ts, cy + t.yOff + 1 * ts);
          ctx.lineTo(cx + t.w - 1.4 * ts, cy + t.yOff + 1 * ts);
          ctx.closePath();
          ctx.fill();

          // Snow / sun highlight on upper-left slope
          ctx.fillStyle = colHigh;
          ctx.beginPath();
          ctx.moveTo(cx, cy + t.yOff - t.h + 1.4 * ts);
          ctx.lineTo(cx - t.w * 0.65, cy + t.yOff);
          ctx.lineTo(cx + t.w * 0.15, cy + t.yOff - 1 * ts);
          ctx.closePath();
          ctx.fill();
        }
      } else if (prop === Prop2DType.PalmTree) {
        // Starburst arching palm fronds
        const angles = [-2.6, -1.9, -1.1, -0.4, 0.4, 1.2, 2.1];
        for (const ang of angles) {
          const fx = cx + Math.cos(ang) * 9.5 * ts;
          const fy = cy + Math.sin(ang) * 6.5 * ts;
          ctx.strokeStyle = colOutline;
          ctx.lineWidth = 3.6 * ts;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.quadraticCurveTo((cx + fx) * 0.5, cy - 3 * ts, fx, fy);
          ctx.stroke();

          ctx.strokeStyle = ang < 0 ? colHigh : colMid;
          ctx.lineWidth = 2.2 * ts;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.quadraticCurveTo((cx + fx) * 0.5, cy - 3 * ts, fx, fy);
          ctx.stroke();
        }
        // Coconuts at crown center
        ctx.fillStyle = '#5c3a21';
        ctx.beginPath();
        ctx.arc(cx, cy + 1 * ts, 2.2 * ts, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Lush Multi-Clustered Stardew Valley Hardwood Canopy (4 overlapping puffs)
        const puffs = [
          { dx: -4.5 * ts, dy: 1.5 * ts, r: 6.2 * ts },
          { dx: 4.5 * ts, dy: 1.5 * ts, r: 6.2 * ts },
          { dx: 0, dy: 2.5 * ts, r: 6.8 * ts },
          { dx: 0, dy: -2.8 * ts, r: 6.8 * ts },
        ];

        // Pass A: Colored Outline
        ctx.fillStyle = colOutline;
        for (const p of puffs) {
          ctx.beginPath();
          ctx.arc(cx + p.dx, cy + p.dy, p.r + 1.2 * ts, 0, Math.PI * 2);
          ctx.fill();
        }

        // Pass B: Lower Shadow Base
        ctx.fillStyle = colShadow;
        for (const p of puffs) {
          ctx.beginPath();
          ctx.arc(cx + p.dx, cy + p.dy + 0.5 * ts, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Pass C: Midtone Leaf Clusters
        ctx.fillStyle = colMid;
        for (const p of puffs) {
          ctx.beginPath();
          ctx.arc(cx + p.dx - 0.3 * ts, cy + p.dy - 0.8 * ts, p.r * 0.86, 0, Math.PI * 2);
          ctx.fill();
        }

        // Pass D: Sunlit Crown Highlights & Pixel Leaf Detail
        ctx.fillStyle = colHigh;
        ctx.beginPath();
        ctx.arc(cx - 2.2 * ts, cy - 3.6 * ts, 4.2 * ts, 0, Math.PI * 2);
        ctx.arc(cx + 2.0 * ts, cy - 2.2 * ts, 3.2 * ts, 0, Math.PI * 2);
        ctx.arc(cx - 4.0 * ts, cy - 0.4 * ts, 2.8 * ts, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}

/**
 * Draws a 2D Top-Down Building with:
 * 1. Foundation & Interior Floor + Furniture (always rendered so roof cutaway reveals lived-in rooms!)
 * 2. Walls, Doorways, Windows, Flower Boxes & Night Window Glow
 * 3. Pitched/Tiled/Domed Roof with Smooth Cutaway Alpha (`roofAlpha` in [0..1])
 * 4. Construction Scaffolding when `!st.isComplete`
 */
export function drawStructure2D(
  ctx: CanvasRenderingContext2D,
  st: StructureMarker3D,
  screenX: number,
  screenY: number,
  tilePx: number,
  roofAlpha: number,
  nightGlow: number,
  animTimeSec: number
) {
  const wTiles = Math.max(3, st.width || 6);
  const dTiles = Math.max(3, st.depth || 6);
  const pw = wTiles * tilePx;
  const pd = dTiles * tilePx;
  const x0 = screenX - pw * 0.5;
  const y0 = screenY - pd * 0.5;
  const s = tilePx / 16;

  // Special open structures (Campfire, Roads, Bridges, StandingStones, WheatFarmPlot)
  if (st.type === 'Campfire') {
    // Stone ring + log benches + warm flickering fire
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(screenX, screenY, tilePx * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Log benches
    ctx.fillStyle = '#5c3a21';
    ctx.fillRect(screenX - tilePx * 1.2, screenY - tilePx * 1.6, tilePx * 2.4, 4 * s);
    ctx.fillRect(screenX - tilePx * 1.2, screenY + tilePx * 1.2, tilePx * 2.4, 4 * s);
    ctx.fillRect(screenX - tilePx * 1.6, screenY - tilePx * 1.0, 4 * s, tilePx * 2.0);
    ctx.fillRect(screenX + tilePx * 1.2, screenY - tilePx * 1.0, 4 * s, tilePx * 2.0);

    // Stone ring
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.arc(screenX, screenY, tilePx * 0.75, 0, Math.PI * 2);
    ctx.fill();

    // Dancing fire
    const flicker = Math.sin(animTimeSec * 9 + st.id) * 1.5 * s;
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(screenX, screenY, tilePx * 0.52 + flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(screenX, screenY, tilePx * 0.28, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (st.type === 'WheatFarmPlot' || st.type === 'OrchardGrove') {
    // Fenced farm plot with furrowed soil & golden crops
    ctx.fillStyle = '#4f3522';
    ctx.fillRect(x0, y0, pw, pd);
    ctx.fillStyle = '#69472e';
    ctx.fillRect(x0 + 2 * s, y0 + 2 * s, pw - 4 * s, pd - 4 * s);

    const rows = Math.max(2, dTiles - 1);
    for (let r = 0; r < rows; r++) {
      const ry = y0 + 5 * s + (r * (pd - 10 * s)) / rows;
      ctx.fillStyle = '#472e1c';
      ctx.fillRect(x0 + 5 * s, ry, pw - 10 * s, 2.5 * s);
      if (st.isComplete) {
        ctx.fillStyle = st.type === 'OrchardGrove' ? '#4d8f3c' : '#eab308';
        for (let cx = x0 + 7 * s; cx < x0 + pw - 7 * s; cx += 6 * s) {
          ctx.fillRect(cx, ry - 2 * s, 3.2 * s, 3.2 * s);
        }
      }
    }
    return;
  }

  // 1. Soft Building Drop Shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
  ctx.fillRect(x0 + 4 * s, y0 + 5 * s, pw, pd);

  // Era material palette
  const isStoneAge = st.era === EraType.StoneAge;
  const isNeolithic = st.era === EraType.Neolithic;
  const isBronze = st.era === EraType.BronzeAge;
  const isIron = st.era === EraType.IronAge;
  const isMedieval = st.era === EraType.Medieval;
  const isArcane = st.era === EraType.ArcaneRenaissance;

  const wallOutline = isStoneAge
    ? '#3d291a'
    : isBronze
    ? '#5c3824'
    : isMedieval || isArcane
    ? '#2e3440'
    : '#3b2818';

  const floorBase = isStoneAge
    ? '#8c6d4e'
    : isNeolithic
    ? '#9e744b'
    : isBronze
    ? '#c99e67'
    : isArcane
    ? '#d8dee9'
    : '#8f6845';

  const floorLine = isArcane ? '#b8c2d1' : '#6e4e32';

  // 2. Foundation & Interior Floor (Always drawn so cutaway shows interior rooms!)
  ctx.fillStyle = wallOutline;
  ctx.fillRect(x0, y0, pw, pd);

  const wallThick = Math.max(2, 3 * s);
  const ix = x0 + wallThick;
  const iy = y0 + wallThick;
  const iw = pw - wallThick * 2;
  const id = pd - wallThick * 2;

  ctx.fillStyle = floorBase;
  ctx.fillRect(ix, iy, iw, id);

  // Floor plank / tile lines
  ctx.fillStyle = floorLine;
  for (let py = iy + 6 * s; py < iy + id; py += 6 * s) {
    ctx.fillRect(ix, py, iw, Math.max(1, 0.8 * s));
  }

  // Interior room divider wall + doorway for larger buildings
  if (wTiles >= 6 && dTiles >= 6) {
    const midY = iy + id * 0.48;
    ctx.fillStyle = wallOutline;
    ctx.fillRect(ix, midY, iw * 0.38, 2.2 * s);
    ctx.fillRect(ix + iw * 0.62, midY, iw * 0.38, 2.2 * s);
  }

  // 3. Interior Furniture (Beds, Glowing Hearth, Tables, Anvil, Bookshelves, Crates)
  if (tilePx >= 6) {
    // Cozy Hearth on north wall
    ctx.fillStyle = '#57534e';
    ctx.fillRect(screenX - 5 * s, iy + 1 * s, 10 * s, 5 * s);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(screenX - 3 * s, iy + 2 * s, 6 * s, 3 * s);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(screenX - 1.5 * s, iy + 2.5 * s, 3 * s, 2 * s);

    if (st.category === 'Shelter') {
      // Beds with colored quilts (civColor) and white pillows
      ctx.fillStyle = '#4a2e19';
      ctx.fillRect(ix + 3 * s, iy + 3 * s, 8 * s, 11 * s);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(ix + 4 * s, iy + 4 * s, 6 * s, 3 * s);
      ctx.fillStyle = st.civColor || '#ef4444';
      ctx.fillRect(ix + 4 * s, iy + 7 * s, 6 * s, 6 * s);

      // Center wooden table & rug
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(screenX - 6 * s, screenY, 12 * s, 8 * s);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(screenX - 4 * s, screenY + 1.5 * s, 8 * s, 5 * s);
    } else if (st.category === 'Industry' || st.category === 'Craft') {
      // Blacksmith Anvil, Furnace & Barrels
      ctx.fillStyle = '#334155';
      ctx.fillRect(ix + 4 * s, screenY - 2 * s, 7 * s, 4.5 * s);
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(ix + iw - 6 * s, iy + 6 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.arc(ix + iw - 6 * s, iy + 14 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (st.category === 'Civic' || st.category === 'Spiritual' || st.category === 'Wonder') {
      // Carpet runner + bookshelves / altar
      ctx.fillStyle = st.civColor || '#d97706';
      ctx.fillRect(screenX - 4 * s, iy + 6 * s, 8 * s, id - 8 * s);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(screenX - 6 * s, iy + 7 * s, 12 * s, 4 * s);
    } else {
      // Storage crates & grain sacks
      ctx.fillStyle = '#a16207';
      ctx.fillRect(ix + 3 * s, iy + 4 * s, 6 * s, 6 * s);
      ctx.fillRect(ix + iw - 9 * s, iy + 4 * s, 6 * s, 6 * s);
    }
  }

  // Front South Wall Facade + Threshold Doorway + Paned Windows
  const facadeH = Math.max(4 * s, pd * 0.22);
  const fy = y0 + pd - facadeH;
  const facadeWallCol = isStoneAge
    ? '#a68966'
    : isNeolithic
    ? '#8c5e3c'
    : isBronze
    ? '#d9ad7c'
    : isIron
    ? '#d6cec2'
    : isMedieval
    ? '#949ba6'
    : '#e2e8f0';

  ctx.fillStyle = wallOutline;
  ctx.fillRect(x0, fy, pw, facadeH);
  ctx.fillStyle = facadeWallCol;
  ctx.fillRect(x0 + 1.5 * s, fy + 1.5 * s, pw - 3 * s, facadeH - 3 * s);

  // Timber framing crossbeams for Iron/Medieval houses
  if (isIron || isMedieval) {
    ctx.fillStyle = '#4a301d';
    ctx.fillRect(x0 + pw * 0.28, fy, 2 * s, facadeH);
    ctx.fillRect(x0 + pw * 0.72, fy, 2 * s, facadeH);
  }

  // Arched / Framed Front Doorway (South center)
  const doorW = Math.max(5 * s, pw * 0.18);
  const doorH = facadeH - 1.5 * s;
  ctx.fillStyle = '#29190e';
  ctx.fillRect(screenX - doorW * 0.5 - 1 * s, fy + 1.5 * s, doorW + 2 * s, doorH);
  ctx.fillStyle = '#5c381e';
  ctx.fillRect(screenX - doorW * 0.5, fy + 2.5 * s, doorW, doorH - 1 * s);

  // Flanking Windows with Night Candlelight Glow & Flower Boxes
  if (wTiles >= 5) {
    const winW = 4.5 * s;
    const winH = 4.0 * s;
    const winColor = nightGlow > 0.2 ? '#fde047' : '#7dd3fc';
    for (const side of [-1, 1]) {
      const wx = screenX + side * (pw * 0.28) - winW * 0.5;
      const wy = fy + 2.5 * s;
      ctx.fillStyle = '#3b2616';
      ctx.fillRect(wx - 1 * s, wy - 1 * s, winW + 2 * s, winH + 2 * s);
      ctx.fillStyle = winColor;
      ctx.fillRect(wx, wy, winW, winH);
      // Window cross-mullion
      ctx.fillStyle = '#3b2616';
      ctx.fillRect(wx + winW * 0.45, wy, 1 * s, winH);
      // Charming Stardew flower box under window
      if (!isStoneAge) {
        ctx.fillStyle = '#6b4226';
        ctx.fillRect(wx - 1 * s, wy + winH + 0.5 * s, winW + 2 * s, 2 * s);
        ctx.fillStyle = side < 0 ? '#f43f5e' : '#facc15';
        ctx.fillRect(wx, wy + winH - 0.5 * s, 1.8 * s, 1.8 * s);
        ctx.fillRect(wx + 2.5 * s, wy + winH - 0.5 * s, 1.8 * s, 1.8 * s);
      }
    }
  }

  // 4. Exterior Roof Layer (Fades out smoothly via roofAlpha when inspecting interior!)
  if (st.isComplete && roofAlpha > 0.03) {
    ctx.save();
    ctx.globalAlpha = roofAlpha;

    const overhang = 2.5 * s;
    const rx = x0 - overhang;
    const ry = y0 - overhang;
    const rw = pw + overhang * 2;
    const rd = pd - facadeH * 0.55 + overhang;

    // Choose roof color by Era / Category / Civ Color
    let roofDark = '#78552b';
    let roofMid = '#9e723b';
    let roofLight = '#bd8d4f';
    if (isStoneAge || isNeolithic) {
      // Golden layered reed thatch
      roofDark = '#7c5d2a';
      roofMid = '#a37c3b';
      roofLight = '#c49a52';
    } else if (isBronze) {
      // Terracotta / Sandstone flat or hipped roof
      roofDark = '#8c3d27';
      roofMid = '#b55338';
      roofLight = '#d46b4e';
    } else if (isIron) {
      // Warm timber & clay shingles
      roofDark = '#6e3222';
      roofMid = '#944530';
      roofLight = '#b55b43';
    } else if (isMedieval) {
      // Royal slate & civ-accented roof tiles
      roofDark = '#2d3748';
      roofMid = '#4a5568';
      roofLight = '#718096';
    } else if (isArcane) {
      // Gilded azure / marble dome
      roofDark = '#1e3a8a';
      roofMid = '#2563eb';
      roofLight = '#60a5fa';
    }

    // Colored outline around roof overhang
    ctx.fillStyle = wallOutline;
    ctx.fillRect(rx - 1.2 * s, ry - 1.2 * s, rw + 2.4 * s, rd + 2.4 * s);

    // Lower shaded slope (South side of roof)
    ctx.fillStyle = roofMid;
    ctx.fillRect(rx, ry, rw, rd);

    // Upper sunlit slope (North side of roof)
    ctx.fillStyle = roofLight;
    ctx.fillRect(rx, ry, rw, rd * 0.52);

    // Shingle / Thatch Texture Courses
    ctx.fillStyle = roofDark;
    const courseStep = Math.max(3, 4.5 * s);
    for (let cy = ry + courseStep; cy < ry + rd; cy += courseStep) {
      ctx.fillRect(rx + 2 * s, cy, rw - 4 * s, Math.max(1, 1.1 * s));
    }

    // Center Ridge Beam + Civ Banner Crest
    const ridgeY = ry + rd * 0.5 - 1.5 * s;
    ctx.fillStyle = wallOutline;
    ctx.fillRect(rx - 0.5 * s, ridgeY, rw + 1 * s, 3 * s);
    ctx.fillStyle = st.civColor || '#f59e0b';
    ctx.fillRect(rx + 2 * s, ridgeY + 0.6 * s, rw - 4 * s, 1.8 * s);

    // Brick Chimney with drifting smoke puffs (for Shelters, Forges, Kitchens)
    if (
      !isStoneAge &&
      (st.category === 'Shelter' || st.category === 'Industry' || st.category === 'Craft')
    ) {
      const chX = rx + rw - 9 * s;
      const chY = ry + 3 * s;
      ctx.fillStyle = '#3b2318';
      ctx.fillRect(chX - 1 * s, chY - 1 * s, 6.5 * s, 6.5 * s);
      ctx.fillStyle = '#993d2b';
      ctx.fillRect(chX, chY, 4.5 * s, 4.5 * s);
      ctx.fillStyle = '#261710';
      ctx.fillRect(chX + 1 * s, chY + 1 * s, 2.5 * s, 2.5 * s);

      // Gentle animated smoke puffs
      const smokePhase = (animTimeSec * 0.9 + st.id * 0.37) % 1;
      ctx.fillStyle = `rgba(226, 232, 240, ${(1 - smokePhase) * 0.55 * roofAlpha})`;
      ctx.beginPath();
      ctx.arc(
        chX + 2.2 * s + smokePhase * 5 * s,
        chY - smokePhase * 8 * s,
        (2.2 + smokePhase * 2.5) * s,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  }

  // 5. Real-Time Construction Scaffolding Overlay when building is under construction
  if (!st.isComplete) {
    const pct = Math.max(0.05, Math.min(1, st.progress / Math.max(1, st.totalBlocks)));
    // Partial wall build progress bar & timber lattice scaffolding
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.strokeRect(x0 + 1 * s, y0 + 1 * s, pw - 2 * s, pd - 2 * s);

    // Cross-bracing scaffold poles
    ctx.fillStyle = '#b45309';
    for (let sx = x0 + 2 * s; sx < x0 + pw - 2 * s; sx += 7 * s) {
      ctx.fillRect(sx, y0, 1.8 * s, pd * pct);
    }
    for (let sy = y0 + 2 * s; sy < y0 + pd * pct; sy += 7 * s) {
      ctx.fillRect(x0, sy, pw, 1.6 * s);
    }
  }
}

/**
 * Draws an expressive 16-24px Stardew/WorldBox Paper-Doll Citizen Sprite in 2D top-down view
 */
export function drawPaperDollAgent2D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pixelScale: number,
  facing: number,
  phase: number,
  action: AgentAnimAction,
  bodyScale: number,
  tunicR: number,
  tunicG: number,
  tunicB: number,
  eraIndex: number,
  headgearId: number,
  hasCapeOrShield: number,
  isSelected: boolean,
  isHovered: boolean
) {
  const s = pixelScale * Math.max(0.62, Math.min(1.25, bodyScale));
  const isMoving =
    action === AgentAnimAction.Walking || action === AgentAnimAction.Hauling;
  const isWorking =
    action === AgentAnimAction.Building ||
    action === AgentAnimAction.Chopping ||
    action === AgentAnimAction.Mining ||
    action === AgentAnimAction.Farming ||
    action === AgentAnimAction.Combat;
  const isSleeping = action === AgentAnimAction.Sleeping;

  const stride = isMoving ? Math.sin(phase * 1.4) * 2.2 * s : 0;
  const bob = isMoving ? Math.abs(Math.cos(phase * 1.4)) * 1.2 * s : 0;
  const swing = isWorking ? Math.sin(phase * 2.2) * 3.8 * s : 0;

  // Selection / Hover Ring under feet
  if (isSelected || isHovered) {
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#38bdf8';
    ctx.lineWidth = Math.max(1.5, 1.8 * s);
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * s, 6.8 * s, 3.8 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 1. Soft Oval Ground Shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1.2 * s, 4.8 * s, 2.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isSleeping) {
    // Sleeping horizontally with "Zzz"
    ctx.fillStyle = `rgb(${Math.round(tunicR * 255)},${Math.round(tunicG * 255)},${Math.round(
      tunicB * 255
    )})`;
    ctx.fillRect(x - 5 * s, y - 3 * s, 10 * s, 5 * s);
    ctx.fillStyle = '#f2bfa0';
    ctx.fillRect(x - 6 * s, y - 3.5 * s, 4.5 * s, 4.5 * s);
    return;
  }

  const cy = y - bob;
  const dirX = Math.sin(facing);

  // 2. Cape / Cloak behind torso
  if (hasCapeOrShield >= 1) {
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(x - 4.2 * s - dirX * 1.2 * s, cy - 8.5 * s, 8.4 * s, 7.5 * s);
  }

  // 3. Boots / Legs (Animated Walk Cycle)
  ctx.fillStyle = '#2b1d12';
  ctx.fillRect(x - 3.0 * s, cy - 3.2 * s + stride * 0.5, 2.4 * s, 3.6 * s);
  ctx.fillRect(x + 0.6 * s, cy - 3.2 * s - stride * 0.5, 2.4 * s, 3.6 * s);

  // 4. Colored Outline + Tunic / Armor Torso
  const tr = Math.round(tunicR * 255);
  const tg = Math.round(tunicG * 255);
  const tb = Math.round(tunicB * 255);
  ctx.fillStyle = '#231b18'; // Soft dark umber outline (never harsh black)
  ctx.fillRect(x - 4.4 * s, cy - 9.8 * s, 8.8 * s, 7.2 * s);

  ctx.fillStyle = `rgb(${tr},${tg},${tb})`;
  ctx.fillRect(x - 3.4 * s, cy - 9.0 * s, 6.8 * s, 5.6 * s);

  // Belt & Buckle
  ctx.fillStyle = '#3d2616';
  ctx.fillRect(x - 3.4 * s, cy - 4.6 * s, 6.8 * s, 1.3 * s);
  if (eraIndex >= 2) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - 1.0 * s, cy - 4.6 * s, 2.0 * s, 1.3 * s);
  }

  // 5. Head with Warm Skin Tone, Wrap-Around Hair & Expressive Pixel Face
  ctx.fillStyle = '#2d1e17';
  ctx.fillRect(x - 4.2 * s, cy - 16.4 * s, 8.4 * s, 7.4 * s);

  ctx.fillStyle = '#f3c3a2';
  ctx.fillRect(x - 3.2 * s, cy - 15.4 * s, 6.4 * s, 5.6 * s);

  // Dark / Styled Pixel Hair Cap & Sideburns
  const hairColors = ['#1e1b18', '#3b2416', '#5c381e', '#78350f', '#27272a'];
  ctx.fillStyle = hairColors[(Math.abs(Math.round(tunicR * 100 + tunicG * 50)) + eraIndex) % hairColors.length];
  ctx.fillRect(x - 3.6 * s, cy - 16.2 * s, 7.2 * s, 2.4 * s);
  ctx.fillRect(x - 3.6 * s, cy - 14.8 * s, 1.2 * s, 2.5 * s);
  ctx.fillRect(x + 2.4 * s, cy - 14.8 * s, 1.2 * s, 2.5 * s);

  // Crisp Pixel Eyes & Friendly Smile
  const eyeShift = Math.max(-1.0, Math.min(1.0, dirX * 1.1)) * s;
  ctx.fillStyle = '#18181b';
  ctx.fillRect(x - 2.0 * s + eyeShift, cy - 13.2 * s, 1.2 * s, 1.5 * s);
  ctx.fillRect(x + 0.8 * s + eyeShift, cy - 13.2 * s, 1.2 * s, 1.5 * s);

  // Mouth expression
  ctx.fillStyle = '#451a03';
  if (action === AgentAnimAction.Combat) {
    ctx.fillRect(x - 1.2 * s + eyeShift, cy - 10.9 * s, 2.4 * s, 1.2 * s);
  } else {
    ctx.fillRect(x - 1.0 * s + eyeShift, cy - 10.8 * s, 2.0 * s, 0.9 * s);
  }

  // 6. Flush-Fitting Era Headgear (StrawHat, Hood, Helmet, Crown, Scholar Cap)
  if (headgearId > 0) {
    if (headgearId === 1) {
      // Farmer Straw Hat
      ctx.fillStyle = '#eab308';
      ctx.fillRect(x - 5.2 * s, cy - 16.4 * s, 10.4 * s, 1.6 * s);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - 3.4 * s, cy - 18.0 * s, 6.8 * s, 1.8 * s);
    } else if (headgearId === 3) {
      // Bronze / Iron Soldier Helmet with Crest
      ctx.fillStyle = eraIndex <= 2 ? '#d97706' : '#94a3b8';
      ctx.fillRect(x - 3.8 * s, cy - 17.4 * s, 7.6 * s, 2.6 * s);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 1.2 * s, cy - 18.8 * s, 2.4 * s, 1.6 * s);
    } else if (headgearId === 5) {
      // Golden Royal Crown
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x - 3.6 * s, cy - 17.8 * s, 7.2 * s, 2.2 * s);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x - 0.8 * s, cy - 17.4 * s, 1.6 * s, 1.2 * s);
    } else {
      // Hood / Scholar Cap
      ctx.fillStyle = '#334155';
      ctx.fillRect(x - 3.8 * s, cy - 17.2 * s, 7.6 * s, 2.2 * s);
    }
  }

  // 7. Held Tool / Weapon or Carried Resource Bundle
  if (action === AgentAnimAction.Hauling) {
    // Carrying resource crate/logs in front
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x - 2.6 * s + dirX * 2 * s, cy - 8.8 * s, 5.2 * s, 4.2 * s);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(x - 2.0 * s + dirX * 2 * s, cy - 8.2 * s, 4.0 * s, 3.0 * s);
  } else if (isWorking || eraIndex >= 0) {
    // Tool shaft + metallic/stone head on right hand
    const tx = x + 4.2 * s;
    const ty = cy - 7.5 * s + swing;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(tx - 0.8 * s, ty - 4.5 * s, 1.6 * s, 6.5 * s);
    ctx.fillStyle =
      eraIndex === 0
        ? '#a8a29e'
        : eraIndex <= 2
        ? '#f59e0b'
        : eraIndex <= 4
        ? '#cbd5e1'
        : '#38bdf8';
    ctx.fillRect(tx - 2.2 * s, ty - 5.5 * s, 4.2 * s, 2.4 * s);
  }
}

/**
 * Draws a 2D Top-Down Animal Sprite (Land Herds, Predators, Birds, Fish & Whales)
 */
export function drawAnimal2D(
  ctx: CanvasRenderingContext2D,
  a: AnimalMarker3D,
  x: number,
  y: number,
  pixelScale: number,
  animTimeSec: number,
  isSelected: boolean
) {
  const s = pixelScale * Math.max(0.65, Math.min(1.4, a.scale || 1.0));
  const isBird = a.domain === 'Bird';
  const isWater = a.domain === 'Water';
  const dirX = Math.sin(a.facing) >= 0 ? 1 : -1;
  const hop =
    a.state === 'Roaming' || a.state === 'Fleeing' || a.state === 'Hunting'
      ? Math.abs(Math.sin(animTimeSec * 7 + a.id)) * 1.5 * s
      : 0;

  if (isSelected) {
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * s, 6.5 * s, 3.8 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isWater) {
    if (a.species === 'Whale') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, 10 * s, 4.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(x, y - 1 * s, 8.5 * s, 3.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Water spout
      if (Math.sin(animTimeSec * 2 + a.id) > 0.6) {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(x - 1 * s, y - 6 * s, 2 * s, 4 * s);
      }
    } else {
      // Shimmering fish school or crab
      ctx.fillStyle = a.species === 'Crab' ? '#ef4444' : '#38bdf8';
      ctx.fillRect(x - 3 * s, y - 1.5 * s, 3.5 * s, 2 * s);
      ctx.fillRect(x + 1 * s, y + 0.5 * s, 3.5 * s, 2 * s);
    }
    return;
  }

  if (isBird) {
    // Ground shadow far below + soaring winged bird
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8 * s, 3.5 * s, 1.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const wingY = Math.sin(animTimeSec * 11 + a.id) * 2.5 * s;
    ctx.strokeStyle = a.colorHex || '#f8fafc';
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.moveTo(x - 4.5 * s, y - 6 * s + wingY);
    ctx.lineTo(x, y - 5 * s);
    ctx.lineTo(x + 4.5 * s, y - 6 * s + wingY);
    ctx.stroke();
    return;
  }

  // Land Quadruped (Deer, Horse, Wolf, Bear, Bison, Sheep, Rabbit, Boar)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1.5 * s, 5.2 * s, 2.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  const cy = y - hop;
  // Colored outline
  ctx.fillStyle = '#261c14';
  ctx.fillRect(x - 4.8 * s, cy - 6.2 * s, 9.6 * s, 5.6 * s);

  // Body coat
  ctx.fillStyle = a.colorHex || '#9a6b3e';
  ctx.fillRect(x - 4.0 * s, cy - 5.4 * s, 8.0 * s, 4.2 * s);

  // Legs
  ctx.fillStyle = '#3d2817';
  ctx.fillRect(x - 3.6 * s, cy - 1.5 * s, 1.6 * s, 2.5 * s);
  ctx.fillRect(x + 2.0 * s, cy - 1.5 * s, 1.6 * s, 2.5 * s);

  // Head & Ears / Antlers
  const hx = x + dirX * 3.8 * s;
  ctx.fillStyle = '#261c14';
  ctx.fillRect(hx - 2.4 * s, cy - 8.2 * s, 4.8 * s, 4.2 * s);
  ctx.fillStyle = a.colorHex || '#9a6b3e';
  ctx.fillRect(hx - 1.8 * s, cy - 7.6 * s, 3.6 * s, 3.2 * s);

  if (a.species === 'Deer') {
    ctx.fillStyle = '#d6c7b2';
    ctx.fillRect(hx - 1.5 * s, cy - 10.2 * s, 1.2 * s, 2.4 * s);
    ctx.fillRect(hx + 0.5 * s, cy - 10.2 * s, 1.2 * s, 2.4 * s);
  }
}

/**
 * Draws a 2D Top-Down Naval Vessel or Land Cart with Wake Ripples, Billowing Sails & Crew
 */
export function drawVehicle2D(
  ctx: CanvasRenderingContext2D,
  v: VehicleMarker3D,
  x: number,
  y: number,
  pixelScale: number,
  animTimeSec: number
) {
  const s = pixelScale;
  const isWater =
    v.type === 'LogRaft' ||
    v.type === 'DugoutCanoe' ||
    v.type === 'Sailboat' ||
    v.type === 'Longship' ||
    v.type === 'Galley' ||
    v.type === 'CaravelShip' ||
    v.type === 'Steamship';

  const isLargeShip =
    v.type === 'Longship' ||
    v.type === 'Galley' ||
    v.type === 'CaravelShip' ||
    v.type === 'Steamship';

  const hullLen = (isLargeShip ? 13 : isWater ? 9.5 : 8) * s;
  const hullWid = (isLargeShip ? 6.5 : 4.8) * s;

  ctx.save();
  ctx.translate(x, y);

  if (isWater) {
    // V-Shaped Foam Wake Behind Vessel
    const wakePulse = Math.sin(animTimeSec * 5 + v.id) * 1.2 * s;
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
    ctx.lineWidth = Math.max(1, 1.5 * s);
    ctx.beginPath();
    ctx.moveTo(-hullLen * 0.45, -hullWid * 0.35);
    ctx.lineTo(-hullLen * 0.95 - wakePulse, -hullWid * 0.85);
    ctx.moveTo(-hullLen * 0.45, hullWid * 0.35);
    ctx.lineTo(-hullLen * 0.95 - wakePulse, hullWid * 0.85);
    ctx.stroke();
  }

  // Shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 2 * s, hullLen * 0.55, hullWid * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hull Outline & Deck Planks
  ctx.fillStyle = '#2d1b0e';
  ctx.beginPath();
  ctx.ellipse(0, 0, hullLen * 0.55, hullWid * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = v.type === 'Steamship' ? '#475569' : '#7c4d28';
  ctx.beginPath();
  ctx.ellipse(0, -0.5 * s, hullLen * 0.48, hullWid * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#a36a3e';
  ctx.fillRect(-hullLen * 0.3, -hullWid * 0.25, hullLen * 0.6, hullWid * 0.5);

  // Visible Captain / Crew Head on Deck
  ctx.fillStyle = v.colorHex || '#f59e0b';
  ctx.fillRect(-2 * s, -2 * s, 4 * s, 4 * s);
  ctx.fillStyle = '#f3c3a2';
  ctx.fillRect(-1.5 * s, -4.5 * s, 3 * s, 3 * s);

  // Billowing Sail with Civilization Emblem or Steam Smokestack
  if (isWater && v.type !== 'LogRaft' && v.type !== 'DugoutCanoe') {
    if (v.type === 'Steamship') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, -6 * s, 3.5 * s, 6 * s);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, -5 * s, 3.5 * s, 1.5 * s);
    } else {
      // Mast + Billowing Canvas Sail
      ctx.fillStyle = '#3b2313';
      ctx.fillRect(-1 * s, -11 * s, 2 * s, 11 * s);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-5.5 * s, -10.5 * s, 11 * s, 6.5 * s);
      // Civ color stripe on sail
      ctx.fillStyle = v.colorHex || '#f59e0b';
      ctx.fillRect(-5.5 * s, -8.2 * s, 11 * s, 2.2 * s);
    }
  } else if (!isWater) {
    // Land Cart Wheels
    ctx.fillStyle = '#29180c';
    ctx.fillRect(-hullLen * 0.35, -hullWid * 0.58, 3 * s, 1.5 * s);
    ctx.fillRect(hullLen * 0.15, -hullWid * 0.58, 3 * s, 1.5 * s);
    ctx.fillRect(-hullLen * 0.35, hullWid * 0.45, 3 * s, 1.5 * s);
    ctx.fillRect(hullLen * 0.15, hullWid * 0.45, 3 * s, 1.5 * s);
  }

  ctx.restore();
}

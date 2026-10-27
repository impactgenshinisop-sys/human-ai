/**
 * High-Performance 2D Top-Down Pixel-Art World Renderer ("WorldBox meets Stardew Valley")
 * - Offscreen 16x16 chunk tile caching (256x256px per chunk) with instant deterministic fallback
 *   so there is NEVER an empty void or unloaded circle when panning or zooming out
 * - Autotiled beaches, riverbanks, terraced mountain cliffs, and road networks
 * - Y-sorted 2D entities: swaying biome trees, wildflower/berry/ore props, modular buildings
 *   with smooth interior roof cutaway, 16-24px paper-doll citizens, wildlife herds, and ships
 * - Continuous frame-driven 2D day/night lighting, sunset tint, night window glow, weather
 *   particles (rain, snow, sandstorm, drifting clouds), and interactive terraforming brushes
 */

import {
  Chunk2DSurfaceData,
  extractChunk2DSurface,
  Prop2DType,
  sampleColumn,
} from '../sim/terrain';
import {
  AgentAnimAction,
  AnimalMarker3D,
  CHUNK_SIZE,
  CitySummary,
  CivilizationSummary,
  FallingVoxelParticle,
  MapOverlayMode,
  QualityPreset,
  RendererPerfStats,
  SeasonType,
  StructureMarker3D,
  VoxelType,
  WATER_LEVEL,
  WeatherType,
} from '../sim/types';
import {
  drawAnimal2D,
  drawPaperDollAgent2D,
  drawProp2D,
  drawStructure2D,
  drawVehicle2D,
  getTilePalette,
} from './PixelArtAtlas';

export type CameraMode = 'orbit' | 'freefly' | 'follow' | 'cinematic';

export interface HoveredWorldPoint {
  wx: number;
  wy: number;
  wz: number;
  agentId: number | null;
  structureId?: number | null;
}

export interface PhotoModeSettings {
  active: boolean;
  fov: number;
  timeOverride: number | null;
  weatherOverride: WeatherType | null;
  filter: 'none' | 'warm' | 'vintage' | 'noir' | 'vibrant';
  tiltShift: boolean;
}

const BASE_TILE_PX = 16;
const CHUNK_CANVAS_PX = CHUNK_SIZE * BASE_TILE_PX; // 256x256 px per cached chunk

interface CachedChunkLayer {
  cx: number;
  cz: number;
  revision: number;
  season: SeasonType;
  surface: Chunk2DSurfaceData;
  canvas: HTMLCanvasElement;
}

interface BurstEffect2D {
  wx: number;
  wz: number;
  colorHex: string;
  age: number;
  maxAge: number;
}

interface FloatingParticle2D {
  wx: number;
  wz: number;
  vx: number;
  vz: number;
  colorHex: string;
  age: number;
  maxAge: number;
}

export class PixelWorldRenderer2D {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;

  private isDisposed = false;
  private frameId = 0;
  private currentSeedNum = 1337;
  private expectedRenderDistance = 8;

  // 2D Top-Down Camera State (World coordinates wx, wz and zoom scale)
  public cameraWx = 0;
  public cameraWz = 0;
  private targetCameraWx = 0;
  private targetCameraWz = 0;
  public zoom = 1.65; // 1.0 = 16px per world tile; range [0.22 .. 4.5]
  private targetZoom = 1.65;
  private camVelX = 0;
  private camVelZ = 0;

  private isDragging = false;
  private dragStartScreenX = 0;
  private dragStartScreenY = 0;
  private dragStartCamWx = 0;
  private dragStartCamWz = 0;
  private pointerDownDistMoved = 0;
  private isPaintingBrush = false;

  // Cached 2D Chunk Layers
  private chunkCache = new Map<string, CachedChunkLayer>();
  private rawChunkData = new Map<
    string,
    { cx: number; cz: number; revision: number; voxels: Uint8Array }
  >();

  // Entities & Simulation State
  private latestAgentBuffer: Float32Array | null = null;
  private agentRenderState = new Map<
    number,
    { x: number; y: number; z: number; facing: number; phase: number }
  >();
  private cachedStructures: StructureMarker3D[] = [];
  private cachedVehicles: any[] = [];
  private cachedAnimals: AnimalMarker3D[] = [];
  private cachedCities: CitySummary[] = [];
  private cachedCivs: CivilizationSummary[] = [];

  private targetTimeOfDay = 11.0;
  private smoothTimeOfDay = 11.0;
  private season: SeasonType = 'Spring';
  private weather: WeatherType = 'Clear';
  private simSpeedMultiplier = 1;
  private isSimPaused = false;
  private dynamicCycleEnabled = true;

  // Overlays, Cutaway & Brushes
  public overlayMode: MapOverlayMode = 'none';
  public forceInteriorCutaway = false;
  private activeGodPowerColor: string | null = null;
  private activeBrushRadius = 0;
  private chunkDebugVisible = false;
  private navDebugVisible = false;

  // FX & Weather
  private bursts: BurstEffect2D[] = [];
  private particles: FloatingParticle2D[] = [];
  private weatherDrops: { x: number; y: number; speed: number; len: number }[] = [];
  private lightningFlash = 0;

  // Camera Modes & Photo Mode
  public cameraMode: CameraMode = 'orbit';
  public followedAgentId: number | null = null;
  private cinematicTimer = 0;
  private cinematicTargetIdx = 0;

  public photoSettings: PhotoModeSettings = {
    active: false,
    fov: 45,
    timeOverride: null,
    weatherOverride: null,
    filter: 'none',
    tiltShift: false,
  };

  private qualityPreset: QualityPreset = 'High';
  private lastFrameTimestamp = performance.now();
  private smoothedFps = 60;
  private smoothedFrameMs = 16.6;
  private lastRenderMs = 1.5;
  private keysPressed = new Set<string>();
  private lastCameraNotifyTime = 0;
  private lastChunkWatchdogTime = 0;
  public hoveredWorldPoint: HoveredWorldPoint | null = null;
  public selectedAgentId: number | null = null;
  public selectedStructureId: number | null = null;

  private onSelectAgent: (agentId: number | null) => void;
  private onSelectAnimal?: (animalId: number) => void;
  private onSelectStructure?: (structureId: number) => void;
  private onCastGodPowerAt: (wx: number, wz: number) => void;
  private onApplyTerraformBrush?: (wx: number, wz: number) => void;
  private onCameraChunkCenterChanged: (
    wx: number,
    wz: number,
    zoomChunkRadius?: number
  ) => void;
  private onRequestMissingChunks?: (coords: { cx: number; cz: number }[]) => void;

  constructor(
    container: HTMLElement,
    callbacks: {
      onSelectAgent: (agentId: number | null) => void;
      onSelectAnimal?: (animalId: number) => void;
      onSelectStructure?: (structureId: number) => void;
      onCastGodPowerAt: (wx: number, wz: number) => void;
      onApplyTerraformBrush?: (wx: number, wz: number) => void;
      onCameraChunkCenterChanged: (
        wx: number,
        wz: number,
        zoomChunkRadius?: number
      ) => void;
      onRequestMissingChunks?: (coords: { cx: number; cz: number }[]) => void;
    }
  ) {
    this.container = container;
    this.onSelectAgent = callbacks.onSelectAgent;
    this.onSelectAnimal = callbacks.onSelectAnimal;
    this.onSelectStructure = callbacks.onSelectStructure;
    this.onCastGodPowerAt = callbacks.onCastGodPowerAt;
    this.onApplyTerraformBrush = callbacks.onApplyTerraformBrush;
    this.onCameraChunkCenterChanged = callbacks.onCameraChunkCenterChanged;
    this.onRequestMissingChunks = callbacks.onRequestMissingChunks;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'block h-full w-full cursor-grab active:cursor-grabbing select-none';
    this.canvas.style.imageRendering = 'pixelated';
    container.innerHTML = '';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to initialize 2D canvas context');
    this.ctx = ctx;

    // Offscreen lighting canvas for smooth day/night multiply + warm additive window/fire glow
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;

    for (let i = 0; i < 180; i++) {
      this.weatherDrops.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.4 + Math.random() * 0.4,
        len: 8 + Math.random() * 10,
      });
    }

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.tick();
  }

  private handleResize = () => {
    if (this.isDisposed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.lightCanvas.width = Math.max(1, Math.round(w * 0.5));
    this.lightCanvas.height = Math.max(1, Math.round(h * 0.5));
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (
      document.activeElement &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
    ) {
      return;
    }
    this.keysPressed.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keysPressed.delete(e.code);
  };

  private screenToWorld(clientX: number, clientY: number): { wx: number; wz: number } {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cx = rect.width * 0.5;
    const cy = rect.height * 0.5;
    const tilePx = BASE_TILE_PX * this.zoom;
    return {
      wx: this.cameraWx + (sx - cx) / tilePx,
      wz: this.cameraWz + (sy - cy) / tilePx,
    };
  }

  public projectWorldToScreen(
    wx: number,
    wy: number,
    wz: number,
    _checkOcclusion = false
  ): {
    x: number;
    y: number;
    visible: boolean;
    distance: number;
    centerDistNdc: number;
  } {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    const tilePx = BASE_TILE_PX * this.zoom;
    const sx = w * 0.5 + (wx - this.cameraWx) * tilePx;
    const sy = h * 0.5 + (wz - this.cameraWz) * tilePx - Math.max(0, wy - WATER_LEVEL) * 0.35 * this.zoom;
    const ndcX = (sx / w) * 2 - 1;
    const ndcY = (sy / h) * 2 - 1;
    const centerDistNdc = Math.hypot(ndcX, ndcY);
    const visible = sx >= -40 && sx <= w + 40 && sy >= -40 && sy <= h + 40;
    const distance = 60 / Math.max(0.2, this.zoom);
    return { x: sx, y: sy, visible, distance, centerDistNdc };
  }

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const before = this.screenToWorld(e.clientX, e.clientY);
    const zoomFactor = e.deltaY < 0 ? 1.16 : 1 / 1.16;
    this.targetZoom = Math.max(0.24, Math.min(4.8, this.targetZoom * zoomFactor));
    this.zoom = this.zoom + (this.targetZoom - this.zoom) * 0.45;
    const after = this.screenToWorld(e.clientX, e.clientY);
    this.cameraWx += before.wx - after.wx;
    this.cameraWz += before.wz - after.wz;
    this.targetCameraWx = this.cameraWx;
    this.targetCameraWz = this.cameraWz;
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
    const worldPt = this.screenToWorld(e.clientX, e.clientY);

    // If a terraforming brush or God Power is active on left click:
    if (e.button === 0 && this.activeGodPowerColor) {
      if (this.activeBrushRadius > 0 && this.onApplyTerraformBrush) {
        this.isPaintingBrush = true;
        this.spawnDivineBurst(worldPt.wx, WATER_LEVEL + 2, worldPt.wz, this.activeGodPowerColor);
        this.onApplyTerraformBrush(worldPt.wx, worldPt.wz);
        return;
      } else {
        this.spawnDivineBurst(worldPt.wx, WATER_LEVEL + 2, worldPt.wz, this.activeGodPowerColor);
        this.onCastGodPowerAt(worldPt.wx, worldPt.wz);
        return;
      }
    }

    this.isDragging = true;
    this.pointerDownDistMoved = 0;
    this.dragStartScreenX = e.clientX;
    this.dragStartScreenY = e.clientY;
    this.dragStartCamWx = this.cameraWx;
    this.dragStartCamWz = this.cameraWz;
    if (this.cameraMode === 'cinematic') {
      this.cameraMode = 'orbit';
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    const worldPt = this.screenToWorld(e.clientX, e.clientY);

    if (this.isPaintingBrush && this.onApplyTerraformBrush && this.activeGodPowerColor) {
      this.onApplyTerraformBrush(worldPt.wx, worldPt.wz);
    } else if (this.isDragging) {
      const dx = e.clientX - this.dragStartScreenX;
      const dy = e.clientY - this.dragStartScreenY;
      this.pointerDownDistMoved = Math.hypot(dx, dy);
      const tilePx = BASE_TILE_PX * this.zoom;
      this.cameraWx = this.dragStartCamWx - dx / tilePx;
      this.cameraWz = this.dragStartCamWz - dy / tilePx;
      this.targetCameraWx = this.cameraWx;
      this.targetCameraWz = this.cameraWz;
      if (this.pointerDownDistMoved > 6 && this.cameraMode === 'follow') {
        this.followedAgentId = null;
        this.cameraMode = 'orbit';
      }
    }

    // Hit-test closest agent or building under cursor
    let bestAgentId: number | null = null;
    let bestDist = 1.35;
    this.agentRenderState.forEach((st, id) => {
      const d = Math.hypot(st.x - worldPt.wx, st.z - worldPt.wz);
      if (d < bestDist) {
        bestDist = d;
        bestAgentId = id;
      }
    });

    let hoveredStructId: number | null = null;
    for (const st of this.cachedStructures) {
      const hw = (st.width || 6) * 0.5;
      const hd = (st.depth || 6) * 0.5;
      if (
        Math.abs(worldPt.wx - st.x) <= hw &&
        Math.abs(worldPt.wz - st.z) <= hd
      ) {
        hoveredStructId = st.id;
        break;
      }
    }

    const col = sampleColumn(Math.round(worldPt.wx), Math.round(worldPt.wz), this.currentSeedNum);
    this.hoveredWorldPoint = {
      wx: worldPt.wx,
      wy: col.height,
      wz: worldPt.wz,
      agentId: bestAgentId,
      structureId: hoveredStructId,
    };
  };

  private handlePointerUp = (e: PointerEvent) => {
    if (this.isPaintingBrush) {
      this.isPaintingBrush = false;
      return;
    }
    if (!this.isDragging) return;
    this.isDragging = false;

    // If click without drag: select agent, animal, or building
    if (this.pointerDownDistMoved < 6 && e.button === 0 && !this.activeGodPowerColor) {
      const worldPt = this.screenToWorld(e.clientX, e.clientY);

      // 1. Check Agent
      let hitAgentId: number | null = null;
      let bestAgentDist = 1.45;
      this.agentRenderState.forEach((st, id) => {
        const d = Math.hypot(st.x - worldPt.wx, st.z - worldPt.wz);
        if (d < bestAgentDist) {
          bestAgentDist = d;
          hitAgentId = id;
        }
      });
      if (hitAgentId !== null) {
        this.selectedAgentId = hitAgentId;
        this.onSelectAgent(hitAgentId);
        return;
      }

      // 2. Check Animal
      if (this.onSelectAnimal) {
        for (const an of this.cachedAnimals) {
          if (Math.hypot(an.x - worldPt.wx, an.z - worldPt.wz) < 1.5) {
            this.onSelectAnimal(an.id);
            return;
          }
        }
      }

      // 3. Check Building
      if (this.onSelectStructure) {
        for (const st of this.cachedStructures) {
          const hw = (st.width || 6) * 0.5;
          const hd = (st.depth || 6) * 0.5;
          if (
            Math.abs(worldPt.wx - st.x) <= hw &&
            Math.abs(worldPt.wz - st.z) <= hd
          ) {
            this.selectedStructureId = st.id;
            this.onSelectStructure(st.id);
            return;
          }
        }
      }

      this.selectedAgentId = null;
      this.selectedStructureId = null;
      this.onSelectAgent(null);
    }
  };

  /**
   * Renders a 16x16 chunk's ground tiles, dithering, shorelines, cliff steps, and roads
   * into an offscreen 256x256 canvas for ultra-fast O(1) frame blitting.
   */
  private buildChunkLayerCanvas(
    cx: number,
    cz: number,
    revision: number,
    voxels?: Uint8Array
  ): CachedChunkLayer {
    const surface = extractChunk2DSurface(cx, cz, this.currentSeedNum, revision, voxels);
    const offCanvas = document.createElement('canvas');
    offCanvas.width = CHUNK_CANVAS_PX;
    offCanvas.height = CHUNK_CANVAS_PX;
    const cctx = offCanvas.getContext('2d', { alpha: false })!;

    const baseWx = cx * CHUNK_SIZE;
    const baseWz = cz * CHUNK_SIZE;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = lz * CHUNK_SIZE + lx;
        const px = lx * BASE_TILE_PX;
        const py = lz * BASE_TILE_PX;
        const v = surface.groundVoxels[idx] as VoxelType;
        const wDepth = surface.waterDepths[idx];
        const elev = surface.elevations[idx];
        const varHash = surface.propVariants[idx];

        if (wDepth > 0 && v === VoxelType.Water) {
          // Multi-depth stylized WorldBox/Stardew ocean & river water
          const isShallow = wDepth <= 2;
          const isMid = wDepth <= 5;
          const baseWater = isShallow
            ? '#38bdf8'
            : isMid
            ? '#0284c7'
            : '#0369a1';
          const ditherWater = isShallow
            ? '#7dd3fc'
            : isMid
            ? '#0ea5e9'
            : '#075985';

          cctx.fillStyle = baseWater;
          cctx.fillRect(px, py, BASE_TILE_PX, BASE_TILE_PX);

          if ((varHash & 3) === 0) {
            cctx.fillStyle = ditherWater;
            cctx.fillRect(px + (varHash & 7), py + ((varHash >> 3) & 7), 4, 2);
          }

          // Autotile shoreline foam when adjacent to dry land
          const nLand =
            lz > 0
              ? surface.waterDepths[(lz - 1) * CHUNK_SIZE + lx] === 0
              : sampleColumn(baseWx + lx, baseWz + lz - 1, this.currentSeedNum).height >= WATER_LEVEL;
          const sLand =
            lz < CHUNK_SIZE - 1
              ? surface.waterDepths[(lz + 1) * CHUNK_SIZE + lx] === 0
              : sampleColumn(baseWx + lx, baseWz + lz + 1, this.currentSeedNum).height >= WATER_LEVEL;
          const wLand =
            lx > 0
              ? surface.waterDepths[lz * CHUNK_SIZE + (lx - 1)] === 0
              : sampleColumn(baseWx + lx - 1, baseWz + lz, this.currentSeedNum).height >= WATER_LEVEL;
          const eLand =
            lx < CHUNK_SIZE - 1
              ? surface.waterDepths[lz * CHUNK_SIZE + (lx + 1)] === 0
              : sampleColumn(baseWx + lx + 1, baseWz + lz, this.currentSeedNum).height >= WATER_LEVEL;

          cctx.fillStyle = '#e0f2fe';
          if (nLand) cctx.fillRect(px, py, BASE_TILE_PX, 2.5);
          if (sLand) cctx.fillRect(px, py + BASE_TILE_PX - 2.5, BASE_TILE_PX, 2.5);
          if (wLand) cctx.fillRect(px, py, 2.5, BASE_TILE_PX);
          if (eLand) cctx.fillRect(px + BASE_TILE_PX - 2.5, py, 2.5, BASE_TILE_PX);
          continue;
        }

        const pal = getTilePalette(v, this.season);
        cctx.fillStyle = pal.base;
        cctx.fillRect(px, py, BASE_TILE_PX, BASE_TILE_PX);

        // Subtle pixel dithering & grass/pebble texture without harsh noise
        cctx.fillStyle = pal.ditherA;
        const dx1 = (varHash & 3) * 3 + 1;
        const dy1 = ((varHash >> 2) & 3) * 3 + 1;
        cctx.fillRect(px + dx1, py + dy1, 2, 2);

        cctx.fillStyle = pal.ditherB;
        const dx2 = ((varHash >> 4) & 3) * 3 + 2;
        const dy2 = ((varHash >> 6) & 3) * 3 + 2;
        cctx.fillRect(px + dx2, py + dy2, 2, 2);

        // Road & Bridge Curbing / Plank Detail
        if (v === VoxelType.RoadPaved || v === VoxelType.Cobblestone) {
          cctx.fillStyle = pal.edge;
          cctx.fillRect(px + 7, py, 1, BASE_TILE_PX);
          cctx.fillRect(px, py + 7, BASE_TILE_PX, 1);
        } else if (v === VoxelType.BridgeWood || v === VoxelType.Plank) {
          cctx.fillStyle = pal.edge;
          cctx.fillRect(px, py, BASE_TILE_PX, 2);
          cctx.fillRect(px, py + BASE_TILE_PX - 2, BASE_TILE_PX, 2);
          for (let rx = 3; rx < BASE_TILE_PX; rx += 4) {
            cctx.fillRect(px + rx, py + 2, 1, BASE_TILE_PX - 4);
          }
        }

        // Terraced Elevation Contour & Cliff Face Shading when higher than South/East neighbor
        const sElev =
          lz < CHUNK_SIZE - 1
            ? surface.elevations[(lz + 1) * CHUNK_SIZE + lx]
            : sampleColumn(baseWx + lx, baseWz + lz + 1, this.currentSeedNum).height;
        const nElev =
          lz > 0
            ? surface.elevations[(lz - 1) * CHUNK_SIZE + lx]
            : sampleColumn(baseWx + lx, baseWz + lz - 1, this.currentSeedNum).height;
        const eElev =
          lx < CHUNK_SIZE - 1
            ? surface.elevations[lz * CHUNK_SIZE + (lx + 1)]
            : sampleColumn(baseWx + lx + 1, baseWz + lz, this.currentSeedNum).height;

        if (elev > sElev) {
          const cliffH = Math.min(6, (elev - sElev) * 2.2);
          cctx.fillStyle = pal.cliffFace;
          cctx.fillRect(px, py + BASE_TILE_PX - cliffH, BASE_TILE_PX, cliffH);
          cctx.fillStyle = pal.cliffShadow;
          cctx.fillRect(px, py + BASE_TILE_PX - 1.5, BASE_TILE_PX, 1.5);
        }
        if (elev > nElev) {
          // Sunlit top ledge highlight
          cctx.fillStyle = pal.ditherA;
          cctx.fillRect(px, py, BASE_TILE_PX, 1.8);
        }
        if (elev > eElev) {
          cctx.fillStyle = pal.edge;
          cctx.fillRect(px + BASE_TILE_PX - 2, py, 2, BASE_TILE_PX);
        }
      }
    }

    return {
      cx,
      cz,
      revision,
      season: this.season,
      surface,
      canvas: offCanvas,
    };
  }

  private getOrBuildChunkLayer(cx: number, cz: number): CachedChunkLayer {
    const key = `${cx},${cz}`;
    const raw = this.rawChunkData.get(key);
    const targetRev = raw ? raw.revision : 0;
    const cached = this.chunkCache.get(key);

    if (
      cached &&
      cached.revision === targetRev &&
      cached.season === this.season
    ) {
      return cached;
    }

    const built = this.buildChunkLayerCanvas(cx, cz, targetRev, raw?.voxels);
    this.chunkCache.set(key, built);
    return built;
  }

  private updateCamera(dtMs: number) {
    const dtSec = Math.min(0.1, dtMs * 0.001);
    const panSpeed = (28 / Math.max(0.35, this.zoom)) * dtSec;
    let moved = false;

    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) {
      this.targetCameraWz -= panSpeed;
      moved = true;
    }
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) {
      this.targetCameraWz += panSpeed;
      moved = true;
    }
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) {
      this.targetCameraWx -= panSpeed;
      moved = true;
    }
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) {
      this.targetCameraWx += panSpeed;
      moved = true;
    }
    if (this.keysPressed.has('KeyE') || this.keysPressed.has('Equal')) {
      this.targetZoom = Math.min(4.8, this.targetZoom * (1 + dtSec * 1.4));
    }
    if (this.keysPressed.has('KeyQ') || this.keysPressed.has('Minus')) {
      this.targetZoom = Math.max(0.24, this.targetZoom * (1 - dtSec * 1.4));
    }

    if (moved && (this.cameraMode === 'follow' || this.cameraMode === 'cinematic')) {
      this.followedAgentId = null;
      this.cameraMode = 'orbit';
    }

    if (this.cameraMode === 'follow' && this.followedAgentId !== null) {
      const ag = this.agentRenderState.get(this.followedAgentId);
      if (ag) {
        this.targetCameraWx = ag.x;
        this.targetCameraWz = ag.z;
      }
    } else if (this.cameraMode === 'cinematic') {
      this.cinematicTimer += dtMs;
      if (this.cinematicTimer > 9000 && this.cachedCities.length > 0) {
        this.cinematicTimer = 0;
        this.cinematicTargetIdx = (this.cinematicTargetIdx + 1) % this.cachedCities.length;
        const c = this.cachedCities[this.cinematicTargetIdx];
        if (c) {
          this.targetCameraWx = c.x;
          this.targetCameraWz = c.z;
        }
      }
      this.targetCameraWx += Math.cos(performance.now() * 0.0002) * 0.04;
      this.targetCameraWz += Math.sin(performance.now() * 0.0002) * 0.04;
    }

    const lerpFactor = Math.min(1, dtMs * 0.016);
    const prevWx = this.cameraWx;
    const prevWz = this.cameraWz;
    this.cameraWx += (this.targetCameraWx - this.cameraWx) * lerpFactor;
    this.cameraWz += (this.targetCameraWz - this.cameraWz) * lerpFactor;
    this.zoom += (this.targetZoom - this.zoom) * lerpFactor;

    this.camVelX = (this.cameraWx - prevWx) / Math.max(0.005, dtSec);
    this.camVelZ = (this.cameraWz - prevWz) / Math.max(0.005, dtSec);

    const now = performance.now();
    if (now - this.lastCameraNotifyTime > 120) {
      this.lastCameraNotifyTime = now;
      this.onCameraChunkCenterChanged(
        this.cameraWx,
        this.cameraWz,
        this.getZoomExpandedChunkRadius()
      );
    }

    // Request any missing simulation chunks in view from worker
    if (now - this.lastChunkWatchdogTime > 240 && this.onRequestMissingChunks) {
      this.lastChunkWatchdogTime = now;
      const centerCx = Math.floor(this.cameraWx / CHUNK_SIZE);
      const centerCz = Math.floor(this.cameraWz / CHUNK_SIZE);
      const r = Math.min(10, this.getZoomExpandedChunkRadius());
      const missing: { cx: number; cz: number }[] = [];
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const cx = centerCx + dx;
          const cz = centerCz + dz;
          const key = `${cx},${cz}`;
          if (!this.rawChunkData.has(key)) {
            missing.push({ cx, cz });
          }
        }
      }
      if (missing.length > 0) {
        this.onRequestMissingChunks(missing.slice(0, 36));
      }
    }
  }

  private interpolateAgents(dtMs: number) {
    const buf = this.latestAgentBuffer;
    if (!buf) return;
    const stride = 16;
    const count = Math.floor(buf.length / stride);
    const lerpT = Math.min(1, dtMs * 0.02);

    for (let i = 0; i < count; i++) {
      const off = i * stride;
      const id = buf[off + 0];
      const tx = buf[off + 1];
      const ty = buf[off + 2];
      const tz = buf[off + 3];
      const tfacing = buf[off + 4];
      const rawPhase = buf[off + 8];

      let rs = this.agentRenderState.get(id);
      if (!rs || Math.hypot(tx - rs.x, tz - rs.z) > 14) {
        rs = { x: tx, y: ty, z: tz, facing: tfacing, phase: rawPhase };
        this.agentRenderState.set(id, rs);
      } else {
        rs.x += (tx - rs.x) * lerpT;
        rs.y += (ty - rs.y) * lerpT;
        rs.z += (tz - rs.z) * lerpT;
        rs.facing = tfacing;
        rs.phase += dtMs * 0.009;
      }
    }
  }

  private renderScene(dtMs: number) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = w / Math.max(1, this.container.clientWidth || window.innerWidth);
    const tilePx = BASE_TILE_PX * this.zoom * dpr;
    const chunkPx = CHUNK_SIZE * tilePx;
    const centerScreenX = w * 0.5;
    const centerScreenY = h * 0.5;
    const nowSec = performance.now() * 0.001;

    ctx.imageSmoothingEnabled = false;

    // Smooth Time of Day & Solar Shadow Offset
    const effectiveTime =
      this.photoSettings.active && this.photoSettings.timeOverride !== null
        ? this.photoSettings.timeOverride
        : this.dynamicCycleEnabled
        ? this.smoothTimeOfDay
        : 11.5;

    const sunAngle = ((effectiveTime - 6) / 24) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle);
    const dayFactor = Math.max(0, Math.min(1, (sunElev + 0.18) / 0.55));
    const nightGlow = 1.0 - dayFactor;
    const sunOffX = -Math.cos(sunAngle) * 3.5;
    const sunOffY = Math.max(1.2, (1.1 - Math.max(0, sunElev)) * 3.2);
    const windSway = Math.sin(nowSec * 2.1) * 0.65;

    // 1. Visible Chunk Bounds
    const halfTilesW = w / (2 * tilePx) + 2;
    const halfTilesH = h / (2 * tilePx) + 2;
    const minWx = this.cameraWx - halfTilesW;
    const maxWx = this.cameraWx + halfTilesW;
    const minWz = this.cameraWz - halfTilesH;
    const maxWz = this.cameraWz + halfTilesH;

    const minCx = Math.floor(minWx / CHUNK_SIZE);
    const maxCx = Math.floor(maxWx / CHUNK_SIZE);
    const minCz = Math.floor(minWz / CHUNK_SIZE);
    const maxCz = Math.floor(maxWz / CHUNK_SIZE);

    // Clear canvas with deep ocean color
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, w, h);

    // 2. Blit Cached Ground Chunk Layers + Animated Water Shimmer
    const visibleLayers: CachedChunkLayer[] = [];
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const layer = this.getOrBuildChunkLayer(cx, cz);
        visibleLayers.push(layer);

        const sx = Math.floor(centerScreenX + (cx * CHUNK_SIZE - this.cameraWx) * tilePx);
        const sy = Math.floor(centerScreenY + (cz * CHUNK_SIZE - this.cameraWz) * tilePx);
        const sw = Math.ceil(chunkPx);
        const sh = Math.ceil(chunkPx);

        ctx.drawImage(layer.canvas, sx, sy, sw, sh);

        if (this.chunkDebugVisible) {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
          ctx.lineWidth = 1;
          ctx.strokeRect(sx, sy, sw, sh);
        }
      }
    }

    // Animated Water Sparkles & Ripples across visible chunks
    if (this.zoom >= 0.45) {
      const wavePhase = Math.floor(nowSec * 3.2);
      ctx.fillStyle = dayFactor > 0.3 ? 'rgba(224, 242, 254, 0.45)' : 'rgba(125, 211, 252, 0.22)';
      for (const layer of visibleLayers) {
        const baseWx = layer.cx * CHUNK_SIZE;
        const baseWz = layer.cz * CHUNK_SIZE;
        for (let i = 0; i < 256; i += 3) {
          if (layer.surface.waterDepths[i] > 0) {
            const hVal = (layer.surface.propVariants[i] + wavePhase) & 15;
            if (hVal === 0) {
              const lx = i & 15;
              const lz = i >> 4;
              const wx = baseWx + lx + 0.3;
              const wz = baseWz + lz + 0.5;
              const sx = centerScreenX + (wx - this.cameraWx) * tilePx;
              const sy = centerScreenY + (wz - this.cameraWz) * tilePx;
              ctx.fillRect(sx, sy, Math.max(2, tilePx * 0.28), Math.max(1, tilePx * 0.12));
            }
          }
        }
      }
    }

    // 3. Map Overlays (Biomes, Territories, Fertility, Resources, Wealth, Crime, Happiness)
    this.renderMapOverlays(ctx, visibleLayers, centerScreenX, centerScreenY, tilePx);

    // 4. Collect & Y-Sort All 2D World Objects (Props, Trees, Structures, Vehicles, Animals, Citizens)
    // At very far world-map zoom (zoom < 0.38), render crisp strategic icons instead of thousands of tiny sprites
    if (this.zoom < 0.38) {
      this.renderStrategicWorldMapZoom(ctx, centerScreenX, centerScreenY, tilePx);
    } else {
      // Draw Structures (Bottom-to-Top Z order) with Smooth Interior Cutaway when zoomed in or hovered
      const sortedStructs = [...this.cachedStructures].sort((a, b) => a.z - b.z);
      for (const st of sortedStructs) {
        if (st.x < minWx - 10 || st.x > maxWx + 10 || st.z < minWz - 10 || st.z > maxWz + 10) {
          continue;
        }
        const sx = centerScreenX + (st.x - this.cameraWx) * tilePx;
        const sy = centerScreenY + (st.z - this.cameraWz) * tilePx;

        const isHovered = this.hoveredWorldPoint?.structureId === st.id;
        const isSelected = this.selectedStructureId === st.id;
        const distToCam = Math.hypot(st.x - this.cameraWx, st.z - this.cameraWz);
        const closeCutaway = this.zoom > 2.35 && distToCam < 14;

        const roofAlpha =
          this.forceInteriorCutaway || isHovered || isSelected || closeCutaway
            ? 0.16
            : 1.0;

        drawStructure2D(ctx, st, sx, sy, tilePx, roofAlpha, nightGlow, nowSec);
      }

      // Draw Flora & Resource Props per visible chunk row
      for (const layer of visibleLayers) {
        const baseWx = layer.cx * CHUNK_SIZE;
        const baseWz = layer.cz * CHUNK_SIZE;
        const props = layer.surface.props;
        const vars = layer.surface.propVariants;

        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            const idx = lz * CHUNK_SIZE + lx;
            const p = props[idx] as Prop2DType;
            if (p === Prop2DType.None) continue;

            const wx = baseWx + lx + 0.5;
            const wz = baseWz + lz + 0.5;
            const sx = centerScreenX + (wx - this.cameraWx) * tilePx;
            const sy = centerScreenY + (wz - this.cameraWz) * tilePx;

            drawProp2D(
              ctx,
              p,
              vars[idx],
              sx,
              sy,
              tilePx,
              this.season,
              windSway,
              sunOffX,
              sunOffY
            );
          }
        }
      }

      // Draw Ships & Land Vehicles
      const spriteScale = Math.max(0.55, tilePx / 12);
      for (const v of this.cachedVehicles) {
        if (v.x < minWx - 6 || v.x > maxWx + 6 || v.z < minWz - 6 || v.z > maxWz + 6) continue;
        const sx = centerScreenX + (v.x - this.cameraWx) * tilePx;
        const sy = centerScreenY + (v.z - this.cameraWz) * tilePx;
        drawVehicle2D(ctx, v, sx, sy, spriteScale, nowSec);
      }

      // Draw Wildlife Herds, Birds & Marine Life
      for (const an of this.cachedAnimals) {
        if (an.x < minWx - 4 || an.x > maxWx + 4 || an.z < minWz - 4 || an.z > maxWz + 4) continue;
        const sx = centerScreenX + (an.x - this.cameraWx) * tilePx;
        const sy = centerScreenY + (an.z - this.cameraWz) * tilePx;
        drawAnimal2D(ctx, an, sx, sy, spriteScale, nowSec, false);
      }

      // Draw Layered Paper-Doll Citizens (Y-sorted by Z coordinate)
      const buf = this.latestAgentBuffer;
      if (buf) {
        const stride = 16;
        const count = Math.floor(buf.length / stride);
        const visibleIndices: number[] = [];
        for (let i = 0; i < count; i++) {
          const off = i * stride;
          const id = buf[off + 0];
          const rs = this.agentRenderState.get(id);
          const ax = rs ? rs.x : buf[off + 1];
          const az = rs ? rs.z : buf[off + 3];
          if (ax >= minWx - 3 && ax <= maxWx + 3 && az >= minWz - 3 && az <= maxWz + 3) {
            visibleIndices.push(i);
          }
        }

        visibleIndices.sort((ia, ib) => buf[ia * stride + 3] - buf[ib * stride + 3]);

        const agentScale = Math.max(0.6, tilePx / 13.5);
        for (const i of visibleIndices) {
          const off = i * stride;
          const id = buf[off + 0];
          const rs = this.agentRenderState.get(id);
          const ax = rs ? rs.x : buf[off + 1];
          const az = rs ? rs.z : buf[off + 3];
          const facing = rs ? rs.facing : buf[off + 4];
          const phase = rs ? rs.phase : buf[off + 8];

          const sx = centerScreenX + (ax - this.cameraWx) * tilePx;
          const sy = centerScreenY + (az - this.cameraWz) * tilePx;

          drawPaperDollAgent2D(
            ctx,
            sx,
            sy,
            agentScale,
            facing,
            phase,
            Math.round(buf[off + 11]) as AgentAnimAction,
            buf[off + 12] || 1.0,
            buf[off + 5],
            buf[off + 6],
            buf[off + 7],
            Math.round(buf[off + 10]),
            Math.round(buf[off + 13] || 0),
            Math.round(buf[off + 15] || 0),
            this.selectedAgentId === id,
            this.hoveredWorldPoint?.agentId === id
          );
        }
      }
    }

    // 5. Divine Bursts & Falling Leaf/Resource Particles
    this.renderEffectsAndWeather(ctx, w, h, centerScreenX, centerScreenY, tilePx, dtMs);

    // 6. 2D Day/Night Atmospheric Lighting & Additive Night Window/Fire Glow
    this.renderLightingPass(ctx, w, h, centerScreenX, centerScreenY, tilePx, effectiveTime, dayFactor, nightGlow);

    // 7. Interactive God Power / Terraforming Brush Ring Preview
    if (this.activeGodPowerColor && this.hoveredWorldPoint) {
      const sx = centerScreenX + (this.hoveredWorldPoint.wx - this.cameraWx) * tilePx;
      const sy = centerScreenY + (this.hoveredWorldPoint.wz - this.cameraWz) * tilePx;
      const radTiles = Math.max(2.5, this.activeBrushRadius || 3.5);
      const rPx = radTiles * tilePx;

      ctx.save();
      ctx.strokeStyle = this.activeGodPowerColor;
      ctx.lineWidth = Math.max(2, 2.5 * dpr);
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = this.activeGodPowerColor + '24';
      ctx.beginPath();
      ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderMapOverlays(
    ctx: CanvasRenderingContext2D,
    visibleLayers: CachedChunkLayer[],
    centerScreenX: number,
    centerScreenY: number,
    tilePx: number
  ) {
    // Always draw subtle territory borders if overlayMode === 'territories'
    if (this.overlayMode === 'territories' || this.zoom < 0.55) {
      for (const city of this.cachedCities) {
        if (city.population <= 0) continue;
        const civ = this.cachedCivs.find((c) => c.id === city.civId);
        if (!civ) continue;
        const sx = centerScreenX + (city.x - this.cameraWx) * tilePx;
        const sy = centerScreenY + (city.z - this.cameraWz) * tilePx;
        const rPx = Math.min(48, Math.max(18, 14 + Math.sqrt(city.population) * 3.5)) * tilePx;

        ctx.save();
        ctx.fillStyle = civ.colorHex + '22';
        ctx.strokeStyle = civ.colorHex + 'aa';
        ctx.lineWidth = Math.max(1.5, tilePx * 0.14);
        ctx.beginPath();
        ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    if (this.overlayMode === 'fertility' || this.overlayMode === 'resources') {
      for (const layer of visibleLayers) {
        const baseWx = layer.cx * CHUNK_SIZE;
        const baseWz = layer.cz * CHUNK_SIZE;
        for (let lz = 0; lz < CHUNK_SIZE; lz += 2) {
          for (let lx = 0; lx < CHUNK_SIZE; lx += 2) {
            const idx = lz * CHUNK_SIZE + lx;
            if (layer.surface.waterDepths[idx] > 0) continue;
            const sx = centerScreenX + (baseWx + lx - this.cameraWx) * tilePx;
            const sy = centerScreenY + (baseWz + lz - this.cameraWz) * tilePx;

            if (this.overlayMode === 'fertility') {
              const fert = layer.surface.fertility[idx];
              ctx.fillStyle =
                fert >= 70
                  ? 'rgba(34, 197, 94, 0.34)'
                  : fert >= 45
                  ? 'rgba(234, 179, 8, 0.28)'
                  : 'rgba(239, 68, 68, 0.28)';
              ctx.fillRect(sx, sy, tilePx * 2, tilePx * 2);
            } else {
              const p = layer.surface.props[idx] as Prop2DType;
              if (
                p === Prop2DType.CopperOreNode ||
                p === Prop2DType.IronOreNode ||
                p === Prop2DType.GoldOreNode ||
                p === Prop2DType.CrystalOreNode
              ) {
                ctx.fillStyle = 'rgba(192, 132, 252, 0.65)';
                ctx.fillRect(sx - tilePx * 0.5, sy - tilePx * 0.5, tilePx * 3, tilePx * 3);
              }
            }
          }
        }
      }
    } else if (
      this.overlayMode === 'wealth' ||
      this.overlayMode === 'crime' ||
      this.overlayMode === 'happiness'
    ) {
      for (const city of this.cachedCities) {
        const civ = this.cachedCivs.find((c) => c.id === city.civId);
        const sx = centerScreenX + (city.x - this.cameraWx) * tilePx;
        const sy = centerScreenY + (city.z - this.cameraWz) * tilePx;
        const rPx = 22 * tilePx;

        let color = 'rgba(56, 189, 248, 0.35)';
        if (this.overlayMode === 'wealth') {
          color =
            city.treasuryCoins > 120
              ? 'rgba(250, 204, 21, 0.42)'
              : 'rgba(148, 163, 184, 0.32)';
        } else if (this.overlayMode === 'crime') {
          color =
            city.crimeRate > 12
              ? 'rgba(239, 68, 68, 0.45)'
              : 'rgba(34, 197, 94, 0.32)';
        } else if (this.overlayMode === 'happiness') {
          const hap = civ?.happiness ?? 80;
          color =
            hap >= 75
              ? 'rgba(52, 211, 153, 0.4)'
              : hap >= 50
              ? 'rgba(251, 191, 36, 0.4)'
              : 'rgba(244, 63, 94, 0.45)';
        }

        const grad = ctx.createRadialGradient(sx, sy, rPx * 0.1, sx, sy, rPx);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderStrategicWorldMapZoom(
    ctx: CanvasRenderingContext2D,
    centerScreenX: number,
    centerScreenY: number,
    tilePx: number
  ) {
    // At World-Map zoom, draw crisp emblems for cities, fleets, and citizens
    for (const city of this.cachedCities) {
      if (city.population <= 0) continue;
      const civ = this.cachedCivs.find((c) => c.id === city.civId);
      const sx = centerScreenX + (city.x - this.cameraWx) * tilePx;
      const sy = centerScreenY + (city.z - this.cameraWz) * tilePx;

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = civ?.colorHex || '#f59e0b';
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderEffectsAndWeather(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    centerScreenX: number,
    centerScreenY: number,
    tilePx: number,
    dtMs: number
  ) {
    // Divine Bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age++;
      const t = b.age / b.maxAge;
      const sx = centerScreenX + (b.wx - this.cameraWx) * tilePx;
      const sy = centerScreenY + (b.wz - this.cameraWz) * tilePx;
      ctx.strokeStyle = b.colorHex;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, (1.5 + t * 8.5) * tilePx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
      if (b.age >= b.maxAge) {
        this.bursts.splice(i, 1);
      }
    }

    // Falling Voxel / Leaf Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age++;
      p.wx += p.vx;
      p.wz += p.vz;
      const sx = centerScreenX + (p.wx - this.cameraWx) * tilePx;
      const sy = centerScreenY + (p.wz - this.cameraWz) * tilePx;
      ctx.fillStyle = p.colorHex;
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.maxAge);
      ctx.fillRect(sx, sy, Math.max(2, tilePx * 0.25), Math.max(2, tilePx * 0.25));
      ctx.globalAlpha = 1.0;
      if (p.age >= p.maxAge) {
        this.particles.splice(i, 1);
      }
    }

    // Weather Precipitation (Rain, Thunderstorm, Snow, Blizzard, Sandstorm)
    const effWeather =
      this.photoSettings.active && this.photoSettings.weatherOverride
        ? this.photoSettings.weatherOverride
        : this.weather;

    const isRain =
      effWeather === 'Rain' || effWeather === 'Thunderstorm' || effWeather === 'Storm';
    const isSnow = effWeather === 'Snow' || effWeather === 'Blizzard';
    const isSand = effWeather === 'Sandstorm';

    if (isRain || isSnow || isSand) {
      ctx.save();
      const dtSec = dtMs * 0.001;
      for (const d of this.weatherDrops) {
        d.y = (d.y + d.speed * dtSec * (isSnow ? 0.45 : 1.3)) % 1.0;
        d.x = (d.x + d.speed * dtSec * (isSand ? 0.9 : 0.22)) % 1.0;
        const px = d.x * w;
        const py = d.y * h;

        if (isSnow) {
          ctx.fillStyle = 'rgba(248, 250, 252, 0.8)';
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (isSand) {
          ctx.fillStyle = 'rgba(217, 155, 82, 0.55)';
          ctx.fillRect(px, py, 8, 2);
        } else {
          ctx.strokeStyle = 'rgba(147, 197, 253, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - 3, py + d.len);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    if (effWeather === 'Thunderstorm' && Math.random() < 0.006) {
      this.lightningFlash = 0.65;
    }
    if (this.lightningFlash > 0.01) {
      ctx.fillStyle = `rgba(224, 242, 254, ${this.lightningFlash})`;
      ctx.fillRect(0, 0, w, h);
      this.lightningFlash *= 0.84;
    }
  }

  private renderLightingPass(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    centerScreenX: number,
    centerScreenY: number,
    tilePx: number,
    effectiveTime: number,
    dayFactor: number,
    nightGlow: number
  ) {
    // Sunset / Sunrise Golden Hour Tint
    const goldenHour = Math.max(
      0,
      1.0 - Math.min(Math.abs(effectiveTime - 6.5), Math.abs(effectiveTime - 18.2)) / 1.8
    );
    if (goldenHour > 0.02) {
      ctx.fillStyle = `rgba(251, 146, 60, ${goldenHour * 0.16})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Night Ambient Multiply + Warm Point Lights for Windows, Campfires & Forges
    if (nightGlow > 0.04) {
      const lw = this.lightCanvas.width;
      const lh = this.lightCanvas.height;
      const lctx = this.lightCtx;
      const scaleX = lw / w;
      const scaleY = lh / h;

      lctx.globalCompositeOperation = 'source-over';
      const nightAlpha = Math.min(0.62, nightGlow * 0.58);
      lctx.fillStyle = `rgba(12, 22, 46, ${nightAlpha})`;
      lctx.fillRect(0, 0, lw, lh);

      // Punch warm light halos out of the night darkness around completed buildings & campfires
      lctx.globalCompositeOperation = 'destination-out';
      for (const st of this.cachedStructures) {
        if (!st.isComplete && st.type !== 'Campfire') continue;
        const sx = (centerScreenX + (st.x - this.cameraWx) * tilePx) * scaleX;
        const sy = (centerScreenY + (st.z - this.cameraWz) * tilePx) * scaleY;
        const r = Math.max(14, (st.width || 6) * 1.45 * tilePx * scaleX);
        if (sx < -r || sx > lw + r || sy < -r || sy > lh + r) continue;

        const grad = lctx.createRadialGradient(sx, sy, r * 0.1, sx, sy, r);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lctx.fillStyle = grad;
        lctx.beginPath();
        lctx.arc(sx, sy, r, 0, Math.PI * 2);
        lctx.fill();
      }

      ctx.drawImage(this.lightCanvas, 0, 0, w, h);

      // Subtle warm golden glow over lit structures at night
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const st of this.cachedStructures) {
        if (!st.isComplete && st.type !== 'Campfire') continue;
        const sx = centerScreenX + (st.x - this.cameraWx) * tilePx;
        const sy = centerScreenY + (st.z - this.cameraWz) * tilePx;
        const r = (st.width || 6) * 1.15 * tilePx;
        if (sx < -r || sx > w + r || sy < -r || sy > h + r) continue;

        const grad = ctx.createRadialGradient(sx, sy, r * 0.05, sx, sy, r);
        grad.addColorStop(0, `rgba(251, 191, 36, ${nightGlow * 0.22})`);
        grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private tick = () => {
    if (this.isDisposed) return;

    const now = performance.now();
    const dtMs = Math.max(1, Math.min(100, now - this.lastFrameTimestamp));
    this.lastFrameTimestamp = now;

    const instFps = 1000 / dtMs;
    this.smoothedFps = this.smoothedFps * 0.92 + instFps * 0.08;
    this.smoothedFrameMs = this.smoothedFrameMs * 0.92 + dtMs * 0.08;

    // Continuous smooth day/night progression
    let deltaHours = this.targetTimeOfDay - this.smoothTimeOfDay;
    if (deltaHours < -12) deltaHours += 24;
    if (deltaHours > 12) deltaHours -= 24;
    this.smoothTimeOfDay = (this.smoothTimeOfDay + deltaHours * Math.min(1, dtMs * 0.01) + 24) % 24;

    this.updateCamera(dtMs);
    this.interpolateAgents(dtMs);

    const rStart = performance.now();
    this.renderScene(dtMs);
    this.lastRenderMs = performance.now() - rStart;

    this.frameId = requestAnimationFrame(this.tick);
  };

  // ============================================================================
  // PUBLIC API (Compatible with App.tsx and extended for 2D Overlays & Brushes)
  // ============================================================================

  public queueChunksForMeshing(
    chunks: {
      key: string;
      cx: number;
      cz: number;
      seedNum?: number;
      revision: number;
      voxels: Uint8Array;
    }[],
    clearPrevious = false,
    seedNum?: number
  ) {
    if (seedNum !== undefined) {
      this.currentSeedNum = seedNum;
    } else if (chunks.length > 0 && chunks[0].seedNum !== undefined) {
      this.currentSeedNum = chunks[0].seedNum;
    }

    if (clearPrevious) {
      this.chunkCache.clear();
      this.rawChunkData.clear();
    }

    for (const c of chunks) {
      this.rawChunkData.set(c.key, {
        cx: c.cx,
        cz: c.cz,
        revision: c.revision,
        voxels: c.voxels,
      });
      const existing = this.chunkCache.get(c.key);
      if (existing && existing.revision !== c.revision) {
        this.chunkCache.delete(c.key);
      }
    }
  }

  public unloadChunks(keys: string[], forceImmediate = false) {
    for (const key of keys) {
      if (forceImmediate) {
        this.chunkCache.delete(key);
        this.rawChunkData.delete(key);
      }
    }
  }

  public updateAgentsFromBuffer(
    buf: Float32Array,
    timeOfDay: number,
    season: SeasonType,
    weather: WeatherType
  ) {
    this.targetTimeOfDay = timeOfDay;
    if (this.season !== season) {
      this.season = season;
      // Rebuild chunk palettes smoothly on season change
      this.chunkCache.clear();
    }
    this.weather = weather;
    this.latestAgentBuffer = buf;
  }

  public syncArchitecturalProps(structures: StructureMarker3D[]) {
    this.cachedStructures = structures;
  }

  public syncCitiesAndCivs(cities: CitySummary[], civs: CivilizationSummary[]) {
    this.cachedCities = cities;
    this.cachedCivs = civs;
  }

  public syncVehicles(vehicles: any[]) {
    this.cachedVehicles = vehicles;
  }

  public syncAnimals(animals: AnimalMarker3D[]) {
    this.cachedAnimals = animals;
  }

  public spawnFallingVoxelParticles(particles: FallingVoxelParticle[]) {
    for (const p of particles) {
      if (this.particles.length >= 150) break;
      this.particles.push({
        wx: p.x + (Math.random() - 0.5) * 0.5,
        wz: p.z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 0.05,
        vz: (Math.random() - 0.5) * 0.05,
        colorHex: p.colorHex,
        age: 0,
        maxAge: 28,
      });
    }
  }

  public spawnDivineBurst(wx: number, _wy: number, wz: number, colorHex: string) {
    this.bursts.push({ wx, wz, colorHex, age: 0, maxAge: 32 });
  }

  public jumpCameraTo(wx: number, _wy: number, wz: number) {
    this.followedAgentId = null;
    if (this.cameraMode === 'follow' || this.cameraMode === 'cinematic') {
      this.cameraMode = 'orbit';
    }
    this.targetCameraWx = wx;
    this.targetCameraWz = wz;
    this.onCameraChunkCenterChanged(wx, wz, this.getZoomExpandedChunkRadius());
  }

  public getWorldCameraTarget(): { wx: number; wy: number; wz: number } {
    return {
      wx: Math.round(this.cameraWx),
      wy: Math.round(30 / Math.max(0.25, this.zoom)),
      wz: Math.round(this.cameraWz),
    };
  }

  public getZoomExpandedChunkRadius(): number {
    return Math.max(
      this.expectedRenderDistance,
      Math.min(14, Math.ceil(9 / Math.max(0.3, this.zoom)) + 3)
    );
  }

  public setActiveGodPowerCursor(colorHex: string | null, brushRadius = 0) {
    this.activeGodPowerColor = colorHex;
    this.activeBrushRadius = brushRadius;
    this.canvas.style.cursor = colorHex ? 'crosshair' : 'grab';
  }

  public setMapOverlayMode(mode: MapOverlayMode) {
    this.overlayMode = mode;
  }

  public setInteriorCutaway(enabled: boolean) {
    this.forceInteriorCutaway = enabled;
  }

  public setSimSpeedState(speed: number, isPaused: boolean) {
    this.simSpeedMultiplier = speed;
    this.isSimPaused = isPaused;
  }

  public setPhotoModeSettings(partial: Partial<PhotoModeSettings>) {
    this.photoSettings = { ...this.photoSettings, ...partial };
  }

  public captureScreenshotDataUrl(): string {
    return this.canvas.toDataURL('image/png');
  }

  public setQualityPreset(preset: QualityPreset) {
    this.qualityPreset = preset;
  }

  public setDynamicCycle(enabled: boolean) {
    this.dynamicCycleEnabled = enabled;
  }

  public setShadowDebugVisible(_visible: boolean) {}

  public setChunkDebugVisible(visible: boolean) {
    this.chunkDebugVisible = visible;
  }

  public setNavDebugVisible(visible: boolean) {
    this.navDebugVisible = visible;
  }

  public startFlyFarDistanceTest(onStep?: (wx: number, wz: number) => void) {
    let step = 0;
    const startWx = this.cameraWx;
    const startWz = this.cameraWz;
    const timer = window.setInterval(() => {
      if (this.isDisposed || step >= 16) {
        clearInterval(timer);
        return;
      }
      step++;
      const nx = startWx + step * 28;
      const nz = startWz + step * 18;
      this.jumpCameraTo(nx, WATER_LEVEL + 4, nz);
      if (onStep) onStep(nx, nz);
    }, 150);
  }

  public getPerfStats(): RendererPerfStats {
    return {
      fps: Math.round(this.smoothedFps),
      frameMs: Number(this.smoothedFrameMs.toFixed(1)),
      renderMs: Number(this.lastRenderMs.toFixed(2)),
      drawCalls: this.chunkCache.size,
      triangles: 0,
      geometries: 0,
      textures: this.chunkCache.size,
      activeChunks: this.chunkCache.size,
      pendingMeshJobs: 0,
      shadowMapSize: 2048,
      shadowFrustumSize: 180,
      sunIntensity: 1.0,
      ambientIntensity: 1.0,
      originRebaseX: 0,
      originRebaseZ: 0,
      qualityPreset: this.qualityPreset,
    };
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }
}

export { PixelWorldRenderer2D as VoxelWorldRenderer };

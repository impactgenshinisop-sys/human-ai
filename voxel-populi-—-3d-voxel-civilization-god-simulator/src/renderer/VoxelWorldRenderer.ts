/**
 * High-Detail Three.js Voxel World, Tropical Lagoon Water, Wildlife & 11-Part Human Renderer
 * - Part 1 (Item 2): Continuous frame-driven sun, moon, stars, sky dome & texel-snapped shadows
 * - Part 1 (Item 3): Stylized tropical lagoon water shader (turquoise-to-navy depth gradient,
 *   transparent shallow bed, domain-warped FBM ripples, Fresnel sky reflection, sun glints, shore foam)
 * - Part 2 (Item 6): Fixed bareheaded floating hat cubes (scale 0,0,0 when headgearId === 0)
 *   and restricted architectural sub-block props/lanterns strictly to completed structures
 * - Part 2 (Item 7): Procedural pixel-art facial expression texture on character heads
 * - Part 4 (Item 12): 3D instanced wildlife (land herds, predators, soaring birds, fish & whales)
 * - Part 5 (Items 15-21): Procedural sky dome + drifting clouds, dynamic night window glow,
 *   evolving ships, Photo Mode screenshot capture, and Cinematic Auto-Camera
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { sampleColumn } from '../sim/terrain';
import {
  AgentAnimAction,
  AnimalMarker3D,
  CHUNK_SIZE,
  FallingVoxelParticle,
  QualityPreset,
  RendererPerfStats,
  SeasonType,
  StructureMarker3D,
  VehicleMarker3D,
  WATER_LEVEL,
  WeatherType,
} from '../sim/types';
import type { MeshChunkRequest, MeshChunkResponse } from '../workers/meshWorker';

const MAX_AGENTS = 3000;
const MAX_ARCH_PROPS = 4096;
const MAX_VEHICLES = 128;
const MAX_ANIMALS = 512;
const MAX_CLOUDS = 64;
const MAX_FLORA = 6000;

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();
const _color = new THREE.Color();
const _skinColor = new THREE.Color(0xf2bfa0);
const _bootColor = new THREE.Color(0x3b2618);
const _skyColor = new THREE.Color();
const _groundColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _projVec = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

export type CameraMode = 'orbit' | 'freefly' | 'follow' | 'cinematic';

export interface ProjectedLabel2D {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface HoveredWorldPoint {
  wx: number;
  wy: number;
  wz: number;
  agentId: number | null;
}

export interface PhotoModeSettings {
  active: boolean;
  fov: number;
  timeOverride: number | null; // null = live world time, or 0..24
  weatherOverride: WeatherType | null;
  filter: 'none' | 'warm' | 'vintage' | 'noir' | 'vibrant';
  tiltShift: boolean;
}

/**
 * Generates a 512x512 16-tile (4x4) procedural material texture atlas + matching bump map.
 */
function createVoxelMaterialAtlas(maxAnisotropy: number): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 512;
  const tileSize = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const hash2 = (x: number, y: number, s: number) => {
    const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };

  for (let tileIdx = 0; tileIdx < 16; tileIdx++) {
    const col = tileIdx & 3;
    const row = (tileIdx >> 2) & 3;
    const ox = col * tileSize;
    const oy = row * tileSize;

    for (let py = 0; py < tileSize; py += 4) {
      for (let px = 0; px < tileSize; px += 4) {
        const r = hash2(px, py, tileIdx);
        let lum = 238 + Math.floor((r - 0.5) * 26);
        let bump = 128 + Math.floor((r - 0.5) * 60);

        switch (tileIdx) {
          case 0: {
            const blade = ((px + py * 2) % 16) < 4 && r > 0.35;
            lum = blade ? 252 : 228 + Math.floor(r * 22);
            bump = blade ? 175 : 115;
            break;
          }
          case 1: {
            const pebble = r > 0.82;
            lum = pebble ? 210 : 236 + Math.floor((r - 0.5) * 20);
            bump = pebble ? 185 : 120;
            break;
          }
          case 2: {
            const strata = Math.sin(py * 0.18 + Math.sin(px * 0.12) * 2.5);
            lum = 232 + Math.floor(strata * 16 + (r - 0.5) * 18);
            bump = 128 + Math.floor(strata * 45);
            break;
          }
          case 3: {
            const gx = (px + (Math.floor(py / 24) % 2) * 12) % 24;
            const gy = py % 24;
            const isMortar = gx < 4 || gy < 4;
            lum = isMortar ? 192 : 244 + Math.floor((r - 0.5) * 22);
            bump = isMortar ? 65 : 172;
            break;
          }
          case 4: {
            const rowIdx = Math.floor(py / 32);
            const bx = (px + (rowIdx % 2) * 32) % 64;
            const by = py % 32;
            const joint = bx < 4 || by < 4;
            lum = joint ? 196 : 248 + Math.floor((r - 0.5) * 12);
            bump = joint ? 70 : 168;
            break;
          }
          case 5: {
            const rIdx = Math.floor(py / 20);
            const bx = (px + (rIdx % 2) * 20) % 40;
            const by = py % 20;
            const mortar = bx < 4 || by < 4;
            lum = mortar ? 212 : 242 + ((rIdx + Math.floor(px / 40)) % 3) * 5;
            bump = mortar ? 75 : 165;
            break;
          }
          case 6: {
            const ridge = (px % 16) < 6;
            lum = ridge ? 204 : 246 + Math.floor((r - 0.5) * 16);
            bump = ridge ? 72 : 182;
            break;
          }
          case 7: {
            const pRow = Math.floor(py / 32);
            const pyMod = py % 32;
            const seam = pyMod < 4 || ((px + pRow * 48) % 96) < 4;
            const grain = Math.sin(py * 0.4 + px * 0.06) * 8;
            lum = seam ? 195 : Math.min(255, Math.floor(242 + grain));
            bump = seam ? 68 : 158;
            break;
          }
          case 8: {
            const leafCluster = ((px * 3 + py * 5) % 20) < 9 || r > 0.62;
            lum = leafCluster ? 250 : 210;
            bump = leafCluster ? 185 : 90;
            break;
          }
          case 9: {
            const stalk = (px % 12) < 4 && (py % 28) > 4;
            lum = stalk ? 254 : 224 + Math.floor((r - 0.5) * 20);
            bump = stalk ? 180 : 110;
            break;
          }
          case 10: {
            const tRow = Math.floor(py / 24);
            const tx = (px + (tRow % 2) * 16) % 32;
            const ty = py % 24;
            const overlap = ty < 5 || (tx < 4 && ty < 18);
            lum = overlap ? 196 : 248;
            bump = overlap ? 65 : 178;
            break;
          }
          case 11: {
            const wave = Math.sin(px * 0.15 + py * 0.35 + Math.sin(px * 0.08) * 2);
            lum = 240 + Math.floor(wave * 13);
            bump = 128 + Math.floor(wave * 36);
            break;
          }
          case 12: {
            const vein = Math.abs(((px + py) % 36) - 18) < 5 && r > 0.32;
            lum = vein ? 255 : 222 + Math.floor((r - 0.5) * 18);
            bump = vein ? 195 : 115;
            break;
          }
          case 13: {
            const facet = Math.abs(px - 64) + Math.abs(py - 64);
            lum = (facet % 24) < 12 ? 255 : 228;
            bump = (facet % 24) < 12 ? 185 : 110;
            break;
          }
          case 14: {
            const weave = ((px >> 3) + (py >> 3)) & 1;
            lum = weave ? 250 : 230;
            bump = weave ? 155 : 115;
            break;
          }
          case 15: {
            const fx = (px + (Math.floor(py / 28) % 2) * 16) % 32;
            const fy = py % 28;
            const gap = fx < 4 || fy < 4;
            lum = gap ? 200 : 246;
            bump = gap ? 75 : 165;
            break;
          }
        }

        ctx.fillStyle = `rgb(${lum},${lum},${lum})`;
        ctx.fillRect(ox + px, oy + py, 4, 4);

        bCtx.fillStyle = `rgb(${bump},${bump},${bump})`;
        bCtx.fillRect(ox + px, oy + py, 4, 4);
      }
    }

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.11)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 12, oy + 12, tileSize - 24, tileSize - 24);
  }

  const colorMap = new THREE.CanvasTexture(canvas);
  colorMap.flipY = false;
  colorMap.colorSpace = THREE.NoColorSpace;
  colorMap.magFilter = THREE.NearestFilter;
  colorMap.minFilter = THREE.LinearMipmapLinearFilter;
  colorMap.anisotropy = maxAnisotropy;
  colorMap.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.flipY = false;
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.magFilter = THREE.NearestFilter;
  bumpMap.minFilter = THREE.LinearMipmapLinearFilter;
  bumpMap.anisotropy = maxAnisotropy;
  bumpMap.needsUpdate = true;

  return { colorMap, bumpMap };
}

/**
 * Part 2 (Item 7): Cartoony Smiley Face + Full 3D Wrap-Around Dark Hair Materials
 * - Front (+Z): Crisp cartoony eyes, friendly curved smile (no cheek blush!), and top/side hair fringe
 * - Top (+Y) & Back (-Z): Textured dark/black voxel hair (#18181b / #27272a)
 * - Left (-X) & Right (+X): Textured dark hair on the top & back with skin ear/temple below
 */
function createHeadFaceMaterials(): THREE.MeshStandardMaterial[] {
  const bottomMat = new THREE.MeshStandardMaterial({
    roughness: 0.65,
    metalness: 0.06,
  });

  // Minimalist 16x16 low-poly voxel face (clean hair cap + 2-voxel eyes + 1-voxel mouth)
  const hairCanvas = document.createElement('canvas');
  hairCanvas.width = 16;
  hairCanvas.height = 16;
  const hCtx = hairCanvas.getContext('2d')!;
  hCtx.fillStyle = '#1f1c1a';
  hCtx.fillRect(0, 0, 16, 16);
  const hairTex = new THREE.CanvasTexture(hairCanvas);
  hairTex.magFilter = THREE.NearestFilter;
  hairTex.minFilter = THREE.NearestFilter;
  hairTex.colorSpace = THREE.SRGBColorSpace;
  hairTex.needsUpdate = true;
  const fullHairMat = new THREE.MeshStandardMaterial({
    map: hairTex,
    roughness: 0.8,
    metalness: 0.03,
  });

  // Side face (+X / -X): simple low-poly top hair cap + clean skin below
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 16;
  sideCanvas.height = 16;
  const sCtx = sideCanvas.getContext('2d')!;
  sCtx.fillStyle = '#ffffff';
  sCtx.fillRect(0, 0, 16, 16);
  sCtx.fillStyle = '#1f1c1a';
  sCtx.fillRect(0, 0, 16, 5);
  const sideTex = new THREE.CanvasTexture(sideCanvas);
  sideTex.magFilter = THREE.NearestFilter;
  sideTex.minFilter = THREE.NearestFilter;
  sideTex.colorSpace = THREE.SRGBColorSpace;
  sideTex.needsUpdate = true;
  const sideHairMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    roughness: 0.72,
    metalness: 0.04,
  });

  // Front face (+Z): Clean low-poly 16x16 face (hair fringe, 2x2 dark eyes, subtle 4x1 mouth)
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 16, 16);

  // Clean low-poly hair fringe
  ctx.fillStyle = '#1f1c1a';
  ctx.fillRect(0, 0, 16, 4);

  // Simple 2x2 low-poly eyes
  ctx.fillStyle = '#18181b';
  ctx.fillRect(4, 7, 2, 2);
  ctx.fillRect(10, 7, 2, 2);

  // Subtle 4x1 low-poly mouth
  ctx.fillStyle = '#52382c';
  ctx.fillRect(6, 12, 4, 1);

  const faceTex = new THREE.CanvasTexture(canvas);
  faceTex.magFilter = THREE.NearestFilter;
  faceTex.minFilter = THREE.NearestFilter;
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.needsUpdate = true;

  const frontFaceMat = new THREE.MeshStandardMaterial({
    map: faceTex,
    roughness: 0.68,
    metalness: 0.04,
  });

  // BoxGeometry material order: [+X, -X, +Y (top), -Y (bottom), +Z (front), -Z (back)]
  return [sideHairMat, sideHairMat, fullHairMat, bottomMat, frontFaceMat, fullHairMat];
}

/**
 * Builds a soft, flat, single-layer voxel cloud geometry (wide interconnected plates, no blocky vertical steps)
 */
function createFlatVoxelCloudGeometry(): THREE.BufferGeometry {
  const plates: { w: number; h: number; d: number; ox: number; oy: number; oz: number }[] = [
    { w: 26, h: 0.9, d: 14, ox: 0, oy: 0, oz: 0 },
    { w: 16, h: 0.9, d: 22, ox: 2, oy: 0, oz: 0 },
    { w: 32, h: 0.9, d: 8, ox: -1, oy: 0, oz: 1 },
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  for (const p of plates) {
    const box = new THREE.BoxGeometry(p.w, p.h, p.d);
    box.translate(p.ox, p.oy, p.oz);
    const posAttr = box.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = box.getAttribute('normal') as THREE.BufferAttribute;
    const idxAttr = box.getIndex()!;
    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
    }
    for (let i = 0; i < idxAttr.count; i++) {
      indices.push(idxAttr.getX(i) + vertexOffset);
    }
    vertexOffset += posAttr.count;
    box.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}

function lerpAngleShortest(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

export class VoxelWorldRenderer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private isDisposed = false;

  // Floating Origin Scene Rebaser
  public originRebaseX = 0;
  public originRebaseZ = 0;

  private meshWorkers: Worker[] = [];
  private nextWorkerIdx = 0;
  private horizonSkirtMesh: THREE.Mesh;
  private chunkGroup = new THREE.Group();
  private chunkDebugGroup = new THREE.Group();
  private navDebugGroup = new THREE.Group();
  private chunkMeshes = new Map<
    string,
    {
      opaque?: THREE.Mesh;
      water?: THREE.Mesh;
      debugBox?: THREE.LineSegments;
      cx: number;
      cz: number;
      lod: 0 | 1 | 2;
      revision: number;
    }
  >();

  // Priority Chunk Meshing Queue & 3-Tier Horizon LOD Streamer
  private pendingMeshQueue = new Map<
    string,
    {
      key: string;
      cx: number;
      cz: number;
      lod?: 0 | 1 | 2;
      seedNum?: number;
      revision: number;
      voxels: Uint8Array;
    }
  >();
  private inFlightMeshKeys = new Set<string>();
  private currentSeedNum = 777;
  private expectedRenderDistance = 8;
  private lastChunkWatchdogTime = 0;
  private lastFarLodSweepTime = 0;
  private lastCamTargetWx = 0;
  private lastCamTargetWz = 0;
  private camVelX = 0;
  private camVelZ = 0;

  private opaqueMaterial: THREE.MeshStandardMaterial;
  private waterMaterial: THREE.MeshStandardMaterial;
  private waterTimeUniform = { value: 0 };
  private waterSunDirUniform = { value: new THREE.Vector3(0.5, 0.8, 0.3) };
  private waterSkyColorUniform = { value: new THREE.Color(0x6ec3f5) };
  private waterNightGlowUniform = { value: 0.0 };
  private waterWinterIceUniform = { value: 0.0 };
  private chunkDebugMaterial: THREE.LineBasicMaterial;

  // Sky Dome & Drifting 3D Voxel Clouds (Item 15)
  private skyDomeMesh: THREE.Mesh;
  private skyUniforms: {
    uZenithColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uStarIntensity: { value: number };
    uTime: { value: number };
  };
  private cloudInstanced: THREE.InstancedMesh;
  private cloudMat: THREE.MeshBasicMaterial;

  // 3D Sub-Block Wildflowers & Grass Tufts
  private floraStemInstanced: THREE.InstancedMesh;
  private floraBloomInstanced: THREE.InstancedMesh;
  private floraSlotWriteIdx = 0;

  // 3D Sub-Block Architectural Detail Instanced Meshes
  private archRafterInstanced: THREE.InstancedMesh;
  private archLintelInstanced: THREE.InstancedMesh;
  private archShutterInstanced: THREE.InstancedMesh;
  private archCrateFenceInstanced: THREE.InstancedMesh;
  private archLanternInstanced: THREE.InstancedMesh;
  private archLanternMat: THREE.MeshStandardMaterial;
  private cachedStructures: StructureMarker3D[] = [];

  // 3D Era-Evolving Vehicles & Ships + Visible Human Riders
  private vehicleHullInstanced: THREE.InstancedMesh;
  private vehicleWheelInstanced: THREE.InstancedMesh;
  private vehicleSailOrCabInstanced: THREE.InstancedMesh;
  private vehicleRiderTorsoInstanced: THREE.InstancedMesh;
  private vehicleRiderHeadInstanced: THREE.InstancedMesh;
  private cachedVehicles: VehicleMarker3D[] = [];
  private vehicleRenderState = new Map<
    number,
    { x: number; y: number; z: number; facing: number }
  >();

  // 3D Instanced Wildlife Ecosystem (Item 12)
  private animalBodyInstanced: THREE.InstancedMesh;
  private animalHeadInstanced: THREE.InstancedMesh;
  private animalLimbInstanced: THREE.InstancedMesh;
  private cachedAnimals: AnimalMarker3D[] = [];
  private animalRenderState = new Map<
    number,
    { x: number; y: number; z: number; facing: number }
  >();

  // 11-Part Articulated Block Person Instanced Rig + 60 FPS Client-Side Interpolation
  private torsoInstanced: THREE.InstancedMesh;
  private beltInstanced: THREE.InstancedMesh;
  private headInstanced: THREE.InstancedMesh;
  private hatInstanced: THREE.InstancedMesh;
  private leftArmInstanced: THREE.InstancedMesh;
  private rightArmInstanced: THREE.InstancedMesh;
  private leftHandInstanced: THREE.InstancedMesh;
  private rightHandInstanced: THREE.InstancedMesh;
  private leftLegInstanced: THREE.InstancedMesh;
  private rightLegInstanced: THREE.InstancedMesh;
  private toolInstanced: THREE.InstancedMesh;
  private shieldOrCapeInstanced: THREE.InstancedMesh;
  private carriedBlockInstanced: THREE.InstancedMesh;

  private agentIds = new Int32Array(MAX_AGENTS);
  private currentAgentCount = 0;
  private latestAgentBuffer: Float32Array | null = null;
  private agentRenderState = new Map<
    number,
    { x: number; y: number; z: number; facing: number; phase: number }
  >();

  // Smooth Continuous Time-of-Day, Sun, Moon & Shadow System (Part 1 - Item 2)
  private sunLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private shadowCameraHelper: THREE.CameraHelper;
  private fog: THREE.Fog;
  private weatherPoints: THREE.Points;
  private targetTimeOfDay = 10.2;
  private renderTimeOfDay = 10.2;
  private simSpeedMultiplier = 1;
  private isSimPaused = false;
  private season: SeasonType = 'Spring';
  private weather: WeatherType = 'Clear';
  private dynamicCycleEnabled = true;
  private shadowExtent = 95;
  private frameCounter = 0;
  private shadowUpdateInterval = 1;
  private lightningFlashIntensity = 0;

  // Photo Mode & Cinematic Camera (Item 21)
  public photoSettings: PhotoModeSettings = {
    active: false,
    fov: 45,
    timeOverride: null,
    weatherOverride: null,
    filter: 'none',
    tiltShift: false,
  };
  private cinematicOrbitAngle = 0;
  private cinematicFocusSwitchTimer = 0;
  private cinematicFocusIndex = 0;

  // Quality & Debug Toggles
  private qualityPreset: QualityPreset = 'Auto';
  private effectiveQuality: 'Low' | 'Medium' | 'High' | 'Ultra' = 'High';
  private shadowDebugVisible = false;
  private chunkDebugVisible = false;
  private navDebugVisible = false;

  // Performance Tracking
  private lastFrameTimestamp = performance.now();
  private smoothedFps = 60;
  private smoothedFrameMs = 16.6;
  private lastRenderMs = 1.2;
  private lastMeshBuildMs = 0.8;
  private autoQualityCooldown = 0;

  // God Power 3D Target Ring & Falling Voxel Leaf/Debris Particles
  private targetRing: THREE.Mesh;
  private activeGodPowerColor: string | null = null;
  private fxGroup = new THREE.Group();
  private activeBursts: {
    mesh: THREE.Mesh;
    age: number;
    maxAge: number;
  }[] = [];
  private fallingDebrisCubes: {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    age: number;
    maxAge: number;
  }[] = [];
  private sharedDebrisGeo = new THREE.BoxGeometry(0.36, 0.36, 0.36);

  public cameraMode: CameraMode = 'orbit';
  public followedAgentId: number | null = null;
  private smoothTarget = new THREE.Vector3(0, 15, 0);
  private smoothCamPos = new THREE.Vector3(46, 42, 46);
  private isTransitioningCamera = false;
  private keysPressed = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2();
  private lastCameraNotifyTime = 0;
  private lastHoverRaycastTime = 0;
  public hoveredWorldPoint: HoveredWorldPoint | null = null;

  private onSelectAgent: (agentId: number | null) => void;
  private onSelectAnimal?: (animalId: number) => void;
  private onCastGodPowerAt: (wx: number, wz: number) => void;
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
      onCastGodPowerAt: (wx: number, wz: number) => void;
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
    this.onCastGodPowerAt = callbacks.onCastGodPowerAt;
    this.onCameraChunkCenterChanged = callbacks.onCameraChunkCenterChanged;
    this.onRequestMissingChunks = callbacks.onRequestMissingChunks;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Needed for clean Photo Mode PNG captures
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.75)
    );
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    container.appendChild(this.renderer.domElement);

    // Scene & Atmospheric Horizon Fog
    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog(0x7ac1eb, 520, 1650);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x7ac1eb);

    // Camera & OrbitControls (Expanded zoom range up to 950 blocks)
    this.camera = new THREE.PerspectiveCamera(
      45,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.5,
      3500
    );
    this.camera.position.set(46, 42, 46);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 15, 0);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.465;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 340;
    this.controls.addEventListener('start', () => {
      this.isTransitioningCamera = false;
      if (this.cameraMode === 'cinematic') {
        this.cameraMode = 'orbit';
      }
    });

    // ==========================================================================
    // Procedural Sky Dome with Sun/Moon Halo & Night Stars (Item 15)
    // ==========================================================================
    this.skyUniforms = {
      uZenithColor: { value: new THREE.Color(0x2b7de9) },
      uHorizonColor: { value: new THREE.Color(0x9bd7f8) },
      uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
      uSunColor: { value: new THREE.Color(0xfff4d2) },
      uStarIntensity: { value: 0.0 },
      uTime: { value: 0.0 },
    };
    const skyGeo = new THREE.SphereGeometry(2800, 28, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uZenithColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uStarIntensity;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hash31(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uZenithColor, pow(h, 0.62));

          // Sun / Moon disc & warm atmospheric halo
          float sunCos = max(dot(dir, normalize(uSunDir)), 0.0);
          float sunHalo = pow(sunCos, 8.0) * 0.25 + pow(sunCos, 64.0) * 0.6;
          float sunDisc = smoothstep(0.9965, 0.9988, sunCos);
          sky += uSunColor * (sunHalo + sunDisc * 1.4);

          // Twinkling night starfield
          if (uStarIntensity > 0.01 && dir.y > 0.05) {
            vec3 starCell = floor(dir * 260.0);
            float starRand = hash31(starCell);
            if (starRand > 0.993) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + starRand * 100.0);
              sky += vec3(0.9, 0.95, 1.0) * uStarIntensity * twinkle * smoothstep(0.05, 0.25, dir.y);
            }
          }

          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDomeMesh);

    // Soft Flat Unlit Voxel Cloud Layer High in the Sky (World-Anchored)
    const cloudGeo = createFlatVoxelCloudGeometry();
    this.cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.cloudInstanced = new THREE.InstancedMesh(cloudGeo, this.cloudMat, MAX_CLOUDS);
    this.cloudInstanced.frustumCulled = false;
    this.cloudInstanced.castShadow = false;
    this.scene.add(this.cloudInstanced);

    // Continuous Horizon Skirt deep beneath ocean floor so no flat square skirt is visible
    const skirtGeo = new THREE.PlaneGeometry(9600, 9600);
    skirtGeo.rotateX(-Math.PI / 2);
    const skirtMat = new THREE.MeshBasicMaterial({
      color: 0x0b3b66,
    });
    this.horizonSkirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    this.horizonSkirtMesh.position.set(0, 1.0, 0);
    this.scene.add(this.horizonSkirtMesh);

    // Warm Golden Sunlight + Cool Sky/Ground Hemisphere + Soft Opposite Fill Light
    this.sunLight = new THREE.DirectionalLight(0xfff0d0, 2.15);
    this.sunLight.position.set(165, 225, 118);
    this.sunLight.castShadow = !this.isSoftwareGl;
    const shadowRes = this.isSoftwareGl ? 2048 : 4096;
    this.sunLight.shadow.mapSize.width = shadowRes;
    this.sunLight.shadow.mapSize.height = shadowRes;
    const d = 180;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 750;
    this.sunLight.shadow.bias = -0.0022;
    this.sunLight.shadow.normalBias = 0.14;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.shadowCameraHelper = new THREE.CameraHelper(this.sunLight.shadow.camera);
    this.shadowCameraHelper.visible = false;
    this.scene.add(this.shadowCameraHelper);

    this.fillLight = new THREE.DirectionalLight(0x90b8f8, 0.68);
    this.fillLight.position.set(-55, 50, -45);
    this.scene.add(this.fillLight);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x4b3f32, 0.85);
    this.hemiLight.position.set(0, 80, 0);
    this.scene.add(this.hemiLight);

    // 512x512 16-Tile Voxel Material Texture Atlas + Bump Map
    const { colorMap, bumpMap } = createVoxelMaterialAtlas(
      this.renderer.capabilities.getMaxAnisotropy()
    );
    this.opaqueMaterial = new THREE.MeshStandardMaterial({
      map: colorMap,
      bumpMap,
      bumpScale: 0.07,
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.05,
    });

    // ==========================================================================
    // Part 1 (Item 3): Stylized Tropical Lagoon Water & Glowing Window Shader
    // Matches /public/assets/aistudio/image_f5736053.png:
    // - Shallow turquoise to deep navy depth gradient
    // - Partial transparency showing underwater sandy bed & coral reefs
    // - Domain-warped multi-octave FBM surface ripples (zero repeating dot circles!)
    // - Fresnel sky reflection + sparkling sun specular glints + organic shore foam
    // ==========================================================================
    this.waterMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    this.waterMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uWaterTime = this.waterTimeUniform;
      shader.uniforms.uSunDir = this.waterSunDirUniform;
      shader.uniforms.uSkyColor = this.waterSkyColorUniform;
      shader.uniforms.uNightGlow = this.waterNightGlowUniform;
      shader.uniforms.uWinterIce = this.waterWinterIceUniform;

      shader.vertexShader =
        `uniform float uWaterTime;\nvarying vec3 vWaterWorldPos;\nvarying vec3 vWorldViewPos;\n` +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vWaterWorldPos = transformed;
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          vWorldViewPos = wp.xyz;
          if (color.b < 0.5) {
            float swellA = sin(transformed.x * 0.27 + transformed.z * 0.19 + uWaterTime * 1.8) * 0.038;
            float swellB = cos(transformed.x * 0.18 - transformed.z * 0.31 + uWaterTime * 1.4) * 0.028;
            transformed.y += swellA + swellB;
          }`
        );

      shader.fragmentShader =
        `uniform float uWaterTime;
        uniform vec3 uSunDir;
        uniform vec3 uSkyColor;
        uniform float uNightGlow;
        uniform float uWinterIce;
        varying vec3 vWaterWorldPos;
        varying vec3 vWorldViewPos;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise2D(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float waterFbm(vec2 p, float t) {
          float v = 0.0;
          vec2 shift = vec2(t * 0.42, -t * 0.31);
          v += 0.50 * noise2D(p * 0.55 + shift);
          p = mat2(0.8, -0.6, 0.6, 0.8) * p * 2.03;
          v += 0.30 * noise2D(p * 0.55 - shift * 1.3);
          p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.01;
          v += 0.20 * noise2D(p * 0.55 + vec2(-t * 0.5, t * 0.38));
          return v;
        }\n` +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          // vColor.r = depthNorm (0 shallow .. 1 deep), vColor.g = shoreFoam, vColor.b = isGlass
          if (vColor.b > 0.5) {
            // Window Glass Pane: warm amber candlelight glow at dusk/night, crisp sky glass by day
            vec3 dayGlass = vec3(0.55, 0.78, 0.92);
            vec3 nightWindow = vec3(1.0, 0.76, 0.28) * 1.65;
            diffuseColor.rgb = mix(dayGlass, nightWindow, uNightGlow);
            diffuseColor.a = mix(0.68, 0.95, uNightGlow);
          } else {
            float depthNorm = clamp(vColor.r, 0.0, 1.0);
            float shoreFactor = clamp(vColor.g, 0.0, 1.0);
            vec2 wp = vWaterWorldPos.xz;

            // Multi-layered domain-warped FBM ripples (no circular dot patterns)
            vec2 warp = vec2(
              noise2D(wp * 0.32 + uWaterTime * 0.25),
              noise2D(wp * 0.32 - uWaterTime * 0.22 + 17.3)
            );
            float r1 = waterFbm(wp * 1.15 + warp * 0.85, uWaterTime);
            float r2 = waterFbm(wp * 2.35 - warp * 0.65, uWaterTime * 1.25);

            // Perturbed surface normal from FBM gradients
            vec3 surfNorm = normalize(vec3((r1 - 0.5) * 0.34, 1.0, (r2 - 0.5) * 0.34));
            vec3 viewDir = normalize(cameraPosition - vWorldViewPos);
            float fresnel = pow(1.0 - max(dot(surfNorm, viewDir), 0.0), 3.2);

            // Deep linear-space ocean & river blue palette (vivid azure -> cobalt -> deep navy)
            vec3 shallowAzure = vec3(0.015, 0.25, 0.54);
            vec3 midCobalt = vec3(0.008, 0.12, 0.36);
            vec3 deepNavy = vec3(0.003, 0.045, 0.18);

            vec3 baseWater = depthNorm < 0.45
              ? mix(shallowAzure, midCobalt, depthNorm / 0.45)
              : mix(midCobalt, deepNavy, (depthNorm - 0.45) / 0.55);

            // Subtle caustic shimmer in shallow water
            float caustic = smoothstep(0.58, 0.80, r1 * 0.6 + r2 * 0.4) * (1.0 - depthNorm * 0.75);
            baseWater += vec3(0.02, 0.09, 0.16) * caustic;

            // Balanced Fresnel sky reflection without washing out water into white
            vec3 waterCol = mix(baseWater, uSkyColor * 0.55, clamp(fresnel * 0.26, 0.03, 0.28));

            // Crisp specular sun glints on wave crests
            vec3 reflDir = reflect(-normalize(uSunDir), surfNorm);
            float spec = pow(max(dot(viewDir, reflDir), 0.0), 56.0) * (0.4 + 0.6 * r2);
            waterCol += vec3(1.0, 0.96, 0.86) * spec * 0.65;

            // Soft organic shoreline foam lapping beaches and piers
            float foamWave = noise2D(wp * 1.8 + vec2(uWaterTime * 0.9, -uWaterTime * 0.7));
            float foamMask = smoothstep(0.52, 0.84, shoreFactor + (foamWave - 0.5) * 0.24) * shoreFactor;
            waterCol = mix(waterCol, vec3(0.75, 0.88, 0.98), clamp(foamMask * 0.45, 0.0, 0.48));

            // Winter frost rim along shallow edges
            if (uWinterIce > 0.01) {
              float iceMask = smoothstep(0.38, 0.78, shoreFactor + (r1 - 0.5) * 0.25) * uWinterIce;
              waterCol = mix(waterCol, vec3(0.62, 0.82, 0.95), iceMask * 0.55);
            }

            diffuseColor.rgb = waterCol;
            diffuseColor.a = clamp(mix(0.74, 0.94, pow(depthNorm, 0.6)) + fresnel * 0.10, 0.70, 0.96);
          }`
        );
    };

    this.chunkDebugMaterial = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.65,
    });

    this.scene.add(this.chunkGroup);
    this.chunkDebugGroup.visible = false;
    this.scene.add(this.chunkDebugGroup);
    this.navDebugGroup.visible = false;
    this.scene.add(this.navDebugGroup);
    this.scene.add(this.fxGroup);

    // ==========================================================================
    // 3D Sub-Block Architectural Detail Instancing
    // ==========================================================================
    const timberMat = new THREE.MeshStandardMaterial({
      roughness: 0.76,
      metalness: 0.08,
    });
    const rafterGeo = new THREE.BoxGeometry(0.26, 0.28, 1.45);
    this.archRafterInstanced = new THREE.InstancedMesh(rafterGeo, timberMat, MAX_ARCH_PROPS);
    this.archRafterInstanced.count = 0;
    this.archRafterInstanced.frustumCulled = false;
    this.archRafterInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.archRafterInstanced);

    const lintelGeo = new THREE.BoxGeometry(1.9, 0.28, 0.42);
    this.archLintelInstanced = new THREE.InstancedMesh(lintelGeo, timberMat, MAX_ARCH_PROPS);
    this.archLintelInstanced.count = 0;
    this.archLintelInstanced.frustumCulled = false;
    this.archLintelInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.archLintelInstanced);

    const shutterGeo = new THREE.BoxGeometry(0.22, 0.72, 0.18);
    this.archShutterInstanced = new THREE.InstancedMesh(shutterGeo, timberMat, MAX_ARCH_PROPS);
    this.archShutterInstanced.count = 0;
    this.archShutterInstanced.frustumCulled = false;
    this.archShutterInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.archShutterInstanced);

    const crateGeo = new THREE.BoxGeometry(0.38, 0.42, 0.38);
    this.archCrateFenceInstanced = new THREE.InstancedMesh(crateGeo, timberMat, MAX_ARCH_PROPS);
    this.archCrateFenceInstanced.count = 0;
    this.archCrateFenceInstanced.frustumCulled = false;
    this.archCrateFenceInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.archCrateFenceInstanced);

    this.archLanternMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xff9f1c,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });
    const lanternGeo = new THREE.BoxGeometry(0.24, 0.34, 0.24);
    this.archLanternInstanced = new THREE.InstancedMesh(
      lanternGeo,
      this.archLanternMat,
      MAX_ARCH_PROPS
    );
    this.archLanternInstanced.count = 0;
    this.archLanternInstanced.frustumCulled = false;
    this.scene.add(this.archLanternInstanced);

    // ==========================================================================
    // 3D Era-Evolving Land & Water Vehicles Instanced Rig
    // ==========================================================================
    const vehicleHullGeo = new THREE.BoxGeometry(1.15, 0.48, 2.25);
    this.vehicleHullInstanced = new THREE.InstancedMesh(vehicleHullGeo, timberMat, MAX_VEHICLES);
    this.vehicleHullInstanced.count = 0;
    this.vehicleHullInstanced.frustumCulled = false;
    this.vehicleHullInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.vehicleHullInstanced);

    const vehicleWheelGeo = new THREE.BoxGeometry(0.18, 0.56, 0.56);
    this.vehicleWheelInstanced = new THREE.InstancedMesh(
      vehicleWheelGeo,
      timberMat,
      MAX_VEHICLES * 4
    );
    this.vehicleWheelInstanced.count = 0;
    this.vehicleWheelInstanced.frustumCulled = false;
    this.scene.add(this.vehicleWheelInstanced);

    const vehicleSailGeo = new THREE.BoxGeometry(0.95, 1.35, 0.85);
    this.vehicleSailOrCabInstanced = new THREE.InstancedMesh(
      vehicleSailGeo,
      timberMat,
      MAX_VEHICLES * 4
    );
    this.vehicleSailOrCabInstanced.count = 0;
    this.vehicleSailOrCabInstanced.frustumCulled = false;
    this.vehicleSailOrCabInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.vehicleSailOrCabInstanced);

    // 3D Sub-Block Wildflower Stems & Petals
    const stemGeo = new THREE.BoxGeometry(0.08, 0.34, 0.08);
    stemGeo.translate(0, 0.17, 0);
    this.floraStemInstanced = new THREE.InstancedMesh(stemGeo, timberMat, MAX_FLORA);
    this.floraStemInstanced.count = 0;
    this.floraStemInstanced.frustumCulled = false;
    this.chunkGroup.add(this.floraStemInstanced);

    const bloomGeo = new THREE.BoxGeometry(0.24, 0.16, 0.24);
    bloomGeo.translate(0, 0.36, 0);
    this.floraBloomInstanced = new THREE.InstancedMesh(bloomGeo, timberMat, MAX_FLORA);
    this.floraBloomInstanced.count = 0;
    this.floraBloomInstanced.frustumCulled = false;
    this.chunkGroup.add(this.floraBloomInstanced);

    // ==========================================================================
    // 3D Wildlife Ecosystem Instanced Rig (Item 12: Land, Birds, Marine Life)
    // ==========================================================================
    const animalBodyGeo = new THREE.BoxGeometry(0.55, 0.45, 0.85);
    this.animalBodyInstanced = new THREE.InstancedMesh(animalBodyGeo, timberMat, MAX_ANIMALS);
    this.animalBodyInstanced.count = 0;
    this.animalBodyInstanced.frustumCulled = false;
    this.animalBodyInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.animalBodyInstanced);

    const animalHeadGeo = new THREE.BoxGeometry(0.36, 0.36, 0.42);
    this.animalHeadInstanced = new THREE.InstancedMesh(animalHeadGeo, timberMat, MAX_ANIMALS);
    this.animalHeadInstanced.count = 0;
    this.animalHeadInstanced.frustumCulled = false;
    this.scene.add(this.animalHeadInstanced);

    const animalLimbGeo = new THREE.BoxGeometry(0.16, 0.38, 0.16);
    this.animalLimbInstanced = new THREE.InstancedMesh(animalLimbGeo, timberMat, MAX_ANIMALS * 4);
    this.animalLimbInstanced.count = 0;
    this.animalLimbInstanced.frustumCulled = false;
    this.scene.add(this.animalLimbInstanced);

    // ==========================================================================
    // 11-Part Articulated Voxel Human Instanced Rig (with Cartoony Face + Dark Hair)
    // ==========================================================================
    const charMat = new THREE.MeshStandardMaterial({
      roughness: 0.66,
      metalness: 0.08,
    });
    const headFaceMats = createHeadFaceMaterials();

    const riderTorsoGeo = new THREE.BoxGeometry(0.54, 0.64, 0.36);
    this.vehicleRiderTorsoInstanced = new THREE.InstancedMesh(
      riderTorsoGeo,
      charMat,
      MAX_VEHICLES
    );
    this.vehicleRiderTorsoInstanced.count = 0;
    this.vehicleRiderTorsoInstanced.frustumCulled = false;
    this.vehicleRiderTorsoInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.vehicleRiderTorsoInstanced);

    const riderHeadGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
    this.vehicleRiderHeadInstanced = new THREE.InstancedMesh(
      riderHeadGeo,
      headFaceMats,
      MAX_VEHICLES
    );
    this.vehicleRiderHeadInstanced.count = 0;
    this.vehicleRiderHeadInstanced.frustumCulled = false;
    this.vehicleRiderHeadInstanced.castShadow = !this.isSoftwareGl;
    this.scene.add(this.vehicleRiderHeadInstanced);

    const torsoGeo = new THREE.BoxGeometry(0.68, 0.78, 0.42);
    torsoGeo.translate(0, 0.88, 0);
    this.torsoInstanced = new THREE.InstancedMesh(torsoGeo, charMat, MAX_AGENTS);

    const beltGeo = new THREE.BoxGeometry(0.72, 0.18, 0.46);
    beltGeo.translate(0, 0.54, 0);
    this.beltInstanced = new THREE.InstancedMesh(beltGeo, charMat, MAX_AGENTS);

    const headGeo = new THREE.BoxGeometry(0.56, 0.56, 0.56);
    headGeo.translate(0, 1.56, 0);
    this.headInstanced = new THREE.InstancedMesh(headGeo, headFaceMats, MAX_AGENTS);

    // Flush-fitting hat geometry sitting directly on head top (1.84) with zero air gap
    const hatGeo = new THREE.BoxGeometry(0.62, 0.22, 0.62);
    hatGeo.translate(0, 1.80, 0);
    this.hatInstanced = new THREE.InstancedMesh(hatGeo, charMat, MAX_AGENTS);

    const armGeo = new THREE.BoxGeometry(0.24, 0.56, 0.24);
    armGeo.translate(0, -0.24, 0);
    this.leftArmInstanced = new THREE.InstancedMesh(armGeo, charMat, MAX_AGENTS);
    this.rightArmInstanced = new THREE.InstancedMesh(armGeo, charMat, MAX_AGENTS);

    const handGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    handGeo.translate(0, -0.58, 0);
    this.leftHandInstanced = new THREE.InstancedMesh(handGeo, charMat, MAX_AGENTS);
    this.rightHandInstanced = new THREE.InstancedMesh(handGeo, charMat, MAX_AGENTS);

    const legGeo = new THREE.BoxGeometry(0.26, 0.5, 0.28);
    legGeo.translate(0, -0.25, 0);
    this.leftLegInstanced = new THREE.InstancedMesh(legGeo, charMat, MAX_AGENTS);
    this.rightLegInstanced = new THREE.InstancedMesh(legGeo, charMat, MAX_AGENTS);

    const toolGeo = new THREE.BoxGeometry(0.14, 0.72, 0.28);
    toolGeo.translate(0, -0.55, 0.26);
    this.toolInstanced = new THREE.InstancedMesh(toolGeo, charMat, MAX_AGENTS);

    const shieldGeo = new THREE.BoxGeometry(0.54, 0.66, 0.1);
    shieldGeo.translate(0, 0.88, -0.26);
    this.shieldOrCapeInstanced = new THREE.InstancedMesh(shieldGeo, charMat, MAX_AGENTS);

    const blockGeo = new THREE.BoxGeometry(0.48, 0.48, 0.48);
    blockGeo.translate(0, 0.95, 0.46);
    this.carriedBlockInstanced = new THREE.InstancedMesh(
      blockGeo,
      charMat,
      MAX_AGENTS
    );

    const allParts = [
      this.torsoInstanced,
      this.beltInstanced,
      this.headInstanced,
      this.hatInstanced,
      this.leftArmInstanced,
      this.rightArmInstanced,
      this.leftHandInstanced,
      this.rightHandInstanced,
      this.leftLegInstanced,
      this.rightLegInstanced,
      this.toolInstanced,
      this.shieldOrCapeInstanced,
      this.carriedBlockInstanced,
    ];
    for (const part of allParts) {
      part.frustumCulled = false;
      part.castShadow = !this.isSoftwareGl;
      part.receiveShadow = !this.isSoftwareGl;
      this.scene.add(part);
    }

    // Weather Particle System (wide 380x380 volume so it never forms a 1-chunk box)
    const particleCount = 1200;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pPos[i * 3 + 0] = (Math.random() - 0.5) * 380;
      pPos[i * 3 + 1] = Math.random() * 64 + 8;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 380;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.32,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.weatherPoints = new THREE.Points(pGeo, pMat);
    this.scene.add(this.weatherPoints);

    // 3D Target Ring for God Powers
    const ringGeo = new THREE.RingGeometry(3.2, 4.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.targetRing = new THREE.Mesh(ringGeo, ringMat);
    this.targetRing.visible = false;
    this.scene.add(this.targetRing);

    // Spawn Pool of 4 Parallel Chunk Meshing Workers for Instant 1x1 Full-Detail Streaming
    const workerCount = this.isSoftwareGl ? 2 : 4;
    for (let w = 0; w < workerCount; w++) {
      const worker = new Worker(
        new URL('../workers/meshWorker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (e: MessageEvent<MeshChunkResponse>) => {
        if (e.data && e.data.type === 'CHUNK_MESHED') {
          this.inFlightMeshKeys.delete(e.data.key);
          this.lastMeshBuildMs = e.data.buildMs;
          this.applyMeshedChunk(e.data);
          this.flushMeshQueue();
        }
      };
      this.meshWorkers.push(worker);
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);

    this.tick();
  }

  public setSimSpeedState(speed: number, isPaused: boolean) {
    this.simSpeedMultiplier = speed;
    this.isSimPaused = isPaused;
  }

  public setPhotoModeSettings(partial: Partial<PhotoModeSettings>) {
    this.photoSettings = { ...this.photoSettings, ...partial };
    if (partial.fov !== undefined) {
      this.camera.fov = partial.fov;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  public captureScreenshotDataUrl(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  public setNavDebugVisible(visible: boolean) {
    this.navDebugVisible = visible;
    this.navDebugGroup.visible = visible;
    if (visible && this.cachedStructures.length > 0) {
      this.rebuildNavDebugOverlay();
    }
  }

  private rebuildNavDebugOverlay() {
    while (this.navDebugGroup.children.length > 0) {
      const ch = this.navDebugGroup.children[0] as THREE.Mesh;
      this.navDebugGroup.remove(ch);
      ch.geometry.dispose();
    }
    if (!this.navDebugVisible) return;

    const wallMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.42,
      wireframe: true,
    });
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.7,
    });

    for (const st of this.cachedStructures) {
      const lx = st.x - this.originRebaseX;
      const ly = st.y;
      const lz = st.z - this.originRebaseZ;
      const w = st.width || 7;
      const d = st.depth || 7;
      const hd = Math.floor(d / 2);

      const footprintGeo = new THREE.BoxGeometry(w, 2.2, d);
      const footprintMesh = new THREE.Mesh(footprintGeo, wallMat);
      footprintMesh.position.set(lx, ly + 1.1, lz);
      this.navDebugGroup.add(footprintMesh);

      const doorGeo = new THREE.BoxGeometry(1.4, 2.2, 1.4);
      const doorMesh = new THREE.Mesh(doorGeo, doorMat);
      doorMesh.position.set(lx, ly + 1.1, lz + hd);
      this.navDebugGroup.add(doorMesh);
    }
  }

  public getWorldCameraTarget(): { wx: number; wy: number; wz: number } {
    return {
      wx: Math.round(this.controls.target.x + this.originRebaseX),
      wy: Math.round(this.controls.target.y),
      wz: Math.round(this.controls.target.z + this.originRebaseZ),
    };
  }

  private checkFloatingOriginRebase() {
    if (
      Math.abs(this.controls.target.x) > 512 ||
      Math.abs(this.controls.target.z) > 512
    ) {
      const shiftX = Math.round(this.controls.target.x / CHUNK_SIZE) * CHUNK_SIZE;
      const shiftZ = Math.round(this.controls.target.z / CHUNK_SIZE) * CHUNK_SIZE;

      this.originRebaseX += shiftX;
      this.originRebaseZ += shiftZ;

      this.controls.target.x -= shiftX;
      this.controls.target.z -= shiftZ;
      this.camera.position.x -= shiftX;
      this.camera.position.z -= shiftZ;
      this.smoothTarget.x -= shiftX;
      this.smoothTarget.z -= shiftZ;
      this.smoothCamPos.x -= shiftX;
      this.smoothCamPos.z -= shiftZ;

      this.chunkGroup.position.set(-this.originRebaseX, 0, -this.originRebaseZ);
      this.chunkDebugGroup.position.set(-this.originRebaseX, 0, -this.originRebaseZ);
      if (this.cachedStructures.length > 0) {
        this.syncArchitecturalProps(this.cachedStructures);
      }
    }
  }

  public getZoomExpandedChunkRadius(): number {
    const camDist = this.camera.position.distanceTo(this.controls.target);
    return Math.max(
      this.expectedRenderDistance,
      Math.min(16, Math.ceil(camDist / 24) + 5)
    );
  }

  /**
   * Sub-block architectural props: flush doorway lintels, shutters, crates, and lanterns
   * (No floating angled roof rafters or floating ridge beams!)
   */
  public syncArchitecturalProps(structures: StructureMarker3D[]) {
    this.cachedStructures = structures;
    if (this.navDebugVisible) {
      this.rebuildNavDebugOverlay();
    }

    let lintelIdx = 0;
    let shutterIdx = 0;
    let crateIdx = 0;
    let lanternIdx = 0;

    const timberColor = new THREE.Color(0x4a301a);
    const stoneTrimColor = new THREE.Color(0x8c8f94);
    const shutterColor = new THREE.Color(0x2d4c3e);
    const crateColor = new THREE.Color(0x8d5b34);
    const fenceColor = new THREE.Color(0x5c3d24);
    const warmLanternColor = new THREE.Color(0xffb703);

    for (let i = 0; i < structures.length; i++) {
      const st = structures[i];
      if (!st.isComplete) continue;
      if (st.height <= 3) continue;

      const isPrimitive = st.era === 'Stone Age' || st.era === 'Neolithic Farming Age';
      if (isPrimitive) continue;

      const lx = st.x - this.originRebaseX;
      const ly = st.y;
      const lz = st.z - this.originRebaseZ;
      const hw = Math.max(2, Math.floor((st.width || 7) / 2));
      const hd = Math.max(2, Math.floor((st.depth || 7) / 2));

      // 1. Flush Window Shutters attached directly to side walls on Bronze Age+ buildings
      if (shutterIdx < MAX_ARCH_PROPS - 6) {
        for (const xSide of [-hw - 0.04, hw + 0.04]) {
          for (const zOff of [-1.0, 1.0]) {
            _pos.set(lx + xSide, ly + 1.85, lz + zOff);
            _euler.set(0, Math.PI * 0.5, 0);
            _quat.setFromEuler(_euler);
            _scale.set(1, 1, 1);
            _mat4.compose(_pos, _quat, _scale);
            this.archShutterInstanced.setMatrixAt(shutterIdx, _mat4);
            this.archShutterInstanced.setColorAt(shutterIdx, shutterColor);
            shutterIdx++;
          }
        }
      }

      // 2. Warm Doorway Eave Lanterns attached flush to the front doorway wall
      if (lanternIdx < MAX_ARCH_PROPS - 4) {
        for (const side of [-1.05, 1.05]) {
          _pos.set(lx + side, ly + 2.05, lz + hd + 0.12);
          _euler.set(0, 0, 0);
          _quat.setFromEuler(_euler);
          _scale.set(0.8, 0.8, 0.8);
          _mat4.compose(_pos, _quat, _scale);
          this.archLanternInstanced.setMatrixAt(lanternIdx, _mat4);
          this.archLanternInstanced.setColorAt(lanternIdx, warmLanternColor);
          lanternIdx++;
        }
      }
    }

    // Zero floating rafters, lintel sticks, or detached fence posts!
    this.archRafterInstanced.count = 0;
    this.archLintelInstanced.count = lintelIdx;
    this.archShutterInstanced.count = shutterIdx;
    this.archCrateFenceInstanced.count = crateIdx;
    this.archLanternInstanced.count = lanternIdx;

    for (const mesh of [
      this.archRafterInstanced,
      this.archLintelInstanced,
      this.archShutterInstanced,
      this.archCrateFenceInstanced,
      this.archLanternInstanced,
    ]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  public syncVehicles(vehicles: VehicleMarker3D[]) {
    this.cachedVehicles = vehicles;
  }

  public syncAnimals(animals: AnimalMarker3D[]) {
    this.cachedAnimals = animals;
  }

  /**
   * Part 4 (Item 12): 3D Instanced Wildlife Animation with 60 FPS Client-Side Interpolation
   */
  private updateAnimalsFrame(dtMs = 16.6) {
    const animals = this.cachedAnimals;
    if (!animals || animals.length === 0) {
      this.animalBodyInstanced.count = 0;
      this.animalHeadInstanced.count = 0;
      this.animalLimbInstanced.count = 0;
      return;
    }

    let bodyIdx = 0;
    let headIdx = 0;
    let limbIdx = 0;
    const t = this.waterTimeUniform.value;
    const lerpT = Math.min(1, dtMs * 0.018);

    for (let i = 0; i < animals.length && bodyIdx < MAX_ANIMALS; i++) {
      const a = animals[i];
      let rs = this.animalRenderState.get(a.id);
      if (!rs || Math.hypot(a.x - rs.x, a.z - rs.z) > 16) {
        rs = { x: a.x, y: a.y, z: a.z, facing: a.facing };
        this.animalRenderState.set(a.id, rs);
      } else {
        rs.x += (a.x - rs.x) * lerpT;
        rs.y += (a.y - rs.y) * lerpT;
        rs.z += (a.z - rs.z) * lerpT;
        rs.facing = lerpAngleShortest(rs.facing, a.facing, lerpT);
      }

      const cKey = `${Math.floor(rs.x / CHUNK_SIZE)},${Math.floor(rs.z / CHUNK_SIZE)}`;
      if (!this.chunkMeshes.has(cKey)) {
        continue;
      }

      const lx = rs.x - this.originRebaseX;
      const lz = rs.z - this.originRebaseZ;
      const s = a.scale || 1.0;
      const sinF = Math.sin(rs.facing);
      const cosF = Math.cos(rs.facing);
      const isBird = a.domain === 'Bird';
      const isWater = a.domain === 'Water';

      const hop =
        a.state === 'Roaming' || a.state === 'Fleeing' || a.state === 'Hunting'
          ? Math.abs(Math.sin(t * 6.5 + a.id)) * 0.12 * s
          : isBird
          ? Math.sin(t * 3.8 + a.id) * 0.35
          : isWater
          ? Math.sin(t * 2.6 + a.id) * 0.08
          : 0;

      const ly = rs.y + hop + (isWater ? -0.15 : 0.32 * s);

      // 1. Body
      _pos.set(lx, ly, lz);
      _euler.set(0, rs.facing, isBird ? Math.sin(t * 4.2 + a.id) * 0.12 : 0);
      _quat.setFromEuler(_euler);
      if (a.species === 'Whale') {
        _scale.set(2.1 * s, 1.4 * s, 3.2 * s);
      } else if (a.species === 'FishSchool') {
        _scale.set(0.42 * s, 0.28 * s, 0.65 * s);
      } else if (isBird) {
        _scale.set(0.45 * s, 0.35 * s, 0.65 * s);
      } else {
        _scale.set(s, s, s);
      }
      _mat4.compose(_pos, _quat, _scale);
      this.animalBodyInstanced.setMatrixAt(bodyIdx, _mat4);
      _color.set(a.colorHex);
      this.animalBodyInstanced.setColorAt(bodyIdx, _color);
      bodyIdx++;

      // 2. Head
      if (headIdx < MAX_ANIMALS) {
        const grazePitch = a.state === 'Grazing' ? 0.55 : 0;
        const headDist = (a.species === 'Whale' ? 1.5 : 0.48) * s;
        _pos.set(
          lx + sinF * headDist,
          ly + (a.state === 'Grazing' ? -0.05 : 0.22 * s),
          lz + cosF * headDist
        );
        _euler.set(grazePitch, rs.facing, 0);
        _quat.setFromEuler(_euler);
        _scale.set(s, s, s);
        _mat4.compose(_pos, _quat, _scale);
        this.animalHeadInstanced.setMatrixAt(headIdx, _mat4);
        this.animalHeadInstanced.setColorAt(headIdx, _color);
        headIdx++;
      }

      // 3. Limbs (4 legs for land animals, 2 flapping wings for birds)
      if (isBird && limbIdx < MAX_ANIMALS * 4 - 2) {
        const wingFlap = Math.sin(t * 9.5 + a.id * 2.1) * 0.65;
        for (const side of [-1, 1]) {
          _pos.set(lx + cosF * side * 0.36 * s, ly + 0.05, lz - sinF * side * 0.36 * s);
          _euler.set(0, rs.facing, side * (0.9 + wingFlap));
          _quat.setFromEuler(_euler);
          _scale.set(2.4 * s, 0.35 * s, 1.4 * s);
          _mat4.compose(_pos, _quat, _scale);
          this.animalLimbInstanced.setMatrixAt(limbIdx, _mat4);
          this.animalLimbInstanced.setColorAt(limbIdx, _color);
          limbIdx++;
        }
      } else if (!isWater && limbIdx < MAX_ANIMALS * 4 - 4) {
        const strideSwing =
          a.state === 'Roaming' || a.state === 'Fleeing' || a.state === 'Hunting'
            ? Math.sin(t * 8.0 + a.id) * 0.55
            : 0;
        const legOffsets: [number, number, number][] = [
          [-0.2, 0.28, strideSwing],
          [0.2, 0.28, -strideSwing],
          [-0.2, -0.28, -strideSwing],
          [0.2, -0.28, strideSwing],
        ];
        for (const [ox, oz, pitch] of legOffsets) {
          const rx = lx + (cosF * ox + sinF * oz) * s;
          const rz = lz + (-sinF * ox + cosF * oz) * s;
          _pos.set(rx, ly - 0.24 * s, rz);
          _euler.set(pitch, rs.facing, 0);
          _quat.setFromEuler(_euler);
          _scale.set(s, s, s);
          _mat4.compose(_pos, _quat, _scale);
          this.animalLimbInstanced.setMatrixAt(limbIdx, _mat4);
          this.animalLimbInstanced.setColorAt(limbIdx, _color);
          limbIdx++;
        }
      }
    }

    this.animalBodyInstanced.count = bodyIdx;
    this.animalHeadInstanced.count = headIdx;
    this.animalLimbInstanced.count = limbIdx;

    for (const mesh of [
      this.animalBodyInstanced,
      this.animalHeadInstanced,
      this.animalLimbInstanced,
    ]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private updateVehiclesFrame(dtMs = 16.6) {
    const vehicles = this.cachedVehicles;
    if (!vehicles || vehicles.length === 0) {
      this.vehicleHullInstanced.count = 0;
      this.vehicleWheelInstanced.count = 0;
      this.vehicleSailOrCabInstanced.count = 0;
      this.vehicleRiderTorsoInstanced.count = 0;
      this.vehicleRiderHeadInstanced.count = 0;
      return;
    }

    let hullIdx = 0;
    let wheelIdx = 0;
    let sailIdx = 0;
    let riderIdx = 0;
    const t = this.waterTimeUniform.value;
    const lerpT = Math.min(1, dtMs * 0.018);

    const woodColor = new THREE.Color(0x6e4726);
    const darkWoodColor = new THREE.Color(0x3d2514);
    const sailCanvasColor = new THREE.Color(0xf8f4e8);
    const brassSteelColor = new THREE.Color(0x334155);
    const oxDraftColor = new THREE.Color(0x7c4a27);

    for (let i = 0; i < vehicles.length && hullIdx < MAX_VEHICLES; i++) {
      const v = vehicles[i];
      let rs = this.vehicleRenderState.get(v.id);
      if (!rs || Math.hypot(v.x - rs.x, v.z - rs.z) > 16) {
        rs = { x: v.x, y: v.y, z: v.z, facing: v.facing };
        this.vehicleRenderState.set(v.id, rs);
      } else {
        rs.x += (v.x - rs.x) * lerpT;
        rs.y += (v.y - rs.y) * lerpT;
        rs.z += (v.z - rs.z) * lerpT;
        rs.facing = lerpAngleShortest(rs.facing, v.facing, lerpT);
      }

      const cKey = `${Math.floor(rs.x / CHUNK_SIZE)},${Math.floor(rs.z / CHUNK_SIZE)}`;
      if (!this.chunkMeshes.has(cKey)) {
        continue;
      }

      const lx = rs.x - this.originRebaseX;
      const lz = rs.z - this.originRebaseZ;
      const isWater =
        v.type === 'LogRaft' ||
        v.type === 'DugoutCanoe' ||
        v.type === 'Sailboat' ||
        v.type === 'Longship' ||
        v.type === 'Galley' ||
        v.type === 'CaravelShip' ||
        v.type === 'Steamship';

      const bobY = isWater
        ? Math.sin(t * 2.4 + v.id) * 0.06
        : Math.abs(Math.sin(t * 5.0 + v.id)) * 0.025;
      const roll = isWater ? Math.sin(t * 1.9 + v.id) * 0.05 : 0;
      const ly = rs.y + bobY;

      const sinF = Math.sin(rs.facing);
      const cosF = Math.cos(rs.facing);

      // 1. Main Hull / Chassis
      _pos.set(lx, ly + (isWater ? 0.18 : 0.38), lz);
      _euler.set(0, rs.facing, roll);
      _quat.setFromEuler(_euler);
      if (v.type === 'CaravelShip' || v.type === 'Steamship' || v.type === 'Galley') {
        _scale.set(1.45, 0.95, 1.85);
      } else if (v.type === 'Sailboat' || v.type === 'Longship') {
        _scale.set(1.15, 0.75, 1.55);
      } else if (v.type === 'DugoutCanoe' || v.type === 'LogRaft') {
        _scale.set(0.95, 0.42, 1.25);
      } else if (v.type === 'SteamCar') {
        _scale.set(1.05, 0.65, 1.25);
      } else {
        _scale.set(0.95, 0.55, 1.15);
      }
      _mat4.compose(_pos, _quat, _scale);
      this.vehicleHullInstanced.setMatrixAt(hullIdx, _mat4);
      this.vehicleHullInstanced.setColorAt(
        hullIdx,
        v.type === 'SteamCar' || v.type === 'Steamship' ? brassSteelColor : woodColor
      );
      hullIdx++;

      // 2. Visible Human Driver / Sailor aboard EVERY vehicle & boat!
      if (riderIdx < MAX_VEHICLES) {
        const riderFwdOff = isWater ? -0.35 : 0.25;
        const rx = lx + sinF * riderFwdOff;
        const rz = lz + cosF * riderFwdOff;
        const ry = ly + (isWater ? 0.68 : 0.92);

        _pos.set(rx, ry, rz);
        _euler.set(0, rs.facing, roll);
        _quat.setFromEuler(_euler);
        _scale.set(1, 1, 1);
        _mat4.compose(_pos, _quat, _scale);
        this.vehicleRiderTorsoInstanced.setMatrixAt(riderIdx, _mat4);
        _color.set(v.colorHex || '#8b5e3c');
        this.vehicleRiderTorsoInstanced.setColorAt(riderIdx, _color);

        _pos.set(rx, ry + 0.56, rz);
        _mat4.compose(_pos, _quat, _scale);
        this.vehicleRiderHeadInstanced.setMatrixAt(riderIdx, _mat4);
        this.vehicleRiderHeadInstanced.setColorAt(riderIdx, _skinColor);
        riderIdx++;
      }

      if (isWater) {
        // Raised prow/bow + stern gunwale rails so boats look like 3D vessels
        if (sailIdx < MAX_VEHICLES * 4 - 3) {
          _pos.set(lx + sinF * 1.15, ly + 0.48, lz + cosF * 1.15);
          _euler.set(-0.35, rs.facing, roll);
          _quat.setFromEuler(_euler);
          _scale.set(0.55, 0.45, 0.65);
          _mat4.compose(_pos, _quat, _scale);
          this.vehicleSailOrCabInstanced.setMatrixAt(sailIdx, _mat4);
          this.vehicleSailOrCabInstanced.setColorAt(sailIdx, darkWoodColor);
          sailIdx++;
        }

        if (
          v.type !== 'LogRaft' &&
          v.type !== 'DugoutCanoe' &&
          sailIdx < MAX_VEHICLES * 4 - 2
        ) {
          // Mast pole
          _pos.set(lx + sinF * 0.15, ly + 1.25, lz + cosF * 0.15);
          _euler.set(0, rs.facing, roll);
          _quat.setFromEuler(_euler);
          _scale.set(0.16, 1.45, 0.18);
          _mat4.compose(_pos, _quat, _scale);
          this.vehicleSailOrCabInstanced.setMatrixAt(sailIdx, _mat4);
          this.vehicleSailOrCabInstanced.setColorAt(sailIdx, darkWoodColor);
          sailIdx++;

          // Billowing Canvas Sail or Smokestack
          _pos.set(lx + sinF * 0.28, ly + 1.42, lz + cosF * 0.28);
          _euler.set(0.08, rs.facing, roll);
          _quat.setFromEuler(_euler);
          _scale.set(
            v.type === 'CaravelShip' ? 1.55 : v.type === 'Steamship' ? 0.42 : 1.25,
            v.type === 'Steamship' ? 1.15 : 1.15,
            v.type === 'Steamship' ? 0.48 : 0.22
          );
          _mat4.compose(_pos, _quat, _scale);
          this.vehicleSailOrCabInstanced.setMatrixAt(sailIdx, _mat4);
          _color.set(
            v.type === 'Steamship' ? '#334155' : sailCanvasColor
          );
          this.vehicleSailOrCabInstanced.setColorAt(sailIdx, _color);
          sailIdx++;
        }
      } else {
        const wheelOffsets: [number, number][] = [
          [-0.58, 0.65],
          [0.58, 0.65],
          [-0.58, -0.65],
          [0.58, -0.65],
        ];
        for (const [wxOff, wzOff] of wheelOffsets) {
          if (wheelIdx >= MAX_VEHICLES * 4) break;
          const rx = lx + cosF * wxOff + sinF * wzOff;
          const rz = lz - sinF * wxOff + cosF * wzOff;
          _pos.set(rx, ly + 0.28, rz);
          _euler.set(t * 3.5, rs.facing, 0);
          _quat.setFromEuler(_euler);
          _scale.set(1, 1, 1);
          _mat4.compose(_pos, _quat, _scale);
          this.vehicleWheelInstanced.setMatrixAt(wheelIdx, _mat4);
          this.vehicleWheelInstanced.setColorAt(wheelIdx, darkWoodColor);
          wheelIdx++;
        }

        if (sailIdx < MAX_VEHICLES * 4 - 2) {
          if (v.type === 'HorseCarriage' || v.type === 'SteamCar') {
            _pos.set(lx - sinF * 0.2, ly + 0.88, lz - cosF * 0.2);
            _euler.set(0, rs.facing, 0);
            _quat.setFromEuler(_euler);
            _scale.set(0.88, 0.58, 0.85);
            _mat4.compose(_pos, _quat, _scale);
            this.vehicleSailOrCabInstanced.setMatrixAt(sailIdx, _mat4);
            _color.set(v.colorHex);
            this.vehicleSailOrCabInstanced.setColorAt(sailIdx, _color);
            sailIdx++;
          }
          if (
            (v.type === 'OxCart' || v.type === 'HorseCarriage') &&
            sailIdx < MAX_VEHICLES * 4
          ) {
            _pos.set(lx + sinF * 1.75, ly + 0.48, lz + cosF * 1.75);
            _euler.set(0, rs.facing, 0);
            _quat.setFromEuler(_euler);
            _scale.set(0.55, 0.55, 0.95);
            _mat4.compose(_pos, _quat, _scale);
            this.vehicleSailOrCabInstanced.setMatrixAt(sailIdx, _mat4);
            this.vehicleSailOrCabInstanced.setColorAt(sailIdx, oxDraftColor);
            sailIdx++;
          }
        }
      }
    }

    this.vehicleHullInstanced.count = hullIdx;
    this.vehicleWheelInstanced.count = wheelIdx;
    this.vehicleSailOrCabInstanced.count = sailIdx;
    this.vehicleRiderTorsoInstanced.count = riderIdx;
    this.vehicleRiderHeadInstanced.count = riderIdx;

    for (const mesh of [
      this.vehicleHullInstanced,
      this.vehicleWheelInstanced,
      this.vehicleSailOrCabInstanced,
      this.vehicleRiderTorsoInstanced,
      this.vehicleRiderHeadInstanced,
    ]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  public startFlyFarDistanceTest(onStep?: (wx: number, wz: number) => void) {
    const startTarget = this.getWorldCameraTarget();
    let step = 0;
    const totalSteps = 20;
    const timer = window.setInterval(() => {
      if (this.isDisposed || step >= totalSteps) {
        clearInterval(timer);
        return;
      }
      step++;
      const nextWx = startTarget.wx + step * 34;
      const nextWz = startTarget.wz + step * 22;
      const col = sampleColumn(nextWx, nextWz, this.currentSeedNum);
      this.jumpCameraTo(nextWx, Math.max(WATER_LEVEL + 2, col.height), nextWz);
      if (onStep) onStep(nextWx, nextWz);
    }, 180);
  }

  public spawnFallingVoxelParticles(particles: FallingVoxelParticle[]) {
    for (const p of particles) {
      if (this.fallingDebrisCubes.length >= 120) break;
      const mat = new THREE.MeshBasicMaterial({
        color: p.colorHex,
        transparent: true,
        opacity: 0.92,
      });
      const mesh = new THREE.Mesh(this.sharedDebrisGeo, mat);
      mesh.position.set(
        p.x - this.originRebaseX + (Math.random() - 0.5) * 0.4,
        p.y,
        p.z - this.originRebaseZ + (Math.random() - 0.5) * 0.4
      );
      this.fxGroup.add(mesh);
      this.fallingDebrisCubes.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.08 - Math.random() * 0.08,
        vz: (Math.random() - 0.5) * 0.08,
        age: 0,
        maxAge: 34 + Math.floor(Math.random() * 16),
      });
    }
  }

  public setWorldContext(seedNum: number, renderDistance: number) {
    this.currentSeedNum = seedNum;
    this.expectedRenderDistance = renderDistance;
  }

  public setQualityPreset(preset: QualityPreset) {
    this.qualityPreset = preset;
    if (preset !== 'Auto') {
      this.applyEffectiveQuality(preset);
    }
  }

  private applyEffectiveQuality(q: 'Low' | 'Medium' | 'High' | 'Ultra') {
    if (this.effectiveQuality === q || this.isSoftwareGl) return;
    this.effectiveQuality = q;

    const dpr = window.devicePixelRatio || 1;
    if (q === 'Low') {
      this.renderer.setPixelRatio(1.0);
      this.shadowUpdateInterval = 3;
      this.weatherPoints.visible = false;
    } else if (q === 'Medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.25));
      this.shadowUpdateInterval = 2;
      this.weatherPoints.visible = true;
    } else if (q === 'High') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.65));
      this.shadowUpdateInterval = 1;
      this.weatherPoints.visible = true;
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2.0));
      this.shadowUpdateInterval = 1;
      this.weatherPoints.visible = true;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  public setShadowDebugVisible(visible: boolean) {
    this.shadowDebugVisible = visible;
    this.shadowCameraHelper.visible = visible;
  }

  public setChunkDebugVisible(visible: boolean) {
    this.chunkDebugVisible = visible;
    this.chunkDebugGroup.visible = visible;
  }

  public getPerfStats(): RendererPerfStats {
    const info = this.renderer.info;
    return {
      fps: Math.round(this.smoothedFps),
      frameMs: Number(this.smoothedFrameMs.toFixed(1)),
      renderMs: Number(this.lastRenderMs.toFixed(2)),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      activeChunks: this.chunkMeshes.size,
      pendingMeshJobs: this.pendingMeshQueue.size + this.inFlightMeshKeys.size,
      shadowMapSize: this.sunLight.shadow.mapSize.width,
      shadowFrustumSize: Math.round(this.shadowExtent * 2),
      sunIntensity: Number(this.sunLight.intensity.toFixed(2)),
      ambientIntensity: Number(
        (this.hemiLight.intensity + this.fillLight.intensity).toFixed(2)
      ),
      originRebaseX: this.originRebaseX,
      originRebaseZ: this.originRebaseZ,
      qualityPreset:
        this.qualityPreset === 'Auto'
          ? (`Auto (${this.effectiveQuality})` as unknown as QualityPreset)
          : this.qualityPreset,
    };
  }

  public setDynamicCycle(enabled: boolean) {
    this.dynamicCycleEnabled = enabled;
    this.renderer.shadowMap.needsUpdate = true;
  }

  public setActiveGodPowerCursor(colorHex: string | null) {
    this.activeGodPowerColor = colorHex;
    if (colorHex) {
      (this.targetRing.material as THREE.MeshBasicMaterial).color.set(colorHex);
      this.targetRing.visible = true;
    } else {
      this.targetRing.visible = false;
    }
  }

  public spawnDivineBurst(wx: number, wy: number, wz: number, colorHex: string) {
    const geo = new THREE.SphereGeometry(1.2, 16, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(wx - this.originRebaseX, wy + 1.5, wz - this.originRebaseZ);
    this.fxGroup.add(mesh);
    this.activeBursts.push({ mesh, age: 0, maxAge: 35 });
  }

  public jumpCameraTo(wx: number, wy: number, wz: number) {
    this.followedAgentId = null;
    if (this.cameraMode === 'follow' || this.cameraMode === 'cinematic') {
      this.cameraMode = 'orbit';
    }
    const lx = wx - this.originRebaseX;
    const lz = wz - this.originRebaseZ;
    this.smoothTarget.set(lx, Math.max(12, wy), lz);
    this.smoothCamPos.set(lx + 28, Math.max(28, wy + 22), lz + 28);
    this.isTransitioningCamera = true;
    this.onCameraChunkCenterChanged(wx, wz, this.getZoomExpandedChunkRadius());
  }

  public projectWorldToScreen(
    wx: number,
    wy: number,
    wz: number,
    checkOcclusion = false
  ): {
    x: number;
    y: number;
    visible: boolean;
    distance: number;
    centerDistNdc: number;
  } {
    const lx = wx - this.originRebaseX;
    const lz = wz - this.originRebaseZ;
    _projVec.set(lx, wy, lz);
    const distance = this.camera.position.distanceTo(_projVec);
    _projVec.project(this.camera);
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const centerDistNdc = Math.hypot(_projVec.x, _projVec.y);
    let visible =
      _projVec.z >= -1 &&
      _projVec.z <= 1 &&
      Math.abs(_projVec.x) <= 0.96 &&
      Math.abs(_projVec.y) <= 0.94;

    if (visible && checkOcclusion && this.chunkGroup.children.length > 0) {
      _pos.set(lx, wy, lz);
      _rayDir.subVectors(_pos, this.camera.position).normalize();
      this.raycaster.set(this.camera.position, _rayDir);
      this.raycaster.far = Math.max(1, distance - 3.5);
      const hits = this.raycaster.intersectObjects(this.chunkGroup.children, false);
      if (hits.length > 0) {
        visible = false;
      }
      this.raycaster.far = Infinity;
    }

    return {
      x: (_projVec.x * 0.5 + 0.5) * w,
      y: (-(_projVec.y * 0.5) + 0.5) * h,
      visible,
      distance,
      centerDistNdc,
    };
  }

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
      this.pendingMeshQueue.clear();
      this.inFlightMeshKeys.clear();
      this.unloadChunks(Array.from(this.chunkMeshes.keys()), true);
      this.originRebaseX = 0;
      this.originRebaseZ = 0;
      this.chunkGroup.position.set(0, 0, 0);
      this.chunkDebugGroup.position.set(0, 0, 0);
      this.floraStemInstanced.count = 0;
      this.floraBloomInstanced.count = 0;
      this.floraSlotWriteIdx = 0;
    }

    for (const c of chunks) {
      this.pendingMeshQueue.set(c.key, {
        ...c,
        lod: 0,
        seedNum: c.seedNum ?? this.currentSeedNum,
      });
    }

    this.flushMeshQueue();
  }

  private flushMeshQueue() {
    if (this.pendingMeshQueue.size === 0 || this.meshWorkers.length === 0) return;

    const maxInFlight = 96;
    if (this.inFlightMeshKeys.size >= maxInFlight) return;

    const camCx = (this.controls.target.x + this.originRebaseX) / CHUNK_SIZE;
    const camCz = (this.controls.target.z + this.originRebaseZ) / CHUNK_SIZE;
    // Predictive lookahead point in the direction of camera motion so chunks ahead stream first
    const leadCx = camCx + Math.max(-8, Math.min(8, this.camVelX * 0.35));
    const leadCz = camCz + Math.max(-8, Math.min(8, this.camVelZ * 0.35));
    const maxHorizonR = this.isSoftwareGl ? 24 : 38;
    const maxDistSq = (maxHorizonR + 6) * (maxHorizonR + 6);

    // Prune stale queued chunks left far behind as the user flies across the world
    this.pendingMeshQueue.forEach((item, key) => {
      const dSq = (item.cx + 0.5 - camCx) ** 2 + (item.cz + 0.5 - camCz) ** 2;
      if (dSq > maxDistSq) {
        this.pendingMeshQueue.delete(key);
      }
    });

    const sorted = Array.from(this.pendingMeshQueue.values()).sort((a, b) => {
      const da = (a.cx + 0.5 - leadCx) ** 2 + (a.cz + 0.5 - leadCz) ** 2;
      const db = (b.cx + 0.5 - leadCx) ** 2 + (b.cz + 0.5 - leadCz) ** 2;
      return da - db;
    });

    while (this.inFlightMeshKeys.size < maxInFlight && sorted.length > 0) {
      const next = sorted.shift()!;
      this.pendingMeshQueue.delete(next.key);
      this.inFlightMeshKeys.add(next.key);

      // Always mesh at full 1x1 voxel detail (lod = 0) with fast surface-only meshing
      const req: MeshChunkRequest = {
        type: 'MESH_CHUNK',
        key: next.key,
        cx: next.cx,
        cz: next.cz,
        lod: 0,
        revision: next.revision,
        seedNum: next.seedNum || this.currentSeedNum,
        voxels: next.voxels,
      };
      const transfer = next.voxels.byteLength > 0 ? [next.voxels.buffer] : [];
      const worker = this.meshWorkers[this.nextWorkerIdx % this.meshWorkers.length];
      this.nextWorkerIdx++;
      worker.postMessage(req, transfer);
    }
  }

  public unloadChunks(keys: string[], forceImmediate = false) {
    const camCx = (this.controls.target.x + this.originRebaseX) / CHUNK_SIZE;
    const camCz = (this.controls.target.z + this.originRebaseZ) / CHUNK_SIZE;
    const maxHorizonRadius = this.isSoftwareGl ? 24 : 40;

    for (const key of keys) {
      const entry = this.chunkMeshes.get(key);
      if (!forceImmediate && entry) {
        const dist = Math.hypot(entry.cx + 0.5 - camCx, entry.cz + 0.5 - camCz);
        if (dist <= maxHorizonRadius) {
          continue;
        }
      }
      this.pendingMeshQueue.delete(key);
      if (entry) {
        if (entry.opaque) {
          this.chunkGroup.remove(entry.opaque);
          entry.opaque.geometry.dispose();
        }
        if (entry.water) {
          this.chunkGroup.remove(entry.water);
          entry.water.geometry.dispose();
        }
        if (entry.debugBox) {
          this.chunkDebugGroup.remove(entry.debugBox);
          entry.debugBox.geometry.dispose();
        }
        this.chunkMeshes.delete(key);
      }
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  private applyMeshedChunk(res: MeshChunkResponse) {
    if (this.isDisposed) return;

    const existing = this.chunkMeshes.get(res.key);
    if (existing && existing.lod === 0 && existing.revision >= 1 && res.revision === 0) {
      return;
    }
    const isFirstLod0 = !existing || existing.lod !== 0;
    if (existing) {
      if (existing.opaque) {
        this.chunkGroup.remove(existing.opaque);
        existing.opaque.geometry.dispose();
      }
      if (existing.water) {
        this.chunkGroup.remove(existing.water);
        existing.water.geometry.dispose();
      }
      if (existing.debugBox) {
        this.chunkDebugGroup.remove(existing.debugBox);
        existing.debugBox.geometry.dispose();
      }
    }

    let opaqueMesh: THREE.Mesh | undefined;
    if (res.opaquePositions.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(res.opaquePositions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(res.opaqueNormals, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(res.opaqueColors, 3));
      if (res.opaqueUvs && res.opaqueUvs.length > 0) {
        geo.setAttribute('uv', new THREE.BufferAttribute(res.opaqueUvs, 2));
      }
      geo.setIndex(new THREE.BufferAttribute(res.opaqueIndices, 1));
      geo.computeBoundingSphere();

      opaqueMesh = new THREE.Mesh(geo, this.opaqueMaterial);
      opaqueMesh.castShadow = !this.isSoftwareGl;
      opaqueMesh.receiveShadow = !this.isSoftwareGl;
      this.chunkGroup.add(opaqueMesh);
    }

    let waterMesh: THREE.Mesh | undefined;
    if (res.waterPositions.length > 0) {
      const wGeo = new THREE.BufferGeometry();
      wGeo.setAttribute('position', new THREE.BufferAttribute(res.waterPositions, 3));
      wGeo.setAttribute('normal', new THREE.BufferAttribute(res.waterNormals, 3));
      wGeo.setAttribute('color', new THREE.BufferAttribute(res.waterColors, 3));
      wGeo.setIndex(new THREE.BufferAttribute(res.waterIndices, 1));
      wGeo.computeBoundingSphere();

      waterMesh = new THREE.Mesh(wGeo, this.waterMaterial);
      waterMesh.renderOrder = 1;
      this.chunkGroup.add(waterMesh);
    }

    let debugBox: THREE.LineSegments | undefined;
    if (res.lod === 0) {
      const boxGeo = new THREE.BoxGeometry(CHUNK_SIZE, 64, CHUNK_SIZE);
      const edgesGeo = new THREE.EdgesGeometry(boxGeo);
      boxGeo.dispose();
      debugBox = new THREE.LineSegments(edgesGeo, this.chunkDebugMaterial);
      debugBox.position.set(
        res.cx * CHUNK_SIZE + CHUNK_SIZE * 0.5,
        32,
        res.cz * CHUNK_SIZE + CHUNK_SIZE * 0.5
      );
      this.chunkDebugGroup.add(debugBox);

      // Populate 3D sub-block wildflowers & grass tufts on natural meadow/plains/forest tiles
      if (isFirstLod0) {
        this.populateChunkWildflowers(res.cx, res.cz);
      }
    }

    this.chunkMeshes.set(res.key, {
      opaque: opaqueMesh,
      water: waterMesh,
      debugBox,
      cx: res.cx,
      cz: res.cz,
      lod: res.lod,
      revision: res.revision,
    });

    this.renderer.shadowMap.needsUpdate = true;
  }

  private populateChunkWildflowers(cx: number, cz: number) {
    const stemColors = [0x2d6a32, 0x3b7a3e, 0x255829];
    const bloomColors = [0xef4444, 0xfacc15, 0xa855f7, 0xf97316, 0xec4899, 0x38bdf8];
    let added = false;

    // Organic quasi-random wildflower scatter (no grid stepping or square cell cutouts)
    const candidateCount = 7;
    for (let i = 0; i < candidateCount; i++) {
      let h = Math.imul(cx * 37 + i * 13, 0x9e3779b1) ^ Math.imul(cz * 53 - i * 19, 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35 + this.currentSeedNum);
      h = (h ^ (h >>> 13)) >>> 0;
      if ((h % 100) > 42) continue;

      const lx = 1 + ((h >>> 4) % (CHUNK_SIZE - 2));
      const lz = 1 + ((h >>> 9) % (CHUNK_SIZE - 2));
      const wx = cx * CHUNK_SIZE + lx;
      const wz = cz * CHUNK_SIZE + lz;

      const col = sampleColumn(wx, wz, this.currentSeedNum);
      if (col.height <= WATER_LEVEL + 1 || col.isRiver || col.slope >= 1.1) continue;
      const bStr = String(col.biome);
      if (bStr !== 'Meadow' && bStr !== 'Plains' && !bStr.includes('Forest')) {
        continue;
      }

      const slot = this.floraSlotWriteIdx % MAX_FLORA;
      this.floraSlotWriteIdx++;
      if (this.floraStemInstanced.count < MAX_FLORA) {
        this.floraStemInstanced.count = Math.min(MAX_FLORA, this.floraSlotWriteIdx);
        this.floraBloomInstanced.count = Math.min(MAX_FLORA, this.floraSlotWriteIdx);
      }

      const jx = (((h >>> 14) & 31) / 31 - 0.5) * 0.78;
      const jz = (((h >>> 19) & 31) / 31 - 0.5) * 0.78;
      _pos.set(wx + 0.5 + jx, col.height + 1.0, wz + 0.5 + jz);
      _euler.set(0, (h % 628) * 0.01, 0);
      _quat.setFromEuler(_euler);
      const s = 0.75 + ((h >>> 24) & 7) * 0.05;
      _scale.set(s, s, s);
      _mat4.compose(_pos, _quat, _scale);

      this.floraStemInstanced.setMatrixAt(slot, _mat4);
      _color.setHex(stemColors[h % stemColors.length]);
      this.floraStemInstanced.setColorAt(slot, _color);

      this.floraBloomInstanced.setMatrixAt(slot, _mat4);
      _color.setHex(bloomColors[(h >>> 3) % bloomColors.length]);
      this.floraBloomInstanced.setColorAt(slot, _color);
      added = true;
    }

    if (added) {
      this.floraStemInstanced.instanceMatrix.needsUpdate = true;
      if (this.floraStemInstanced.instanceColor) {
        this.floraStemInstanced.instanceColor.needsUpdate = true;
      }
      this.floraBloomInstanced.instanceMatrix.needsUpdate = true;
      if (this.floraBloomInstanced.instanceColor) {
        this.floraBloomInstanced.instanceColor.needsUpdate = true;
      }
    }
  }

  private scheduleFarLodHorizonChunks(now: number) {
    if (now - this.lastFarLodSweepTime < 18) return;
    this.lastFarLodSweepTime = now;

    const centerCx = Math.floor(
      (this.controls.target.x + this.originRebaseX) / CHUNK_SIZE +
        Math.max(-6, Math.min(6, this.camVelX * 0.28))
    );
    const centerCz = Math.floor(
      (this.controls.target.z + this.originRebaseZ) / CHUNK_SIZE +
        Math.max(-6, Math.min(6, this.camVelZ * 0.28))
    );

    const maxHorizonR = this.isSoftwareGl ? 22 : 34;
    const unloadBeyondR = maxHorizonR + 8;

    const toPrune: string[] = [];
    this.chunkMeshes.forEach((entry, key) => {
      const d = Math.hypot(entry.cx - centerCx, entry.cz - centerCz);
      if (d > unloadBeyondR) {
        toPrune.push(key);
      }
    });
    if (toPrune.length > 0) {
      this.unloadChunks(toPrune, true);
    }

    let queued = 0;
    const maxQueueBatch = 160;
    for (let ring = 0; ring <= maxHorizonR && queued < maxQueueBatch; ring++) {
      for (let dz = -ring; dz <= ring && queued < maxQueueBatch; dz++) {
        for (let dx = -ring; dx <= ring && queued < maxQueueBatch; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          if (dx * dx + dz * dz > maxHorizonR * maxHorizonR) continue;

          const cx = centerCx + dx;
          const cz = centerCz + dz;
          const key = `${cx},${cz}`;
          if (
            this.chunkMeshes.has(key) ||
            this.pendingMeshQueue.has(key) ||
            this.inFlightMeshKeys.has(key)
          ) {
            continue;
          }

          this.pendingMeshQueue.set(key, {
            key,
            cx,
            cz,
            lod: 0,
            seedNum: this.currentSeedNum,
            revision: 0,
            voxels: new Uint8Array(0),
          });
          queued++;
        }
      }
    }

    if (queued > 0 || this.pendingMeshQueue.size > 0) {
      this.flushMeshQueue();
    }
  }

  private runMissingChunkWatchdog(now: number) {
    this.scheduleFarLodHorizonChunks(now);

    if (now - this.lastChunkWatchdogTime < 140 || !this.onRequestMissingChunks) {
      return;
    }
    this.lastChunkWatchdogTime = now;

    const centerCx = Math.floor(
      (this.controls.target.x + this.originRebaseX) / CHUNK_SIZE +
        Math.max(-5, Math.min(5, this.camVelX * 0.25))
    );
    const centerCz = Math.floor(
      (this.controls.target.z + this.originRebaseZ) / CHUNK_SIZE +
        Math.max(-5, Math.min(5, this.camVelZ * 0.25))
    );
    const r = Math.min(14, Math.max(6, this.getZoomExpandedChunkRadius()));
    const missing: { cx: number; cz: number }[] = [];

    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r + 1) continue;
        const cx = centerCx + dx;
        const cz = centerCz + dz;
        const key = `${cx},${cz}`;
        const existing = this.chunkMeshes.get(key);
        if (
          (!existing || existing.lod !== 0) &&
          !this.pendingMeshQueue.has(key) &&
          !this.inFlightMeshKeys.has(key)
        ) {
          missing.push({ cx, cz });
        }
      }
    }

    if (missing.length > 0) {
      missing.sort((a, b) => {
        const da = (a.cx - centerCx) ** 2 + (a.cz - centerCz) ** 2;
        const db = (b.cx - centerCx) ** 2 + (b.cz - centerCz) ** 2;
        return da - db;
      });
      this.onRequestMissingChunks(missing.slice(0, 48));
    }
  }

  /**
   * Updates all 11 articulated body parts.
   * Part 2 (Item 6): When headgearId === 0 and !isNotable, hatInstanced scale is set to (0, 0, 0)
   * so bareheaded citizens NEVER have a floating cube hovering above their heads!
   */
  public updateAgentsFromBuffer(
    buf: Float32Array,
    timeOfDay: number,
    season: SeasonType,
    weather: WeatherType
  ) {
    this.targetTimeOfDay = timeOfDay;
    this.season = season;
    this.weather = weather;
    this.latestAgentBuffer = buf;
  }

  private interpolateAgentsFrame(dtMs: number) {
    const buf = this.latestAgentBuffer;
    if (!buf) return;

    const stride = 16;
    const count = Math.min(MAX_AGENTS, Math.floor(buf.length / stride));
    this.currentAgentCount = count;
    const lerpT = Math.min(1, dtMs * 0.018);

    const allParts = [
      this.torsoInstanced,
      this.beltInstanced,
      this.headInstanced,
      this.hatInstanced,
      this.leftArmInstanced,
      this.rightArmInstanced,
      this.leftHandInstanced,
      this.rightHandInstanced,
      this.leftLegInstanced,
      this.rightLegInstanced,
      this.toolInstanced,
      this.shieldOrCapeInstanced,
      this.carriedBlockInstanced,
    ];
    for (const part of allParts) {
      part.count = count;
    }

    for (let i = 0; i < count; i++) {
      const off = i * stride;
      const id = buf[off + 0];
      const targetWx = buf[off + 1];
      const targetWy = buf[off + 2];
      const targetWz = buf[off + 3];
      const targetFacing = buf[off + 4];
      const r = buf[off + 5];
      const g = buf[off + 6];
      const b = buf[off + 7];
      const rawPhase = buf[off + 8];
      const eraIndex = Math.round(buf[off + 10]);
      const action = Math.round(buf[off + 11]) as AgentAnimAction;
      const bodyScale = buf[off + 12] || 1.0;
      const headgearId = Math.round(buf[off + 13] || 0);
      const toolScaleY = buf[off + 14] || 0.28;
      const hasCapeOrShield = Math.round(buf[off + 15] || 0);

      let rs = this.agentRenderState.get(id);
      if (!rs || Math.hypot(targetWx - rs.x, targetWz - rs.z) > 12) {
        rs = {
          x: targetWx,
          y: targetWy,
          z: targetWz,
          facing: targetFacing,
          phase: rawPhase,
        };
        this.agentRenderState.set(id, rs);
      } else {
        rs.x += (targetWx - rs.x) * lerpT;
        rs.y += (targetWy - rs.y) * lerpT;
        rs.z += (targetWz - rs.z) * lerpT;
        rs.facing = lerpAngleShortest(rs.facing, targetFacing, lerpT);
        rs.phase += dtMs * 0.0085;
      }

      const x = rs.x - this.originRebaseX;
      const y = rs.y;
      const z = rs.z - this.originRebaseZ;
      const facing = rs.facing;
      const phase = rs.phase;

      this.agentIds[i] = id;

      if (this.cameraMode === 'follow' && this.followedAgentId === id) {
        this.smoothTarget.set(x, y + 1.4, z);
      }

      const isMoving =
        action === AgentAnimAction.Walking || action === AgentAnimAction.Hauling;
      const isWorking =
        action === AgentAnimAction.Building ||
        action === AgentAnimAction.Chopping ||
        action === AgentAnimAction.Mining ||
        action === AgentAnimAction.Farming ||
        action === AgentAnimAction.Combat ||
        action === AgentAnimAction.Ritual ||
        action === AgentAnimAction.CrimeSteal;

      const isSitting = action === AgentAnimAction.IdleSit;
      const isSleeping = action === AgentAnimAction.Sleeping;
      const isStretching = action === AgentAnimAction.IdleStretch;
      const isChatting = action === AgentAnimAction.IdleChat;
      const isMourning = action === AgentAnimAction.Mourning;
      const isArrested = action === AgentAnimAction.Arrested;

      const sitDrop = isSleeping
        ? -0.56 * bodyScale
        : isSitting
        ? -0.32 * bodyScale
        : 0;
      const walkBob = isMoving ? Math.abs(Math.sin(phase * 1.4)) * 0.1 * bodyScale : 0;
      const elderStoop = bodyScale > 0.9 && bodyScale < 0.96 ? 0.14 : 0;
      const workLean = isSleeping
        ? -1.42
        : isWorking
        ? Math.sin(phase * 3.0) * 0.18 + elderStoop
        : isStretching
        ? -0.14
        : isMourning
        ? 0.25
        : isChatting
        ? Math.sin(phase * 2.2) * 0.08 + elderStoop
        : elderStoop;

      // 1. Torso, Belt, Head, and Headgear
      _pos.set(x, y + walkBob + sitDrop, z);
      _euler.set(workLean, facing, 0);
      _quat.setFromEuler(_euler);
      _scale.set(bodyScale, bodyScale, bodyScale);
      _mat4.compose(_pos, _quat, _scale);

      this.torsoInstanced.setMatrixAt(i, _mat4);
      this.beltInstanced.setMatrixAt(i, _mat4);
      this.headInstanced.setMatrixAt(i, _mat4);

      // Only show headgear in Neolithic+ when headgearId > 0, and NEVER scale Y on translated hatGeo!
      if (headgearId > 0 && eraIndex >= 1) {
        _scale.set(bodyScale, bodyScale, bodyScale);
        _mat4.compose(_pos, _quat, _scale);
        this.hatInstanced.setMatrixAt(i, _mat4);
      } else {
        _scale.set(0, 0, 0);
        _mat4.compose(_pos, _quat, _scale);
        this.hatInstanced.setMatrixAt(i, _mat4);
      }

      // Shield or Royal Cape on Back/Side (only in Neolithic+ eras, never in Stone Age)
      if (hasCapeOrShield > 0 && eraIndex >= 1 && bodyScale >= 0.8) {
        _scale.set(bodyScale, bodyScale, bodyScale);
        _mat4.compose(_pos, _quat, _scale);
        this.shieldOrCapeInstanced.setMatrixAt(i, _mat4);
        if (hasCapeOrShield === 2) {
          _color.setHex(0xdc2626);
        } else {
          _color.setHex(eraIndex >= 3 ? 0x94a3b8 : 0xb45309);
        }
        this.shieldOrCapeInstanced.setColorAt(i, _color);
      } else {
        _scale.set(0, 0, 0);
        _mat4.compose(_pos, _quat, _scale);
        this.shieldOrCapeInstanced.setMatrixAt(i, _mat4);
      }

      // Era-Authentic Tunic & Hide Colors
      const stoneAgeHides = [0x785233, 0x8b5e3c, 0x6b4423, 0x5c4033, 0x936639, 0x4a3525];
      if (eraIndex === 0) {
        _color.setHex(stoneAgeHides[Math.abs(id) % stoneAgeHides.length]);
      } else if (eraIndex === 1) {
        _color.setRGB(r * 0.65 + 0.25, g * 0.62 + 0.22, b * 0.52 + 0.16);
      } else {
        _color.setRGB(r, g, b);
      }
      this.torsoInstanced.setColorAt(i, _color);

      if (eraIndex >= 4) {
        _color.setHex(0xfbbf24);
      } else if (eraIndex === 3) {
        _color.setHex(0x94a3b8);
      } else if (eraIndex === 2) {
        _color.setHex(0xd97706);
      } else {
        _color.setHex(0x3b2313);
      }
      this.beltInstanced.setColorAt(i, _color);

      const skinTint = ((id * 29) % 5) * 0.035;
      _color.setRGB(0.95 - skinTint, 0.75 - skinTint * 0.85, 0.63 - skinTint * 0.75);
      this.headInstanced.setColorAt(i, _color);

      if (headgearId === 5) {
        _color.setHex(0xfbbf24);
      } else if (headgearId === 1) {
        _color.setHex(0xd4a359);
      } else if (headgearId === 3) {
        _color.setHex(0x94a3b8);
      } else if (headgearId === 6) {
        _color.setHex(0xe2e8f0);
      } else {
        _color.setHex(0x6b4423);
      }
      this.hatInstanced.setColorAt(i, _color);

      // 2. Left & Right Arms + Hands Animation
      const shoulderOffsetX = Math.cos(facing) * 0.44 * bodyScale;
      const shoulderOffsetZ = -Math.sin(facing) * 0.44 * bodyScale;

      let leftArmPitch = 0;
      let rightArmPitch = 0;

      if (action === AgentAnimAction.Hauling) {
        leftArmPitch = -1.1;
        rightArmPitch = -1.1;
      } else if (isArrested) {
        leftArmPitch = 0.65;
        rightArmPitch = 0.65;
      } else if (isMourning) {
        leftArmPitch = -1.45;
        rightArmPitch = -1.45;
      } else if (isWorking) {
        rightArmPitch = -1.35 + Math.sin(phase * 3.2) * 1.15;
        leftArmPitch = -0.45 + Math.cos(phase * 3.2) * 0.35;
      } else if (isMoving) {
        leftArmPitch = Math.sin(phase * 1.4) * 0.75;
        rightArmPitch = -Math.sin(phase * 1.4) * 0.75;
      } else if (isStretching) {
        leftArmPitch = -2.25 + Math.sin(phase * 1.8) * 0.3;
        rightArmPitch = -2.25 + Math.cos(phase * 1.8) * 0.3;
      } else if (isSitting) {
        leftArmPitch = -0.55;
        rightArmPitch = -0.55;
      } else if (isChatting) {
        leftArmPitch = -0.65 + Math.sin(phase * 2.6) * 0.38;
        rightArmPitch = -0.5 + Math.cos(phase * 2.3) * 0.38;
      } else {
        leftArmPitch = Math.sin(phase * 0.5) * 0.08;
        rightArmPitch = -Math.sin(phase * 0.5) * 0.08;
      }

      _pos.set(
        x - shoulderOffsetX,
        y + 1.2 * bodyScale + walkBob + sitDrop,
        z - shoulderOffsetZ
      );
      _euler.set(leftArmPitch, facing, 0);
      _quat.setFromEuler(_euler);
      _scale.set(bodyScale, bodyScale, bodyScale);
      _mat4.compose(_pos, _quat, _scale);
      this.leftArmInstanced.setMatrixAt(i, _mat4);
      this.leftHandInstanced.setMatrixAt(i, _mat4);

      _pos.set(
        x + shoulderOffsetX,
        y + 1.2 * bodyScale + walkBob + sitDrop,
        z + shoulderOffsetZ
      );
      _euler.set(rightArmPitch, facing, 0);
      _quat.setFromEuler(_euler);
      _mat4.compose(_pos, _quat, _scale);
      this.rightArmInstanced.setMatrixAt(i, _mat4);
      this.rightHandInstanced.setMatrixAt(i, _mat4);

      if (eraIndex === 0) {
        _color.setHex(stoneAgeHides[(Math.abs(id) + 1) % stoneAgeHides.length]);
      } else {
        _color.setRGB(r * 0.9, g * 0.9, b * 0.9);
      }
      this.leftArmInstanced.setColorAt(i, _color);
      this.rightArmInstanced.setColorAt(i, _color);
      this.leftHandInstanced.setColorAt(i, _skinColor);
      this.rightHandInstanced.setColorAt(i, _skinColor);

      // 3. Held Tool / Weapon in Right Hand
      if (isWorking && bodyScale >= 0.75) {
        const toolLen = Math.max(0.8, Math.min(1.65, toolScaleY * 3.4));
        _scale.set(bodyScale, bodyScale * toolLen, bodyScale);
        _mat4.compose(_pos, _quat, _scale);
        this.toolInstanced.setMatrixAt(i, _mat4);
        if (eraIndex >= 5) {
          _color.setHex(0x22d3ee);
        } else if (eraIndex === 4) {
          _color.setHex(0xe2e8f0);
        } else if (eraIndex === 3) {
          _color.setHex(0x94a3b8);
        } else if (eraIndex === 2) {
          _color.setHex(0xd97706);
        } else {
          _color.setHex(0x78716c);
        }
        this.toolInstanced.setColorAt(i, _color);
      } else {
        _scale.set(0, 0, 0);
        _mat4.compose(_pos, _quat, _scale);
        this.toolInstanced.setMatrixAt(i, _mat4);
      }

      // 4. Carried Voxel Block when Hauling
      if (action === AgentAnimAction.Hauling) {
        _pos.set(x, y + walkBob, z);
        _euler.set(0, facing, 0);
        _quat.setFromEuler(_euler);
        _scale.set(bodyScale, bodyScale, bodyScale);
        _mat4.compose(_pos, _quat, _scale);
        this.carriedBlockInstanced.setMatrixAt(i, _mat4);
        _color.setHex(eraIndex >= 2 ? 0x9ca3af : 0xb45309);
        this.carriedBlockInstanced.setColorAt(i, _color);
      } else {
        _scale.set(0, 0, 0);
        _mat4.compose(_pos, _quat, _scale);
        this.carriedBlockInstanced.setMatrixAt(i, _mat4);
      }

      // 5. Left & Right Legs
      const hipOffsetX = Math.cos(facing) * 0.18 * bodyScale;
      const hipOffsetZ = -Math.sin(facing) * 0.18 * bodyScale;
      const leftLegPitch = isSitting
        ? -1.35
        : isMoving
        ? -Math.sin(phase * 1.4) * 0.72
        : 0;
      const rightLegPitch = isSitting
        ? -1.35
        : isMoving
        ? Math.sin(phase * 1.4) * 0.72
        : 0;

      _pos.set(
        x - hipOffsetX,
        y + 0.5 * bodyScale + walkBob + sitDrop,
        z - hipOffsetZ
      );
      _euler.set(leftLegPitch, facing, 0);
      _quat.setFromEuler(_euler);
      _scale.set(bodyScale, bodyScale, bodyScale);
      _mat4.compose(_pos, _quat, _scale);
      this.leftLegInstanced.setMatrixAt(i, _mat4);

      _pos.set(
        x + hipOffsetX,
        y + 0.5 * bodyScale + walkBob + sitDrop,
        z + hipOffsetZ
      );
      _euler.set(rightLegPitch, facing, 0);
      _quat.setFromEuler(_euler);
      _mat4.compose(_pos, _quat, _scale);
      this.rightLegInstanced.setMatrixAt(i, _mat4);

      this.leftLegInstanced.setColorAt(i, _bootColor);
      this.rightLegInstanced.setColorAt(i, _bootColor);
    }

    for (const part of allParts) {
      part.instanceMatrix.needsUpdate = true;
      if (part.instanceColor) part.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Part 1 (Item 2): Smooth continuous sun, moon, stars, clouds, and texel-snapped shadows
   * Driven every render frame from real delta time (`dtMs`) so sun and shadows never tick or jump!
   */
  private updateAtmosphereAndLighting(dtMs: number) {
    // Advance continuous renderTimeOfDay smoothly from real frame delta time
    if (!this.isSimPaused && this.dynamicCycleEnabled) {
      // Sim runs at 20 ticks/sec * 0.016 hr/tick = 0.32 hr/sec at 1x speed (~75s full day)
      const hoursPerMs = (0.32 * this.simSpeedMultiplier) / 1000;
      this.renderTimeOfDay = (this.renderTimeOfDay + dtMs * hoursPerMs) % 24;
    }
    // Only snap if world was reset/loaded; otherwise use ultra-gentle phase drift so sun NEVER stutters!
    let diff = this.targetTimeOfDay - this.renderTimeOfDay;
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;
    if (Math.abs(diff) > 2.5) {
      this.renderTimeOfDay = this.targetTimeOfDay;
    } else {
      this.renderTimeOfDay =
        (this.renderTimeOfDay + diff * Math.min(1, dtMs * 0.0008) + 24) % 24;
    }

    const effectiveWeather = this.photoSettings.weatherOverride || this.weather;
    const hour =
      this.photoSettings.timeOverride !== null
        ? this.photoSettings.timeOverride
        : this.dynamicCycleEnabled
        ? this.renderTimeOfDay
        : 10.5;

    const sunAngle = ((hour - 6.0) / 24.0) * Math.PI * 2.0;
    const sunElevation = Math.sin(sunAngle);
    const sunHoriz = Math.cos(sunAngle);

    const camDist = this.camera.position.distanceTo(this.controls.target);
    // Hide sub-block wildflowers at high altitude zoom so they never create sub-pixel dot patterns
    const showCloseFlora = camDist < 135;
    this.floraStemInstanced.visible = showCloseFlora;
    this.floraBloomInstanced.visible = showCloseFlora;

    // Wide shadow frustum covering the entire visible viewport so no shadow square border is visible
    const desiredExtent = Math.round(Math.max(280, Math.min(620, camDist * 2.75)));
    if (Math.abs(desiredExtent - this.shadowExtent) >= 4) {
      this.shadowExtent = desiredExtent;
      const sc = this.sunLight.shadow.camera;
      sc.left = -desiredExtent;
      sc.right = desiredExtent;
      sc.top = desiredExtent;
      sc.bottom = -desiredExtent;
      sc.near = 10;
      sc.far = Math.max(760, desiredExtent * 3.5);
      sc.updateProjectionMatrix();
      if (this.shadowDebugVisible) {
        this.shadowCameraHelper.update();
      }
    }

    // Snap shadow camera target to world-space shadow texel increments so shadows never shimmer
    const texelWorldSize =
      (this.shadowExtent * 2) / this.sunLight.shadow.mapSize.width;
    const snappedTx =
      Math.round(this.controls.target.x / texelWorldSize) * texelWorldSize;
    const snappedTz =
      Math.round(this.controls.target.z / texelWorldSize) * texelWorldSize;

    // Smooth continuous sun / moon orbit direction without discrete dawn/dusk direction flips
    const isNight = sunElevation < -0.06;
    const smoothElev = Math.max(0.35, Math.abs(sunElevation) * 0.75 + 0.25);

    const sunRadius = Math.max(320, this.shadowExtent * 1.45);
    const dirX = sunHoriz * sunRadius;
    const dirY = smoothElev * sunRadius + 32;
    const dirZ = 64 + Math.sin(sunAngle * 0.5) * 24;

    this.sunLight.position.set(snappedTx + dirX, WATER_LEVEL + dirY, snappedTz + dirZ);
    this.sunLight.target.position.set(snappedTx, this.controls.target.y, snappedTz);
    this.sunLight.target.updateMatrixWorld();

    if (this.frameCounter % this.shadowUpdateInterval === 0) {
      this.renderer.shadowMap.needsUpdate = true;
    }
    if (this.shadowDebugVisible) {
      this.shadowCameraHelper.update();
    }

    // Smoothly interpolate dawn / day / golden hour / night colors
    const dayFactor = Math.max(0.0, Math.min(1.0, (sunElevation + 0.18) / 0.85));
    const goldenHourFactor = Math.max(
      0.0,
      1.0 - Math.abs(sunElevation - 0.12) * 3.8
    );

    const zenithDay = new THREE.Color(0x2574e8);
    const horizonDay = new THREE.Color(0x9be2fa);
    const zenithSunset = new THREE.Color(0x3b2d6e);
    const horizonSunset = new THREE.Color(0xf9844a);
    const zenithNight = new THREE.Color(0x091326);
    const horizonNight = new THREE.Color(0x162947);

    const zenithCol = zenithNight
      .clone()
      .lerp(zenithDay, dayFactor)
      .lerp(zenithSunset, goldenHourFactor * 0.65);
    const horizonCol = horizonNight
      .clone()
      .lerp(horizonDay, dayFactor)
      .lerp(horizonSunset, goldenHourFactor * 0.78);

    if (effectiveWeather === 'Rain' || effectiveWeather === 'Thunderstorm') {
      zenithCol.lerp(new THREE.Color(0x334155), 0.55);
      horizonCol.lerp(new THREE.Color(0x64748b), 0.55);
    } else if (effectiveWeather === 'Sandstorm' || effectiveWeather === 'Drought') {
      horizonCol.lerp(new THREE.Color(0xd99b52), 0.45);
    } else if (this.season === 'Winter' || effectiveWeather === 'Blizzard') {
      horizonCol.lerp(new THREE.Color(0xcde4f7), 0.35);
    }

    // Occasional lightning flash during Thunderstorms
    if (effectiveWeather === 'Thunderstorm' && Math.random() < 0.008) {
      this.lightningFlashIntensity = 1.4;
    }
    if (this.lightningFlashIntensity > 0.01) {
      this.lightningFlashIntensity *= 0.85;
      horizonCol.lerp(new THREE.Color(0xe0f2fe), this.lightningFlashIntensity * 0.5);
    }

    _skyColor.copy(horizonCol);
    _groundColor.setRGB(
      0.16 + dayFactor * 0.18,
      0.20 + dayFactor * 0.22,
      0.22 + dayFactor * 0.12
    );
    _sunColor.setRGB(
      isNight ? 0.68 : 1.0,
      isNight ? 0.82 : 0.94 - goldenHourFactor * 0.22,
      isNight ? 1.0 : 0.84 - goldenHourFactor * 0.38
    );

    this.scene.background = _skyColor;
    this.fog.color.copy(_skyColor);
    this.hemiLight.color.copy(_skyColor);
    this.hemiLight.groundColor.copy(_groundColor);
    this.hemiLight.intensity = isNight ? 0.78 : 0.88;
    this.fillLight.intensity = isNight ? 0.55 : 0.68;
    this.sunLight.color.copy(_sunColor);
    this.sunLight.intensity =
      (isNight ? 0.95 : 1.15 + dayFactor * 1.25) + this.lightningFlashIntensity;

    // Tint flat unlit clouds softly by day/sunset/night sky
    this.cloudMat.color
      .setHex(0xffffff)
      .lerp(horizonCol, 0.35 + (1 - dayFactor) * 0.45);
    this.cloudMat.opacity = isNight ? 0.42 : 0.72;

    const nightGlow = Math.max(0.0, Math.min(1.0, 1.0 - dayFactor * 1.25));
    this.archLanternMat.emissiveIntensity = 0.45 + nightGlow * 2.2;

    // Update Sky Dome & Water Shader Uniforms
    this.skyDomeMesh.position.copy(this.camera.position);
    this.skyUniforms.uZenithColor.value.copy(zenithCol);
    this.skyUniforms.uHorizonColor.value.copy(horizonCol);
    this.skyUniforms.uSunDir.value
      .set(Math.cos(sunAngle), sunElevation, 0.32)
      .normalize();
    this.skyUniforms.uSunColor.value.copy(_sunColor);
    this.skyUniforms.uStarIntensity.value = nightGlow;
    this.skyUniforms.uTime.value = this.waterTimeUniform.value;

    this.waterSunDirUniform.value.set(dirX, dirY, dirZ).normalize();
    this.waterSkyColorUniform.value.copy(horizonCol);
    this.waterNightGlowUniform.value = nightGlow;
    this.waterWinterIceUniform.value =
      this.season === 'Winter' || effectiveWeather === 'Blizzard' ? 1.0 : 0.0;

    // Keep Horizon Skirt centered on camera X/Z and blended with horizon fog
    this.horizonSkirtMesh.position.set(
      this.camera.position.x,
      WATER_LEVEL - 0.35,
      this.camera.position.z
    );
    (this.horizonSkirtMesh.material as THREE.MeshStandardMaterial).color
      .setHex(0x3a6b48)
      .lerp(horizonCol, 0.55);

    // Update World-Anchored Soft Flat Voxel Clouds High in the Sky
    const t = this.waterTimeUniform.value;
    this.cloudInstanced.count = MAX_CLOUDS;
    const camWx = this.controls.target.x + this.originRebaseX;
    const camWz = this.controls.target.z + this.originRebaseZ;
    const cloudSpan = 1200;
    const halfSpan = cloudSpan * 0.5;

    for (let c = 0; c < MAX_CLOUDS; c++) {
      const gx = (c % 8) * 150;
      const gz = Math.floor(c / 8) * 150;
      const seedJitterX = Math.sin(c * 12.9898) * 48;
      const seedJitterZ = Math.cos(c * 78.233) * 48;

      // Smooth wind drift across the sky in world coordinates
      const rawWx = gx + seedJitterX + t * 5.2;
      const rawWz = gz + seedJitterZ + t * 1.4;
      const wrappedWx =
        camWx + ((((rawWx - camWx + halfSpan) % cloudSpan) + cloudSpan) % cloudSpan) - halfSpan;
      const wrappedWz =
        camWz + ((((rawWz - camWz + halfSpan) % cloudSpan) + cloudSpan) % cloudSpan) - halfSpan;

      _pos.set(
        wrappedWx - this.originRebaseX,
        122 + (c % 3) * 2.5,
        wrappedWz - this.originRebaseZ
      );
      _euler.set(0, (c % 2) * Math.PI * 0.5, 0);
      _quat.setFromEuler(_euler);
      const sx = 1.15 + (c % 3) * 0.45;
      const sz = 1.05 + ((c >> 1) % 3) * 0.4;
      _scale.set(sx, 1.0, sz);
      _mat4.compose(_pos, _quat, _scale);
      this.cloudInstanced.setMatrixAt(c, _mat4);
    }
    this.cloudInstanced.instanceMatrix.needsUpdate = true;

    // Weather particles (fade out smoothly when zoomed out so they never form a 1-chunk box of dots)
    if (this.weatherPoints.visible) {
      const pMat = this.weatherPoints.material as THREE.PointsMaterial;
      const isRainy =
        effectiveWeather === 'Rain' ||
        effectiveWeather === 'Thunderstorm' ||
        effectiveWeather === 'Storm';
      const isSnowy =
        effectiveWeather === 'Snow' || effectiveWeather === 'Blizzard';
      const isSand = effectiveWeather === 'Sandstorm';
      const zoomFade = Math.max(0, Math.min(1, (220 - camDist) / 90));

      if ((isRainy || isSnowy || isSand) && zoomFade > 0.02) {
        pMat.opacity = (isSand ? 0.5 : 0.62) * zoomFade;
        pMat.color.setHex(
          isSnowy ? 0xffffff : isSand ? 0xd99b52 : 0x93c5fd
        );
        const posAttr = this.weatherPoints.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const fallSpeed = isSnowy ? 0.25 : isSand ? 0.14 : 0.78;
        const windX = isSand || effectiveWeather === 'Blizzard' ? 0.48 : 0.06;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 0] += windX;
          arr[i + 1] -= fallSpeed;
          if (arr[i + 1] < 6) {
            arr[i + 0] = this.controls.target.x + (Math.random() - 0.5) * 360;
            arr[i + 1] = 68;
            arr[i + 2] = this.controls.target.z + (Math.random() - 0.5) * 360;
          }
        }
        posAttr.needsUpdate = true;
      } else {
        pMat.opacity = 0;
      }
    }

    // Divine bursts
    for (let i = this.activeBursts.length - 1; i >= 0; i--) {
      const b = this.activeBursts[i];
      b.age++;
      const s = 1 + (b.age / b.maxAge) * 7.5;
      b.mesh.scale.setScalar(s);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity =
        0.85 * (1 - b.age / b.maxAge);
      if (b.age >= b.maxAge) {
        this.fxGroup.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.activeBursts.splice(i, 1);
      }
    }

    // Falling leaf / debris particles
    for (let i = this.fallingDebrisCubes.length - 1; i >= 0; i--) {
      const p = this.fallingDebrisCubes[i];
      p.age++;
      p.vy -= 0.008;
      p.mesh.position.x += p.vx;
      p.mesh.position.y += p.vy;
      p.mesh.position.z += p.vz;
      p.mesh.rotation.x += 0.12;
      p.mesh.rotation.z += 0.09;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity =
        0.92 * (1 - p.age / p.maxAge);
      if (p.age >= p.maxAge || p.mesh.position.y < WATER_LEVEL) {
        this.fxGroup.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.fallingDebrisCubes.splice(i, 1);
      }
    }
  }

  private updateCameraMovement(dtMs: number) {
    let cameraMoved = false;
    if (this.keysPressed.size > 0) {
      const moveSpeed = 0.85;
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3()
        .crossVectors(forward, this.camera.up)
        .normalize();

      if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) {
        this.camera.position.addScaledVector(forward, moveSpeed);
        this.controls.target.addScaledVector(forward, moveSpeed);
        cameraMoved = true;
      }
      if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) {
        this.camera.position.addScaledVector(forward, -moveSpeed);
        this.controls.target.addScaledVector(forward, -moveSpeed);
        cameraMoved = true;
      }
      if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) {
        this.camera.position.addScaledVector(right, -moveSpeed);
        this.controls.target.addScaledVector(right, -moveSpeed);
        cameraMoved = true;
      }
      if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) {
        this.camera.position.addScaledVector(right, moveSpeed);
        this.controls.target.addScaledVector(right, moveSpeed);
        cameraMoved = true;
      }
      if (this.keysPressed.has('KeyE')) {
        this.camera.position.y += moveSpeed * 0.7;
        cameraMoved = true;
      }
      if (this.keysPressed.has('KeyQ')) {
        this.camera.position.y = Math.max(8, this.camera.position.y - moveSpeed * 0.7);
        cameraMoved = true;
      }
    }

    // Cinematic Auto-Camera (Item 21): Smoothly pans and orbits around settlements & ships
    if (this.cameraMode === 'cinematic') {
      this.cinematicOrbitAngle += dtMs * 0.00022;
      this.cinematicFocusSwitchTimer += dtMs;
      if (this.cinematicFocusSwitchTimer > 14000 && this.cachedStructures.length > 0) {
        this.cinematicFocusSwitchTimer = 0;
        this.cinematicFocusIndex =
          (this.cinematicFocusIndex + 1) % this.cachedStructures.length;
        const st = this.cachedStructures[this.cinematicFocusIndex];
        if (st) {
          this.smoothTarget.set(
            st.x - this.originRebaseX,
            Math.max(15, st.y + 3),
            st.z - this.originRebaseZ
          );
        }
      }
      this.controls.target.lerp(this.smoothTarget, 0.03);
      const orbitR = 44;
      this.camera.position.set(
        this.controls.target.x + Math.cos(this.cinematicOrbitAngle) * orbitR,
        this.controls.target.y + 24 + Math.sin(this.cinematicOrbitAngle * 0.5) * 6,
        this.controls.target.z + Math.sin(this.cinematicOrbitAngle) * orbitR
      );
      cameraMoved = true;
    } else if (this.isTransitioningCamera) {
      this.controls.target.lerp(this.smoothTarget, 0.14);
      this.camera.position.lerp(this.smoothCamPos, 0.14);
      cameraMoved = true;
      if (this.controls.target.distanceTo(this.smoothTarget) < 0.4) {
        this.isTransitioningCamera = false;
      }
    } else if (this.cameraMode === 'follow' && this.followedAgentId !== null) {
      this.controls.target.lerp(this.smoothTarget, 0.15);
      cameraMoved = true;
    }

    this.controls.update();

    // Prevent camera target or camera position from ever dipping below terrain or water
    const targetWx = Math.round(this.controls.target.x + this.originRebaseX);
    const targetWz = Math.round(this.controls.target.z + this.originRebaseZ);
    const targetCol = sampleColumn(targetWx, targetWz, this.currentSeedNum);
    const minTargetY = Math.max(WATER_LEVEL + 0.5, targetCol.height + 0.5);
    if (this.controls.target.y < minTargetY) {
      const lift = minTargetY - this.controls.target.y;
      this.controls.target.y = minTargetY;
      this.camera.position.y += lift;
    }

    const camWx = Math.round(this.camera.position.x + this.originRebaseX);
    const camWz = Math.round(this.camera.position.z + this.originRebaseZ);
    const camCol = sampleColumn(camWx, camWz, this.currentSeedNum);
    const minCamY = Math.max(WATER_LEVEL + 2.2, camCol.height + 2.2);
    if (this.camera.position.y < minCamY) {
      this.camera.position.y = minCamY;
    }

    this.checkFloatingOriginRebase();

    const curWx = this.controls.target.x + this.originRebaseX;
    const curWz = this.controls.target.z + this.originRebaseZ;
    const dtSec = Math.max(0.005, dtMs * 0.001);
    const instVelX = (curWx - this.lastCamTargetWx) / (CHUNK_SIZE * dtSec);
    const instVelZ = (curWz - this.lastCamTargetWz) / (CHUNK_SIZE * dtSec);
    if (Math.hypot(instVelX, instVelZ) < 60) {
      this.camVelX = this.camVelX * 0.8 + instVelX * 0.2;
      this.camVelZ = this.camVelZ * 0.8 + instVelZ * 0.2;
    } else {
      this.camVelX = 0;
      this.camVelZ = 0;
    }
    if (Math.hypot(curWx - this.lastCamTargetWx, curWz - this.lastCamTargetWz) > 0.2) {
      cameraMoved = true;
    }
    this.lastCamTargetWx = curWx;
    this.lastCamTargetWz = curWz;

    if (cameraMoved) {
      this.renderer.shadowMap.needsUpdate = true;
    }

    const now = performance.now();
    const notifyInterval = cameraMoved ? 75 : 220;
    if (now - this.lastCameraNotifyTime > notifyInterval) {
      this.lastCameraNotifyTime = now;
      const leadWx = curWx + Math.max(-6, Math.min(6, this.camVelX * 0.25)) * CHUNK_SIZE;
      const leadWz = curWz + Math.max(-6, Math.min(6, this.camVelZ * 0.25)) * CHUNK_SIZE;
      this.onCameraChunkCenterChanged(leadWx, leadWz, this.getZoomExpandedChunkRadius());
    }
    this.runMissingChunkWatchdog(now);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDisposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.isDisposed) return;

    if (document.hidden) {
      this.lastFrameTimestamp = performance.now();
      this.frameId = window.setTimeout(this.tick, 250);
      return;
    }

    const now = performance.now();
    const dtMs = Math.max(1, Math.min(200, now - this.lastFrameTimestamp));
    this.lastFrameTimestamp = now;
    const instFps = 1000 / dtMs;
    this.smoothedFps = this.smoothedFps * 0.92 + instFps * 0.08;
    this.smoothedFrameMs = this.smoothedFrameMs * 0.92 + dtMs * 0.08;
    this.frameCounter++;

    if (this.qualityPreset === 'Auto' && !this.isSoftwareGl) {
      if (this.autoQualityCooldown > 0) {
        this.autoQualityCooldown--;
      } else if (this.smoothedFps < 36 && this.effectiveQuality !== 'Low') {
        const nextQ =
          this.effectiveQuality === 'Ultra'
            ? 'High'
            : this.effectiveQuality === 'High'
            ? 'Medium'
            : 'Low';
        this.applyEffectiveQuality(nextQ);
        this.autoQualityCooldown = 90;
      } else if (this.smoothedFps > 56 && this.effectiveQuality === 'Low') {
        this.applyEffectiveQuality('Medium');
        this.autoQualityCooldown = 120;
      } else if (this.smoothedFps > 58 && this.effectiveQuality === 'Medium') {
        this.applyEffectiveQuality('High');
        this.autoQualityCooldown = 120;
      }
    }

    this.waterTimeUniform.value = now * 0.001;
    this.updateCameraMovement(dtMs);
    this.updateAtmosphereAndLighting(dtMs);
    this.interpolateAgentsFrame(dtMs);
    this.updateVehiclesFrame(dtMs);
    this.updateAnimalsFrame(dtMs);

    const rStart = performance.now();
    this.renderer.render(this.scene, this.camera);
    this.lastRenderMs = performance.now() - rStart;

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private handleResize = () => {
    if (this.isDisposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.needsUpdate = true;
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

  private handlePointerMove = (e: PointerEvent) => {
    const now = performance.now();
    if (!this.activeGodPowerColor && now - this.lastHoverRaycastTime < 90) {
      return;
    }
    this.lastHoverRaycastTime = now;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    let hoveredAgentId: number | null = null;
    if (this.currentAgentCount > 0) {
      const torsoHits = this.raycaster.intersectObject(this.torsoInstanced, false);
      if (
        torsoHits.length > 0 &&
        torsoHits[0].instanceId !== undefined &&
        torsoHits[0].instanceId < this.currentAgentCount
      ) {
        hoveredAgentId = this.agentIds[torsoHits[0].instanceId];
      }
    }

    const hits = this.raycaster.intersectObjects(this.chunkGroup.children, false);
    if (hits.length > 0) {
      const pt = hits[0].point;
      if (this.activeGodPowerColor) {
        this.targetRing.position.set(pt.x, pt.y + 0.15, pt.z);
      }
      this.hoveredWorldPoint = {
        wx: pt.x + this.originRebaseX,
        wy: pt.y,
        wz: pt.z + this.originRebaseZ,
        agentId: hoveredAgentId,
      };
    } else {
      this.hoveredWorldPoint = null;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);

    if (this.activeGodPowerColor) {
      const hits = this.raycaster.intersectObjects(this.chunkGroup.children, false);
      if (hits.length > 0) {
        const pt = hits[0].point;
        const wx = pt.x + this.originRebaseX;
        const wz = pt.z + this.originRebaseZ;
        this.spawnDivineBurst(wx, pt.y, wz, this.activeGodPowerColor);
        this.onCastGodPowerAt(wx, wz);
        return;
      }
    }

    const torsoHits = this.raycaster.intersectObject(this.torsoInstanced, false);
    const headHits = this.raycaster.intersectObject(this.headInstanced, false);
    const bestHit = torsoHits[0] || headHits[0];
    if (
      bestHit &&
      bestHit.instanceId !== undefined &&
      bestHit.instanceId < this.currentAgentCount
    ) {
      const agentId = this.agentIds[bestHit.instanceId];
      this.onSelectAgent(agentId);
      return;
    }

    if (this.onSelectAnimal && this.cachedAnimals.length > 0) {
      const animalHits = this.raycaster.intersectObject(this.animalBodyInstanced, false);
      if (
        animalHits.length > 0 &&
        animalHits[0].instanceId !== undefined &&
        animalHits[0].instanceId < this.cachedAnimals.length
      ) {
        this.onSelectAnimal(this.cachedAnimals[animalHits[0].instanceId].id);
      }
    }
  };

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    for (const w of this.meshWorkers) {
      w.terminate();
    }
    this.meshWorkers = [];
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.unloadChunks(Array.from(this.chunkMeshes.keys()), true);
    this.renderer.dispose();
  }
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Anchor,
  BookOpen,
  Bug,
  Camera,
  CheckCircle2,
  Compass,
  Crown,
  Download,
  Eye,
  Flame,
  Globe,
  Hammer,
  HelpCircle,
  History,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Pause,
  PawPrint,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sliders,
  Sparkles,
  Sun,
  Swords,
  Trash2,
  Trees,
  Upload,
  Users,
  Volume2,
  VolumeX,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { SparklineCard } from './components/SparklineChart';
import {
  CameraMode,
  PixelWorldRenderer2D as VoxelWorldRenderer,
} from './renderer/PixelWorldRenderer2D';
import { ProceduralSoundEngine } from './sim/audio';
import {
  AnimalMarker3D,
  CitySummary,
  CivilizationSummary,
  ERA_ORDER,
  EraType,
  GOD_POWERS,
  GodPowerDefinition,
  MapOverlayMode,
  QualityPreset,
  RendererPerfStats,
  SavedWorldRecord,
  SimStageMode,
  SimTelemetrySnapshot,
  StructureMarker3D,
  TERRAFORM_BRUSHES,
  TerraformBrushDef,
  VehicleMarker3D,
  WORLD_GEN_VERSION,
  WorldSettings,
} from './sim/types';
import {
  deleteWorldInstance,
  exportWorldToJsonFile,
  listWorldInstances,
  saveWorldInstance,
} from './storage/worldStorage';

const SPEED_OPTIONS = [
  { label: '1x', value: 1 },
  { label: '5x', value: 5 },
  { label: '25x', value: 25 },
  { label: '100x', value: 100 },
  { label: '1000x', value: 1000 },
];

const QUALITY_OPTIONS: QualityPreset[] = ['Auto', 'Low', 'Medium', 'High', 'Ultra'];

type DockPanelId =
  | 'world'
  | 'civs'
  | 'people'
  | 'chronicle'
  | 'powers'
  | 'overlays'
  | 'settings'
  | 'debug'
  | 'help'
  | null;

type SelectedEntity =
  | { kind: 'agent'; id: number }
  | { kind: 'city'; id: number }
  | { kind: 'structure'; id: number }
  | { kind: 'civ'; id: number }
  | { kind: 'animal'; id: number }
  | { kind: 'vehicle'; id: number }
  | null;

/**
 * Isolated Contextual 3D World Label Overlay (No backdrop-blur over WebGL canvas)
 */
const ContextualWorldLabels = React.memo(function ContextualWorldLabels({
  rendererRef,
  telemetryRef,
  labelMode,
  selectedCityId,
  onSelectCity,
  onSelectStructure,
}: {
  rendererRef: React.MutableRefObject<VoxelWorldRenderer | null>;
  telemetryRef: React.MutableRefObject<SimTelemetrySnapshot | null>;
  labelMode: 'contextual' | 'all' | 'off';
  selectedCityId: number | null;
  onSelectCity: (cityId: number, wx: number, wy: number, wz: number) => void;
  onSelectStructure: (structId: number, wx: number, wy: number, wz: number) => void;
}) {
  const [overlay, setOverlay] = useState<{
    cities: {
      id: number;
      name: string;
      civName: string;
      tier: string;
      era: string;
      colorHex: string;
      population: number;
      wx: number;
      wy: number;
      wz: number;
      sx: number;
      sy: number;
    }[];
    structures: {
      id: number;
      name: string;
      colorHex: string;
      completed: boolean;
      progress: number;
      total: number;
      wx: number;
      wy: number;
      wz: number;
      sx: number;
      sy: number;
    }[];
    agentLabel: {
      id: number;
      name: string;
      roleTitle: string;
      lifeStage: string;
      expression: string;
      state: string;
      isNotable: boolean;
      sx: number;
      sy: number;
    } | null;
  }>({ cities: [], structures: [], agentLabel: null });

  useEffect(() => {
    if (labelMode === 'off') {
      setOverlay({ cities: [], structures: [], agentLabel: null });
      return;
    }

    let rafId = 0;
    let lastUpdate = 0;

    const tickOverlay = (now: number) => {
      rafId = requestAnimationFrame(tickOverlay);
      if (now - lastUpdate < 95) return;
      lastUpdate = now;

      const renderer = rendererRef.current;
      const snap = telemetryRef.current;
      if (!renderer || !snap) return;

      const hoverPt = renderer.hoveredWorldPoint;
      const citiesOut: typeof overlay.cities = [];

      for (const city of snap.cities) {
        if (city.population <= 0) continue;
        const isSelected = city.id === selectedCityId;
        const isHovered =
          hoverPt !== null && Math.hypot(city.x - hoverPt.wx, city.z - hoverPt.wz) < 16;

        const p = renderer.projectWorldToScreen(
          city.x,
          city.y + 8.0,
          city.z,
          !isSelected && !isHovered
        );
        if (!p.visible) continue;

        const isCloseCenterFocus =
          labelMode === 'all'
            ? p.distance < 190
            : p.distance < 68 && p.centerDistNdc < 0.45;

        if (isSelected || isHovered || isCloseCenterFocus) {
          const civ = snap.civilizations.find((c) => c.id === city.civId);
          if (!civ) continue;
          citiesOut.push({
            id: city.id,
            name: city.name,
            civName: civ.name,
            tier: city.settlementTier || 'Village',
            era: civ.era,
            colorHex: civ.colorHex,
            population: city.population,
            wx: city.x,
            wy: city.y,
            wz: city.z,
            sx: p.x,
            sy: p.y,
          });
        }
      }

      const structuresOut: typeof overlay.structures = [];
      for (const st of snap.structures) {
        const isHovered =
          hoverPt !== null && Math.hypot(st.x - hoverPt.wx, st.z - hoverPt.wz) < 6.5;
        const isActiveBuild = !st.isComplete;
        if (!isHovered && !isActiveBuild) continue;

        const p = renderer.projectWorldToScreen(
          st.x,
          st.y + st.height + 2.4,
          st.z,
          !isHovered
        );
        if (!p.visible || p.distance > 110) continue;

        structuresOut.push({
          id: st.id,
          name: st.name,
          colorHex: st.civColor,
          completed: st.isComplete,
          progress: st.progress,
          total: st.totalBlocks,
          wx: st.x,
          wy: st.y,
          wz: st.z,
          sx: p.x,
          sy: p.y,
        });
      }

      let agentLabel: typeof overlay.agentLabel = null;
      if (snap.selectedAgent) {
        const a = snap.selectedAgent;
        const p = renderer.projectWorldToScreen(a.x, a.y + 3.2, a.z, false);
        if (p.visible) {
          agentLabel = {
            id: a.id,
            name: a.name,
            roleTitle: a.roleTitle,
            lifeStage: a.lifeStage,
            expression: a.expression || 'Focused',
            state: a.state,
            isNotable: a.isNotable,
            sx: p.x,
            sy: p.y,
          };
        }
      }

      setOverlay({
        cities: citiesOut.slice(0, 6),
        structures: structuresOut.slice(0, 4),
        agentLabel,
      });
    };

    rafId = requestAnimationFrame(tickOverlay);
    return () => cancelAnimationFrame(rafId);
  }, [labelMode, rendererRef, selectedCityId, telemetryRef]);

  if (labelMode === 'off') return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {overlay.cities.map((c) => (
        <button
          key={`city-lbl-${c.id}`}
          onClick={() => onSelectCity(c.id, c.wx, c.wy, c.wz)}
          style={{
            transform: `translate3d(${Math.round(c.sx)}px, ${Math.round(c.sy)}px, 0) translate(-50%, -100%)`,
          }}
          className="pointer-events-auto absolute top-0 left-0 flex flex-col items-start rounded-md border border-slate-700/80 bg-slate-950/85 px-2.5 py-1 text-left shadow-md transition hover:border-amber-400/80"
        >
          <div className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: c.colorHex }}
            />
            <span className="text-xs font-bold text-white">{c.name}</span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
              {c.tier} · {c.population}
            </span>
          </div>
          <div className="text-[10px] text-slate-300">
            {c.civName} · <span className="text-sky-300">{c.era}</span>
          </div>
        </button>
      ))}

      {overlay.structures.map((st) => {
        const pct = Math.min(100, Math.round((st.progress / Math.max(1, st.total)) * 100));
        return (
          <button
            key={`st-lbl-${st.id}`}
            onClick={() => onSelectStructure(st.id, st.wx, st.wy, st.wz)}
            style={{
              transform: `translate3d(${Math.round(st.sx)}px, ${Math.round(st.sy)}px, 0) translate(-50%, -100%)`,
            }}
            className="pointer-events-auto absolute top-0 left-0 rounded border border-slate-700/80 bg-slate-950/85 px-2 py-0.5 text-left text-[10px] text-slate-200 shadow"
          >
            <div className="flex items-center gap-1.5 font-semibold">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: st.colorHex }}
              />
              <span>{st.name}</span>
              {!st.completed && <span className="text-amber-300">{pct}%</span>}
            </div>
          </button>
        );
      })}

      {overlay.agentLabel && (
        <div
          style={{
            transform: `translate3d(${Math.round(overlay.agentLabel.sx)}px, ${Math.round(
              overlay.agentLabel.sy
            )}px, 0) translate(-50%, -100%)`,
          }}
          className=" absolute top-0 left-0 rounded-md border border-amber-400/80 bg-slate-950/90 px-2.5 py-1 text-left shadow-lg"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-amber-300">
              {overlay.agentLabel.name}
            </span>
            <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] text-slate-300">
              {overlay.agentLabel.lifeStage} · {overlay.agentLabel.expression}
            </span>
          </div>
          <div className="text-[10px] text-slate-300">
            {overlay.agentLabel.roleTitle} · {overlay.agentLabel.state}
          </div>
        </div>
      )}
    </div>
  );
});

export function App() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<VoxelWorldRenderer | null>(null);
  const simWorkerRef = useRef<Worker | null>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundEngineRef = useRef<ProceduralSoundEngine | null>(null);

  const [telemetry, setTelemetry] = useState<SimTelemetrySnapshot | null>(null);
  const telemetryRef = useRef<SimTelemetrySnapshot | null>(null);
  const [perfStats, setPerfStats] = useState<RendererPerfStats | null>(null);

  // Part 1 UI State: Slim Left Dock (one panel at a time), Contextual Right Inspector, Bottom Timeline
  const [activeDockPanel, setActiveDockPanel] = useState<DockPanelId>(null);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [hotkeyModalOpen, setHotkeyModalOpen] = useState(false);

  // Camera & Photo Mode
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [photoModeActive, setPhotoModeActive] = useState(false);
  const [photoGridRuleOfThirds, setPhotoGridRuleOfThirds] = useState(true);
  const [photoFov, setPhotoFov] = useState(48);

  // Overlays & Minimap
  const [labelMode, setLabelMode] = useState<'contextual' | 'all' | 'off'>('contextual');
  const [showTerritoryRings, setShowTerritoryRings] = useState(true);
  const [showNavDebugGrid, setShowNavDebugGrid] = useState(false);
  const [minimapMode, setMinimapMode] = useState<'biome' | 'civ' | 'pop'>('civ');
  const [mapOverlayMode, setMapOverlayMode] = useState<MapOverlayMode>('none');
  const [interiorCutaway, setInteriorCutaway] = useState(false);

  // God Power & Terraforming Brush Targeting
  const [activeGodPower, setActiveGodPower] = useState<GodPowerDefinition | null>(null);
  const activeGodPowerRef = useRef<GodPowerDefinition | null>(null);
  const [activeTerraformBrush, setActiveTerraformBrush] =
    useState<TerraformBrushDef | null>(null);
  const activeTerraformBrushRef = useRef<TerraformBrushDef | null>(null);
  const [brushRadius, setBrushRadius] = useState<number>(3);
  const brushRadiusRef = useRef<number>(3);

  // Graphics & Lighting
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>('High');
  const [dynamicDayNight, setDynamicDayNight] = useState(true);
  const [manualTimeOfDay, setManualTimeOfDay] = useState(11.5);

  // Audio Settings
  const [audioMuted, setAudioMuted] = useState(false);
  const [masterVol, setMasterVol] = useState(0.55);
  const [ambienceVol, setAmbienceVol] = useState(0.65);
  const [sfxVol, setSfxVol] = useState(0.6);
  const [musicVol, setMusicVol] = useState(0.45);

  // People & World Manager Search/State
  const [peopleSearch, setPeopleSearch] = useState('');
  const [savedWorlds, setSavedWorlds] = useState<SavedWorldRecord[]>([]);
  const [newWorldName, setNewWorldName] = useState('Aurelia Prime');
  const [newWorldSeed, setNewWorldSeed] = useState('STARDEW-2026');
  const [newWorldCivs, setNewWorldCivs] = useState(4);

  useEffect(() => {
    activeGodPowerRef.current = activeGodPower;
    activeTerraformBrushRef.current = activeTerraformBrush;
    brushRadiusRef.current = brushRadius;
    if (rendererRef.current) {
      if (activeTerraformBrush) {
        rendererRef.current.setActiveGodPowerCursor(
          activeTerraformBrush.colorHex,
          brushRadius
        );
      } else if (activeGodPower) {
        rendererRef.current.setActiveGodPowerCursor(activeGodPower.colorHex, 6);
      } else {
        rendererRef.current.setActiveGodPowerCursor(null, 0);
      }
    }
  }, [activeGodPower, activeTerraformBrush, brushRadius]);

  // Initialize Sound Engine & Saved Worlds
  useEffect(() => {
    soundEngineRef.current = new ProceduralSoundEngine();
    listWorldInstances().then(setSavedWorlds).catch(() => {});
  }, []);

  // Keyboard Shortcuts: Ctrl+K (Command Palette), ? (Help), Space (Pause), Esc (Close/Clear)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setHotkeyModalOpen((v) => !v);
      } else if (e.key === 'Escape') {
        if (photoModeActive) {
          setPhotoModeActive(false);
          rendererRef.current?.setPhotoModeSettings({ active: false });
        } else if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (hotkeyModalOpen) {
          setHotkeyModalOpen(false);
        } else if (activeGodPower) {
          setActiveGodPower(null);
        } else if (selectedEntity) {
          setSelectedEntity(null);
          simWorkerRef.current?.postMessage({ type: 'SELECT_AGENT', agentId: null });
          if (rendererRef.current) rendererRef.current.followedAgentId = null;
        } else if (activeDockPanel) {
          setActiveDockPanel(null);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        if (telemetryRef.current) {
          simWorkerRef.current?.postMessage({
            type: 'SET_SPEED',
            isPaused: !telemetryRef.current.isPaused,
            speedMultiplier: telemetryRef.current.speedMultiplier,
          });
        }
      } else if (e.key.toLowerCase() === 'p') {
        setPhotoModeActive((prev) => {
          const next = !prev;
          rendererRef.current?.setPhotoModeSettings({ active: next });
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDockPanel, activeGodPower, commandPaletteOpen, hotkeyModalOpen, photoModeActive, selectedEntity]);

  // Initialize Renderer & Web Worker
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const worker = new Worker(new URL('./workers/simWorker.ts', import.meta.url), {
      type: 'module',
    });
    simWorkerRef.current = worker;

    const renderer = new VoxelWorldRenderer(host, {
      onSelectAgent: (agentId) => {
        soundEngineRef.current?.ensureInitialized();
        soundEngineRef.current?.playSfx('click');
        worker.postMessage({ type: 'SELECT_AGENT', agentId });
        if (agentId !== null) {
          setSelectedEntity({ kind: 'agent', id: agentId });
        } else {
          setSelectedEntity(null);
        }
      },
      onSelectAnimal: (animalId) => {
        soundEngineRef.current?.ensureInitialized();
        soundEngineRef.current?.playSfx('click');
        setSelectedEntity({ kind: 'animal', id: animalId });
      },
      onSelectStructure: (structureId) => {
        soundEngineRef.current?.ensureInitialized();
        soundEngineRef.current?.playSfx('click');
        setSelectedEntity({ kind: 'structure', id: structureId });
      },
      onCastGodPowerAt: (wx, wz) => {
        soundEngineRef.current?.ensureInitialized();
        const power = activeGodPowerRef.current;
        if (power) {
          soundEngineRef.current?.playSfx('thunder');
          worker.postMessage({
            type: 'APPLY_GOD_POWER',
            powerId: power.id,
            wx,
            wz,
          });
        }
      },
      onApplyTerraformBrush: (wx, wz) => {
        soundEngineRef.current?.ensureInitialized();
        const brush = activeTerraformBrushRef.current;
        if (!brush) return;
        worker.postMessage({
          type: 'APPLY_TERRAFORM_BRUSH',
          brushId: brush.id,
          wx,
          wz,
          radius: brushRadiusRef.current || 3,
        });
      },
      onCameraChunkCenterChanged: (x, z, zoomChunkRadius) => {
        worker.postMessage({ type: 'CAMERA_MOVED', x, z, zoomChunkRadius });
      },
      onRequestMissingChunks: (coords) => {
        const keys = coords.map((c) => `${c.cx},${c.cz}`);
        worker.postMessage({ type: 'REQUEST_CHUNKS', keys });
      },
    });
    rendererRef.current = renderer;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'CHUNKS_DATA') {
        renderer.queueChunksForMeshing(msg.chunks, msg.clearPrevious, msg.seedNum);
      } else if (msg.type === 'UNLOAD_CHUNKS') {
        renderer.unloadChunks(msg.keys);
      } else if (msg.type === 'FRAME_AGENTS') {
        renderer.updateAgentsFromBuffer(
          msg.agentBuffer,
          msg.timeOfDay,
          msg.season,
          msg.weather
        );
        if (msg.vehicles) renderer.syncVehicles(msg.vehicles);
        if (msg.animals) renderer.syncAnimals(msg.animals);
      } else if (msg.type === 'TELEMETRY') {
        const snap = msg.snapshot as SimTelemetrySnapshot;
        telemetryRef.current = snap;
        setTelemetry(snap);
        setPerfStats(renderer.getPerfStats());
        renderer.setSimSpeedState(snap.speedMultiplier, snap.isPaused);
        renderer.syncArchitecturalProps(snap.structures);
        renderer.syncCitiesAndCivs(snap.cities, snap.civilizations);
        renderer.syncVehicles(snap.vehicles);
        renderer.syncAnimals(snap.animals || []);
        if (snap.fallingParticles && snap.fallingParticles.length > 0) {
          renderer.spawnFallingVoxelParticles(snap.fallingParticles);
        }

        // Update spatial procedural audio
        if (soundEngineRef.current && rendererRef.current) {
          const camTarget = rendererRef.current.getWorldCameraTarget();
          const nearCity = snap.cities.some(
            (c) =>
              Math.hypot(c.x - snap.cameraWorldX, c.z - snap.cameraWorldZ) < 48
          );
          soundEngineRef.current.updateSpatialState({
            cameraHeight: Math.max(12, camTarget.wy + 18),
            nearWaterFactor: 0.75,
            nearSettlementFactor: nearCity ? 0.9 : 0.2,
            isAtWar: snap.activeWars.length > 0,
            timeOfDay: snap.timeOfDay,
            weather: snap.weather,
          });
        }
      } else if (msg.type === 'WORLD_SAVED_DATA') {
        saveWorldInstance(msg.record).then(() => {
          listWorldInstances().then(setSavedWorlds);
        });
      }
    };

    return () => {
      worker.terminate();
      renderer.dispose();
    };
  }, []);

  // Draw Minimap whenever telemetry updates
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    const snap = telemetry;
    if (!canvas || !snap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#071936';
    ctx.fillRect(0, 0, w, h);

    const span = 280;
    const camX = snap.cameraWorldX;
    const camZ = snap.cameraWorldZ;
    const toPx = (wx: number, wz: number): [number, number] => [
      ((wx - camX + span) / (span * 2)) * w,
      ((wz - camZ + span) / (span * 2)) * h,
    ];

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      ctx.beginPath();
      ctx.moveTo((w * g) / 4, 0);
      ctx.lineTo((w * g) / 4, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (h * g) / 4);
      ctx.lineTo(w, (h * g) / 4);
      ctx.stroke();
    }

    // Structures
    for (const st of snap.structures) {
      const [px, py] = toPx(st.x, st.z);
      if (px < 0 || px > w || py < 0 || py > h) continue;
      ctx.fillStyle = st.isComplete ? st.civColor : '#FBBF24';
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }

    // Wildlife dots
    if (minimapMode === 'biome' && snap.animals) {
      ctx.fillStyle = '#34D399';
      for (const an of snap.animals) {
        const [px, py] = toPx(an.x, an.z);
        if (px >= 0 && px <= w && py >= 0 && py <= h) {
          ctx.fillRect(px - 1, py - 1, 2, 2);
        }
      }
    }

    // Cities & Territory Circles
    for (const city of snap.cities) {
      const civ = snap.civilizations.find((c) => c.id === city.civId);
      const [px, py] = toPx(city.x, city.z);
      if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;

      ctx.strokeStyle = civ?.colorHex || '#38BDF8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(6, Math.min(20, city.population * 0.45)), 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = civ?.colorHex || '#38BDF8';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera reticle in center
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(w / 2 - 5, h / 2 - 5, 10, 10);
  }, [telemetry, minimapMode]);

  // Handlers
  const toggleDockPanel = (id: DockPanelId) => {
    soundEngineRef.current?.ensureInitialized();
    soundEngineRef.current?.playSfx('click');
    setActiveDockPanel((prev) => (prev === id ? null : id));
  };

  const handleTogglePause = () => {
    if (!telemetry) return;
    soundEngineRef.current?.ensureInitialized();
    soundEngineRef.current?.playSfx('click');
    simWorkerRef.current?.postMessage({
      type: 'SET_SPEED',
      isPaused: !telemetry.isPaused,
      speedMultiplier: telemetry.speedMultiplier,
    });
  };

  const handleSetSpeed = (speed: number) => {
    soundEngineRef.current?.ensureInitialized();
    soundEngineRef.current?.playSfx('click');
    simWorkerRef.current?.postMessage({
      type: 'SET_SPEED',
      isPaused: false,
      speedMultiplier: speed,
    });
  };

  const handleSetCameraMode = (mode: CameraMode) => {
    setCameraMode(mode);
    if (rendererRef.current) {
      rendererRef.current.cameraMode = mode;
    }
  };

  const handleJumpTo = (wx: number, wy: number, wz: number) => {
    rendererRef.current?.jumpCameraTo(wx, wy, wz);
    simWorkerRef.current?.postMessage({
      type: 'CAMERA_MOVED',
      x: wx,
      z: wz,
    });
  };

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!telemetry || !minimapCanvasRef.current) return;
    const rect = minimapCanvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    const span = 280;
    const wx = Math.round(telemetry.cameraWorldX + (nx * 2 - 1) * span);
    const wz = Math.round(telemetry.cameraWorldZ + (ny * 2 - 1) * span);
    handleJumpTo(wx, 18, wz);
  };

  // Resolve currently selected entity details for the Contextual Right Inspector
  const inspectedCity: CitySummary | undefined = useMemo(() => {
    if (!telemetry || selectedEntity?.kind !== 'city') return undefined;
    return telemetry.cities.find((c) => c.id === selectedEntity.id);
  }, [telemetry, selectedEntity]);

  const inspectedStructure: StructureMarker3D | undefined = useMemo(() => {
    if (!telemetry || selectedEntity?.kind !== 'structure') return undefined;
    return telemetry.structures.find((s) => s.id === selectedEntity.id);
  }, [telemetry, selectedEntity]);

  const inspectedCiv: CivilizationSummary | undefined = useMemo(() => {
    if (!telemetry || selectedEntity?.kind !== 'civ') return undefined;
    return telemetry.civilizations.find((c) => c.id === selectedEntity.id);
  }, [telemetry, selectedEntity]);

  const inspectedAnimal: AnimalMarker3D | undefined = useMemo(() => {
    if (!telemetry || selectedEntity?.kind !== 'animal') return undefined;
    return telemetry.animals?.find((a) => a.id === selectedEntity.id);
  }, [telemetry, selectedEntity]);

  const inspectedVehicle: VehicleMarker3D | undefined = useMemo(() => {
    if (!telemetry || selectedEntity?.kind !== 'vehicle') return undefined;
    return telemetry.vehicles.find((v) => v.id === selectedEntity.id);
  }, [telemetry, selectedEntity]);

  // Command Palette searchable items
  const commandItems = useMemo(() => {
    if (!telemetry) return [];
    const q = commandQuery.trim().toLowerCase();
    const items: {
      id: string;
      category: string;
      title: string;
      subtitle: string;
      action: () => void;
    }[] = [];

    for (const c of telemetry.cities) {
      items.push({
        id: `city-${c.id}`,
        category: 'City',
        title: c.name,
        subtitle: `${c.settlementTier} · Pop ${c.population} · ${c.biome} (Score ${c.siteScore})`,
        action: () => {
          setSelectedEntity({ kind: 'city', id: c.id });
          handleJumpTo(c.x, c.y + 4, c.z);
        },
      });
    }

    for (const civ of telemetry.civilizations) {
      items.push({
        id: `civ-${civ.id}`,
        category: 'Civilization',
        title: civ.name,
        subtitle: `${civ.era} · ${civ.governmentType} · Pop ${civ.population}`,
        action: () => {
          setSelectedEntity({ kind: 'civ', id: civ.id });
        },
      });
    }

    for (const a of telemetry.notableHallOfFame) {
      items.push({
        id: `agent-${a.id}`,
        category: 'Person',
        title: a.name,
        subtitle: `${a.roleTitle} (${a.lifeStage}) · ${a.state}`,
        action: () => {
          simWorkerRef.current?.postMessage({ type: 'SELECT_AGENT', agentId: a.id });
          setSelectedEntity({ kind: 'agent', id: a.id });
          handleJumpTo(a.x, a.y + 3, a.z);
        },
      });
    }

    for (const st of telemetry.structures.slice(0, 30)) {
      items.push({
        id: `st-${st.id}`,
        category: 'Structure',
        title: st.name,
        subtitle: `${st.category} · ${st.isComplete ? 'Completed' : `${st.progress}/${st.totalBlocks} blocks`}`,
        action: () => {
          setSelectedEntity({ kind: 'structure', id: st.id });
          handleJumpTo(st.x, st.y + 4, st.z);
        },
      });
    }

    for (const gp of GOD_POWERS) {
      items.push({
        id: `gp-${gp.id}`,
        category: 'God Power',
        title: gp.name,
        subtitle: gp.description,
        action: () => {
          setActiveGodPower(gp);
          setActiveDockPanel('powers');
        },
      });
    }

    if (!q) return items.slice(0, 24);
    return items
      .filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.subtitle.toLowerCase().includes(q) ||
          it.category.toLowerCase().includes(q)
      )
      .slice(0, 28);
  }, [telemetry, commandQuery]);

  const formattedHour = telemetry
    ? `${String(Math.floor(telemetry.timeOfDay)).padStart(2, '0')}:00`
    : '10:00';

  const inspectorVisible =
    !photoModeActive &&
    selectedEntity !== null &&
    ((selectedEntity.kind === 'agent' && Boolean(telemetry?.selectedAgent)) ||
      (selectedEntity.kind === 'city' && Boolean(inspectedCity)) ||
      (selectedEntity.kind === 'structure' && Boolean(inspectedStructure)) ||
      (selectedEntity.kind === 'civ' && Boolean(inspectedCiv)) ||
      (selectedEntity.kind === 'animal' && Boolean(inspectedAnimal)) ||
      (selectedEntity.kind === 'vehicle' && Boolean(inspectedVehicle)));

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* 3D WebGL Canvas Host */}
      <div ref={canvasHostRef} className="absolute inset-0 h-full w-full" />

      {/* 3D Contextual World Labels */}
      {!photoModeActive && (
        <ContextualWorldLabels
          rendererRef={rendererRef}
          telemetryRef={telemetryRef}
          labelMode={labelMode}
          selectedCityId={selectedEntity?.kind === 'city' ? selectedEntity.id : null}
          onSelectCity={(cityId, wx, wy, wz) => {
            setSelectedEntity({ kind: 'city', id: cityId });
            handleJumpTo(wx, wy + 4, wz);
          }}
          onSelectStructure={(structId, wx, wy, wz) => {
            setSelectedEntity({ kind: 'structure', id: structId });
            handleJumpTo(wx, wy + 4, wz);
          }}
        />
      )}

      {/* Photo Mode Rule-of-Thirds Overlay & Floating Bar */}
      {photoModeActive && (
        <div className="pointer-events-none fixed inset-0 z-40">
          {photoGridRuleOfThirds && (
            <div className="grid h-full w-full grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="border border-white/15" />
              ))}
            </div>
          )}
          <div className="pointer-events-auto absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/90 px-4 py-2 shadow-xl">
            <span className="text-xs font-bold text-amber-300">PHOTO MODE</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <span>FOV</span>
              <input
                type="range"
                min={28}
                max={75}
                value={photoFov}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPhotoFov(v);
                  rendererRef.current?.setPhotoModeSettings({ fov: v });
                }}
                className="w-20 accent-amber-400"
              />
            </label>
            <button
              onClick={() => setPhotoGridRuleOfThirds((v) => !v)}
              className={`rounded px-2 py-1 text-xs ${
                photoGridRuleOfThirds
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => {
                const url = rendererRef.current?.captureScreenshotDataUrl();
                if (url) {
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `voxel-populi-yr${telemetry?.year || 1}.png`;
                  a.click();
                }
              }}
              className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <Camera className="h-3.5 w-3.5" /> Save 1x PNG
            </button>
            <button
              onClick={() => {
                const url = rendererRef.current?.captureScreenshotDataUrl();
                if (url) {
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `voxel-populi-yr${telemetry?.year || 1}-2x.png`;
                  a.click();
                }
              }}
              className="flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-500"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Save 2x Hi-Res
            </button>
            <button
              onClick={() => {
                setPhotoModeActive(false);
                rendererRef.current?.setPhotoModeSettings({ active: false });
              }}
              className="rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
            >
              Exit (Esc)
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          1a. THIN, MOSTLY TRANSPARENT TOP HUD BAR (Zero backdrop-blur)
         ===================================================================== */}
      {!photoModeActive && (
        <header className="fixed top-0 right-0 left-0 z-30 flex h-11 items-center justify-between border-b border-slate-800/75 bg-slate-950/75 px-3 text-xs">
          {/* Left: World Identity & WorldGen v5 2D Pixel Art Badge */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-bold tracking-wide text-amber-400">
              <Globe className="h-4 w-4" />
              <span>VOXEL POPULI 2D</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="font-semibold text-slate-200">
              {telemetry?.worldName || 'Aurelia Prime'}
            </span>
            <span className="rounded border border-emerald-500/40 bg-emerald-950/70 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
              v{telemetry?.worldGenVersion || WORLD_GEN_VERSION} Pixel God Sim
            </span>
            <span className="hidden rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] text-slate-400 md:inline">
              Pop {telemetry?.totalPopulation ?? 0} · Cities {telemetry?.cities.length ?? 0}
            </span>
          </div>

          {/* Center: Year, Season, Time of Day & Speed Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/85 px-2.5 py-1">
              <span className="font-bold text-amber-300">
                Year {telemetry?.year ?? 1}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-300">{telemetry?.season ?? 'Spring'}</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-sky-300">{formattedHour}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300">{telemetry?.weather ?? 'Clear'}</span>
            </div>

            {/* Pause & Speed Buttons */}
            <div className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/85 p-0.5">
              <button
                onClick={handleTogglePause}
                title="Pause / Resume Simulation (Space)"
                className={`flex items-center gap-1 rounded px-2 py-1 font-semibold transition ${
                  telemetry?.isPaused
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                {telemetry?.isPaused ? (
                  <Play className="h-3.5 w-3.5" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
              </button>
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSetSpeed(opt.value)}
                  title={`Simulation Speed ${opt.label}`}
                  className={`rounded px-1.5 py-1 text-[11px] font-semibold transition ${
                    !telemetry?.isPaused && telemetry?.speedMultiplier === opt.value
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Camera Mode, Photo Mode, Command Palette (Ctrl+K) & Help (?) */}
          <div className="flex items-center gap-1.5">
            <div className="hidden items-center gap-0.5 rounded border border-slate-800 bg-slate-900/85 p-0.5 sm:flex">
              {(
                [
                  { id: 'orbit', label: 'Orbit' },
                  { id: 'freefly', label: 'Free-Fly' },
                  { id: 'follow', label: 'Follow' },
                  { id: 'cinematic', label: 'Cinematic' },
                ] as { id: CameraMode; label: string }[]
              ).map((cm) => (
                <button
                  key={cm.id}
                  onClick={() => handleSetCameraMode(cm.id)}
                  title={`Camera Mode: ${cm.label}`}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition ${
                    cameraMode === cm.id
                      ? 'bg-sky-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {cm.label}
                </button>
              ))}
            </div>

            <a
              href="/human-ai-engine.zip"
              download="human-ai-engine.zip"
              title="Download Pure Human AI Folder (.zip) — Zero Graphics / Zero WorldGen"
              className="flex items-center gap-1 rounded border border-emerald-500/60 bg-emerald-950/90 px-2.5 py-1 font-semibold text-emerald-300 hover:bg-emerald-900/90"
            >
              <Download className="h-3.5 w-3.5 text-emerald-300" />
              <span>Human AI (.zip)</span>
            </a>

            <a
              href="/human_ai_standalone.ts"
              download="human_ai_standalone.ts"
              title="Download Single-File Pure Human AI Engine (human_ai_standalone.ts)"
              className="hidden items-center gap-1 rounded border border-amber-500/50 bg-amber-950/80 px-2 py-1 font-medium text-amber-300 hover:bg-amber-900/80 xl:flex"
            >
              <Download className="h-3.5 w-3.5 text-amber-300" />
              <span>AI (.ts)</span>
            </a>

            <button
              onClick={() => {
                setPhotoModeActive(true);
                rendererRef.current?.setPhotoModeSettings({ active: true });
              }}
              title="Photo Mode (P)"
              className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/85 px-2 py-1 text-slate-200 hover:border-amber-400/60"
            >
              <Camera className="h-3.5 w-3.5 text-amber-300" />
              <span className="hidden lg:inline">Photo</span>
            </button>

            <button
              onClick={() => setCommandPaletteOpen(true)}
              title="Search & Jump Command Palette (Ctrl+K)"
              className="flex items-center gap-1.5 rounded border border-slate-800 bg-slate-900/85 px-2 py-1 text-slate-200 hover:border-sky-400/60"
            >
              <Search className="h-3.5 w-3.5 text-sky-300" />
              <span className="hidden lg:inline">Search</span>
              <kbd className="rounded bg-slate-800 px-1 text-[10px] text-slate-400">
                ⌘K
              </kbd>
            </button>

            <button
              onClick={() => setHotkeyModalOpen(true)}
              title="Keyboard Shortcuts & Help (?)"
              className="rounded border border-slate-800 bg-slate-900/85 p-1.5 text-slate-200 hover:border-amber-400/60"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
      )}

      {/* Active God Power or Terraforming Brush Targeting Banner */}
      {!photoModeActive && (activeGodPower || activeTerraformBrush) && (
        <div className="fixed top-13 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-md border border-amber-400/80 bg-slate-950/90 px-3.5 py-1.5 text-xs shadow-lg">
          <Sparkles className="h-4 w-4 text-amber-300" />
          {activeTerraformBrush ? (
            <span>
              Brush: <strong>{activeTerraformBrush.name}</strong> (Radius {brushRadius}) — Click or drag on terrain
            </span>
          ) : (
            <span>
              Targeting <strong>{activeGodPower?.name}</strong> ({activeGodPower?.category}) — Click terrain to cast
            </span>
          )}
          <button
            onClick={() => {
              setActiveGodPower(null);
              setActiveTerraformBrush(null);
            }}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* =====================================================================
          1b. SLIM LEFT ICON DOCK (Opens ONE panel at a time, zero horizontal scroll)
         ===================================================================== */}
      {!photoModeActive && (
        <aside className="fixed top-11 bottom-9 left-0 z-30 flex">
          <div className="flex w-12 flex-col items-center justify-between border-r border-slate-800/80 bg-slate-950/85 py-2">
            <div className="flex flex-col items-center gap-1.5">
              {(
                [
                  { id: 'world', icon: Globe, label: 'World & Saves' },
                  { id: 'civs', icon: Crown, label: 'Civilizations & Diplomacy' },
                  { id: 'people', icon: Users, label: 'People, Roles & Census' },
                  { id: 'chronicle', icon: BookOpen, label: 'Chronicle, Charts & Replay' },
                  { id: 'powers', icon: Wand2, label: 'God Powers & Disasters' },
                  { id: 'overlays', icon: Layers, label: 'Map Overlays & Nav Grid' },
                  { id: 'settings', icon: Sliders, label: 'Graphics, Lighting & Audio' },
                  { id: 'debug', icon: Bug, label: 'Debug, Watchdog & Tests' },
                  { id: 'help', icon: HelpCircle, label: 'Controls & Guide' },
                ] as { id: Exclude<DockPanelId, null>; icon: React.ComponentType<{ className?: string }>; label: string }[]
              ).map((item) => {
                const Icon = item.icon;
                const isActive = activeDockPanel === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleDockPanel(item.id)}
                    title={item.label}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                      isActive
                        ? 'border-amber-400/80 bg-amber-500/20 text-amber-300'
                        : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                const nextMute = !audioMuted;
                setAudioMuted(nextMute);
                soundEngineRef.current?.ensureInitialized();
                soundEngineRef.current?.updateSettings({ muted: nextMute });
              }}
              title={audioMuted ? 'Unmute Procedural Audio' : 'Mute Procedural Audio'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            >
              {audioMuted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400" />
              )}
            </button>
          </div>

          {/* Single Active Left Drawer Panel */}
          {activeDockPanel && (
            <div className="flex h-full w-84 flex-col border-r border-slate-800/80 bg-slate-950/92 shadow-2xl overflow-x-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
                <h2 className="text-xs font-bold tracking-wider uppercase text-amber-300">
                  {activeDockPanel === 'world' && 'World Instances & Seed'}
                  {activeDockPanel === 'civs' && 'Civilizations & Diplomacy'}
                  {activeDockPanel === 'people' && 'People, Roles & Census'}
                  {activeDockPanel === 'chronicle' && 'Chronicle, Charts & Replay'}
                  {activeDockPanel === 'powers' && 'God Powers & Disasters'}
                  {activeDockPanel === 'overlays' && 'Overlays & Navigation'}
                  {activeDockPanel === 'settings' && 'Graphics, Sky & Audio'}
                  {activeDockPanel === 'debug' && 'Debug, Watchdog & Tests'}
                  {activeDockPanel === 'help' && 'Controls & Help'}
                </h2>
                <button
                  onClick={() => setActiveDockPanel(null)}
                  title="Close Panel"
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 text-xs">
                {/* PANEL 1: WORLD */}
                {activeDockPanel === 'world' && (
                  <>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">Current World</span>
                        <span className="rounded bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          WorldGen v{telemetry?.worldGenVersion || WORLD_GEN_VERSION}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Name: <strong className="text-white">{telemetry?.worldName}</strong> · Seed:{' '}
                        <code className="text-amber-300">{telemetry?.seed}</code>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          onClick={() => simWorkerRef.current?.postMessage({ type: 'REQUEST_SAVE' })}
                          className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-500"
                        >
                          <Save className="h-3.5 w-3.5" /> Save Snapshot
                        </button>
                        <label className="flex cursor-pointer items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-slate-200 hover:bg-slate-700">
                          <Upload className="h-3.5 w-3.5" /> Import JSON
                          <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              file.text().then((txt) => {
                                const parsed = JSON.parse(txt);
                                simWorkerRef.current?.postMessage({
                                  type: 'LOAD_SAVED_WORLD',
                                  serializedState: parsed.serializedState || txt,
                                });
                              });
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                      <div className="font-semibold text-slate-200">Create New World (v3)</div>
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={newWorldName}
                          onChange={(e) => setNewWorldName(e.target.value)}
                          placeholder="World Name"
                          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={newWorldSeed}
                            onChange={(e) => setNewWorldSeed(e.target.value)}
                            placeholder="Seed"
                            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-amber-300"
                          />
                          <button
                            onClick={() =>
                              setNewWorldSeed(`AURELIA-${Math.floor(100 + Math.random() * 900)}`)
                            }
                            className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                          >
                            Random
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                          <span>Starting Civilizations: {newWorldCivs}</span>
                          <input
                            type="range"
                            min={1}
                            max={6}
                            value={newWorldCivs}
                            onChange={(e) => setNewWorldCivs(Number(e.target.value))}
                            className="w-28 accent-amber-400"
                          />
                        </div>
                        <button
                          onClick={() => {
                            simWorkerRef.current?.postMessage({
                              type: 'INIT_NEW_WORLD',
                              worldId: `world-${Date.now()}`,
                              worldName: newWorldName,
                              seed: newWorldSeed,
                              settings: { startingCivs: newWorldCivs },
                            });
                          }}
                          className="flex w-full items-center justify-center gap-1 rounded bg-amber-500 py-1.5 font-bold text-slate-950 hover:bg-amber-400"
                        >
                          <Plus className="h-3.5 w-3.5" /> Generate New World
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-semibold text-slate-300">
                        Saved Worlds ({savedWorlds.length})
                      </div>
                      {savedWorlds.map((sw) => (
                        <div
                          key={sw.id}
                          className="flex items-center justify-between rounded border border-slate-800 bg-slate-900/60 p-2"
                        >
                          <div>
                            <div className="font-semibold text-white">{sw.name}</div>
                            <div className="text-[10px] text-slate-400">
                              Yr {sw.year} · Pop {sw.population} · Seed {sw.seed}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                simWorkerRef.current?.postMessage({
                                  type: 'LOAD_SAVED_WORLD',
                                  serializedState: sw.serializedState,
                                })
                              }
                              className="rounded bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-500"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => exportWorldToJsonFile(sw)}
                              title="Export JSON"
                              className="rounded bg-slate-800 p-1 text-slate-300 hover:bg-slate-700"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                deleteWorldInstance(sw.id).then(() =>
                                  listWorldInstances().then(setSavedWorlds)
                                )
                              }
                              title="Delete"
                              className="rounded bg-slate-800 p-1 text-rose-400 hover:bg-slate-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* PANEL 2: CIVILIZATIONS */}
                {activeDockPanel === 'civs' && telemetry && (
                  <div className="space-y-2.5">
                    {telemetry.civilizations.map((civ) => (
                      <div
                        key={civ.id}
                        onClick={() => setSelectedEntity({ kind: 'civ', id: civ.id })}
                        className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 transition hover:border-amber-400/60"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: civ.colorHex }}
                            />
                            <span className="font-bold text-white">{civ.name}</span>
                          </div>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-amber-300">
                            {civ.era}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-300">
                          {civ.governmentType} · {civ.rulerTitle} {civ.rulerName}
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px]">
                          <div className="rounded bg-slate-950/80 p-1">
                            <div className="text-slate-400">Pop / Cities</div>
                            <div className="font-bold text-white">
                              {civ.population} / {civ.citiesCount}
                            </div>
                          </div>
                          <div className="rounded bg-slate-950/80 p-1">
                            <div className="text-slate-400">Military</div>
                            <div className="font-bold text-rose-300">{civ.militaryPower}</div>
                          </div>
                          <div className="rounded bg-slate-950/80 p-1">
                            <div className="text-slate-400">Treasury</div>
                            <div className="font-bold text-amber-300">{civ.treasuryCoins}g</div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {civ.discoveredTechs.slice(-4).map((t) => (
                            <span
                              key={t}
                              className="rounded bg-sky-950/80 border border-sky-500/30 px-1.5 py-0.5 text-[10px] text-sky-300"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PANEL 3: PEOPLE & CENSUS */}
                {activeDockPanel === 'people' && telemetry && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={peopleSearch}
                      onChange={(e) => setPeopleSearch(e.target.value)}
                      placeholder="Filter notable citizens or roles..."
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
                    />

                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5">
                      <div className="font-semibold text-slate-200">
                        Life Stage Census (Pop {telemetry.totalPopulation})
                      </div>
                      <div className="grid grid-cols-5 gap-1 text-center text-[10px]">
                        {Object.entries(telemetry.societyCensus.lifeStageCounts).map(
                          ([stage, count]) => (
                            <div key={stage} className="rounded bg-slate-950 p-1">
                              <div className="text-slate-400">{stage}</div>
                              <div className="font-bold text-amber-300">{count}</div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5">
                      <div className="font-semibold text-slate-200">
                        Active Guilds & Roles ({telemetry.societyCensus.activeUniqueRolesCount} /{' '}
                        {telemetry.societyCensus.totalUniqueRolesInCatalog})
                      </div>
                      <div className="space-y-1">
                        {telemetry.societyCensus.topActiveRoles.slice(0, 8).map((r) => (
                          <div
                            key={r.title}
                            className="flex items-center justify-between rounded bg-slate-950/80 px-2 py-1 text-[11px]"
                          >
                            <span className="text-slate-200">{r.title}</span>
                            <span className="text-amber-300 font-semibold">{r.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="font-semibold text-slate-200">Notable Citizens</div>
                      {telemetry.notableHallOfFame
                        .filter(
                          (a) =>
                            !peopleSearch ||
                            a.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
                            a.roleTitle.toLowerCase().includes(peopleSearch.toLowerCase())
                        )
                        .map((a) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              simWorkerRef.current?.postMessage({
                                type: 'SELECT_AGENT',
                                agentId: a.id,
                              });
                              setSelectedEntity({ kind: 'agent', id: a.id });
                              handleJumpTo(a.x, a.y + 3, a.z);
                            }}
                            className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-900/70 p-2 text-left hover:border-amber-400/60"
                          >
                            <div>
                              <div className="font-semibold text-amber-300">{a.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {a.roleTitle} · Age {a.age} ({a.lifeStage}) · {a.expression}
                              </div>
                            </div>
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* PANEL 4: CHRONICLE, CHARTS & REPLAY */}
                {activeDockPanel === 'chronicle' && telemetry && (
                  <div className="space-y-3">
                    {telemetry.civilizations[0] && (
                      <div className="grid grid-cols-2 gap-2">
                        <SparklineCard
                          label="Population History"
                          data={telemetry.civilizations[0].historySeries.map((h) => h.population)}
                          color={telemetry.civilizations[0].colorHex}
                          currentValue={telemetry.totalPopulation}
                        />
                        <SparklineCard
                          label="Discovered Techs"
                          data={telemetry.civilizations[0].historySeries.map((h) => h.techCount)}
                          color="#38BDF8"
                          currentValue={telemetry.civilizations[0].discoveredTechs.length}
                        />
                      </div>
                    )}

                    {/* History Snapshot Replay / Fork */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                        <History className="h-3.5 w-3.5" />
                        <span>Timeline Snapshots (Replay / Fork)</span>
                      </div>
                      {telemetry.historySnapshots && telemetry.historySnapshots.length > 0 ? (
                        <div className="space-y-1">
                          {telemetry.historySnapshots
                            .slice()
                            .reverse()
                            .map((snap) => (
                              <div
                                key={snap.id}
                                className="flex items-center justify-between rounded bg-slate-950 px-2 py-1 text-[11px]"
                              >
                                <div>
                                  <span className="font-bold text-white">Year {snap.year}</span>{' '}
                                  <span className="text-slate-400">
                                    · Pop {snap.population} · {snap.eraSummary}
                                  </span>
                                </div>
                                <button
                                  onClick={() =>
                                    simWorkerRef.current?.postMessage({
                                      type: 'FORK_SNAPSHOT',
                                      serializedState: snap.serializedState,
                                    })
                                  }
                                  className="flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/30"
                                >
                                  <RotateCcw className="h-3 w-3" /> Fork Here
                                </button>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-400">
                          Snapshots are recorded automatically every 3 years.
                        </div>
                      )}
                    </div>

                    {/* World Events List */}
                    <div className="space-y-1.5">
                      <div className="font-semibold text-slate-200">World Chronicle</div>
                      {telemetry.events.slice(0, 25).map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => handleJumpTo(ev.x, ev.y + 4, ev.z)}
                          className="w-full rounded border border-slate-800 bg-slate-900/60 p-2 text-left hover:border-sky-400/60"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white">{ev.title}</span>
                            <span className="text-[10px] text-amber-300">Yr {ev.year}</span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {ev.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* PANEL 5: GOD POWERS & TERRAFORMING BRUSHES */}
                {activeDockPanel === 'powers' && (
                  <div className="space-y-3">
                    {/* Terraforming & Spawning Brushes */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-300">
                          2D Terraforming & Spawning Brushes
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Radius: {brushRadius} tiles
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        value={brushRadius}
                        onChange={(e) => setBrushRadius(Number(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        {TERRAFORM_BRUSHES.map((tb) => {
                          const selected = activeTerraformBrush?.id === tb.id;
                          return (
                            <button
                              key={tb.id}
                              onClick={() => {
                                setActiveGodPower(null);
                                setActiveTerraformBrush(selected ? null : tb);
                              }}
                              title={tb.description}
                              className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-left text-[11px] transition ${
                                selected
                                  ? 'border-amber-400 bg-amber-500/20 font-semibold text-white'
                                  : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: tb.colorHex }}
                              />
                              <span className="truncate">{tb.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-[11px] font-semibold text-slate-300">
                      Divine Blessings & Disasters
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {GOD_POWERS.map((gp) => {
                        const selected = activeGodPower?.id === gp.id;
                        return (
                          <button
                            key={gp.id}
                            onClick={() => {
                              setActiveTerraformBrush(null);
                              setActiveGodPower(selected ? null : gp);
                            }}
                            className={`flex items-start justify-between rounded-lg border p-2.5 text-left transition ${
                              selected
                                ? 'border-amber-400 bg-amber-500/20'
                                : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold text-white">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: gp.colorHex }}
                                />
                                <span>{gp.name}</span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {gp.description}
                              </div>
                            </div>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                gp.category === 'Blessing'
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : 'bg-rose-950 text-rose-300'
                              }`}
                            >
                              {gp.category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* PANEL 6: OVERLAYS & INTERIOR CUTAWAY */}
                {activeDockPanel === 'overlays' && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2.5">
                      <div className="font-semibold text-slate-200">2D Map Data Overlays</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { id: 'none', label: 'Standard View' },
                            { id: 'biomes', label: 'Biome Map' },
                            { id: 'territories', label: 'Civ Borders' },
                            { id: 'fertility', label: 'Soil Fertility' },
                            { id: 'resources', label: 'Ore & Timber' },
                            { id: 'wealth', label: 'City Wealth' },
                            { id: 'crime', label: 'Law & Unrest' },
                            { id: 'happiness', label: 'Happiness' },
                          ] as { id: MapOverlayMode; label: string }[]
                        ).map((ov) => (
                          <button
                            key={ov.id}
                            onClick={() => {
                              setMapOverlayMode(ov.id);
                              rendererRef.current?.setMapOverlayMode(ov.id);
                            }}
                            className={`rounded py-1.5 px-2 text-[11px] font-semibold transition ${
                              mapOverlayMode === ov.id
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {ov.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2.5">
                      <div className="font-semibold text-slate-200">World Labels</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['contextual', 'all', 'off'] as const).map((m) => (
                          <button
                            key={m}
                            onClick={() => setLabelMode(m)}
                            className={`rounded py-1.5 text-xs font-semibold capitalize ${
                              labelMode === m
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2.5">
                      <label className="flex items-center justify-between cursor-pointer">
                        <span>Interior Roof Cutaway (See Inside Buildings)</span>
                        <input
                          type="checkbox"
                          checked={interiorCutaway}
                          onChange={(e) => {
                            setInteriorCutaway(e.target.checked);
                            rendererRef.current?.setInteriorCutaway(e.target.checked);
                          }}
                          className="accent-amber-400"
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span>Territory & Trade Route Rings</span>
                        <input
                          type="checkbox"
                          checked={showTerritoryRings}
                          onChange={(e) => {
                            setShowTerritoryRings(e.target.checked);
                            rendererRef.current?.setChunkDebugVisible(e.target.checked);
                          }}
                          className="accent-amber-400"
                        />
                      </label>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span>Building Wall & Doorway Nav Grid</span>
                        <input
                          type="checkbox"
                          checked={showNavDebugGrid}
                          onChange={(e) => {
                            setShowNavDebugGrid(e.target.checked);
                            rendererRef.current?.setNavDebugVisible(e.target.checked);
                          }}
                          className="accent-emerald-400"
                        />
                      </label>
                      <div className="text-[10px] text-slate-400">
                        Zooming in close or toggling Interior Roof Cutaway fades building roofs to reveal beds, hearths, anvils, and citizens inside.
                      </div>
                    </div>
                  </div>
                )}

                {/* PANEL 7: GRAPHICS, LIGHTING & AUDIO */}
                {activeDockPanel === 'settings' && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                      <div className="font-semibold text-slate-200">Graphics Quality</div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {QUALITY_OPTIONS.map((q) => (
                          <button
                            key={q}
                            onClick={() => {
                              setQualityPreset(q);
                              rendererRef.current?.setQualityPreset(q);
                            }}
                            className={`rounded py-1 text-xs font-semibold ${
                              qualityPreset === q
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                      <div className="font-semibold text-slate-200">
                        Continuous Sun, Moon & Sky
                      </div>
                      <label className="flex items-center justify-between cursor-pointer">
                        <span>Dynamic Day / Night Cycle</span>
                        <input
                          type="checkbox"
                          checked={dynamicDayNight}
                          onChange={(e) => {
                            setDynamicDayNight(e.target.checked);
                            rendererRef.current?.setDynamicCycle(e.target.checked);
                            if (e.target.checked) {
                              rendererRef.current?.setPhotoModeSettings({ timeOverride: null });
                            } else {
                              rendererRef.current?.setPhotoModeSettings({
                                timeOverride: manualTimeOfDay,
                              });
                            }
                          }}
                          className="accent-amber-400"
                        />
                      </label>
                      {!dynamicDayNight && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Fixed Hour</span>
                            <span>{manualTimeOfDay.toFixed(1)}h</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={24}
                            step={0.2}
                            value={manualTimeOfDay}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setManualTimeOfDay(v);
                              rendererRef.current?.setPhotoModeSettings({ timeOverride: v });
                            }}
                            className="w-full accent-amber-400"
                          />
                        </div>
                      )}
                    </div>

                    {/* Procedural Web Audio Controls */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">
                          Procedural Spatial Audio
                        </span>
                        <button
                          onClick={() => {
                            const next = !audioMuted;
                            setAudioMuted(next);
                            soundEngineRef.current?.ensureInitialized();
                            soundEngineRef.current?.updateSettings({ muted: next });
                          }}
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            audioMuted
                              ? 'bg-rose-600 text-white'
                              : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {audioMuted ? 'Muted' : 'Active'}
                        </button>
                      </div>

                      {(
                        [
                          {
                            label: 'Master Volume',
                            val: masterVol,
                            set: (v: number) => {
                              setMasterVol(v);
                              soundEngineRef.current?.updateSettings({ masterVolume: v });
                            },
                          },
                          {
                            label: 'Wind, Water & Birds',
                            val: ambienceVol,
                            set: (v: number) => {
                              setAmbienceVol(v);
                              soundEngineRef.current?.updateSettings({ ambienceVolume: v });
                            },
                          },
                          {
                            label: 'Work & Event SFX',
                            val: sfxVol,
                            set: (v: number) => {
                              setSfxVol(v);
                              soundEngineRef.current?.updateSettings({ sfxVolume: v });
                            },
                          },
                          {
                            label: 'Ambient Pentatonic Music',
                            val: musicVol,
                            set: (v: number) => {
                              setMusicVol(v);
                              soundEngineRef.current?.updateSettings({ musicVolume: v });
                            },
                          },
                        ] as const
                      ).map((slider) => (
                        <div key={slider.label} className="space-y-0.5">
                          <div className="flex justify-between text-[11px] text-slate-300">
                            <span>{slider.label}</span>
                            <span>{Math.round(slider.val * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={slider.val}
                            onChange={(e) => slider.set(Number(e.target.value))}
                            className="w-full accent-amber-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PANEL 8: DEBUG, WATCHDOG & SANDBOX TESTS (Item 1g) */}
                {activeDockPanel === 'debug' && telemetry && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5">
                      <div className="font-semibold text-amber-300">
                        Renderer & Frame Performance
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <div className="rounded bg-slate-950 p-1.5">
                          <span className="text-slate-400">FPS / Frame:</span>{' '}
                          <strong className="text-emerald-300">
                            {perfStats?.fps ?? 60} ({perfStats?.frameMs ?? 8}ms)
                          </strong>
                        </div>
                        <div className="rounded bg-slate-950 p-1.5">
                          <span className="text-slate-400">Sim Step:</span>{' '}
                          <strong className="text-sky-300">{telemetry.lastStepMs}ms</strong>
                        </div>
                        <div className="rounded bg-slate-950 p-1.5">
                          <span className="text-slate-400">Loaded Chunks:</span>{' '}
                          <strong className="text-white">{telemetry.loadedChunksCount}</strong>
                        </div>
                        <div className="rounded bg-slate-950 p-1.5">
                          <span className="text-slate-400">Wildlife / Ships:</span>{' '}
                          <strong className="text-white">
                            {telemetry.animals?.length ?? 0} / {telemetry.vehicles.length}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Item 5: Construction Watchdog & Collision Diagnostics */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5">
                      <div className="font-semibold text-emerald-300">
                        Construction & Navigation Watchdog
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span>Stalled Builds Auto-Fixed:</span>
                          <strong className="text-amber-300">
                            {telemetry.stalledBuildsFixedCount}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Agents Inside Solid Walls:</span>
                          <strong className="text-emerald-300">
                            {telemetry.agentsInsideSolidBlocksCount}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Stuck Agent Recoveries:</span>
                          <strong className="text-sky-300">
                            {telemetry.stuckRecoveriesCount}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Decayed Floating Leaves:</span>
                          <strong className="text-emerald-300">
                            {telemetry.totalDecayedLeavesCount}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* All Test Buttons strictly inside Debug Panel (Item 1g) */}
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-2">
                      <div className="font-semibold text-rose-300">
                        Verification & Stress Test Controls
                      </div>
                      <button
                        onClick={() =>
                          simWorkerRef.current?.postMessage({ type: 'TRIGGER_TEST_WAR' })
                        }
                        className="flex w-full items-center justify-center gap-1.5 rounded bg-rose-600/90 py-1.5 font-semibold text-white hover:bg-rose-500"
                      >
                        <Swords className="h-3.5 w-3.5" /> Trigger Test War Between Civs
                      </button>
                      <button
                        onClick={() =>
                          simWorkerRef.current?.postMessage({
                            type: 'RUN_STRESS_TEST',
                            targetPopulation: 2000,
                            speedMultiplier: 25,
                          })
                        }
                        className="flex w-full items-center justify-center gap-1.5 rounded bg-amber-600/90 py-1.5 font-semibold text-white hover:bg-amber-500"
                      >
                        <Zap className="h-3.5 w-3.5" /> 2,000 Agent Stress Test
                      </button>
                      <button
                        onClick={() =>
                          simWorkerRef.current?.postMessage({
                            type: 'CLEAR_CUT_FOREST_TEST',
                            wx: telemetry.cameraWorldX,
                            wz: telemetry.cameraWorldZ,
                            radius: 18,
                          })
                        }
                        className="flex w-full items-center justify-center gap-1.5 rounded bg-emerald-600/90 py-1.5 font-semibold text-white hover:bg-emerald-500"
                      >
                        <Trees className="h-3.5 w-3.5" /> Clear-Cut & Leaf Decay Audit
                      </button>
                      <button
                        onClick={() => handleJumpTo(680, 28, 680)}
                        className="flex w-full items-center justify-center gap-1.5 rounded bg-sky-600/90 py-1.5 font-semibold text-white hover:bg-sky-500"
                      >
                        <Compass className="h-3.5 w-3.5" /> Fly +680 Blocks Horizon Test
                      </button>
                    </div>
                  </div>
                )}

                {/* PANEL 9: HELP */}
                {activeDockPanel === 'help' && (
                  <div className="space-y-2.5 text-[11px] text-slate-300">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5">
                      <div className="font-semibold text-amber-300">Camera & Selection</div>
                      <div>• Left-click any Person, Building, City, Animal, or Ship to inspect.</div>
                      <div>• Right-drag or Left-drag to orbit/pan; Scroll wheel to zoom.</div>
                      <div>• Use WASD / Arrow keys to pan across the infinite world.</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-1.5">
                      <div className="font-semibold text-sky-300">Keyboard Shortcuts</div>
                      <div>• <kbd className="rounded bg-slate-800 px-1">Ctrl+K</kbd> Open Command Palette</div>
                      <div>• <kbd className="rounded bg-slate-800 px-1">Space</kbd> Pause / Resume simulation</div>
                      <div>• <kbd className="rounded bg-slate-800 px-1">P</kbd> Toggle Photo Mode</div>
                      <div>• <kbd className="rounded bg-slate-800 px-1">?</kbd> Open Hotkey Reference</div>
                      <div>• <kbd className="rounded bg-slate-800 px-1">Esc</kbd> Clear selection or close panel</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* =====================================================================
          1a. SMALL INTERACTIVE MINIMAP IN TOP-RIGHT CORNER
         ===================================================================== */}
      {!photoModeActive && (
        <div
          className={`fixed top-13 z-20 flex flex-col rounded-lg border border-slate-800/80 bg-slate-950/85 p-1.5 shadow-lg transition-all ${
            inspectorVisible ? 'right-82' : 'right-3'
          }`}
        >
          <canvas
            ref={minimapCanvasRef}
            width={136}
            height={136}
            onClick={handleMinimapClick}
            title="Click Minimap to Jump Camera"
            className="cursor-crosshair rounded border border-slate-800"
          />
          <div className="mt-1 flex items-center justify-between text-[10px]">
            <span className="font-mono text-slate-400">
              {telemetry?.cameraWorldX ?? 0}, {telemetry?.cameraWorldZ ?? 0}
            </span>
            <div className="flex gap-1">
              {(['civ', 'biome'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMinimapMode(m)}
                  className={`rounded px-1.5 py-0.5 uppercase ${
                    minimapMode === m
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          1c. CONTEXTUAL RIGHT INSPECTOR (Only appears when an entity is selected)
         ===================================================================== */}
      {inspectorVisible && telemetry && (
        <aside className="fixed top-11 right-0 bottom-9 z-30 flex w-80 flex-col border-l border-slate-800/80 bg-slate-950/92 shadow-2xl overflow-x-hidden">
          <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              {selectedEntity?.kind === 'agent' && 'Citizen Inspector'}
              {selectedEntity?.kind === 'city' && 'Settlement Inspector'}
              {selectedEntity?.kind === 'structure' && 'Building Inspector'}
              {selectedEntity?.kind === 'civ' && 'Civilization Inspector'}
              {selectedEntity?.kind === 'animal' && 'Wildlife Inspector'}
              {selectedEntity?.kind === 'vehicle' && 'Vessel / Vehicle Inspector'}
            </span>
            <button
              onClick={() => {
                setSelectedEntity(null);
                simWorkerRef.current?.postMessage({ type: 'SELECT_AGENT', agentId: null });
                if (rendererRef.current) rendererRef.current.followedAgentId = null;
              }}
              title="Close Inspector (Esc)"
              className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3 text-xs">
            {/* INSPECT AGENT */}
            {selectedEntity?.kind === 'agent' && telemetry.selectedAgent && (
              <>
                <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-300">
                      {telemetry.selectedAgent.name}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      {telemetry.selectedAgent.expression || 'Working'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {telemetry.selectedAgent.roleTitle} · House{' '}
                    {telemetry.selectedAgent.familyName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Age {telemetry.selectedAgent.age}/{telemetry.selectedAgent.maxAge} (
                    {telemetry.selectedAgent.lifeStage}) · {telemetry.selectedAgent.socialClass} ·{' '}
                    {telemetry.selectedAgent.wealthCoins} coins
                  </div>
                  <div className="pt-1 flex gap-1.5">
                    <button
                      onClick={() => {
                        handleSetCameraMode('follow');
                        if (rendererRef.current) {
                          rendererRef.current.followedAgentId = telemetry.selectedAgent!.id;
                        }
                      }}
                      className="flex-1 rounded bg-sky-600 py-1 text-[11px] font-semibold text-white hover:bg-sky-500"
                    >
                      Follow Camera
                    </button>
                    <button
                      onClick={() =>
                        handleJumpTo(
                          telemetry.selectedAgent!.x,
                          telemetry.selectedAgent!.y + 3,
                          telemetry.selectedAgent!.z
                        )
                      }
                      className="rounded bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                    >
                      Center
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">GOAP Goal & Gear</span>
                    {telemetry.selectedAgent.thoughtBubble && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-amber-300">
                        {telemetry.selectedAgent.thoughtBubble}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-medium text-amber-200">
                    {telemetry.selectedAgent.currentGoal || telemetry.selectedAgent.state}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tool: <strong className="text-slate-200">{telemetry.selectedAgent.equippedItem.name}</strong> ({telemetry.selectedAgent.equippedItem.material})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Schedule: <strong className="text-sky-300">{telemetry.selectedAgent.scheduleSlot}</strong>
                  </div>
                </div>

                {telemetry.selectedAgent.skills && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1.5">
                    <div className="font-semibold text-slate-200">Citizen Skills</div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="rounded bg-slate-950 p-1.5 flex justify-between">
                        <span className="text-slate-400">Farming</span>
                        <strong className="text-emerald-300">{telemetry.selectedAgent.skills.farming}</strong>
                      </div>
                      <div className="rounded bg-slate-950 p-1.5 flex justify-between">
                        <span className="text-slate-400">Carpentry</span>
                        <strong className="text-amber-300">{telemetry.selectedAgent.skills.carpentry}</strong>
                      </div>
                      <div className="rounded bg-slate-950 p-1.5 flex justify-between">
                        <span className="text-slate-400">Smithing</span>
                        <strong className="text-orange-300">{telemetry.selectedAgent.skills.smithing}</strong>
                      </div>
                      <div className="rounded bg-slate-950 p-1.5 flex justify-between">
                        <span className="text-slate-400">Combat</span>
                        <strong className="text-rose-300">{telemetry.selectedAgent.skills.combat}</strong>
                      </div>
                      <div className="rounded bg-slate-950 p-1.5 flex justify-between">
                        <span className="text-slate-400">Seafaring</span>
                        <strong className="text-sky-300">{telemetry.selectedAgent.skills.seafaring}</strong>
                      </div>
                      <div className="rounded bg-slate-950 p-1.5 flex justify-between">
                        <span className="text-slate-400">Scholarship</span>
                        <strong className="text-purple-300">{telemetry.selectedAgent.skills.scholarship}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {telemetry.selectedAgent.relationships &&
                  telemetry.selectedAgent.relationships.length > 0 && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1">
                      <div className="font-semibold text-slate-200">Family & Social Bonds</div>
                      {telemetry.selectedAgent.relationships.map((rel) => (
                        <div
                          key={rel.targetId}
                          onClick={() => {
                            setSelectedEntity({ kind: 'agent', id: rel.targetId });
                            simWorkerRef.current?.postMessage({
                              type: 'SELECT_AGENT',
                              agentId: rel.targetId,
                            });
                          }}
                          className="flex cursor-pointer items-center justify-between rounded bg-slate-950 px-2 py-1 text-[10px] hover:bg-slate-800"
                        >
                          <span className="font-medium text-slate-200">{rel.name}</span>
                          <span className="text-amber-300">{rel.relation}</span>
                        </div>
                      ))}
                    </div>
                  )}

                <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1.5">
                  <div className="font-semibold text-slate-200">Vital Needs</div>
                  {(
                    [
                      { label: 'Health', val: telemetry.selectedAgent.health, color: 'bg-emerald-500' },
                      { label: 'Nourishment', val: telemetry.selectedAgent.hunger, color: 'bg-amber-500' },
                      { label: 'Shelter', val: telemetry.selectedAgent.shelter, color: 'bg-sky-500' },
                      { label: 'Social', val: telemetry.selectedAgent.social, color: 'bg-purple-500' },
                    ] as const
                  ).map((bar) => (
                    <div key={bar.label} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">{bar.label}</span>
                        <span>{bar.val}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded bg-slate-950 overflow-hidden">
                        <div
                          className={`h-full ${bar.color}`}
                          style={{ width: `${Math.min(100, Math.max(0, bar.val))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1">
                  <div className="font-semibold text-slate-200">Life Memory Log</div>
                  {telemetry.selectedAgent.lifeLog.map((entry, idx) => (
                    <div key={idx} className="text-[10px] text-slate-300 border-b border-slate-800/60 pb-1">
                      {entry}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* INSPECT CITY (With Settlement Tier & 5-Factor Site Score Breakdown) */}
            {selectedEntity?.kind === 'city' && inspectedCity && (
              <>
                <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{inspectedCity.name}</span>
                    <span className="rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      {inspectedCity.settlementTier}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Biome: <strong className="text-emerald-300">{inspectedCity.biome}</strong> · Founded Yr {inspectedCity.foundedYear}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Population: <strong className="text-white">{inspectedCity.population}</strong> · Buildings: {inspectedCity.completedStructures}/{inspectedCity.structuresCount}
                  </div>
                </div>

                {/* Item 11: Settlement Site Scoring Breakdown */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      Settlement Site Score
                    </span>
                    <span className="rounded bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                      {inspectedCity.siteScore} / 100
                    </span>
                  </div>
                  {(
                    [
                      { label: 'Freshwater & Coast Access', val: inspectedCity.siteBreakdown?.water ?? 85 },
                      { label: 'Soil Fertility', val: inspectedCity.siteBreakdown?.fertility ?? 82 },
                      { label: 'Timber & Forest Abundance', val: inspectedCity.siteBreakdown?.timber ?? 84 },
                      { label: 'Stone & Ore Deposits', val: inspectedCity.siteBreakdown?.stone ?? 78 },
                      { label: 'Flat Buildable Terrace', val: inspectedCity.siteBreakdown?.flatness ?? 80 },
                    ] as const
                  ).map((row) => (
                    <div key={row.label} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-slate-400">{row.label}</span>
                        <span className="text-slate-200">{row.val}</span>
                      </div>
                      <div className="h-1.5 w-full rounded bg-slate-950 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${row.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5">
                  <div className="font-semibold text-slate-200 mb-1.5">Resource Stockpiles</div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="rounded bg-slate-950 p-1.5">Food: <strong>{inspectedCity.foodStock}</strong></div>
                    <div className="rounded bg-slate-950 p-1.5">Wood: <strong>{inspectedCity.woodStock}</strong></div>
                    <div className="rounded bg-slate-950 p-1.5">Stone: <strong>{inspectedCity.stoneStock}</strong></div>
                    <div className="rounded bg-slate-950 p-1.5">Ore: <strong>{inspectedCity.oreStock}</strong></div>
                  </div>
                </div>
              </>
            )}

            {/* INSPECT STRUCTURE (With Construction Watchdog Status) */}
            {selectedEntity?.kind === 'structure' && inspectedStructure && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-2">
                <div className="text-sm font-bold text-white">{inspectedStructure.name}</div>
                <div className="text-[11px] text-slate-300">
                  Category: <strong className="text-amber-300">{inspectedStructure.category}</strong> · {inspectedStructure.era}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Voxel Construction</span>
                    <span className="font-semibold text-emerald-300">
                      {inspectedStructure.progress} / {inspectedStructure.totalBlocks} blocks
                    </span>
                  </div>
                  <div className="h-2 w-full rounded bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (inspectedStructure.progress /
                              Math.max(1, inspectedStructure.totalBlocks)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="rounded bg-slate-950 p-2 text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Watchdog Status:</span>
                    <span className="font-semibold text-sky-300">
                      {inspectedStructure.stallStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Builders:</span>
                    <span className="font-semibold text-white">
                      {inspectedStructure.assignedBuildersCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Footprint:</span>
                    <span className="text-slate-300">
                      {inspectedStructure.width}×{inspectedStructure.depth}×{inspectedStructure.height}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* INSPECT ANIMAL */}
            {selectedEntity?.kind === 'animal' && inspectedAnimal && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-emerald-300">
                    {inspectedAnimal.species}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                    {inspectedAnimal.domain}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Behavior: <strong>{inspectedAnimal.state}</strong>
                </div>
                <button
                  onClick={() =>
                    handleJumpTo(inspectedAnimal.x, inspectedAnimal.y + 3, inspectedAnimal.z)
                  }
                  className="w-full rounded bg-emerald-600 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Center Camera on Wildlife
                </button>
              </div>
            )}

            {/* INSPECT VEHICLE / SHIP */}
            {selectedEntity?.kind === 'vehicle' && inspectedVehicle && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-sky-300">
                    {inspectedVehicle.type}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-amber-300">
                    Crew {inspectedVehicle.crewCount ?? 2}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Route: <strong>{inspectedVehicle.routeSummary || 'Active Trade Route'}</strong>
                </div>
                <div className="text-[11px] text-slate-400">
                  Cargo: {inspectedVehicle.cargoSummary || 'Timber, Grain & Trade Goods'}
                </div>
                <button
                  onClick={() =>
                    handleJumpTo(inspectedVehicle.x, inspectedVehicle.y + 3, inspectedVehicle.z)
                  }
                  className="w-full rounded bg-sky-600 py-1 text-xs font-semibold text-white hover:bg-sky-500"
                >
                  Center Camera on Vessel
                </button>
              </div>
            )}

            {/* INSPECT CIVILIZATION */}
            {selectedEntity?.kind === 'civ' && inspectedCiv && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/75 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: inspectedCiv.colorHex }}
                  />
                  <span className="text-sm font-bold text-white">{inspectedCiv.name}</span>
                </div>
                <div className="text-[11px] text-amber-300">
                  {inspectedCiv.era} · {inspectedCiv.governmentType}
                </div>
                <div className="text-[11px] text-slate-300">
                  {inspectedCiv.rulerTitle}: <strong>{inspectedCiv.rulerName}</strong>
                </div>
                <div className="text-[11px] text-slate-400">
                  Religion: {inspectedCiv.religionName} · Tax Rate: {inspectedCiv.taxRatePct}%
                </div>
                <div className="pt-1">
                  <div className="font-semibold text-slate-200 mb-1">Active Laws</div>
                  <div className="flex flex-wrap gap-1">
                    {inspectedCiv.activeLaws.map((law) => (
                      <span
                        key={law}
                        className="rounded bg-slate-950 px-1.5 py-0.5 text-[10px] text-slate-300"
                      >
                        {law}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* =====================================================================
          1a. THIN COLLAPSED TIMELINE STRIP AT BOTTOM (Expands on Click/Hover)
         ===================================================================== */}
      {!photoModeActive && (
        <footer
          onMouseEnter={() => setTimelineExpanded(true)}
          onMouseLeave={() => setTimelineExpanded(false)}
          className={`fixed right-0 bottom-0 left-0 z-20 border-t border-slate-800/80 bg-slate-950/80 transition-all ${
            timelineExpanded ? 'h-40' : 'h-9'
          }`}
        >
          <div className="flex h-9 items-center justify-between px-3 text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <button
                onClick={() => setTimelineExpanded((v) => !v)}
                className="flex items-center gap-1 font-semibold text-amber-300"
              >
                <History className="h-3.5 w-3.5" />
                <span>Chronicle & Timeline</span>
              </button>
              <span className="text-slate-600">|</span>
              {telemetry?.events[0] ? (
                <button
                  onClick={() =>
                    handleJumpTo(
                      telemetry.events[0].x,
                      telemetry.events[0].y + 4,
                      telemetry.events[0].z
                    )
                  }
                  className="truncate text-slate-300 hover:text-white"
                >
                  <strong className="text-sky-300">Yr {telemetry.events[0].year}:</strong>{' '}
                  {telemetry.events[0].title} — {telemetry.events[0].description}
                </button>
              ) : (
                <span className="text-slate-400">Simulation running...</span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
              <span>Wildlife: {telemetry?.animals?.length ?? 0}</span>
              <span>Ships/Carts: {telemetry?.vehicles.length ?? 0}</span>
              <span>FPS: {perfStats?.fps ?? 60}</span>
            </div>
          </div>

          {timelineExpanded && telemetry && (
            <div className="grid h-31 grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto px-3 pb-2 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  Recent Historical Events (Click to Jump)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {telemetry.events.slice(0, 8).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => handleJumpTo(ev.x, ev.y + 4, ev.z)}
                      className="rounded border border-slate-800 bg-slate-900/90 px-2 py-1 text-left text-[11px] hover:border-amber-400/60"
                    >
                      <span className="font-bold text-amber-300">Yr {ev.year}:</span>{' '}
                      <span className="text-slate-200">{ev.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  History Snapshots — Click to Rewind / Fork Timeline
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {telemetry.historySnapshots && telemetry.historySnapshots.length > 0 ? (
                    telemetry.historySnapshots.map((snap) => (
                      <button
                        key={snap.id}
                        onClick={() =>
                          simWorkerRef.current?.postMessage({
                            type: 'FORK_SNAPSHOT',
                            serializedState: snap.serializedState,
                          })
                        }
                        className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/50 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-900/60"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Yr {snap.year}</span>
                        <span className="text-[10px] text-slate-400">
                          (Pop {snap.population})
                        </span>
                      </button>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Recording snapshots every 3 years...
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </footer>
      )}

      {/* =====================================================================
          1e. COMMAND PALETTE MODAL (Ctrl+K)
         ===================================================================== */}
      {commandPaletteOpen && (
        <div
          onClick={() => setCommandPaletteOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 pt-20"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <Search className="h-4 w-4 text-sky-400" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Jump to any city, citizen, building, civilization, or god power..."
                className="flex-1 bg-transparent text-xs text-white outline-none"
              />
              <button
                onClick={() => setCommandPaletteOpen(false)}
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                Esc
              </button>
            </div>
            <div className="mt-2 max-h-72 overflow-y-auto space-y-1">
              {commandItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    setCommandPaletteOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-slate-800"
                >
                  <div>
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-[10px] text-slate-400">{item.subtitle}</div>
                  </div>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-amber-300">
                    {item.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          1e. HOTKEY HELP OVERLAY (?)
         ===================================================================== */}
      {hotkeyModalOpen && (
        <div
          onClick={() => setHotkeyModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl space-y-3 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-amber-300">
                KEYBOARD SHORTCUTS & UI GUIDE
              </span>
              <button
                onClick={() => setHotkeyModalOpen(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span>Command Palette (Search & Jump)</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-amber-300">Ctrl+K</kbd>
              </div>
              <div className="flex justify-between">
                <span>Pause / Resume Simulation</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-amber-300">Space</kbd>
              </div>
              <div className="flex justify-between">
                <span>Toggle Photo Mode & Hi-Res Capture</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-amber-300">P</kbd>
              </div>
              <div className="flex justify-between">
                <span>Clear Selection / Close Active Drawer</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-amber-300">Esc</kbd>
              </div>
              <div className="flex justify-between">
                <span>Pan Camera Across World</span>
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-amber-300">WASD / Arrows</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;

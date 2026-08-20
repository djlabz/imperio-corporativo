import { Application, Container, Culler, CullerPlugin, extensions } from "pixi.js";
import { attachDrawCallCounter } from "../render/debug/drawCallCounter";
import {
  createDebugOverlay,
  readHeapMB,
  updateDebugOverlay,
  type OverlaySnapshot,
} from "../render/debug/DebugOverlayView";
import { buildFlowField, NPC_TRAVERSAL } from "../render/npc/flowField";
import { buildNpcPoolView, syncNpcPoolView } from "../render/npc/NpcPoolView";
import { createNpcPool, stepNpcPool } from "../render/npc/npcPool";
import { applyToContainer, createCameraState } from "../render/world/camera";
import { attachCameraInput } from "../render/world/cameraInput";
import {
  computeBudgetOccupancyPercent,
  computeLow1PercentFps,
  createLongFrameTracker,
  createStatsTracker,
  instantFps,
  recordFrame,
  recordLongFrame,
} from "../render/world/debugStats";
import { buildTileGrid, WORLD_HEIGHT, WORLD_WIDTH } from "../render/world/tileMap";
import { buildTileMapView } from "../render/world/TileMapView";
import { ElectronSaveAdapter } from "../platform/save/ElectronSaveAdapter";
import { IndexedDbSaveAdapter } from "../platform/save/IndexedDbSaveAdapter";
import { loadLatestWorld, saveWorld } from "../platform/save/saveGame";
import type { SaveAdapter } from "../platform/save/SaveAdapter";
import { createWorld } from "../sim/core/World";
import { updateFrame, type FrameState } from "./frame";
import { createFixedStepLoop } from "./loop";
import { createUncappedScheduler, createVsyncScheduler } from "./frameScheduler";

declare global {
  interface Window {
    /**
     * Último OverlaySnapshot, sempre atualizado — não só em modo de benchmark.
     * É o que main.cts lê via `executeJavaScript` na Parte B da Etapa 6 (ver
     * docs/DECISOES.md), e o mesmo canal serve pra inspeção manual via
     * DevTools. Debug hook deliberado, não vazamento: não influencia o jogo.
     */
    __benchStats?: OverlaySnapshot;
  }
}

const BACKGROUND_COLOR = 0x1a1a1a;
const WORLD_SEED = "etapa-3";

/** Critério de aceite da Etapa 4: 500 NPCs visíveis, dentro de um pool de 600. */
const NPC_ACTIVE_COUNT = 500;
const NPC_POOL_CAPACITY = 600;

/**
 * ?uncapped na URL desliga o vsync: o loop roda solto (ver frameScheduler.ts).
 * É o único jeito de ver headroom real — sob vsync, FPS fica preso no
 * refresh do monitor e não distingue "sobrou 15ms de folga" de "sobrou
 * 0.1ms". Ver também: Orçamento (60fps) no overlay, que não depende disso.
 */
function isUncappedRequested(): boolean {
  return new URLSearchParams(window.location.search).has("uncapped");
}

/**
 * ?npcs=N sobrescreve a contagem de NPCs ativos (e a capacity do pool, sem
 * folga) — usado só pro teste de escala (0/500/1000/2000/4000). Sem a flag,
 * fica no critério de aceite da etapa: 500 ativos num pool de 600.
 */
function getNpcCountOverride(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get("npcs");
  if (raw === null) return undefined;
  const parsed = Math.floor(Number(raw));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function startGame(root: HTMLElement): Promise<Application> {
  // Precisa ser registrado antes de Application.init() — Culler.shared.cull()
  // funciona sem o plugin, mas o plugin é o que o Pixi recomenda pra simular
  // o comportamento automático de culling que existia antes do v8.
  extensions.add(CullerPlugin);

  const app = new Application();
  await app.init({
    resizeTo: root,
    background: BACKGROUND_COLOR,
    autoStart: false,
  });
  root.appendChild(app.canvas);

  const worldContainer = new Container({ sortableChildren: true });
  worldContainer.addChild(buildTileMapView(buildTileGrid()));
  app.stage.addChild(worldContainer);

  const npcCountOverride = getNpcCountOverride();
  const npcActiveCount = npcCountOverride ?? NPC_ACTIVE_COUNT;
  const npcCapacity = npcCountOverride !== undefined ? npcCountOverride : NPC_POOL_CAPACITY;

  const flowField = buildFlowField(NPC_TRAVERSAL);
  const npcPool = createNpcPool({ activeCount: npcActiveCount, capacity: npcCapacity });
  const npcPoolView = buildNpcPoolView(npcPool.capacity);
  worldContainer.addChild(npcPoolView.container);

  const overlay = createDebugOverlay();
  app.stage.addChild(overlay); // filho de app.stage, não de worldContainer — fica fixo na tela

  const cameraInput = attachCameraInput(
    app.canvas,
    worldContainer,
    createCameraState(WORLD_WIDTH / 2, WORLD_HEIGHT / 2),
    () => ({ width: app.screen.width, height: app.screen.height }),
  );

  const drawCallCounter = attachDrawCallCounter(app.renderer);

  let frameState: FrameState = {
    world: createWorld(WORLD_SEED),
    loop: createFixedStepLoop(),
    pendingCommands: [],
  };
  let stats = createStatsTracker();
  let longFrames = createLongFrameTracker();
  let lastFrameTime: number | undefined;

  // window.electronSave só existe dentro do Electron (exposto pelo preload).
  // No browser puro (dev via Vite, ou build web), cai no IndexedDB — os dois
  // adapters coexistem, ver CLAUDE.md/Save game.
  const saveAdapter: SaveAdapter = window.electronSave
    ? new ElectronSaveAdapter()
    : new IndexedDbSaveAdapter();

  // Gatilho manual de save/load pra validar o pipeline através do adapter de
  // filesystem no .exe nativo (Parte B da Etapa 6) — não há UI ainda
  // (src/ui/ vazio na Fase 0). S salva o World atual; L carrega o mais
  // recente e substitui frameState.world, preservando o loop (o acumulador
  // de tempo real não faz parte do contrato de determinismo).
  window.addEventListener("keydown", (event) => {
    if (event.key === "s") {
      saveWorld(saveAdapter, frameState.world)
        .then(() => console.log(`save ok — tick ${frameState.world.tickCount}`))
        .catch((error: unknown) => console.error("save falhou:", error));
    } else if (event.key === "l") {
      loadLatestWorld(saveAdapter)
        .then((world) => {
          frameState = { ...frameState, world };
          console.log(`load ok — tick ${world.tickCount}`);
        })
        .catch((error: unknown) => console.error("load falhou:", error));
    }
  });

  const uncapped = isUncappedRequested();
  const scheduler = uncapped ? createUncappedScheduler() : createVsyncScheduler();

  function runFrame(nowMs: number): void {
    const frameMs = lastFrameTime === undefined ? 0 : nowMs - lastFrameTime;
    lastFrameTime = nowMs;

    const updateStart = performance.now();
    const tickCountBefore = frameState.world.tickCount;
    // Fila vazia: a F1-E2 é só sim/, sem nada na tela e sem input ligado. O
    // clique que produz MINE/SELL entra na F1-E3 — a fronteira de D-016 já
    // está aqui esperando por ele.
    const result = updateFrame(frameState, frameMs, []);
    frameState = result.state;

    // NPC é decorativo: não mora em World, não passa por tick(). Mas o
    // movimento ainda é cadenciado pelo mesmo tick fixo do sim (Regra 3 —
    // deltaTime não multiplica valor de jogo, e "velocidade constante
    // independente do frame rate" é o mesmo princípio pra visual). Um passo
    // de NPC por tick que rodou neste frame, não um passo por frame.
    const camera = cameraInput.getState();
    for (let i = 1; i <= result.ticksRan; i++) {
      stepNpcPool(npcPool, flowField, tickCountBefore + i, camera.x, camera.y);
    }
    syncNpcPoolView(npcPoolView, npcPool);

    applyToContainer(camera, worldContainer, app.screen.width, app.screen.height);
    const updateMs = performance.now() - updateStart;

    // Reset e leitura no mesmo frame: como somos nós que chamamos app.render()
    // agora (autoStart:false), não há mais defasagem de 1 frame nos draw calls.
    drawCallCounter?.reset();
    Culler.shared.cull(app.stage, app.renderer.screen);
    const renderStart = performance.now();
    app.render();
    const renderMs = performance.now() - renderStart;

    stats = recordFrame(stats, frameMs);
    longFrames = recordLongFrame(longFrames, frameMs);
    const snapshot: OverlaySnapshot = {
      fps: instantFps(frameMs),
      low1PercentFps: computeLow1PercentFps(stats),
      frameMs,
      updateMs,
      renderMs,
      budgetOccupancyPercent: computeBudgetOccupancyPercent(updateMs + renderMs),
      uncapped,
      drawCalls: drawCallCounter?.count,
      heapMB: readHeapMB(),
      tickCount: frameState.world.tickCount,
      ticksThisFrame: result.ticksRan,
      backend: app.renderer.name,
      totalFrames: longFrames.totalFrames,
      framesOver20ms: longFrames.framesOver20ms,
      framesOver33ms: longFrames.framesOver33ms,
    };
    updateDebugOverlay(overlay, snapshot);
    window.__benchStats = snapshot;
  }

  scheduler.start(runFrame);

  return app;
}

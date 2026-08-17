import { Application, Container } from "pixi.js";
import { attachDrawCallCounter } from "../render/debug/drawCallCounter";
import {
  createDebugOverlay,
  readHeapMB,
  updateDebugOverlay,
} from "../render/debug/DebugOverlayView";
import { applyToContainer, createCameraState } from "../render/world/camera";
import { attachCameraInput } from "../render/world/cameraInput";
import {
  computeBudgetOccupancyPercent,
  computeLow1PercentFps,
  createStatsTracker,
  instantFps,
  recordFrame,
} from "../render/world/debugStats";
import { buildTileGrid, WORLD_HEIGHT, WORLD_WIDTH } from "../render/world/tileMap";
import { buildTileMapView } from "../render/world/TileMapView";
import { createWorld } from "../sim/core/World";
import { updateFrame, type FrameState } from "./frame";
import { createFixedStepLoop } from "./loop";
import { createUncappedScheduler, createVsyncScheduler } from "./frameScheduler";

const BACKGROUND_COLOR = 0x1a1a1a;
const WORLD_SEED = "etapa-3";

/**
 * ?uncapped na URL desliga o vsync: o loop roda solto (ver frameScheduler.ts).
 * É o único jeito de ver headroom real — sob vsync, FPS fica preso no
 * refresh do monitor e não distingue "sobrou 15ms de folga" de "sobrou
 * 0.1ms". Ver também: Orçamento (60fps) no overlay, que não depende disso.
 */
function isUncappedRequested(): boolean {
  return new URLSearchParams(window.location.search).has("uncapped");
}

export async function startGame(root: HTMLElement): Promise<Application> {
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

  const overlay = createDebugOverlay();
  app.stage.addChild(overlay); // filho de app.stage, não de worldContainer — fica fixo na tela

  const cameraInput = attachCameraInput(
    app.canvas,
    worldContainer,
    createCameraState(WORLD_WIDTH / 2, WORLD_HEIGHT / 2),
    () => ({ width: app.screen.width, height: app.screen.height }),
  );

  const drawCallCounter = attachDrawCallCounter(app.renderer);

  let frameState: FrameState = { world: createWorld(WORLD_SEED), loop: createFixedStepLoop() };
  let stats = createStatsTracker();
  let lastFrameTime: number | undefined;

  const uncapped = isUncappedRequested();
  const scheduler = uncapped ? createUncappedScheduler() : createVsyncScheduler();

  function runFrame(nowMs: number): void {
    const frameMs = lastFrameTime === undefined ? 0 : nowMs - lastFrameTime;
    lastFrameTime = nowMs;

    const updateStart = performance.now();
    const result = updateFrame(frameState, frameMs);
    frameState = result.state;
    applyToContainer(cameraInput.getState(), worldContainer, app.screen.width, app.screen.height);
    const updateMs = performance.now() - updateStart;

    // Reset e leitura no mesmo frame: como somos nós que chamamos app.render()
    // agora (autoStart:false), não há mais defasagem de 1 frame nos draw calls.
    drawCallCounter?.reset();
    const renderStart = performance.now();
    app.render();
    const renderMs = performance.now() - renderStart;

    stats = recordFrame(stats, frameMs);
    updateDebugOverlay(overlay, {
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
    });
  }

  scheduler.start(runFrame);

  return app;
}

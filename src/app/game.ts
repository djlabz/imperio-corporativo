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

const BACKGROUND_COLOR = 0x1a1a1a;
const WORLD_SEED = "etapa-3";

export async function startGame(root: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    resizeTo: root,
    background: BACKGROUND_COLOR,
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

  app.ticker.add(() => {
    // Draw calls do frame anterior: o contador zera aqui, e o render deste
    // frame só acontece depois, fora do nosso controle direto.
    const drawCallsLastFrame = drawCallCounter?.count;
    drawCallCounter?.reset();

    const frameMs = app.ticker.elapsedMS;
    const result = updateFrame(frameState, frameMs);
    frameState = result.state;

    applyToContainer(cameraInput.getState(), worldContainer, app.screen.width, app.screen.height);

    stats = recordFrame(stats, frameMs);
    updateDebugOverlay(overlay, {
      fps: instantFps(frameMs),
      low1PercentFps: computeLow1PercentFps(stats),
      frameMs,
      drawCalls: drawCallsLastFrame,
      heapMB: readHeapMB(),
      tickCount: frameState.world.tickCount,
      ticksThisFrame: result.ticksRan,
      backend: app.renderer.name,
    });
  });

  return app;
}

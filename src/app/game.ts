import { Application, Container, Culler, CullerPlugin, extensions } from "pixi.js";
import { attachDrawCallCounter } from "../render/debug/drawCallCounter";
import {
  createDebugOverlay,
  readHeapMB,
  updateDebugOverlay,
  type OverlaySnapshot,
} from "../render/debug/DebugOverlayView";
import { buildFlowField, NPC_TRAVERSAL } from "../render/npc/flowField";
import { buildManagerView, syncManagerView } from "../render/manager/ManagerView";
import {
  createManager,
  orderManager,
  stepManager,
  type Manager,
  type ManagerIntent,
} from "../render/manager/manager";
import { buildPlaceView } from "../render/world/PlacesView";
import { MAP, centerOf, containsPoint } from "../render/world/layout";
import { attachWorldInput, type WorldClick } from "../render/world/worldInput";
import { createReadout, updateReadout } from "../render/debug/ReadoutView";
import { MINING } from "../sim/data/balance";
import type { Command } from "../sim/core/Command";
import { buildNpcPoolView, syncNpcPoolView } from "../render/npc/NpcPoolView";
import { createNpcPool, stepNpcPool } from "../render/npc/npcPool";
import {
  applyToContainer,
  clampToWorld,
  createCameraState,
  fitZoom,
  type CameraState,
} from "../render/world/camera";
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

/**
 * Traduz a intenção do gerente (renderer) no comando do núcleo (D-016). É o único
 * ponto onde as duas camadas se encontram: o `sim/` nunca soube que existe
 * posição, e o gerente nunca soube que existe `Command`.
 */
function commandFor(intent: ManagerIntent | undefined): Command | undefined {
  switch (intent) {
    case "mine":
      return { kind: "MINE" };
    case "sell":
      return { kind: "SELL" };
    default:
      return undefined;
  }
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

  // Os dois lugares do mapa (D-017, complemento). Cores da paleta travada.
  worldContainer.addChild(buildPlaceView(MAP.deposit, 0x8b5a2b, MAP.reachRadius));
  worldContainer.addChild(buildPlaceView(MAP.refinery, 0x7a7a7a, MAP.reachRadius));

  const flowField = buildFlowField(NPC_TRAVERSAL);
  const npcPool = createNpcPool({ activeCount: npcActiveCount, capacity: npcCapacity });
  const npcPoolView = buildNpcPoolView(npcPool.capacity);
  worldContainer.addChild(npcPoolView.container);

  const managerView = buildManagerView();
  worldContainer.addChild(managerView.container);

  const readout = createReadout();

  const overlay = createDebugOverlay();
  app.stage.addChild(overlay); // filho de app.stage, não de worldContainer — fica fixo na tela
  app.stage.addChild(readout); // idem: instrumento, não parte do mundo

  const viewSize = (): { width: number; height: number } => ({
    width: app.screen.width,
    height: app.screen.height,
  });

  const constrainCamera = (state: CameraState): CameraState => {
    const { width, height } = viewSize();

    // Piso de zoom no "cabe o mundo": abaixo disso a viewport é MAIOR que o mundo
    // e sobra preto em volta, sem nada a mais pra ver. Foi exatamente o sintoma
    // relatado — mundo como um retângulo pequeno com preto em volta depois de ir
    // pra tela cheia: a zoom continuava a que caberia na janela ANTERIOR.
    //
    // É piso, não valor fixo: quem deu zoom PARA DENTRO fica onde está, porque aí
    // o mundo é maior que a tela e há mais o que ver panorâmicando. Só o lado que
    // não serve pra nada é corrigido.
    const floor = fitZoom(WORLD_WIDTH, WORLD_HEIGHT, width, height);
    const zoomed = state.zoom < floor ? { ...state, zoom: floor } : state;

    return clampToWorld(zoomed, WORLD_WIDTH, WORLD_HEIGHT, width, height);
  };

  const cameraInput = attachCameraInput(
    app.canvas,
    worldContainer,
    // Zoom inicial CALCULADO pra caber o mundo na viewport, em vez de um valor
    // fixo: a F1-E3 abria em MIN_ZOOM, que cabia o mundo em 1600x900 e deixava
    // preto em volta numa janela maior. Ver fitZoom em camera.ts.
    createCameraState(
      WORLD_WIDTH / 2,
      WORLD_HEIGHT / 2,
      fitZoom(WORLD_WIDTH, WORLD_HEIGHT, app.screen.width, app.screen.height),
    ),
    viewSize,
    constrainCamera,
  );

  // O gerente começa NA FRENTE do depósito, não em cima dele.
  //
  // Duas razões, e a segunda foi achada abrindo o jogo: nascer longe seria só
  // espera antes de o jogo começar; e nascer no CENTRO do retângulo o deixava
  // invisível. O Y-sort é por pé (mesmo critério de tiles, NPCs e lugares), e um
  // pé em y=1220 está dentro do retângulo 1140–1300, cuja base é 1300 — o prédio
  // desenha na frente, corretamente. Uma pessoa fica de pé na frente do prédio,
  // não dentro dele, e aí o Y-sort resolve sozinho.
  const [depositX] = centerOf(MAP.deposit);
  const depositFrontY = MAP.deposit.y + MAP.deposit.height + 24;
  let manager: Manager = createManager(depositX, depositFrontY);

  // Campo de OBJETIVO do gerente, separado do de travessia dos NPCs. Recomputado
  // a cada destino novo: medido em 0,1185ms de mediana (D-017), 0,7% de um frame.
  let managerField = buildFlowField({ kind: "point", x: depositX, y: depositFrontY });

  function handleClick(click: WorldClick): void {
    if (click.kind === "move") {
      managerField = buildFlowField({ kind: "point", x: click.x, y: click.y });
      manager = orderManager(manager, {
        targetX: click.x,
        targetY: click.y,
        intent: "none",
        arrivalRadius: MAP.arrivalRadius,
      });
      return;
    }

    // Clique esquerdo: só vale sobre um dos dois lugares. Clique esquerdo no
    // vazio não faz nada de propósito — mover é o botão direito.
    const target = containsPoint(MAP.deposit, click.x, click.y)
      ? ({ place: MAP.deposit, intent: "mine" } as const)
      : containsPoint(MAP.refinery, click.x, click.y)
        ? ({ place: MAP.refinery, intent: "sell" } as const)
        : undefined;
    if (!target) return;

    const [px, py] = centerOf(target.place);
    managerField = buildFlowField({ kind: "point", x: px, y: py });
    manager = orderManager(manager, {
      targetX: px,
      targetY: py,
      intent: target.intent,
      arrivalRadius: MAP.reachRadius,
    });
  }

  // Sem guardar o handle: como o cameraInput acima, isto fica ligado pelo tempo de
  // vida do processo. O jogo não tem caminho de teardown hoje.
  attachWorldInput(app.canvas, handleClick, cameraInput.getState, () => ({
    width: app.screen.width,
    height: app.screen.height,
  }));

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
    } else if (event.key === "n") {
      // Andaime de desenvolvimento, não conteúdo: os NPCs decorativos poluem a
      // leitura na hora de balancear (e vagam pra fora dos limites do mapa, o que
      // é comportamento conhecido do campo de travessia). Só a VISIBILIDADE é
      // desligada — o pool continua existindo e sendo atualizado, então isto não
      // é um jeito disfarçado de medir performance sem eles.
      npcPoolView.container.visible = !npcPoolView.container.visible;
      console.log(`NPCs decorativos: ${npcPoolView.container.visible ? "on" : "off"}`);
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
    // Antes de ler a câmera: reaplica o limite com o tamanho de tela ATUAL. É
    // isto que faz o redimensionamento funcionar — ver refresh() em cameraInput.ts
    // pro porquê de não ser um listener de resize.
    cameraInput.refresh();
    const camera = cameraInput.getState();
    for (let i = 1; i <= result.ticksRan; i++) {
      stepNpcPool(npcPool, flowField, tickCountBefore + i, camera.x, camera.y);
    }
    // O gerente anda um passo por TICK que rodou, não por frame — mesmo
    // princípio do pool de NPC (Regra 3: velocidade não depende do frame rate).
    //
    // A intenção que dispara ao chegar entra em pendingCommands em vez de ir
    // direto pro tick deste frame. Duas razões: os ticks deste frame já rodaram,
    // e perguntar ao acumulador quantos VÃO rodar (pra andar antes) duplicaria a
    // decisão que updateFrame já toma, criando duas fontes pra mesma verdade. O
    // custo é o comando esperar o próximo tick — no máximo 100ms, e a fila é
    // exatamente o mecanismo que a F1-E2 construiu pra isso.
    for (let i = 0; i < result.ticksRan; i++) {
      const step = stepManager(manager, managerField, MAP.managerSpeedPerTick);
      manager = step.manager;
      const command = commandFor(step.fired);
      if (command) {
        frameState = {
          ...frameState,
          pendingCommands: frameState.pendingCommands.concat([command]),
        };
      }
    }

    syncManagerView(managerView, manager);
    updateReadout(readout, {
      money: frameState.world.money,
      stockKg: frameState.world.stockKg,
      carryCapacityKg: MINING.carryCapacityKg,
      depositKg: frameState.world.depositKg,
      tickCount: frameState.world.tickCount,
      fiscalMonthTicks: MINING.fiscalMonthTicks,
    });
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

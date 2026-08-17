import { Text } from "pixi.js";

export interface OverlaySnapshot {
  readonly fps: number;
  readonly low1PercentFps: number;
  readonly frameMs: number;
  /**
   * Custo de CPU da fase de atualização (advance+tick+câmera), medido à
   * parte do render — sem isso, FPS/frame-time sob vsync não distinguem
   * "sobrou 15ms de folga" de "sobrou 0.1ms".
   */
  readonly updateMs: number;
  /** Custo de CPU da chamada app.render(). Não é tempo de GPU — ver drawCallCounter.ts para o porquê. */
  readonly renderMs: number;
  /** (updateMs+renderMs) como % do orçamento de 60fps. Pode passar de 100%. */
  readonly budgetOccupancyPercent: number;
  /** true = ticker rodando solto (sem vsync); false = preso ao refresh do monitor. */
  readonly uncapped: boolean;
  /** undefined = indisponível (backend não é WebGL, ou o hook falhou). */
  readonly drawCalls: number | undefined;
  /** undefined = indisponível (só Chrome expõe performance.memory). */
  readonly heapMB: number | undefined;
  readonly tickCount: number;
  readonly ticksThisFrame: number;
  /** 'webgl' | 'webgpu' | 'canvas' — o Pixi escolhe sozinho; muda a leitura dos outros números. */
  readonly backend: string;
  /** Contagem cumulativa de frames longos desde o carregamento — proxy de GC sem profiler externo. */
  readonly totalFrames: number;
  readonly framesOver20ms: number;
  readonly framesOver33ms: number;
}

/** Formatação pura, sem Pixi — testável sem precisar de um Text real. */
export function formatOverlayText(snapshot: OverlaySnapshot): string {
  const drawCalls = snapshot.drawCalls !== undefined ? String(snapshot.drawCalls) : "n/d";
  const heap = snapshot.heapMB !== undefined ? `${snapshot.heapMB.toFixed(1)}MB` : "n/d";
  const mode = snapshot.uncapped ? "sem vsync" : "vsync";

  return [
    `FPS: ${snapshot.fps.toFixed(0)}  (1% low: ${snapshot.low1PercentFps.toFixed(0)})  [${mode}]`,
    `Frame: ${snapshot.frameMs.toFixed(2)}ms  (update: ${snapshot.updateMs.toFixed(2)}ms, render: ${snapshot.renderMs.toFixed(2)}ms)`,
    `Orçamento (60fps): ${snapshot.budgetOccupancyPercent.toFixed(1)}%`,
    `Draw calls: ${drawCalls}`,
    `Heap JS: ${heap}`,
    `Tick: ${snapshot.tickCount}  (+${snapshot.ticksThisFrame} neste frame)`,
    `Backend: ${snapshot.backend}`,
    `Frames >20ms: ${snapshot.framesOver20ms}/${snapshot.totalFrames}  >33ms: ${snapshot.framesOver33ms}/${snapshot.totalFrames}`,
  ].join("\n");
}

export function createDebugOverlay(): Text {
  const text = new Text({
    text: "",
    style: {
      fontFamily: "monospace",
      fontSize: 14,
      fill: 0xffd23f,
      lineHeight: 18,
    },
  });
  text.position.set(8, 8);
  text.zIndex = Number.MAX_SAFE_INTEGER; // sempre por cima de tudo
  return text;
}

export function updateDebugOverlay(overlay: Text, snapshot: OverlaySnapshot): void {
  overlay.text = formatOverlayText(snapshot);
}

interface PerformanceMemory {
  readonly usedJSHeapSize: number;
}

/** performance.memory é extensão só do Chrome — undefined em outros browsers. */
export function readHeapMB(): number | undefined {
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  return memory ? memory.usedJSHeapSize / (1024 * 1024) : undefined;
}

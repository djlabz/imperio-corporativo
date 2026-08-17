import { Text } from "pixi.js";

export interface OverlaySnapshot {
  readonly fps: number;
  readonly low1PercentFps: number;
  readonly frameMs: number;
  /** undefined = indisponível (backend não é WebGL, ou o hook falhou). */
  readonly drawCalls: number | undefined;
  /** undefined = indisponível (só Chrome expõe performance.memory). */
  readonly heapMB: number | undefined;
  readonly tickCount: number;
  readonly ticksThisFrame: number;
  /** 'webgl' | 'webgpu' | 'canvas' — o Pixi escolhe sozinho; muda a leitura dos outros números. */
  readonly backend: string;
}

/** Formatação pura, sem Pixi — testável sem precisar de um Text real. */
export function formatOverlayText(snapshot: OverlaySnapshot): string {
  const drawCalls = snapshot.drawCalls !== undefined ? String(snapshot.drawCalls) : "n/d";
  const heap = snapshot.heapMB !== undefined ? `${snapshot.heapMB.toFixed(1)}MB` : "n/d";

  return [
    `FPS: ${snapshot.fps.toFixed(0)}  (1% low: ${snapshot.low1PercentFps.toFixed(0)})`,
    `Frame: ${snapshot.frameMs.toFixed(2)}ms`,
    `Draw calls: ${drawCalls}`,
    `Heap JS: ${heap}`,
    `Tick: ${snapshot.tickCount}  (+${snapshot.ticksThisFrame} neste frame)`,
    `Backend: ${snapshot.backend}`,
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

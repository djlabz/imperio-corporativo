import { describe, expect, it } from "vitest";
import { formatOverlayText, readHeapMB, type OverlaySnapshot } from "./DebugOverlayView";

const BASE_SNAPSHOT: OverlaySnapshot = {
  fps: 60,
  low1PercentFps: 58,
  frameMs: 16.67,
  drawCalls: 3,
  heapMB: 42.5,
  tickCount: 1234,
  ticksThisFrame: 1,
  backend: "webgl",
};

describe("formatOverlayText()", () => {
  it("inclui todos os números pedidos: fps, 1% low, frame ms, draw calls, heap, tick", () => {
    const text = formatOverlayText(BASE_SNAPSHOT);
    expect(text).toContain("FPS: 60");
    expect(text).toContain("1% low: 58");
    expect(text).toContain("16.67ms");
    expect(text).toContain("Draw calls: 3");
    expect(text).toContain("42.5MB");
    expect(text).toContain("Tick: 1234");
    expect(text).toContain("+1 neste frame");
    expect(text).toContain("Backend: webgl");
  });

  it("mostra n/d quando draw calls está indisponível, sem quebrar formatação", () => {
    const text = formatOverlayText({ ...BASE_SNAPSHOT, drawCalls: undefined });
    expect(text).toContain("Draw calls: n/d");
  });

  it("mostra n/d quando heap está indisponível (browser sem performance.memory)", () => {
    const text = formatOverlayText({ ...BASE_SNAPSHOT, heapMB: undefined });
    expect(text).toContain("Heap JS: n/d");
  });

  it("draw calls igual a zero mostra '0', não 'n/d' — não confunde ausência com valor zero", () => {
    // undefined !== 0: um mapa que realmente faz 0 draw calls (culling total)
    // é uma informação diferente de "não consigo medir".
    const text = formatOverlayText({ ...BASE_SNAPSHOT, drawCalls: 0 });
    expect(text).toContain("Draw calls: 0");
    expect(text).not.toContain("n/d");
  });
});

describe("readHeapMB()", () => {
  it("em Node, sem performance.memory do Chrome, devolve undefined em vez de quebrar", () => {
    // Este teste só prova o caminho "indisponível", que é o único alcançável
    // fora de um browser real. O caminho "disponível" (Chrome) foi checado
    // manualmente via pnpm dev — ver relatório da etapa.
    expect(readHeapMB()).toBeUndefined();
  });
});

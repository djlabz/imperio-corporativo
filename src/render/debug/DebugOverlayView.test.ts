import { describe, expect, it } from "vitest";
import { formatOverlayText, readHeapMB, type OverlaySnapshot } from "./DebugOverlayView";

const BASE_SNAPSHOT: OverlaySnapshot = {
  fps: 60,
  low1PercentFps: 58,
  frameMs: 16.67,
  updateMs: 0.05,
  renderMs: 1.2,
  budgetOccupancyPercent: 7.5,
  uncapped: false,
  drawCalls: 3,
  heapMB: 42.5,
  tickCount: 1234,
  ticksThisFrame: 1,
  backend: "webgl",
  totalFrames: 1800,
  framesOver20ms: 3,
  framesOver33ms: 1,
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

  it("mostra update, render e ocupação de orçamento separados do frame total", () => {
    const text = formatOverlayText(BASE_SNAPSHOT);
    expect(text).toContain("update: 0.05ms");
    expect(text).toContain("render: 1.20ms");
    expect(text).toContain("Orçamento (60fps): 7.5%");
  });

  it("indica o modo vsync/sem vsync", () => {
    expect(formatOverlayText({ ...BASE_SNAPSHOT, uncapped: false })).toContain("[vsync]");
    expect(formatOverlayText({ ...BASE_SNAPSHOT, uncapped: true })).toContain("[sem vsync]");
  });

  it("ocupação pode passar de 100% — isto é informação, não um erro de formatação", () => {
    const text = formatOverlayText({ ...BASE_SNAPSHOT, budgetOccupancyPercent: 214.3 });
    expect(text).toContain("214.3%");
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

  it("mostra a contagem de frames longos nos dois limiares, sobre o total", () => {
    const text = formatOverlayText(BASE_SNAPSHOT);
    expect(text).toContain("Frames >20ms: 3/1800");
    expect(text).toContain(">33ms: 1/1800");
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

import { describe, expect, it } from "vitest";
import {
  computeBudgetOccupancyPercent,
  computeLow1PercentFps,
  createStatsTracker,
  instantFps,
  recordFrame,
} from "./debugStats";

describe("instantFps()", () => {
  it("16.66ms de frame dá ~60fps", () => {
    expect(instantFps(1000 / 60)).toBeCloseTo(60, 5);
  });

  it("33.33ms de frame dá ~30fps", () => {
    expect(instantFps(1000 / 30)).toBeCloseTo(30, 5);
  });

  it("frame de duração zero não explode em Infinity", () => {
    expect(instantFps(0)).toBe(0);
  });
});

describe("recordFrame() / janela deslizante", () => {
  it("acumula amostras", () => {
    let tracker = createStatsTracker();
    tracker = recordFrame(tracker, 16);
    tracker = recordFrame(tracker, 17);
    expect(tracker.samples).toEqual([16, 17]);
  });

  it("descarta as mais antigas além do tamanho da janela", () => {
    let tracker = createStatsTracker();
    // Grava 130 valores únicos (0..129); a janela deve guardar só os últimos 120.
    for (let i = 0; i < 130; i++) tracker = recordFrame(tracker, i);

    expect(tracker.samples).toHaveLength(120);
    expect(tracker.samples[0]).toBe(10); // 130 - 120 = índice de corte
    expect(tracker.samples.at(-1)).toBe(129);
  });
});

describe("computeLow1PercentFps() — o pior 1%, não a média", () => {
  it("janela vazia não quebra, devolve 0", () => {
    expect(computeLow1PercentFps(createStatsTracker())).toBe(0);
  });

  it("com frames todos iguais, o 1% low é igual ao FPS instantâneo", () => {
    let tracker = createStatsTracker();
    for (let i = 0; i < 100; i++) tracker = recordFrame(tracker, 1000 / 60);
    expect(computeLow1PercentFps(tracker)).toBeCloseTo(60, 5);
  });

  it("um engasgo isolado entre 99 frames bons derruba o 1% low bem mais que a média esconderia", () => {
    let tracker = createStatsTracker();
    for (let i = 0; i < 99; i++) tracker = recordFrame(tracker, 1000 / 60); // 16.67ms
    tracker = recordFrame(tracker, 500); // um engasgo de 500ms (2fps)

    const low1pct = computeLow1PercentFps(tracker);
    const naiveAverageFps = instantFps(
      tracker.samples.reduce((sum, ms) => sum + ms, 0) / tracker.samples.length,
    );

    // A média mal sente o engasgo (cai só um pouco); o 1% low tem que refletir
    // majoritariamente o frame ruim, ficando muito mais perto de 2fps que de 60fps.
    expect(low1pct).toBeLessThan(10);
    expect(low1pct).toBeLessThan(naiveAverageFps);
  });

  it("pega o pior 1% mesmo com a amostra fora de ordem de inserção", () => {
    let tracker = createStatsTracker();
    // Insere o pior frame no meio, não no fim — pega um bug de "olhar só a
    // última amostra" em vez de ordenar de verdade.
    for (let i = 0; i < 50; i++) tracker = recordFrame(tracker, 16);
    tracker = recordFrame(tracker, 1000); // pior frame, no meio
    for (let i = 0; i < 49; i++) tracker = recordFrame(tracker, 16);

    expect(computeLow1PercentFps(tracker)).toBeCloseTo(instantFps(1000), 5);
  });
});

describe("computeBudgetOccupancyPercent() — o número que sobrevive ao vsync", () => {
  it("gastar o orçamento inteiro de 60fps dá 100%", () => {
    expect(computeBudgetOccupancyPercent(1000 / 60, 60)).toBeCloseTo(100, 5);
  });

  it("gastar metade do orçamento dá 50%", () => {
    expect(computeBudgetOccupancyPercent(1000 / 120, 60)).toBeCloseTo(50, 5);
  });

  it("sem gastar nada dá 0%", () => {
    expect(computeBudgetOccupancyPercent(0, 60)).toBe(0);
  });

  it("passar do orçamento dá mais de 100% — isto é o ponto: vsync escode isso, ocupação não", () => {
    // 33ms de trabalho por frame, mas o alvo é 16.67ms (60fps): já não cabe.
    expect(computeBudgetOccupancyPercent(33.33, 60)).toBeGreaterThan(100);
  });

  it("respeita um targetFps diferente do default", () => {
    // A 30fps o orçamento é 33.33ms; gastar 33.33ms de trabalho é 100% dele.
    expect(computeBudgetOccupancyPercent(1000 / 30, 30)).toBeCloseTo(100, 5);
  });
});

import { describe, expect, it } from "vitest";
import { advance, createFixedStepLoop, TICK_MS } from "./loop";

describe("advance()", () => {
  it("frame menor que TICK_MS não roda nenhum tick, só acumula", () => {
    const result = advance(createFixedStepLoop(), 16);
    expect(result.ticksToRun).toBe(0);
    expect(result.loop.accumulatorMs).toBe(16);
  });

  it("frame de exatamente TICK_MS roda 1 tick e zera o acumulador", () => {
    const result = advance(createFixedStepLoop(), TICK_MS);
    expect(result.ticksToRun).toBe(1);
    expect(result.loop.accumulatorMs).toBe(0);
  });

  it("frame maior que TICK_MS roda vários ticks e guarda o resto", () => {
    // 220ms / 100ms = 2 ticks, sobra 20ms. Fica abaixo do clamp de 250ms de
    // propósito, para não se confundir com o teste do clamp logo abaixo.
    const result = advance(createFixedStepLoop(), 220);
    expect(result.ticksToRun).toBe(2);
    expect(result.loop.accumulatorMs).toBe(20);
  });

  it("acumula entre chamadas — dois frames de 60ms completam 1 tick na segunda chamada", () => {
    const first = advance(createFixedStepLoop(), 60);
    expect(first.ticksToRun).toBe(0);

    const second = advance(first.loop, 60);
    expect(second.ticksToRun).toBe(1);
    expect(second.loop.accumulatorMs).toBe(20);
  });

  it("clampa frames gigantes — não tenta recuperar o atraso todo de uma vez", () => {
    // Sem o clamp, 5_000ms rodaria 50 ticks. Com o clamp em 250ms, no máximo 2.
    const result = advance(createFixedStepLoop(), 5_000);
    expect(result.ticksToRun).toBe(2);
    expect(result.ticksToRun).toBeLessThan(50);
  });

  it("alpha reflete a fração do próximo tick já decorrida", () => {
    const result = advance(createFixedStepLoop(), 150);
    expect(result.ticksToRun).toBe(1);
    expect(result.loop.accumulatorMs).toBe(50);
    expect(result.alpha).toBeCloseTo(0.5, 10);
  });

  it("TICK_MS é 100 — muda a Regra 3 do CLAUDE.md se isso mudar", () => {
    expect(TICK_MS).toBe(100);
  });
});

import { describe, expect, it } from "vitest";
import { createWorld } from "../sim/core/World";
import { updateFrame, type FrameState } from "./frame";
import { createFixedStepLoop, TICK_MS } from "./loop";

function initialState(): FrameState {
  return { world: createWorld("frame-test"), loop: createFixedStepLoop(), pendingCommands: [] };
}

describe("updateFrame()", () => {
  it("frame curto não roda tick nenhum", () => {
    const result = updateFrame(initialState(), 16, []);
    expect(result.ticksRan).toBe(0);
    expect(result.state.world.tickCount).toBe(0);
  });

  it("frame de TICK_MS roda exatamente 1 tick e avança o World", () => {
    const result = updateFrame(initialState(), TICK_MS, []);
    expect(result.ticksRan).toBe(1);
    expect(result.state.world.tickCount).toBe(1);
  });

  it("acumula entre chamadas — o estado do loop realmente é passado adiante", () => {
    let state = initialState();
    const first = updateFrame(state, 60, []);
    state = first.state;
    expect(state.world.tickCount).toBe(0);

    const second = updateFrame(state, 60, []);
    expect(second.ticksRan).toBe(1);
    expect(second.state.world.tickCount).toBe(1);
  });

  it("respeita o clamp de 250ms do loop — não tenta recuperar um frame gigante de uma vez", () => {
    const result = updateFrame(initialState(), 5_000, []);
    expect(result.ticksRan).toBe(2); // igual ao teste de loop.ts: floor(250/100)
  });
});

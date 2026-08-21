import { describe, expect, it } from "vitest";
import { markerAlpha } from "./ClickMarkerView";

describe("markerAlpha()", () => {
  it("sem clique nenhum, invisível", () => {
    expect(markerAlpha(undefined, 1_000)).toBe(0);
  });

  it("no instante do clique, opaco", () => {
    expect(markerAlpha(1_000, 1_000, 300)).toBe(1);
  });

  it("apaga linearmente e chega a zero no fim da vida", () => {
    expect(markerAlpha(1_000, 1_150, 300)).toBeCloseTo(0.5, 6);
    expect(markerAlpha(1_000, 1_300, 300)).toBe(0);
    expect(markerAlpha(1_000, 5_000, 300)).toBe(0);
  });

  it("timestamp anterior ao clique não deixa o marcador aceso", () => {
    // O relógio do frame (rAF) e o do clique (performance.now) têm a mesma
    // origem, mas o clique pode chegar DEPOIS do timestamp do frame em curso.
    expect(markerAlpha(1_000, 900, 300)).toBe(0);
  });
});

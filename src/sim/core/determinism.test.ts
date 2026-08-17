import { describe, expect, it } from "vitest";
import { tick } from "./tick";
import { createWorld, type World } from "./World";

const TICKS = 10_000;

describe("determinismo", () => {
  it("mesma seed produz o mesmo estado final após 10.000 ticks", () => {
    let worldA: World = createWorld("seed-determinismo");
    let worldB: World = createWorld("seed-determinismo");

    for (let i = 0; i < TICKS; i++) {
      worldA = tick(worldA);
      worldB = tick(worldB);
    }

    expect(worldB).toEqual(worldA);
  });

  it("mesma seed bate campo a campo em checkpoints intermediários, não só no final", () => {
    // Comparar só o estado final poderia mascarar duas trajetórias que
    // divergem no meio do caminho e "colidem" de volta por coincidência.
    let worldA: World = createWorld("seed-checkpoints");
    let worldB: World = createWorld("seed-checkpoints");

    const checkpoints = new Set([1, 7, 100, 2_500, 9_999]);
    for (let i = 1; i <= TICKS; i++) {
      worldA = tick(worldA);
      worldB = tick(worldB);
      if (checkpoints.has(i)) {
        expect(worldB).toEqual(worldA);
      }
    }
  });

  it("seeds diferentes produzem sequências de ruído diferentes", () => {
    // Não compara os World inteiros: o campo `seed` por si só já os deixaria
    // diferentes mesmo que o RNG estivesse quebrado e ignorasse a seed. O que
    // importa é o valor DERIVADO do RNG (`noise`) realmente divergir.
    let worldA: World = createWorld("seed-um");
    let worldB: World = createWorld("seed-dois");

    const noiseA: number[] = [];
    const noiseB: number[] = [];
    for (let i = 0; i < TICKS; i++) {
      worldA = tick(worldA);
      worldB = tick(worldB);
      noiseA.push(worldA.noise);
      noiseB.push(worldB.noise);
    }

    expect(noiseA).not.toEqual(noiseB);

    // Controle extra: mesmo que as sequências não sejam idênticas ponto a
    // ponto, um RNG quase-quebrado poderia colidir em uma fração suspeita de
    // posições. Com dois floats de verdade a colisão exata é ~0.
    const identicalCount = noiseA.filter((value, i) => value === noiseB[i]).length;
    expect(identicalCount).toBe(0);
  });
});

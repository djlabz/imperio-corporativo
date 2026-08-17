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

  // O teste "seeds diferentes produzem resultados diferentes" que existia
  // aqui na Etapa 2 foi removido de propósito nesta etapa, junto com o campo
  // World.noise que ele exercitava. Sem esse campo, nada em World depende da
  // seed depois da criação — tick() virou de novo um simples tickCount + 1.
  // Um teste de divergência por seed hoje passaria de forma vazia (só porque
  // o campo `seed` em si já é diferente, não porque o RNG foi exercitado de
  // verdade) — e teste vazio que passa é pior que teste ausente, dá confiança
  // falsa. Ele volta a fazer sentido assim que algum sistema do sim/ consumir
  // o RNG dentro de tick() — candidato mais provável: spawn/movimento de NPC
  // na Etapa 4. Quando isso acontecer, reintroduza este teste comparando o
  // valor derivado do RNG, não o World inteiro (ver histórico do commit da
  // Etapa 2 para o formato).
});

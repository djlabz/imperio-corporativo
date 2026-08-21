import { describe, expect, it } from "vitest";
import type { Command } from "./Command";
import { tick } from "./tick";
import { createWorld, type World } from "./World";

const TICKS = 10_000;

/**
 * Fila determinística por tick, sem RNG: dá um golpe a cada 3 ticks e vende a
 * cada 50. Não é ritmo de jogo — é uma sequência de comandos que exercita a
 * economia inteira (depósito esvaziando, estoque enchendo, dinheiro entrando) de
 * um jeito reproduzível, que é o que o determinismo de D-016 precisa provar.
 */
function commandsFor(tickIndex: number): readonly Command[] {
  const queue: Command[] = [];
  if (tickIndex % 3 === 0) queue.push({ kind: "MINE" });
  if (tickIndex % 50 === 0) queue.push({ kind: "SELL" });
  return queue;
}

describe("determinismo", () => {
  it("mesma seed produz o mesmo estado final após 10.000 ticks", () => {
    let worldA: World = createWorld("seed-determinismo");
    let worldB: World = createWorld("seed-determinismo");

    for (let i = 0; i < TICKS; i++) {
      worldA = tick(worldA, []);
      worldB = tick(worldB, []);
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
      worldA = tick(worldA, []);
      worldB = tick(worldB, []);
      if (checkpoints.has(i)) {
        expect(worldB).toEqual(worldA);
      }
    }
  });

  it("mesmo World e mesma sequência de COMANDOS produzem o mesmo estado final (D-016)", () => {
    let worldA: World = createWorld("seed-comandos");
    let worldB: World = createWorld("seed-comandos");

    const checkpoints = new Set([1, 3, 50, 151, 2_500, 9_999]);
    for (let i = 1; i <= TICKS; i++) {
      const queue = commandsFor(i);
      worldA = tick(worldA, queue);
      worldB = tick(worldB, queue);
      if (checkpoints.has(i)) {
        expect(worldB).toEqual(worldA);
      }
    }

    expect(worldB).toEqual(worldA);
    // Âncora contra o teste passar de forma vazia: a economia tem que ter mesmo
    // acontecido. Sem isto, duas trajetórias que não fizeram nada bateriam.
    expect(worldA.depositKg).toBeLessThan(createWorld("seed-comandos").depositKg);
    expect(worldA.money).toBeGreaterThan(0);
  });

  it("com HIRE na fila (F1-E4): mesmo World e mesmos comandos produzem o mesmo estado", () => {
    // HIRE é o primeiro comando cujo efeito (runEmployees, payPayroll) depende de
    // tickCount — exatamente o tipo de dependência que poderia divergir entre
    // duas trajetórias por um motivo bobo (ordem de iteração, ponto flutuante
    // escondido). Este teste teria pegado isso.
    function commandsWithHire(tickIndex: number): readonly Command[] {
      const queue: Command[] = [];
      if (tickIndex % 3 === 0) queue.push({ kind: "MINE" });
      if (tickIndex % 50 === 0) queue.push({ kind: "SELL" });
      if (tickIndex % 137 === 0) queue.push({ kind: "HIRE" });
      return queue;
    }

    let worldA: World = createWorld("seed-hire");
    let worldB: World = createWorld("seed-hire");

    const checkpoints = new Set([1, 137, 1_800, 1_801, 2_500, 9_999]);
    for (let i = 1; i <= TICKS; i++) {
      const queue = commandsWithHire(i);
      worldA = tick(worldA, queue);
      worldB = tick(worldB, queue);
      if (checkpoints.has(i)) {
        expect(worldB).toEqual(worldA);
      }
    }

    expect(worldB).toEqual(worldA);
    // Âncora: prova que HIRE, produção de funcionário E folha aconteceram de
    // verdade nesta trajetória, não que as duas travessias ficaram paradas e
    // "empataram" por não terem feito nada.
    expect(worldA.employeeCount).toBeGreaterThan(0);
  });

  // O teste "seeds diferentes produzem resultados diferentes" que existia
  // aqui na Etapa 2 foi removido de propósito nesta etapa, junto com o campo
  // World.noise que ele exercitava. Sem esse campo, nada em World depende da
  // seed depois da criação — tick() virou de novo um simples tickCount + 1.
  // Um teste de divergência por seed hoje passaria de forma vazia (só porque
  // o campo `seed` em si já é diferente, não porque o RNG foi exercitado de
  // verdade) — e teste vazio que passa é pior que teste ausente, dá confiança
  // falsa.
  //
  // CORREÇÃO (Etapa 4): o candidato que este comentário apontava — NPC — não
  // vai acontecer. render/npc/ é "decorativo" por definição arquitetural
  // (CLAUDE.md: render/ só LÊ World, nunca escreve; npc/ é "pool de NPCs
  // decorativos"). NPC nunca toca World nem tick(), e usa Math.random() puro
  // (permitido fora de sim/) para tint/posição — não a seed do jogo. Este
  // teste só volta a fazer sentido quando um sistema ECONÔMICO de verdade
  // (produtividade de trabalhador, flutuação de mercado, evento aleatório)
  // consumir o RNG dentro de sim/tick() — isso é conteúdo de jogo, então fica
  // para a Fase 1, não para o resto da Fase 0. Ver docs/DECISOES.md P-01.
});

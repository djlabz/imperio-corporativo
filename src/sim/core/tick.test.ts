import { describe, expect, it } from "vitest";
import { MINING } from "../data/balance";
import type { Command } from "./Command";
import { tick } from "./tick";
import { createWorld, type World } from "./World";

const MINE: Command = { kind: "MINE" };
const SELL: Command = { kind: "SELL" };

function fresh(): World {
  return createWorld("tick-test");
}

describe("tick()", () => {
  it("fila vazia só avança o contador", () => {
    const before = fresh();
    const after = tick(before, []);

    expect(after.tickCount).toBe(before.tickCount + 1);
    expect({ ...after, tickCount: 0 }).toEqual({ ...before, tickCount: 0 });
  });

  it("aplica MINE: sai minério do depósito e entra no estoque", () => {
    const after = tick(fresh(), [MINE]);

    expect(after.stockKg).toBe(MINING.kgPerStrike);
    expect(after.depositKg).toBe(MINING.initialDepositKg - MINING.kgPerStrike);
  });

  it("aplica os comandos na ordem da fila: MINE depois SELL vende no mesmo tick", () => {
    const after = tick(fresh(), [MINE, SELL]);

    expect(after.stockKg).toBe(0);
    expect(after.money).toBe(MINING.kgPerStrike * MINING.pricePerKg);
  });

  it("a ordem importa: SELL antes de MINE não vende o que ainda não foi extraído", () => {
    const after = tick(fresh(), [SELL, MINE]);

    expect(after.money).toBe(0);
    expect(after.stockKg).toBe(MINING.kgPerStrike);
  });

  it("vários comandos iguais na mesma fila acumulam", () => {
    const after = tick(fresh(), [MINE, MINE, MINE]);
    expect(after.stockKg).toBe(MINING.kgPerStrike * 3);
  });

  it("o contador avança uma vez só, independente do tamanho da fila", () => {
    expect(tick(fresh(), [MINE, MINE, SELL, MINE]).tickCount).toBe(1);
  });

  it("o contador avança a partir do valor que estava no World, não do zero", () => {
    const after = tick({ ...fresh(), tickCount: 41 }, [MINE]);
    expect(after.tickCount).toBe(42);
  });

  // NÃO existe aqui um teste de "o tickCount avança DEPOIS dos comandos". Foi
  // tentado e removido: a mutação que move o incremento pra antes do laço passa
  // verde, porque NENHUM comando lê tickCount hoje — as duas ordens produzem
  // exatamente o mesmo World. Um teste com esse nome afirmaria uma garantia que
  // ele não verifica, que é pior que não ter teste (D-011).
  //
  // A ordem (comandos primeiro, contador depois) está em tick.ts e vale como
  // decisão; ela passa a ser OBSERVÁVEL quando existir comando que dependa do
  // tick — o imposto da F1-E5 é o candidato. O teste nasce lá, junto do primeiro
  // consumidor de verdade.

  it("não muta o World de entrada", () => {
    const before = fresh();
    const snapshot = { ...before };
    tick(before, [MINE, SELL]);
    expect(before).toEqual(snapshot);
  });
});

import { describe, expect, it } from "vitest";
import { createWorld, type World } from "../core/World";
import type { MiningBalance } from "../data/balance";
import { centavos } from "./money";
import { mine, sell } from "./mining";

// Balanceamento próprio, com números redondos escolhidos pra que a aritmética do
// teste seja verificável de cabeça. Não usa o MINING de produção de propósito:
// teste que depende do JSON de balanceamento quebra a cada ajuste de ritmo, e
// ajustar ritmo é a coisa que mais vai acontecer nesta fase.
const BALANCE: MiningBalance = {
  fiscalMonthTicks: 1000,
  kgPerStrike: 10,
  initialDepositKg: 100,
  pricePerKg: centavos(50),
};

function world(overrides: Partial<World> = {}): World {
  return { ...createWorld("mining-test"), depositKg: 100, stockKg: 0, ...overrides };
}

describe("mine()", () => {
  it("move exatamente a mesma quantidade dos dois lados", () => {
    const before = world();
    const after = mine(before, BALANCE);

    expect(after.depositKg).toBe(90);
    expect(after.stockKg).toBe(10);
    // A conservação é a propriedade que importa: minério não aparece nem some.
    expect(after.depositKg + after.stockKg).toBe(before.depositKg + before.stockKg);
  });

  it("depósito parcial: extrai o que resta e para em zero, nunca negativo", () => {
    const after = mine(world({ depositKg: 4 }), BALANCE);

    expect(after.depositKg).toBe(0);
    expect(after.stockKg).toBe(4); // 4, não os 10 do golpe
  });

  it("depósito vazio não cria minério", () => {
    const before = world({ depositKg: 0, stockKg: 7 });
    const after = mine(before, BALANCE);

    expect(after.depositKg).toBe(0);
    expect(after.stockKg).toBe(7);
    expect(after).toEqual(before);
  });

  it("golpes sucessivos esvaziam o depósito e depois não fazem nada", () => {
    let w = world({ depositKg: 25 });
    for (let i = 0; i < 20; i++) {
      w = mine(w, BALANCE);
    }

    expect(w.depositKg).toBe(0);
    expect(w.stockKg).toBe(25); // o depósito inteiro, nem um kg a mais
  });

  it("não toca em dinheiro — minerar não é vender", () => {
    const after = mine(world(), BALANCE);
    expect(after.money).toBe(0);
  });
});

describe("sell()", () => {
  it("zera o estoque e credita o valor exato", () => {
    const after = sell(world({ stockKg: 30 }), BALANCE);

    expect(after.stockKg).toBe(0);
    expect(after.money).toBe(30 * 50);
  });

  it("soma ao dinheiro que já existia, não substitui", () => {
    const after = sell(world({ stockKg: 2, money: centavos(1_000) }), BALANCE);
    expect(after.money).toBe(1_000 + 2 * 50);
  });

  it("estoque zero não move dinheiro", () => {
    const before = world({ stockKg: 0, money: centavos(777) });
    const after = sell(before, BALANCE);

    expect(after.money).toBe(777);
    expect(after).toEqual(before);
  });

  it("não toca no depósito — vender não minera", () => {
    const after = sell(world({ depositKg: 60, stockKg: 5 }), BALANCE);
    expect(after.depositKg).toBe(60);
  });
});

describe("mine() + sell() juntos", () => {
  it("minerar o depósito inteiro e vender dá o valor do depósito inteiro", () => {
    let w = world({ depositKg: 100 });
    for (let i = 0; i < 10; i++) {
      w = mine(w, BALANCE);
    }
    w = sell(w, BALANCE);

    expect(w.depositKg).toBe(0);
    expect(w.stockKg).toBe(0);
    expect(w.money).toBe(100 * 50);
  });
});

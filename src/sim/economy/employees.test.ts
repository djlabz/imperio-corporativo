import { describe, expect, it } from "vitest";
import { createWorld, type World } from "../core/World";
import type { MiningBalance } from "../data/balance";
import { hire, payPayroll, runEmployees } from "./employees";
import { centavos } from "./money";

// Números redondos, escolhidos pra que a aritmética do teste seja verificável
// de cabeça — mesmo espírito do BALANCE de mining.test.ts, e pelo mesmo motivo:
// teste que depende do JSON de produção quebra a cada ajuste de ritmo.
const BALANCE: MiningBalance = {
  fiscalMonthTicks: 100,
  kgPerStrike: 10,
  initialDepositKg: 1_000,
  pricePerKg: centavos(10),
  carryCapacityKg: 50,
  hireCost: centavos(500),
  wagePerEmployee: centavos(20),
  employeeKgPerCycle: 2,
  employeeCycleTicks: 5,
};

function world(overrides: Partial<World> = {}): World {
  return { ...createWorld("employees-test"), employeeCount: 0, ...overrides };
}

describe("hire()", () => {
  it("com dinheiro suficiente, debita o custo e soma um funcionário", () => {
    const before = world({ money: centavos(1_000) });
    const after = hire(before, BALANCE);

    expect(after.employeeCount).toBe(1);
    expect(after.money).toBe(500);
  });

  it("com o dinheiro EXATO do custo, ainda contrata — o corte é '< custo', não '<= custo'", () => {
    const after = hire(world({ money: centavos(500) }), BALANCE);
    expect(after.employeeCount).toBe(1);
    expect(after.money).toBe(0);
  });

  it("sem dinheiro suficiente é no-op, igual a golpe em depósito vazio", () => {
    const before = world({ money: centavos(499) });
    const after = hire(before, BALANCE);

    expect(after).toEqual(before);
    expect(after.employeeCount).toBe(0);
  });

  it("dinheiro negativo (dívida de folha) também não contrata", () => {
    const before = world({ money: centavos(-100) });
    expect(hire(before, BALANCE)).toEqual(before);
  });

  it("contratações sucessivas acumulam — dois golpes, dois funcionários, custo cobrado duas vezes", () => {
    let w = world({ money: centavos(2_000) });
    w = hire(w, BALANCE);
    w = hire(w, BALANCE);

    expect(w.employeeCount).toBe(2);
    expect(w.money).toBe(1_000);
  });

  it("não toca em depositKg nem stockKg — contratar não é minerar", () => {
    const before = world({ money: centavos(1_000), depositKg: 777, stockKg: 33 });
    const after = hire(before, BALANCE);

    expect(after.depositKg).toBe(777);
    expect(after.stockKg).toBe(33);
  });
});

describe("runEmployees()", () => {
  it("fora da cadência, não produz nada", () => {
    const before = world({ employeeCount: 3, tickCount: 7, depositKg: 1_000 });
    expect(runEmployees(before, BALANCE)).toEqual(before);
  });

  it("no marco da cadência, produção = employeeCount × employeeKgPerCycle, vendida na hora", () => {
    const before = world({ employeeCount: 3, tickCount: 5, depositKg: 1_000, money: centavos(0) });
    const after = runEmployees(before, BALANCE);

    // 3 funcionários × 2 kg = 6 kg, a R$0,10/kg = 60 centavos.
    expect(after.depositKg).toBe(994);
    expect(after.money).toBe(60);
  });

  it("não passa estoque intermediário — stockKg nunca muda", () => {
    const before = world({ employeeCount: 5, tickCount: 10, depositKg: 1_000, stockKg: 12 });
    const after = runEmployees(before, BALANCE);
    expect(after.stockKg).toBe(12);
  });

  it("tick 0 nunca produz, mesmo sendo múltiplo de employeeCycleTicks", () => {
    // 0 % 5 === 0 matematicamente, mas tick 0 é "o mundo acabou de nascer" —
    // produção aqui seria dinheiro que ninguém ganhou.
    const before = world({ employeeCount: 4, tickCount: 0, depositKg: 1_000 });
    expect(runEmployees(before, BALANCE)).toEqual(before);
  });

  it("zero funcionários é no-op, mesmo na cadência certa", () => {
    const before = world({ employeeCount: 0, tickCount: 15, depositKg: 1_000 });
    expect(runEmployees(before, BALANCE)).toEqual(before);
  });

  it("clampa no que resta do depósito — funcionário não vende minério que não existe", () => {
    // 10 funcionários pediriam 20 kg; só restam 3.
    const before = world({ employeeCount: 10, tickCount: 5, depositKg: 3, money: centavos(0) });
    const after = runEmployees(before, BALANCE);

    expect(after.depositKg).toBe(0);
    expect(after.money).toBe(30); // 3 kg × 10 centavos, não 20 kg
  });

  it("depósito exatamente esgotado por golpes anteriores não produz mais", () => {
    const before = world({ employeeCount: 5, tickCount: 20, depositKg: 0 });
    expect(runEmployees(before, BALANCE)).toEqual(before);
  });

  it("cadência se repete a cada employeeCycleTicks ticks, não só uma vez", () => {
    let w = world({ employeeCount: 1, tickCount: 5, depositKg: 1_000, money: centavos(0) });
    w = runEmployees(w, BALANCE);
    expect(w.depositKg).toBe(998); // primeiro marco: 2kg

    w = { ...w, tickCount: 10 };
    w = runEmployees(w, BALANCE);
    expect(w.depositKg).toBe(996); // segundo marco: outros 2kg
  });
});

describe("payPayroll()", () => {
  it("dentro do mesmo mês fiscal, não cobra nada", () => {
    const before = world({ employeeCount: 4, tickCount: 55, money: centavos(1_000) });
    expect(payPayroll(before, 50, BALANCE)).toEqual(before);
  });

  it("na virada do mês, cobra o salário × a contagem de funcionários — uma vez", () => {
    const before = world({ employeeCount: 4, tickCount: 100, money: centavos(1_000) });
    const after = payPayroll(before, 99, BALANCE);

    expect(after.money).toBe(1_000 - 4 * 20);
  });

  it("zero funcionários na virada não cobra nada, e não cria objeto novo", () => {
    const before = world({ employeeCount: 0, tickCount: 100, money: centavos(1_000) });
    expect(payPayroll(before, 99, BALANCE)).toEqual(before);
  });

  it("dinheiro PODE FICAR NEGATIVO — sem falência, sem trava (P-13)", () => {
    const before = world({ employeeCount: 10, tickCount: 100, money: centavos(50) });
    const after = payPayroll(before, 99, BALANCE);

    expect(after.money).toBe(50 - 10 * 20); // -150, negativo e válido
    expect(after.money).toBeLessThan(0);
  });

  it("não toca em depositKg nem stockKg — folha não é economia de minério", () => {
    const before = world({
      employeeCount: 2,
      tickCount: 100,
      depositKg: 321,
      stockKg: 9,
      money: centavos(1_000),
    });
    const after = payPayroll(before, 99, BALANCE);

    expect(after.depositKg).toBe(321);
    expect(after.stockKg).toBe(9);
  });

  it("virar MAIS de um mês de uma vez (não deveria acontecer via tick(), mas a função não assume) cobra a diferença de mês corretamente", () => {
    // fiscalMonth(50, 100) = 1, fiscalMonth(250, 100) = 3. monthAfter !== monthBefore
    // ainda dispara — a função não sabe (e não precisa saber) que tick() nunca
    // pula tickCount de mais de 1 em produção; ela só compara os dois meses.
    const before = world({ employeeCount: 1, tickCount: 250, money: centavos(1_000) });
    const after = payPayroll(before, 50, BALANCE);
    expect(after.money).toBe(1_000 - 20);
  });
});

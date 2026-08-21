import { describe, expect, it } from "vitest";
import { MINING } from "../data/balance";
import { centavos } from "../economy/money";
import type { Command } from "./Command";
import { tick } from "./tick";
import { createWorld, type World } from "./World";

const MINE: Command = { kind: "MINE" };
const SELL: Command = { kind: "SELL" };
const HIRE: Command = { kind: "HIRE" };

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

  // Esta seção dizia, até a F1-E4: "não existe teste de 'tickCount avança DEPOIS
  // dos comandos' porque nenhum comando lê tickCount hoje, e a ordem só fica
  // observável quando um existir — candidato: o imposto da F1-E5." A previsão
  // errou o candidato, não o raciocínio: quem tornou a ordem observável foi
  // HIRE, na PRÓPRIA F1-E4 — runEmployees() lê tickCount, e roda depois do
  // incremento E depois do laço de comandos. O teste que a nota prometia é o de
  // baixo.

  it("HIRE aplicado ANTES da produção do ciclo: quem contrata bem no marco já produz no mesmo tick", () => {
    // Prova a ordem (comandos → incremento → produção → folha) observando o
    // efeito dela: se HIRE rodasse DEPOIS de runEmployees, o funcionário novo
    // não existiria ainda quando a produção for calculada, e este tick não
    // produziria nada.
    const before: World = {
      ...fresh(),
      tickCount: MINING.employeeCycleTicks - 1,
      money: MINING.hireCost,
    };
    const after = tick(before, [HIRE]);

    expect(after.employeeCount).toBe(1);
    expect(after.depositKg).toBe(MINING.initialDepositKg - MINING.employeeKgPerCycle);
    expect(after.money).toBe(MINING.pricePerKg * MINING.employeeKgPerCycle);
  });

  it("não muta o World de entrada", () => {
    const before = fresh();
    const snapshot = { ...before };
    tick(before, [MINE, SELL]);
    expect(before).toEqual(snapshot);
  });
});

describe("tick() — HIRE", () => {
  it("com dinheiro suficiente, soma um funcionário e debita o custo", () => {
    const before = { ...fresh(), money: MINING.hireCost };
    const after = tick(before, [HIRE]);

    expect(after.employeeCount).toBe(1);
    expect(after.money).toBe(0);
  });

  it("sem dinheiro suficiente, é no-op — a linha de evento é quem explica por quê", () => {
    const before = { ...fresh(), money: centavos(0) };
    const after = tick(before, [HIRE]);

    expect(after.employeeCount).toBe(0);
    expect(after.money).toBe(0);
  });
});

describe("tick() — ciclo de funcionário e folha (F1-E4)", () => {
  function withEmployees(count: number, overrides: Partial<World> = {}): World {
    return { ...fresh(), employeeCount: count, ...overrides };
  }

  it("produz exatamente na cadência, e não em nenhum outro tick", () => {
    let w = withEmployees(3);
    const producedAt = MINING.employeeCycleTicks;

    for (let t = 1; t < producedAt; t++) {
      const before = w.depositKg;
      w = tick(w, []);
      expect(w.depositKg).toBe(before); // nenhuma produção fora do marco
    }

    const beforeDeposit = w.depositKg;
    w = tick(w, []); // este é o tick do marco
    expect(w.depositKg).toBe(beforeDeposit - 3 * MINING.employeeKgPerCycle);
  });

  it("a virada do mês cobra a folha exatamente UMA vez, não duas", () => {
    let w = withEmployees(2, {
      tickCount: MINING.fiscalMonthTicks - 2,
      money: centavos(100_000),
    });

    w = tick(w, []); // ainda dentro do mês
    const moneyAntesDaVirada = w.money;

    w = tick(w, []); // este tick CRUZA a fronteira — cobra uma vez
    const cobrado = moneyAntesDaVirada - w.money;

    w = tick(w, []); // um tick a mais, ainda dentro do mês novo — não cobra de novo
    expect(w.money).toBe(moneyAntesDaVirada - cobrado);
  });

  it("virada do mês com zero funcionários não cobra nada", () => {
    const w = withEmployees(0, {
      tickCount: MINING.fiscalMonthTicks - 1,
      money: centavos(5_000),
    });
    const after = tick(w, []);
    expect(after.money).toBe(5_000);
  });

  it("dinheiro fica negativo quando a folha não cabe, e o jogo não trava nem lança", () => {
    // depositKg: 0 isola a folha do ciclo de produção — 1800 é múltiplo de
    // employeeCycleTicks (15), então a virada do mês TAMBÉM seria marco de
    // produção; sem depósito, produced = min(kg, 0) = 0 e só a folha se mede.
    const w = withEmployees(50, {
      tickCount: MINING.fiscalMonthTicks - 1,
      money: centavos(100),
      depositKg: 0,
    });
    expect(() => tick(w, [])).not.toThrow();

    const after = tick(w, []);
    expect(after.money).toBeLessThan(0);
    expect(after.money).toBe(100 - 50 * MINING.wagePerEmployee);
  });

  it("1800 ticks com N funcionários batem com a conta feita à mão", () => {
    // O teste que mais importa (item 6 da etapa): se divergir da conta de
    // cabeça, é acumulador fracionário disfarçado, ou cadência errada.
    //
    // Conta: fiscalMonthTicks=1800, employeeCycleTicks=15 → 120 ciclos de
    // produção em 1800 ticks (1800/15). Com N funcionários, cada ciclo produz
    // N×employeeKgPerCycle kg, vendidos a pricePerKg. Nenhum clamp de depósito
    // entra em jogo pra N pequeno (N=2 dá 240kg em 5000kg de depósito). Um mês
    // fiscal completo cabe exatamente nos 1800 ticks, então a folha cobra
    // EXATAMENTE uma vez, no último tick.
    const N = 2;
    let w: World = { ...fresh(), employeeCount: N };

    for (let t = 0; t < MINING.fiscalMonthTicks; t++) {
      w = tick(w, []);
    }

    const cycles = MINING.fiscalMonthTicks / MINING.employeeCycleTicks;
    const kgProduced = cycles * N * MINING.employeeKgPerCycle;
    const revenue = kgProduced * MINING.pricePerKg;
    const payroll = N * MINING.wagePerEmployee;

    expect(w.depositKg).toBe(MINING.initialDepositKg - kgProduced);
    expect(w.money).toBe(revenue - payroll);
    expect(w.tickCount).toBe(MINING.fiscalMonthTicks);
  });
});

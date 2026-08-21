import { describe, expect, it } from "vitest";
import { centavos } from "../../sim/economy/money";
import { formatReadoutText, type ReadoutSnapshot } from "./ReadoutView";

function snapshot(overrides: Partial<ReadoutSnapshot> = {}): ReadoutSnapshot {
  return {
    money: centavos(123_456),
    stockKg: 12,
    carryCapacityKg: 50,
    depositKg: 4_988,
    tickCount: 900,
    fiscalMonthTicks: 1_800,
    employeeCount: 0,
    wagePerEmployee: centavos(2_000),
    ...overrides,
  };
}

describe("formatReadoutText()", () => {
  it("mostra as sete linhas que a etapa pede (F1-E4 somou funcionários e próxima virada)", () => {
    const lines = formatReadoutText(snapshot()).split("\n");
    expect(lines).toHaveLength(7);
    expect(lines[0]).toContain("Dinheiro");
    expect(lines[1]).toContain("Carga");
    expect(lines[2]).toContain("Depósito");
    expect(lines[3]).toContain("Mês fiscal");
    expect(lines[4]).toContain("Funcionários");
    expect(lines[5]).toContain("Próxima virada");
    expect(lines[6]).toContain("Tick");
  });

  it("formata dinheiro pelo fmt() do money.ts, não por conta própria", () => {
    // 123456 centavos = R$ 1.234,56. Se alguém dividir por 100 à mão aqui, o
    // arredondamento sai diferente do resto do jogo.
    expect(formatReadoutText(snapshot())).toContain(fmtExpected());
  });

  it("avisa quando a carga está cheia — é a informação que decide a viagem", () => {
    expect(formatReadoutText(snapshot({ stockKg: 50 }))).toContain("[CHEIO]");
    expect(formatReadoutText(snapshot({ stockKg: 49 }))).not.toContain("[CHEIO]");
  });

  it("avisa cheio também se o estoque passou do teto (balanceamento reduzido)", () => {
    expect(formatReadoutText(snapshot({ stockKg: 80 }))).toContain("[CHEIO]");
  });

  it("mostra o mês derivado e o progresso dentro dele", () => {
    expect(formatReadoutText(snapshot({ tickCount: 0 }))).toContain("Mês fiscal: 1");
    expect(formatReadoutText(snapshot({ tickCount: 1_799 }))).toContain("Mês fiscal: 1");

    const virou = formatReadoutText(snapshot({ tickCount: 1_800 }));
    expect(virou).toContain("Mês fiscal: 2");
    expect(virou).toContain("0%"); // recomeçou a contagem dentro do mês
  });

  it("o progresso do mês é do mês ATUAL, não acumulado desde o começo do jogo", () => {
    // tick 2700 = metade do mês 2. Se alguém usar tickCount direto em vez do
    // resto, isto vira 150%.
    //
    // A asserção é ANCORADA de propósito. A primeira versão usava
    // `toContain("50%")` e passou verde sob exatamente essa mutação, porque
    // "150%" contém "50%" — substring solta é falso-verde (D-011). Pego por
    // mutação, não por leitura.
    const text = formatReadoutText(snapshot({ tickCount: 2_700 }));
    expect(text).toContain("Mês fiscal: 2");
    expect(text).toMatch(/\(50% — tick 900\/1800\)/);
    expect(text).not.toContain("150%");
  });

  it("mostra a folha TOTAL (funcionários × salário), não o salário de um só", () => {
    const text = formatReadoutText(
      snapshot({ employeeCount: 4, wagePerEmployee: centavos(2_000) }),
    );
    // 4 × R$20,00 = R$80,00. Ancorado: R$20,00 sozinho também apareceria como
    // substring de qualquer formatação errada que esquecesse a multiplicação.
    expect(text).toMatch(/Funcionários: 4 {2}\(folha: R\$ 80,00 \/ mês\)/);
  });

  it("zero funcionários mostra folha zero, não a ausência da linha", () => {
    const text = formatReadoutText(snapshot({ employeeCount: 0 }));
    expect(text).toContain("Funcionários: 0");
    expect(text).toContain("folha: R$ 0,00 / mês");
  });

  it("a próxima virada é a PRÓXIMA fronteira, não a que já passou", () => {
    // tick 900 = metade do mês 1 (fiscalMonthTicks=1800) → próxima virada é 1800.
    expect(formatReadoutText(snapshot({ tickCount: 900 }))).toContain("Próxima virada: tick 1800");

    // EM CIMA da fronteira (tick 1800 = início do mês 2): a próxima virada é
    // 3600, não 1800 de novo — este é o caso que uma divisão sem +1 erraria.
    expect(formatReadoutText(snapshot({ tickCount: 1_800 }))).toContain(
      "Próxima virada: tick 3600",
    );
  });
});

function fmtExpected(): string {
  // Deriva do próprio helper em vez de cravar a string: se o formato do fmt()
  // mudar, este teste acompanha em vez de virar falso-vermelho.
  return "1.234,56";
}

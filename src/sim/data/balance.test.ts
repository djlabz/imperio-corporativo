import { describe, expect, it } from "vitest";
import { MINING, parseMiningBalance } from "./balance";

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    fiscalMonthTicks: 1800,
    kgPerStrike: 2,
    initialDepositKg: 5000,
    pricePerKgCents: 45,
    ...overrides,
  };
}

describe("parseMiningBalance()", () => {
  it("aceita o balanceamento válido e branda o preço como Money", () => {
    const balance = parseMiningBalance(valid());
    expect(balance.fiscalMonthTicks).toBe(1800);
    expect(balance.kgPerStrike).toBe(2);
    expect(balance.initialDepositKg).toBe(5000);
    // Money é branded number: continua o número de centavos, não um objeto.
    expect(balance.pricePerKg).toBe(45);
  });

  it("rejeita campo faltando, com o nome do campo na mensagem", () => {
    for (const field of [
      "fiscalMonthTicks",
      "kgPerStrike",
      "initialDepositKg",
      "pricePerKgCents",
    ]) {
      const raw = valid();
      delete (raw as Record<string, unknown>)[field];
      expect(() => parseMiningBalance(raw), field).toThrow(new RegExp(field));
    }
  });

  it("rejeita tipo trocado", () => {
    expect(() => parseMiningBalance(valid({ kgPerStrike: "dois" }))).toThrow(/kgPerStrike/);
    expect(() => parseMiningBalance(valid({ pricePerKgCents: null }))).toThrow(/pricePerKgCents/);
  });

  it("rejeita não-inteiro — centavo fracionário é o erro que money.ts existe pra barrar", () => {
    expect(() => parseMiningBalance(valid({ pricePerKgCents: 45.5 }))).toThrow(/pricePerKgCents/);
    expect(() => parseMiningBalance(valid({ kgPerStrike: 1.5 }))).toThrow(/kgPerStrike/);
  });

  it("rejeita NaN e Infinity — é o que um 1e999 mal digitado produz", () => {
    expect(() => parseMiningBalance(valid({ pricePerKgCents: NaN }))).toThrow(/pricePerKgCents/);
    expect(() => parseMiningBalance(valid({ fiscalMonthTicks: Infinity }))).toThrow(
      /fiscalMonthTicks/,
    );
  });

  it("rejeita valores sem sentido de jogo: mês de zero tick, golpe de zero kg, preço zero", () => {
    expect(() => parseMiningBalance(valid({ fiscalMonthTicks: 0 }))).toThrow(/fiscalMonthTicks/);
    expect(() => parseMiningBalance(valid({ kgPerStrike: 0 }))).toThrow(/kgPerStrike/);
    expect(() => parseMiningBalance(valid({ pricePerKgCents: 0 }))).toThrow(/pricePerKgCents/);
    expect(() => parseMiningBalance(valid({ initialDepositKg: -1 }))).toThrow(/initialDepositKg/);
  });

  it("valida também o JSON de verdade, não só objetos de teste", () => {
    // Âncora: se mining.json for editado pra algo inválido, o import do módulo
    // explode e ISTO é o que aponta o dedo. Sem esta asserção, os testes acima
    // passariam felizes validando literais que ninguém usa em produção.
    expect(MINING.fiscalMonthTicks).toBeGreaterThan(0);
    expect(MINING.kgPerStrike).toBeGreaterThan(0);
    expect(MINING.pricePerKg).toBeGreaterThan(0);
    expect(MINING.initialDepositKg).toBeGreaterThanOrEqual(0);
  });
});

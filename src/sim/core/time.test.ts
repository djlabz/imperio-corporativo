import { describe, expect, it } from "vitest";
import { MINING } from "../data/balance";
import { fiscalMonth, nextFiscalMonthTick } from "./time";

const TICKS = MINING.fiscalMonthTicks;

describe("fiscalMonth()", () => {
  it("o tick 0 já está no mês 1 — não existe mês 0", () => {
    expect(fiscalMonth(0, TICKS)).toBe(1);
  });

  it("vira de mês exatamente na fronteira, não um tick antes nem depois", () => {
    expect(fiscalMonth(TICKS - 2, TICKS)).toBe(1);
    expect(fiscalMonth(TICKS - 1, TICKS)).toBe(1);
    expect(fiscalMonth(TICKS, TICKS)).toBe(2);
    expect(fiscalMonth(TICKS + 1, TICKS)).toBe(2);
  });

  it("segue virando nas fronteiras seguintes", () => {
    expect(fiscalMonth(TICKS * 2 - 1, TICKS)).toBe(2);
    expect(fiscalMonth(TICKS * 2, TICKS)).toBe(3);
    expect(fiscalMonth(TICKS * 12, TICKS)).toBe(13);
  });

  it("é derivação pura: mesmo tick, mesmo mês, sem estado no meio", () => {
    expect(fiscalMonth(4_242, TICKS)).toBe(fiscalMonth(4_242, TICKS));
  });
});

describe("nextFiscalMonthTick()", () => {
  it("do tick 0, a próxima virada é o fim do mês 1", () => {
    expect(nextFiscalMonthTick(0, TICKS)).toBe(TICKS);
  });

  it("um tick antes da fronteira, a próxima virada ainda é a mesma fronteira", () => {
    expect(nextFiscalMonthTick(TICKS - 1, TICKS)).toBe(TICKS);
  });

  it("EM CIMA da fronteira, a próxima virada é a SEGUINTE, não a que já passou", () => {
    // Este é o ponto que uma divisão sem +1 erraria: no tick em que o mês 2
    // acabou de começar, "próxima virada" não pode ser o próprio tick atual.
    expect(nextFiscalMonthTick(TICKS, TICKS)).toBe(TICKS * 2);
  });

  it("segue avançando nas fronteiras seguintes", () => {
    expect(nextFiscalMonthTick(TICKS + 1, TICKS)).toBe(TICKS * 2);
    expect(nextFiscalMonthTick(TICKS * 2 - 1, TICKS)).toBe(TICKS * 2);
    expect(nextFiscalMonthTick(TICKS * 12, TICKS)).toBe(TICKS * 13);
  });
});

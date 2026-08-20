import { describe, expect, it } from "vitest";
import { MINING } from "../data/balance";
import { fiscalMonth } from "./time";

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

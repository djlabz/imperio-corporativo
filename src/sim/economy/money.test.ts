import { describe, expect, it } from "vitest";
import { add, applyRate, centavos, fmt, mul, reais, sub, type Money } from "./money";

describe("centavos / reais", () => {
  it("centavos() aceita um inteiro e vira Money", () => {
    expect(centavos(1990)).toBe(1990);
  });

  it("centavos() rejeita valor fracionário — não é um jeito silencioso de arredondar", () => {
    expect(() => centavos(19.9)).toThrow(RangeError);
  });

  it("reais() usa Math.round, não Math.floor, para corrigir o erro de representação do float", () => {
    // 19.9 * 100 === 1989.9999999999998 em ponto flutuante.
    // Math.floor daria 1989 (errado); Math.round dá 1990 (certo).
    expect(reais(19.9)).toBe(1990);
    expect(reais(0.1)).toBe(10);
    expect(reais(-19.9)).toBe(-1990);
  });

  it("reais() e centavos() nunca produzem float", () => {
    for (const value of [19.9, 0.1, 2.005, -3.33, 1234.56]) {
      expect(Number.isInteger(reais(value))).toBe(true);
    }
  });
});

describe("teto de Number.MAX_SAFE_INTEGER centavos", () => {
  it("aceita o teto exato (~R$ 90 trilhões)", () => {
    expect(centavos(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejeita construção acima do teto — não deixa passar silenciosamente", () => {
    expect(() => centavos(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
  });

  it("rejeita overflow por soma — add() não deixa o resultado estourar em silêncio", () => {
    const nearCeiling = centavos(Number.MAX_SAFE_INTEGER - 1);
    expect(() => add(nearCeiling, centavos(10))).toThrow(RangeError);
  });

  it("rejeita overflow por multiplicação", () => {
    const grande = centavos(Number.MAX_SAFE_INTEGER);
    expect(() => mul(grande, 2)).toThrow(RangeError);
  });
});

describe("aritmética — add / sub / mul / applyRate", () => {
  it("nunca produz float, em nenhum helper", () => {
    const a = centavos(10_007);
    const b = centavos(3_333);
    expect(Number.isInteger(add(a, b))).toBe(true);
    expect(Number.isInteger(sub(a, b))).toBe(true);
    expect(Number.isInteger(mul(a, 7))).toBe(true);
    expect(Number.isInteger(applyRate(a, 1_500))).toBe(true);
  });

  it("add / sub fazem a conta certa", () => {
    expect(add(centavos(1_000), centavos(250))).toBe(1_250);
    expect(sub(centavos(1_000), centavos(250))).toBe(750);
  });

  it("sub com resultado negativo é permitido — dívida é Money válido", () => {
    expect(sub(centavos(100), centavos(300))).toBe(-200);
  });

  it("applyRate arredonda em .5 para baixo, de propósito — nunca a favor do jogador", () => {
    // 103 centavos a 50% (5_000 bps) = 51.5 → floor → 51
    expect(applyRate(centavos(103), 5_000)).toBe(51);
    // 100 bps = 1% exato, sem fração — controle
    expect(applyRate(centavos(10_000), 100)).toBe(100);
  });

  it("applyRate com Money negativo floor para o lado mais negativo (não arredonda para 0)", () => {
    // -103 * 5000 / 10000 = -51.5 → Math.floor(-51.5) = -52
    expect(applyRate(centavos(-103), 5_000)).toBe(-52);
  });

  it("mul com fator negativo inverte o sinal corretamente", () => {
    expect(mul(centavos(500), -1)).toBe(-500);
  });
});

describe("fmt() — formatação pt-BR", () => {
  it("formata valores positivos", () => {
    expect(fmt(centavos(123_456))).toBe("R$ 1.234,56");
  });

  it("formata centavos com padding", () => {
    expect(fmt(centavos(100_005))).toBe("R$ 1.000,05");
  });

  it("formata zero", () => {
    expect(fmt(centavos(0))).toBe("R$ 0,00");
  });

  it("formata negativos com o sinal antes do R$", () => {
    expect(fmt(centavos(-123_456))).toBe("-R$ 1.234,56");
  });
});

describe("branded type — o que a trava de tipo realmente barra", () => {
  it("barra atribuir number cru a uma variável Money", () => {
    // @ts-expect-error — number cru não é atribuível a Money sem passar por centavos()/reais()
    const rawAsMoney: Money = 500;
    expect(rawAsMoney).toBe(500); // roda normalmente: é só o TS que reclama, JS não distingue
  });

  it("barra passar number cru como argumento onde se espera Money", () => {
    // @ts-expect-error — add() espera Money, não number cru
    expect(() => add(500, centavos(100))).not.toThrow();
  });

  it("NÃO barra operador aritmético cru sobre dois Money — limitação documentada no CLAUDE.md", () => {
    // Nenhum @ts-expect-error aqui: isto TEM que compilar. Se um dia parar de
    // compilar, o TypeScript mudou a checagem de operadores sobre branded
    // types — bom saber, não é um teste quebrado.
    const a = centavos(100);
    const b = centavos(50);
    const rawSum: number = a + b;
    expect(rawSum).toBe(150); // computa o valor certo; só não passou pelo teto/validação
  });
});

import { describe, expect, it } from "vitest";
import { createRng } from "../core/rng";
import { add, applyRate, bps, centavos, fmt, mul, reais, sub, type Bps, type Money } from "./money";

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

describe("bps() — a outra metade da Regra 2", () => {
  it("aceita um inteiro válido", () => {
    expect(bps(1500)).toBe(1500);
  });

  it("rejeita fração — é exatamente o erro que a Regra 2 antecipa e barrava só na prosa", () => {
    // Antes desta correção, applyRate(m, 0.15) compilava, rodava e devolvia 0
    // (Math.floor(0.15) === 0) — o dev queria dizer 15% e não recebia erro nenhum.
    expect(() => bps(0.15)).toThrow(RangeError);
    expect(() => bps(15.5)).toThrow(RangeError);
  });

  it("rejeita negativo", () => {
    expect(() => bps(-100)).toThrow(RangeError);
  });

  it("rejeita acima do teto de sanidade", () => {
    expect(() => bps(100_001)).toThrow(RangeError);
  });

  it("aceita a borda do teto", () => {
    expect(bps(100_000)).toBe(100_000);
  });

  it("aceita zero", () => {
    expect(bps(0)).toBe(0);
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
    expect(Number.isInteger(applyRate(a, bps(1_500)))).toBe(true);
  });

  it("add / sub fazem a conta certa", () => {
    expect(add(centavos(1_000), centavos(250))).toBe(1_250);
    expect(sub(centavos(1_000), centavos(250))).toBe(750);
  });

  it("sub com resultado negativo é permitido — dívida é Money válido", () => {
    expect(sub(centavos(100), centavos(300))).toBe(-200);
  });
});

describe("mul() / applyRate() — arredondamento simétrico nos dois sinais (Math.trunc)", () => {
  // Math.floor arredonda sempre em direção a -infinito: perde fração a favor
  // da casa quando o valor é positivo, mas GANHA fração de dívida quando é
  // negativo — inversão de sentido descoberta na revisão. EBIT negativo
  // (empresa no prejuízo) é o caso normal no começo do jogo, não uma borda
  // rara. Math.trunc arredonda em direção a zero nos dois sinais: a casa
  // sempre fica com a fração, nunca o contrário.

  it("mul: metade de fração positiva trunca para baixo em magnitude", () => {
    expect(mul(centavos(101), 0.5)).toBe(50); // trunc(50.5) = 50
  });

  it("mul: mesma magnitude de fração, money negativo — resultado espelhado, não mais negativo", () => {
    // Com Math.floor isto daria -51 (dívida maior que a exata). Com trunc, -50.
    expect(mul(centavos(-101), 0.5)).toBe(-50);
  });

  it("mul: |resultado(-x)| === |resultado(x)| para o mesmo fator — é a garantia de simetria", () => {
    const factor = 0.5;
    for (const value of [101, 103, 999, 12_345]) {
      expect(mul(centavos(-value), factor)).toBe(-mul(centavos(value), factor));
    }
  });

  it("mul com fator negativo inverte o sinal corretamente", () => {
    expect(mul(centavos(500), -1)).toBe(-500);
  });

  it("applyRate: 103 centavos a 50% trunca para baixo em magnitude", () => {
    expect(applyRate(centavos(103), bps(5_000))).toBe(51); // trunc(51.5) = 51
    expect(applyRate(centavos(10_000), bps(100))).toBe(100); // sem fração — controle
  });

  it("applyRate: mesma taxa, Money negativo — resultado espelhado, não mais negativo (era o bug)", () => {
    // Antes (Math.floor): applyRate(-103, 5000) = -52 (dívida maior que a exata).
    // Depois (BigInt, trunca em direção a zero): -51, espelho exato de +51.
    expect(applyRate(centavos(-103), bps(5_000))).toBe(-51);
  });

  it("applyRate: |resultado(-x)| === |resultado(x)| para a mesma taxa — mesma garantia de simetria", () => {
    const rate = bps(5_000);
    for (const value of [103, 999, 12_345, 7]) {
      expect(applyRate(centavos(-value), rate)).toBe(-applyRate(centavos(value), rate));
    }
  });
});

describe("applyRate() — precisão em valores grandes (BigInt, não float)", () => {
  // Casos reais encontrados na revisão: money * bps estoura Number.MAX_SAFE_INTEGER
  // no intermediário, e dividir de volta por 10_000 em float devolve um
  // valor que passa em Number.isSafeInteger mas está errado por 1 centavo.
  // Cada caso abaixo tem o valor exato calculado independentemente via BigInt.
  const knownCases: ReadonlyArray<{ money: number; rateBps: number; exact: number }> = [
    { money: 748_046_709_814_882, rateBps: 8_941, exact: 668_828_563_245_485 },
    { money: 837_382_127_512_851, rateBps: 8_895, exact: 744_851_402_422_680 },
    { money: 474_753_751_880_319, rateBps: 5_392, exact: 255_987_223_013_868 },
  ];

  it.each(knownCases)(
    "money=$money bps=$rateBps dá o valor exato, não o que o float arredondado daria",
    ({ money, rateBps, exact }) => {
      expect(applyRate(centavos(money), bps(rateBps))).toBe(exact);
    },
  );

  it("o mesmo teto de casos também é exato com Money negativo", () => {
    for (const { money, rateBps, exact } of knownCases) {
      expect(applyRate(centavos(-money), bps(rateBps))).toBe(-exact);
    }
  });

  // Seeds literais, nunca derivadas de tempo: fuzz sem seed é irreproduzível por
  // construção — acha a divergência e recusa dizer qual caso a produziu. Três
  // seeds em vez de uma ampliam a cobertura sem custar determinismo.
  const FUZZ_SEEDS = ["money-fuzz-a", "money-fuzz-b", "money-fuzz-c"] as const;
  const FUZZ_SAMPLES = 5_000;

  it.each(FUZZ_SEEDS)(
    'fuzz [seed "%s"]: bate com o valor exato via BigInt em 5000 amostras grandes',
    (seed) => {
      // Regressão do bug de precisão: gera valores na faixa onde a divergência
      // apareceu de verdade (~1e14–1e15 centavos), compara com o cálculo
      // independente via BigInt, e falha no primeiro descompasso.
      const rng = createRng(seed);
      let checked = 0;

      for (let i = 0; i < FUZZ_SAMPLES; i++) {
        const money = rng.int(1e14, 1e15 - 1);
        const rateValue = rng.int(0, 9_999);
        const expected = Number((BigInt(money) * BigInt(rateValue)) / 10_000n);
        const actual = applyRate(centavos(money), bps(rateValue));

        if (actual !== expected) {
          expect.fail(
            [
              "divergência de precisão em applyRate — caso exato para reproduzir:",
              `  seed:      "${seed}"`,
              `  amostra:   ${i}`,
              `  money:     ${money}`,
              `  bps:       ${rateValue}`,
              `  applyRate: ${actual}`,
              `  BigInt:    ${expected}`,
              `  delta:     ${actual - expected}`,
            ].join("\n"),
          );
        }
        checked++;
      }

      // Ancora que o laço rodou de verdade. Sem isto, um `FUZZ_SAMPLES` zerado
      // por acidente deixaria o teste verde sem comparar nada — a mesma classe
      // de falso-verde registrada em D-011.
      expect(checked).toBe(FUZZ_SAMPLES);
    },
  );
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

  it("barra atribuir number cru a uma variável Bps", () => {
    // @ts-expect-error — number cru não é atribuível a Bps sem passar por bps()
    const rawAsBps: Bps = 1500;
    expect(rawAsBps).toBe(1500);
  });

  it("barra passar number cru como argumento onde se espera Money", () => {
    // @ts-expect-error — add() espera Money, não number cru
    expect(() => add(500, centavos(100))).not.toThrow();
  });

  it("barra no tipo passar number cru onde se espera Bps — a trava nova desta correção", () => {
    // @ts-expect-error — applyRate() espera Bps, não number cru; um inteiro
    // válido bypassando o tipo ainda COMPUTA (só pula a validação de faixa),
    // porque BigInt(1500) não lança. Isto documenta o que o tipo barra: o
    // erro de chamada, não a aritmética em si — igual ao Money.
    expect(applyRate(centavos(100), 1_500)).toBe(15);
  });

  it("bônus de proteção em runtime: contornar o tipo com um Bps fracionário lança de qualquer jeito", () => {
    // Efeito colateral favorável do BigInt: BigInt(0.15) lança RangeError
    // ("not an integer") — diferente do bug original, que devolvia 0 em
    // silêncio. Mesmo ignorando o erro de tipo do @ts-expect-error acima,
    // o valor fracionário ainda é pego, só que por um erro de mensagem
    // diferente (de conversão de BigInt, não de validação de bps()).
    // @ts-expect-error — mesmo bypass do teste anterior, mas com fração
    expect(() => applyRate(centavos(100), 0.15)).toThrow(RangeError);
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

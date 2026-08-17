import { describe, expect, it } from "vitest";
import { createRng, restoreRng } from "./rng";

describe("serialização — salvar e restaurar o estado do PRNG", () => {
  it("restaurar de um estado salvo reproduz exatamente a mesma sequência seguinte", () => {
    const rng = createRng("seed-de-teste");

    // Consome 50 valores só para afastar do estado inicial.
    for (let i = 0; i < 50; i++) rng.float();

    const savedState = rng.getState();
    const expected = Array.from({ length: 50 }, () => rng.float());

    const restored = restoreRng(savedState);
    const actual = Array.from({ length: 50 }, () => restored.float());

    expect(actual).toEqual(expected);
  });

  it("dois Rng com a mesma seed, do zero, produzem a mesma sequência", () => {
    const a = createRng("seed-fixa");
    const b = createRng("seed-fixa");

    const seqA = Array.from({ length: 100 }, () => a.float());
    const seqB = Array.from({ length: 100 }, () => b.float());

    expect(seqA).toEqual(seqB);
  });

  it("seeds diferentes produzem sequências diferentes — nega um PRNG quebrado que sempre retorna a mesma coisa", () => {
    const a = createRng("seed-a");
    const b = createRng("seed-b");

    const seqA = Array.from({ length: 20 }, () => a.float());
    const seqB = Array.from({ length: 20 }, () => b.float());

    expect(seqA).not.toEqual(seqB);
  });

  it("getState() não muda o estado interno — chamar duas vezes seguidas dá o mesmo snapshot", () => {
    const rng = createRng("seed-snapshot");
    rng.float();
    expect(rng.getState()).toEqual(rng.getState());
  });
});

describe("float()", () => {
  it("sempre fica em [0, 1)", () => {
    const rng = createRng("seed-float-bounds");
    for (let i = 0; i < 1000; i++) {
      const value = rng.float();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("int(min, max)", () => {
  it("min === max sempre retorna o mesmo valor", () => {
    const rng = createRng("seed-int-degenerate");
    for (let i = 0; i < 20; i++) {
      expect(rng.int(7, 7)).toBe(7);
    }
  });

  it("nunca sai do intervalo [min, max]", () => {
    const rng = createRng("seed-int-range");
    for (let i = 0; i < 2000; i++) {
      const value = rng.int(-3, 4);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThanOrEqual(4);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("as duas bordas são de fato alcançadas — não só 'dentro do intervalo'", () => {
    // Um int() com limite superior exclusivo por engano passaria no teste
    // anterior (nunca sai do range) mas nunca acertaria o `max`. Este teste
    // existe para pegar exatamente esse bug.
    const rng = createRng("seed-int-edges");
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      seen.add(rng.int(0, 5));
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });
});

describe("pick()", () => {
  it("sempre devolve um elemento que está no array de entrada", () => {
    const rng = createRng("seed-pick");
    const items = ["a", "b", "c", "d"];
    for (let i = 0; i < 200; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("com tempo suficiente, alcança todos os elementos — não fica preso num só", () => {
    const rng = createRng("seed-pick-coverage");
    const items = ["a", "b", "c"];
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(rng.pick(items));
    expect(seen).toEqual(new Set(items));
  });

  it("rejeita array vazio em vez de devolver undefined em silêncio", () => {
    const rng = createRng("seed-pick-empty");
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});

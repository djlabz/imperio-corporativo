import { describe, expect, it } from "vitest";

// Teste bobo: só prova que o Vitest está de pé.
// Sai da árvore na Etapa 2, quando money.test.ts e determinism.test.ts o substituem.
describe("smoke", () => {
  it("roda o vitest", () => {
    expect(1 + 1).toBe(2);
  });
});

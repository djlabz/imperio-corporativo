import { describe, expect, it } from "vitest";
import { attachDrawCallCounter } from "./drawCallCounter";

function fakeGl() {
  return {
    drawElements: () => undefined,
    drawArrays: () => undefined,
  };
}

describe("attachDrawCallCounter() — casos que funcionam", () => {
  it("conta drawElements e drawArrays juntos", () => {
    const gl = fakeGl();
    const counter = attachDrawCallCounter({ gl });
    expect(counter).toBeDefined();

    gl.drawElements();
    gl.drawArrays();
    gl.drawElements();

    expect(counter?.count).toBe(3);
  });

  it("reset() zera a contagem", () => {
    const gl = fakeGl();
    const counter = attachDrawCallCounter({ gl });
    gl.drawArrays();
    gl.drawArrays();
    counter?.reset();
    expect(counter?.count).toBe(0);
  });

  it("chama a função original de verdade, não só conta — não quebra o rendering de fato", () => {
    const calls: string[] = [];
    const gl = {
      drawElements: () => calls.push("elements"),
      drawArrays: () => calls.push("arrays"),
    };
    attachDrawCallCounter({ gl });
    gl.drawElements();
    gl.drawArrays();
    expect(calls).toEqual(["elements", "arrays"]);
  });

  it("continua contando depois de reset()", () => {
    const gl = fakeGl();
    const counter = attachDrawCallCounter({ gl });
    gl.drawArrays();
    counter?.reset();
    gl.drawArrays();
    gl.drawArrays();
    expect(counter?.count).toBe(2);
  });
});

describe("attachDrawCallCounter() — degradação silenciosa, nunca lança", () => {
  it("renderer sem propriedade gl devolve undefined", () => {
    expect(attachDrawCallCounter({})).toBeUndefined();
  });

  it("renderer nulo devolve undefined", () => {
    expect(attachDrawCallCounter(null)).toBeUndefined();
  });

  it("renderer indefinido devolve undefined", () => {
    expect(attachDrawCallCounter(undefined)).toBeUndefined();
  });

  it("gl sem drawElements/drawArrays (ex.: backend WebGPU/Canvas) devolve undefined", () => {
    expect(attachDrawCallCounter({ gl: {} })).toBeUndefined();
  });

  it("gl que não é objeto (string, número) devolve undefined sem lançar", () => {
    expect(attachDrawCallCounter({ gl: "não sou um contexto" })).toBeUndefined();
    expect(attachDrawCallCounter({ gl: 42 })).toBeUndefined();
  });

  it("propriedade gl que lança ao ser acessada não escapa do módulo", () => {
    const renderer = {
      get gl(): never {
        throw new Error("acesso a gl falhou de propósito, simulando um renderer hostil");
      },
    };
    expect(() => attachDrawCallCounter(renderer)).not.toThrow();
    expect(attachDrawCallCounter(renderer)).toBeUndefined();
  });
});

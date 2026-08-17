import { describe, expect, it } from "vitest";
import { ElectronSaveAdapter } from "./ElectronSaveAdapter";

// Stub da Etapa 6. O contrato de hoje é "lança sempre" — não "funciona às
// vezes". Um stub que engolisse a chamada em silêncio seria pior que um erro.
describe("ElectronSaveAdapter (stub da Etapa 6)", () => {
  it("write() lança", () => {
    expect(() => new ElectronSaveAdapter().write()).toThrow(/Etapa 6/);
  });

  it("read() lança", () => {
    expect(() => new ElectronSaveAdapter().read()).toThrow(/Etapa 6/);
  });

  it("list() lança", () => {
    expect(() => new ElectronSaveAdapter().list()).toThrow(/Etapa 6/);
  });

  it("remove() lança", () => {
    expect(() => new ElectronSaveAdapter().remove()).toThrow(/Etapa 6/);
  });
});

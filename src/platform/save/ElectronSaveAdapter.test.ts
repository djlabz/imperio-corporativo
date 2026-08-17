import { beforeEach, describe, expect, it } from "vitest";
import type { ElectronSaveApi } from "../electron/electronSaveApi";
import { ElectronSaveAdapter } from "./ElectronSaveAdapter";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/**
 * Fake de `window.electronSave` — o ambiente de teste é Node puro (ver
 * vite.config.ts), sem Electron real por trás. Isto testa o contrato do
 * ElectronSaveAdapter (delega pra `window.electronSave`, propaga erros, não
 * inventa comportamento) — não testa o processo main nem o IPC de verdade,
 * que só existem dentro do Electron. Mesmo padrão de global injetado que
 * IndexedDbSaveAdapter.test.ts usa pra `indexedDB`.
 */
function createFakeElectronSave(): ElectronSaveApi {
  const store = new Map<string, Uint8Array>();
  return {
    write: (key, data) => {
      store.set(key, data);
      return Promise.resolve();
    },
    read: (key) => Promise.resolve(store.get(key)),
    list: () => Promise.resolve([...store.keys()]),
    remove: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
}

describe("ElectronSaveAdapter — sem window.electronSave", () => {
  beforeEach(() => {
    globalThis.window = {} as unknown as Window & typeof globalThis;
  });

  it("construtor lança com mensagem clara — melhor que falhar tarde na primeira chamada", () => {
    expect(() => new ElectronSaveAdapter()).toThrow(/electronSave/);
  });
});

describe("ElectronSaveAdapter — com window.electronSave (fake)", () => {
  beforeEach(() => {
    globalThis.window = { electronSave: createFakeElectronSave() } as unknown as Window &
      typeof globalThis;
  });

  it("write() seguido de read() devolve os mesmos bytes", async () => {
    const adapter = new ElectronSaveAdapter();
    await adapter.write("slot-1", bytes(1, 2, 3));
    expect(await adapter.read("slot-1")).toEqual(bytes(1, 2, 3));
  });

  it("read() de chave inexistente devolve undefined, não lança", async () => {
    const adapter = new ElectronSaveAdapter();
    expect(await adapter.read("nao-existe")).toBeUndefined();
  });

  it("list() devolve as chaves gravadas", async () => {
    const adapter = new ElectronSaveAdapter();
    await adapter.write("a", bytes(1));
    await adapter.write("b", bytes(2));
    expect((await adapter.list()).sort()).toEqual(["a", "b"]);
  });

  it("remove() apaga a chave", async () => {
    const adapter = new ElectronSaveAdapter();
    await adapter.write("slot-1", bytes(1));
    await adapter.remove("slot-1");
    expect(await adapter.read("slot-1")).toBeUndefined();
  });

  it("delega pra window.electronSave, não reimplementa nada — erro do lado do main propaga intacto", async () => {
    const boom = new Error("disco cheio");
    globalThis.window = {
      electronSave: {
        write: () => Promise.reject(boom),
        read: () => Promise.reject(boom),
        list: () => Promise.reject(boom),
        remove: () => Promise.reject(boom),
      },
    } as unknown as Window & typeof globalThis;

    const adapter = new ElectronSaveAdapter();
    await expect(adapter.write("k", bytes(1))).rejects.toBe(boom);
  });
});

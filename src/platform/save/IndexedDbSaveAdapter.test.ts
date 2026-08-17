import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { IndexedDbSaveAdapter } from "./IndexedDbSaveAdapter";

// fake-indexeddb persiste dados entre testes por padrão (é um banco de
// verdade, só que em memória). Recriar a IDBFactory a cada teste isola um
// teste do outro — senão "não sobrou nada" de um teste vazaria pro próximo.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe("IndexedDbSaveAdapter", () => {
  it("write() seguido de read() devolve os mesmos bytes", async () => {
    const adapter = new IndexedDbSaveAdapter();
    await adapter.write("slot-1", bytes(1, 2, 3));
    const result = await adapter.read("slot-1");
    expect(result).toEqual(bytes(1, 2, 3));
  });

  it("read() de chave inexistente devolve undefined, não lança", async () => {
    const adapter = new IndexedDbSaveAdapter();
    const result = await adapter.read("nao-existe");
    expect(result).toBeUndefined();
  });

  it("list() devolve as chaves gravadas", async () => {
    const adapter = new IndexedDbSaveAdapter();
    await adapter.write("a", bytes(1));
    await adapter.write("b", bytes(2));
    const keys = await adapter.list();
    expect(keys.sort()).toEqual(["a", "b"]);
  });

  it("list() vazio devolve array vazio, não erro", async () => {
    const adapter = new IndexedDbSaveAdapter();
    expect(await adapter.list()).toEqual([]);
  });

  it("write() na mesma chave sobrescreve, não duplica", async () => {
    const adapter = new IndexedDbSaveAdapter();
    await adapter.write("slot-1", bytes(1));
    await adapter.write("slot-1", bytes(9, 9));
    expect(await adapter.read("slot-1")).toEqual(bytes(9, 9));
    expect(await adapter.list()).toEqual(["slot-1"]);
  });

  it("remove() apaga a chave", async () => {
    const adapter = new IndexedDbSaveAdapter();
    await adapter.write("slot-1", bytes(1));
    await adapter.remove("slot-1");
    expect(await adapter.read("slot-1")).toBeUndefined();
    expect(await adapter.list()).toEqual([]);
  });

  it("remove() de chave inexistente não lança", async () => {
    const adapter = new IndexedDbSaveAdapter();
    await expect(adapter.remove("nao-existe")).resolves.toBeUndefined();
  });

  it("instâncias diferentes do adapter compartilham o mesmo banco — o SaveAdapter é a interface, não o estado", async () => {
    const first = new IndexedDbSaveAdapter();
    await first.write("slot-1", bytes(42));
    const second = new IndexedDbSaveAdapter();
    expect(await second.read("slot-1")).toEqual(bytes(42));
  });
});

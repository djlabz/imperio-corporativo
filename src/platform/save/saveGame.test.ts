import { describe, expect, it } from "vitest";
import { createWorld } from "../../sim/core/World";
import { tick } from "../../sim/core/tick";
import { decodeWorld } from "./pipeline";
import { loadLatestWorld, MAX_BACKUPS, saveWorld } from "./saveGame";
import type { SaveAdapter } from "./SaveAdapter";
import { SaveError } from "./SaveError";

/** Fake em memória — testa a lógica de saveGame.ts isolada do IndexedDB de verdade. */
function createMemorySaveAdapter(): SaveAdapter {
  const store = new Map<string, Uint8Array>();
  return {
    async write(key, data) {
      store.set(key, data);
    },
    async read(key) {
      return store.get(key);
    },
    async list() {
      return Array.from(store.keys());
    },
    async remove(key) {
      store.delete(key);
    },
  };
}

/** Relógio falso, incrementa 1 por chamada — Date.now() de verdade colidiria num loop de teste. */
function fakeClock(): () => number {
  let current = 1_000;
  return () => current++;
}

describe("saveWorld() / loadLatestWorld() — caminho feliz", () => {
  it("salva e carrega o mesmo World", async () => {
    const adapter = createMemorySaveAdapter();
    const world = createWorld("save-game-teste");

    await saveWorld(adapter, world, fakeClock());
    const loaded = await loadLatestWorld(adapter);

    expect(loaded).toEqual(world);
  });

  it("loadLatestWorld() num adapter vazio lança SaveError", async () => {
    const adapter = createMemorySaveAdapter();
    await expect(loadLatestWorld(adapter)).rejects.toThrow(SaveError);
    await expect(loadLatestWorld(adapter)).rejects.toThrow(/nenhum save/i);
  });
});

describe("rotação de backup — só os MAX_BACKUPS mais recentes sobrevivem", () => {
  it("salvar 5 vezes deixa exatamente 3 saves", async () => {
    const adapter = createMemorySaveAdapter();
    const clock = fakeClock();

    for (let i = 0; i < 5; i++) {
      await saveWorld(adapter, createWorld(`seed-${i}`), clock);
    }

    const keys = await adapter.list();
    expect(keys).toHaveLength(MAX_BACKUPS);
  });

  it("os 3 que sobram são os 3 MAIS RECENTES, não os 3 mais antigos", async () => {
    const adapter = createMemorySaveAdapter();
    const clock = fakeClock();

    // 5 saves com tickCount identificável: 1, 2, 3, 4, 5.
    let world = createWorld("seed-rotacao");
    for (let i = 0; i < 5; i++) {
      world = tick(world);
      await saveWorld(adapter, world, clock);
    }

    const keys = await adapter.list();
    const survivingTickCounts = new Set(
      await Promise.all(
        keys.map(async (key) => {
          const bytes = await adapter.read(key);
          const loaded = await decodeWorld(bytes as Uint8Array<ArrayBuffer>);
          return loaded.tickCount;
        }),
      ),
    );

    // Os 3 mais recentes (tickCount 3, 4, 5) sobrevivem; 1 e 2 foram podados.
    expect(survivingTickCounts).toEqual(new Set([3, 4, 5]));

    const latest = await loadLatestWorld(adapter);
    expect(latest.tickCount).toBe(5);
  });

  it("chaves que não são deste esquema de save (prefixo diferente) são ignoradas pela rotação", async () => {
    const adapter = createMemorySaveAdapter();
    await adapter.write("outra-coisa-qualquer", new Uint8Array([1, 2, 3]));

    const clock = fakeClock();
    for (let i = 0; i < 5; i++) {
      await saveWorld(adapter, createWorld(`seed-${i}`), clock);
    }

    const keys = await adapter.list();
    expect(keys).toContain("outra-coisa-qualquer");
    expect(keys).toHaveLength(MAX_BACKUPS + 1); // 3 saves + a chave estranha, que não devia ter sido podada
  });
});

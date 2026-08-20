import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { World } from "../../sim/core/World";
import { createWorld } from "../../sim/core/World";
import { tick } from "../../sim/core/tick";
import { AUTOSAVE_INTERVAL_MS, startAutosave } from "./autosave";
import type { SaveAdapter } from "./SaveAdapter";

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

/**
 * saveWorld() de verdade passa por PBKDF2 via crypto.subtle, que no Node
 * roda no thread pool real — os fake timers do vitest não aceleram isso, e
 * o teste travaria esperando um "advance" que nunca resolve a Promise. O
 * pipeline completo já está testado em pipeline.test.ts/saveGame.test.ts;
 * aqui o que importa é só o agendamento, então injeta um save falso e
 * instantâneo.
 */
function createCountingFakeSave(): {
  save: (adapter: SaveAdapter, world: World) => Promise<void>;
  calls: World[];
} {
  const calls: World[] = [];
  return {
    calls,
    save: (_adapter, world) => {
      calls.push(world);
      return Promise.resolve();
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startAutosave()", () => {
  it("salva no primeiro intervalo, sem precisar esperar de verdade", async () => {
    const fake = createCountingFakeSave();
    const world = createWorld("autosave-teste");
    const handle = startAutosave(() => world, createMemorySaveAdapter(), 1000, fake.save);

    expect(fake.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fake.calls).toHaveLength(1);

    handle.stop();
  });

  it("salva repetidamente, uma chamada por intervalo", async () => {
    const fake = createCountingFakeSave();
    const world = createWorld("autosave-repetido");
    const handle = startAutosave(() => world, createMemorySaveAdapter(), 1000, fake.save);

    await vi.advanceTimersByTimeAsync(3500); // 3 intervalos completos, o 4º não chegou

    expect(fake.calls).toHaveLength(3);
    handle.stop();
  });

  it("stop() para os próximos autosaves", async () => {
    const fake = createCountingFakeSave();
    const world = createWorld("autosave-stop");
    const handle = startAutosave(() => world, createMemorySaveAdapter(), 1000, fake.save);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fake.calls).toHaveLength(1);

    handle.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(fake.calls).toHaveLength(1); // não cresceu depois do stop
  });

  it("usa o World atual a cada disparo, não uma cópia congelada de quando começou", async () => {
    const fake = createCountingFakeSave();
    let world = createWorld("autosave-atual");
    const handle = startAutosave(() => world, createMemorySaveAdapter(), 1000, fake.save);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fake.calls[0]?.tickCount).toBe(0);

    world = tick(tick(tick(world, []), []), []); // o mundo avança FORA do autosave
    await vi.advanceTimersByTimeAsync(1000);

    expect(fake.calls[1]?.tickCount).toBe(3);
    handle.stop();
  });

  it("uma falha num autosave não impede os próximos", async () => {
    let shouldFail = true;
    let successCount = 0;
    const flakySave = (): Promise<void> => {
      if (shouldFail) return Promise.reject(new Error("disco cheio, de propósito, só neste teste"));
      successCount++;
      return Promise.resolve();
    };

    const world = createWorld("autosave-falha");
    const handle = startAutosave(() => world, createMemorySaveAdapter(), 1000, flakySave);

    await vi.advanceTimersByTimeAsync(1000); // este falha
    expect(successCount).toBe(0);

    shouldFail = false;
    await vi.advanceTimersByTimeAsync(1000); // este funciona
    expect(successCount).toBe(1);

    handle.stop();
  });

  it("respeita AUTOSAVE_INTERVAL_MS por padrão (60s), não dispara antes disso", async () => {
    const fake = createCountingFakeSave();
    const world = createWorld("autosave-default");
    const handle = startAutosave(() => world, createMemorySaveAdapter(), undefined, fake.save);

    await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS - 1);
    expect(fake.calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(fake.calls).toHaveLength(1);

    handle.stop();
  });

  it("AUTOSAVE_INTERVAL_MS é 60 segundos", () => {
    expect(AUTOSAVE_INTERVAL_MS).toBe(60_000);
  });
});

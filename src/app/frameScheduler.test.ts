import { describe, expect, it } from "vitest";
import { createUncappedScheduler } from "./frameScheduler";

// createVsyncScheduler não é testado aqui: depende de requestAnimationFrame,
// que não existe em Node puro. Ver comentário em frameScheduler.ts.

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createUncappedScheduler()", () => {
  it("chama o callback repetidamente até stop()", async () => {
    const scheduler = createUncappedScheduler();
    const calls: number[] = [];

    scheduler.start((now) => {
      calls.push(now);
      if (calls.length >= 5) scheduler.stop();
    });

    await waitMs(50);
    expect(calls.length).toBeGreaterThanOrEqual(5);
  });

  it("depois de stop(), para de chamar o callback", async () => {
    const scheduler = createUncappedScheduler();
    let count = 0;

    scheduler.start(() => {
      count++;
    });
    await waitMs(20);
    scheduler.stop();
    const countAtStop = count;

    await waitMs(30);
    expect(count).toBe(countAtStop);
  });

  it("dispara muito mais rápido que 60fps permitiria — é o ponto do módulo", async () => {
    const scheduler = createUncappedScheduler();
    const timestamps: number[] = [];

    scheduler.start((now) => {
      timestamps.push(now);
      if (timestamps.length >= 50) scheduler.stop();
    });

    await waitMs(200);
    expect(timestamps.length).toBeGreaterThanOrEqual(50);

    const first = timestamps[0] as number;
    const last = timestamps.at(-1) as number;
    const avgMsPerFrame = (last - first) / (timestamps.length - 1);

    // A 60fps, 50 frames levariam ~833ms. Sem vsync tem que ser MUITO mais rápido.
    expect(avgMsPerFrame).toBeLessThan(1000 / 60);
  });

  it("dá pra reiniciar depois de parar", async () => {
    const scheduler = createUncappedScheduler();
    let count = 0;
    scheduler.start(() => count++);
    await waitMs(10);
    scheduler.stop();
    const afterFirstRun = count;
    expect(afterFirstRun).toBeGreaterThan(0);

    scheduler.start(() => count++);
    await waitMs(10);
    scheduler.stop();
    expect(count).toBeGreaterThan(afterFirstRun);
  });
});

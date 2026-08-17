import { describe, expect, it } from "vitest";
import { GRID_COLS, GRID_ROWS, WORLD_HEIGHT, WORLD_WIDTH } from "../world/tileMap";
import type { FlowField } from "./flowField";
import {
  CLOTHING_PALETTE,
  createNpcPool,
  LOD_INTERVAL_TICKS,
  LOD_NEAR_RADIUS,
  NPC_SPAWN_MARGIN,
  POOL_CAPACITY,
  SCALE_Y_MAX,
  SCALE_Y_MIN,
  SPEED_PER_TICK,
  stepNpcPool,
} from "./npcPool";

/** Campo fake, uniforme — todo NPC lê a mesma direção não importa onde esteja. */
function uniformField(dx: number, dy: number): FlowField {
  const vectors = new Float32Array(GRID_COLS * GRID_ROWS * 2);
  for (let i = 0; i < vectors.length; i += 2) {
    vectors[i] = dx;
    vectors[i + 1] = dy;
  }
  return { cols: GRID_COLS, rows: GRID_ROWS, vectors };
}

/** Gerador determinístico: repete a sequência dada, em ordem, indefinidamente. */
function sequence(values: readonly number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] as number;
}

function isOnWorldEdge(x: number, y: number): boolean {
  return (
    x === -NPC_SPAWN_MARGIN ||
    x === WORLD_WIDTH + NPC_SPAWN_MARGIN ||
    y === -NPC_SPAWN_MARGIN ||
    y === WORLD_HEIGHT + NPC_SPAWN_MARGIN
  );
}

describe("createNpcPool()", () => {
  it("capacity default é POOL_CAPACITY", () => {
    expect(createNpcPool({ activeCount: 1 }).capacity).toBe(POOL_CAPACITY);
  });

  it("rejeita activeCount maior que capacity", () => {
    expect(() => createNpcPool({ capacity: 10, activeCount: 11 })).toThrow(RangeError);
  });

  it("todo NPC nasce numa borda do mundo (dentro da margem)", () => {
    const pool = createNpcPool({ capacity: 50, activeCount: 50 });
    for (let i = 0; i < pool.capacity; i++) {
      expect(isOnWorldEdge(pool.x[i] as number, pool.y[i] as number)).toBe(true);
    }
  });

  it("scaleY sempre entre SCALE_Y_MIN e SCALE_Y_MAX", () => {
    const pool = createNpcPool({ capacity: 100, activeCount: 100 });
    for (let i = 0; i < pool.capacity; i++) {
      const scale = pool.scaleY[i] as number;
      expect(scale).toBeGreaterThanOrEqual(SCALE_Y_MIN);
      expect(scale).toBeLessThanOrEqual(SCALE_Y_MAX);
    }
  });

  it("tint sempre é um valor da paleta de roupa", () => {
    const pool = createNpcPool({ capacity: 100, activeCount: 100 });
    for (let i = 0; i < pool.capacity; i++) {
      expect(CLOTHING_PALETTE).toContain(pool.tint[i]);
    }
  });

  it("com random injetado e determinístico, duas chamadas dão pools idênticos", () => {
    const makeRandom = () => sequence([0.1, 0.4, 0.6, 0.9, 0.05, 0.7]);
    const a = createNpcPool({ capacity: 20, activeCount: 20, random: makeRandom() });
    const b = createNpcPool({ capacity: 20, activeCount: 20, random: makeRandom() });
    expect(Array.from(a.x)).toEqual(Array.from(b.x));
    expect(Array.from(a.y)).toEqual(Array.from(b.y));
    expect(Array.from(a.tint)).toEqual(Array.from(b.tint));
  });
});

describe("stepNpcPool()", () => {
  it("NPC perto da câmera se move todo tick, na direção do campo", () => {
    const pool = createNpcPool({ capacity: 1, activeCount: 1 });
    pool.x[0] = 1000;
    pool.y[0] = 1000;
    const field = uniformField(1, 0); // pra +x

    stepNpcPool(pool, field, 1, /* cameraX */ 1000, /* cameraY */ 1000);

    expect(pool.x[0]).toBeCloseTo(1000 + SPEED_PER_TICK, 5);
    expect(pool.y[0]).toBeCloseTo(1000, 5);
  });

  it("NPC longe da câmera só se move nos ticks escalonados (LOD)", () => {
    const pool = createNpcPool({ capacity: 1, activeCount: 1 });
    pool.x[0] = 1000;
    pool.y[0] = 1000;
    const field = uniformField(1, 0);
    const farCamera = { x: pool.x[0] as number, y: (pool.y[0] as number) + LOD_NEAR_RADIUS * 10 };

    // índice 0: elegível quando (tickCount + 0) % LOD_INTERVAL_TICKS === 0
    const nonEligibleTick = 1; // (1+0) % 5 !== 0
    stepNpcPool(pool, field, nonEligibleTick, farCamera.x, farCamera.y);
    expect(pool.x[0]).toBe(1000); // não moveu

    const eligibleTick = LOD_INTERVAL_TICKS; // (5+0) % 5 === 0
    stepNpcPool(pool, field, eligibleTick, farCamera.x, farCamera.y);
    expect(pool.x[0]).toBeCloseTo(1000 + SPEED_PER_TICK, 5); // moveu
  });

  it("LOD escalona por índice — dois NPCs longe não atualizam no mesmo tick", () => {
    const pool = createNpcPool({ capacity: 2, activeCount: 2 });
    pool.x[0] = 1000;
    pool.y[0] = 1000;
    pool.x[1] = 1000;
    pool.y[1] = 1000;
    const field = uniformField(1, 0);
    const farCamera = { x: 1000, y: 1000 + LOD_NEAR_RADIUS * 10 };

    // tick 0: índice 0 elegível ((0+0)%5===0), índice 1 não ((0+1)%5!==0)
    stepNpcPool(pool, field, 0, farCamera.x, farCamera.y);
    expect(pool.x[0]).toBeCloseTo(1000 + SPEED_PER_TICK, 5);
    expect(pool.x[1]).toBe(1000);
  });

  it("NPC que sairia do mundo respawna numa borda aleatória, não continua na direção do campo", () => {
    const pool = createNpcPool({ capacity: 1, activeCount: 1 });
    pool.x[0] = WORLD_WIDTH + NPC_SPAWN_MARGIN - 1; // um passo de sair pela direita
    pool.y[0] = 1000;
    const field = uniformField(1, 0); // empurra mais pra fora ainda

    // random controla o respawn: edge=3 (esquerda, índice 3 de 4 → floor(0.99*4)=3), alongEdge=0.5
    const random = sequence([0.99, 0.5]);
    stepNpcPool(pool, field, 1, pool.x[0] as number, pool.y[0] as number, random);

    expect(pool.x[0]).toBe(-NPC_SPAWN_MARGIN);
    expect(pool.y[0]).toBeCloseTo(0.5 * WORLD_HEIGHT, 5);
  });

  it("respeita activeCount — NPCs além do índice activeCount-1 não se movem", () => {
    const pool = createNpcPool({ capacity: 5, activeCount: 2 });
    for (let i = 0; i < pool.capacity; i++) {
      pool.x[i] = 1000;
      pool.y[i] = 1000;
    }
    const field = uniformField(1, 0);

    stepNpcPool(pool, field, LOD_INTERVAL_TICKS * 10, 1000, 1000); // câmera em cima, todos "perto"

    expect(pool.x[0]).not.toBe(1000);
    expect(pool.x[1]).not.toBe(1000);
    expect(pool.x[2]).toBe(1000); // inativo, não mexeu
    expect(pool.x[3]).toBe(1000);
    expect(pool.x[4]).toBe(1000);
  });
});

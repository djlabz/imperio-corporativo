import { describe, expect, it } from "vitest";
import { createNpcPool } from "./npcPool";
import { buildNpcPoolView, syncNpcPoolView } from "./NpcPoolView";

describe("buildNpcPoolView()", () => {
  it("cria exatamente `capacity` Graphics", () => {
    const view = buildNpcPoolView(50);
    expect(view.items).toHaveLength(50);
    expect(view.container.children).toHaveLength(50);
  });

  it("container tem sortableChildren ligado — necessário pro Y-sort funcionar quando os NPCs se movem", () => {
    const view = buildNpcPoolView(10);
    expect(view.container.sortableChildren).toBe(true);
  });

  it("todas as instâncias compartilham o mesmo GraphicsContext — nunca recria a geometria por NPC", () => {
    const view = buildNpcPoolView(20);
    const sharedContext = view.items[0]?.context;
    expect(sharedContext).toBeDefined();
    for (const graphics of view.items) {
      expect(graphics.context).toBe(sharedContext);
    }
  });

  it("cada Graphics é cullable com cullArea pré-computado", () => {
    const view = buildNpcPoolView(5);
    for (const graphics of view.items) {
      expect(graphics.cullable).toBe(true);
      expect(graphics.cullArea).not.toBeNull();
    }
  });
});

describe("syncNpcPoolView()", () => {
  it("NPC ativo fica visível, com posição/tint/scale/zIndex do pool", () => {
    const pool = createNpcPool({ capacity: 5, activeCount: 5 });
    pool.x[0] = 123;
    pool.y[0] = 456;
    pool.tint[0] = 0xff0000;
    pool.scaleY[0] = 1.05;

    const view = buildNpcPoolView(5);
    syncNpcPoolView(view, pool);

    const graphics = view.items[0];
    expect(graphics?.visible).toBe(true);
    expect(graphics?.position.x).toBe(123);
    expect(graphics?.position.y).toBe(456);
    expect(graphics?.tint).toBe(0xff0000);
    expect(graphics?.scale.y).toBeCloseTo(1.05, 5);
    expect(graphics?.zIndex).toBe(456);
  });

  it("NPC além de activeCount fica invisível — não é removido, só escondido", () => {
    const pool = createNpcPool({ capacity: 5, activeCount: 2 });
    const view = buildNpcPoolView(5);
    syncNpcPoolView(view, pool);

    expect(view.items[0]?.visible).toBe(true);
    expect(view.items[1]?.visible).toBe(true);
    expect(view.items[2]?.visible).toBe(false);
    expect(view.items[3]?.visible).toBe(false);
    expect(view.items[4]?.visible).toBe(false);
  });

  it("nunca cria ou destrói Graphics — os mesmos objetos sobrevivem a múltiplos syncs", () => {
    const pool = createNpcPool({ capacity: 5, activeCount: 5 });
    const view = buildNpcPoolView(5);
    const originalRefs = [...view.items];

    syncNpcPoolView(view, pool);
    pool.x[0] = 999;
    syncNpcPoolView(view, pool);

    expect(view.items).toEqual(originalRefs); // mesmas referências, não recriadas
    expect(view.container.children).toHaveLength(5); // nenhum filho adicionado/removido
  });
});

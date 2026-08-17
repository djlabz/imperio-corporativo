import { Container, Graphics, GraphicsContext, Rectangle } from "pixi.js";
import type { NpcPool } from "./npcPool";

const NPC_WIDTH = 14;
const NPC_HEIGHT = 22;
const OUTLINE_COLOR = 0x1a1a1a; // preto da paleta travada do CLAUDE.md, não #000 puro
const OUTLINE_WIDTH = 4; // convenção de arte do CLAUDE.md: contorno preto de 4px

/**
 * Retângulo com origem nos "pés" do NPC (y=0 na base, centralizado em x) —
 * é o ponto que graphics.position representa, e o que zIndex usa pro Y-sort:
 * o pé é o que toca o chão, então é ele que decide quem desenha na frente.
 * Preenchimento branco: base neutra pra tint reproduzir a cor da paleta sem
 * distorcer o matiz (tint multiplica a cor base).
 */
function buildNpcShape(): GraphicsContext {
  return new GraphicsContext()
    .rect(-NPC_WIDTH / 2, -NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT)
    .fill(0xffffff)
    .stroke({ color: OUTLINE_COLOR, width: OUTLINE_WIDTH });
}

export interface NpcPoolView {
  readonly container: Container;
  readonly items: readonly Graphics[];
}

/**
 * Um GraphicsContext compartilhado entre `capacity` instâncias de Graphics —
 * nunca recria a geometria por NPC. Cada Graphics é criado uma única vez
 * aqui e nunca destruído: o "pool" é justamente nunca dar new/destroy depois
 * disto (ver stepNpcPool/syncNpcPoolView, que só mutam propriedades).
 */
export function buildNpcPoolView(capacity: number): NpcPoolView {
  const shape = buildNpcShape();
  const container = new Container({ sortableChildren: true });
  const items: Graphics[] = [];

  const cullArea = new Rectangle(-NPC_WIDTH / 2, -NPC_HEIGHT, NPC_WIDTH, NPC_HEIGHT);
  for (let i = 0; i < capacity; i++) {
    const graphics = new Graphics(shape);
    // cullArea pré-computado evita recalcular bounds a partir da geometria a
    // cada frame — recomendação direta da doc de performance do Pixi.
    graphics.cullable = true;
    graphics.cullArea = cullArea;
    container.addChild(graphics);
    items.push(graphics);
  }

  return { container, items };
}

/** Copia o estado do pool (typed arrays) pros Graphics. Nunca cria/destrói nada. */
export function syncNpcPoolView(view: NpcPoolView, pool: NpcPool): void {
  for (let i = 0; i < pool.capacity; i++) {
    const graphics = view.items[i];
    if (!graphics) continue;

    const active = i < pool.activeCount;
    graphics.visible = active;
    if (!active) continue;

    const y = pool.y[i] as number;
    graphics.position.set(pool.x[i] as number, y);
    graphics.tint = pool.tint[i] as number;
    graphics.scale.y = pool.scaleY[i] as number;
    graphics.zIndex = y; // sortableChildren=true resorta sozinho antes de renderizar
  }
}

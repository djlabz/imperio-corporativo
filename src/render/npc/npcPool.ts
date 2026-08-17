import { WORLD_HEIGHT, WORLD_WIDTH } from "../world/tileMap";
import { sampleFlowField, type FlowField } from "./flowField";

/** Tamanho fixo do pool. Nunca cresce/encolhe em runtime — ver Regra de Performance no CLAUDE.md. */
export const POOL_CAPACITY = 600;

export const SPEED_PER_TICK = 12; // px de mundo por tick — ajuste visual, não balanceamento
export const LOD_INTERVAL_TICKS = 5;
export const LOD_NEAR_RADIUS = 800; // px de mundo — dentro disso, NPC atualiza todo tick
export const SCALE_Y_MIN = 0.92;
export const SCALE_Y_MAX = 1.08;
export const NPC_SPAWN_MARGIN = 16; // nasce/sai um pouco fora do mundo, não em cima da borda exata

/**
 * Cores "de roupa" da paleta travada do CLAUDE.md. Exclui pretos/brancos/
 * cinzas (reservados pra contorno e fundo) e tons de pele/madeira
 * (reservados pra quando houver arte de verdade) — sobra só o que lê como
 * roupa: vermelhos, laranjas, amarelos, azuis, verdes, rosa.
 */
export const CLOTHING_PALETTE: readonly number[] = [
  0xa31e14, 0xc42b1e, 0xe8452f, 0xd9631a, 0xf07a20, 0xff9a3c, 0xffd23f, 0xfcee8a, 0x6fd8e8,
  0x2b6cb0, 0x2e7d32, 0x4caf50, 0xe86ba0,
];

export interface NpcPool {
  readonly capacity: number;
  readonly activeCount: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly tint: Uint32Array;
  readonly scaleY: Float32Array;
}

export interface CreateNpcPoolOptions {
  readonly capacity?: number;
  readonly activeCount: number;
  /** Injetável para teste determinístico. Fora de sim/, Math.random() é permitido — NPC é decorativo. */
  readonly random?: () => number;
}

export function createNpcPool(options: CreateNpcPoolOptions): NpcPool {
  const capacity = options.capacity ?? POOL_CAPACITY;
  const random = options.random ?? Math.random;

  if (options.activeCount > capacity) {
    throw new RangeError(
      `activeCount (${options.activeCount}) não pode passar de capacity (${capacity})`,
    );
  }

  const x = new Float32Array(capacity);
  const y = new Float32Array(capacity);
  const tint = new Uint32Array(capacity);
  const scaleY = new Float32Array(capacity);

  for (let i = 0; i < capacity; i++) {
    const spawn = randomEdgePoint(random);
    x[i] = spawn.x;
    y[i] = spawn.y;
    tint[i] = pickClothingColor(random);
    scaleY[i] = SCALE_Y_MIN + random() * (SCALE_Y_MAX - SCALE_Y_MIN);
  }

  return { capacity, activeCount: options.activeCount, x, y, tint, scaleY };
}

function pickClothingColor(random: () => number): number {
  const index = Math.min(
    Math.floor(random() * CLOTHING_PALETTE.length),
    CLOTHING_PALETTE.length - 1,
  );
  return CLOTHING_PALETTE[index] as number;
}

// P-06 (docs/DECISOES.md): candidata não confirmada pro surto de frames longos
// no aquecimento em N alto (2000-4000) — aloca um objeto por respawn. Não
// "corrigido" de propósito: não há profiler provando gargalo real em N=500
// (o teto de pool de verdade), e a Regra de Performance do CLAUDE.md proíbe
// pré-otimizar sem essa prova. Se for mexer aqui, leia P-06 antes.
function randomEdgePoint(random: () => number): { x: number; y: number } {
  const edge = Math.min(Math.floor(random() * 4), 3); // 0=topo, 1=direita, 2=baixo, 3=esquerda
  const alongEdge = random();
  switch (edge) {
    case 0:
      return { x: alongEdge * WORLD_WIDTH, y: -NPC_SPAWN_MARGIN };
    case 1:
      return { x: WORLD_WIDTH + NPC_SPAWN_MARGIN, y: alongEdge * WORLD_HEIGHT };
    case 2:
      return { x: alongEdge * WORLD_WIDTH, y: WORLD_HEIGHT + NPC_SPAWN_MARGIN };
    default:
      return { x: -NPC_SPAWN_MARGIN, y: alongEdge * WORLD_HEIGHT };
  }
}

function isOutOfWorld(x: number, y: number): boolean {
  return (
    x < -NPC_SPAWN_MARGIN ||
    x > WORLD_WIDTH + NPC_SPAWN_MARGIN ||
    y < -NPC_SPAWN_MARGIN ||
    y > WORLD_HEIGHT + NPC_SPAWN_MARGIN
  );
}

/**
 * Avança o pool em um tick, mutando os typed arrays no lugar (zero alocação
 * no caminho comum — só um respawn aloca um objeto pequeno, e respawn é raro
 * comparado ao total de NPCs por tick).
 *
 * LOD: NPC fora de LOD_NEAR_RADIUS da câmera só recalcula posição a cada
 * LOD_INTERVAL_TICKS ticks, escalonado por índice (`(tickCount + i) % N`)
 * pra não empacotar o recálculo de todos os NPCs distantes no mesmo tick.
 */
export function stepNpcPool(
  pool: NpcPool,
  field: FlowField,
  tickCount: number,
  cameraX: number,
  cameraY: number,
  random: () => number = Math.random,
): void {
  for (let i = 0; i < pool.activeCount; i++) {
    const currentX = pool.x[i] as number;
    const currentY = pool.y[i] as number;

    const distanceToCamera = Math.hypot(currentX - cameraX, currentY - cameraY);
    const isNear = distanceToCamera <= LOD_NEAR_RADIUS;
    const isEligibleThisTick = isNear || (tickCount + i) % LOD_INTERVAL_TICKS === 0;
    if (!isEligibleThisTick) continue;

    const [dirX, dirY] = sampleFlowField(field, currentX, currentY);
    let nextX = currentX + dirX * SPEED_PER_TICK;
    let nextY = currentY + dirY * SPEED_PER_TICK;

    if (isOutOfWorld(nextX, nextY)) {
      const spawn = randomEdgePoint(random);
      nextX = spawn.x;
      nextY = spawn.y;
    }

    pool.x[i] = nextX;
    pool.y[i] = nextY;
  }
}

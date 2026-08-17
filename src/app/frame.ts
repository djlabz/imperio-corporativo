import { tick } from "../sim/core/tick";
import type { World } from "../sim/core/World";
import { advance, type FixedStepLoop } from "./loop";

export interface FrameState {
  readonly world: World;
  readonly loop: FixedStepLoop;
}

export interface FrameUpdateResult {
  readonly state: FrameState;
  readonly ticksRan: number;
}

/**
 * Fase de atualização de CPU de um frame: decide quantos ticks rodar (via o
 * acumulador de loop.ts) e roda cada um. Não toca em nada do Pixi — é por
 * isso que dá pra medir o custo dela num teste headless (ver frame.perf.test.ts).
 *
 * O que falta aqui pra virar o pipeline de frame completo (aplicar câmera,
 * sincronizar view do Pixi) fica fora de propósito: essa parte é O(1) hoje
 * (só tiles estáticos) e vira relevante de verdade na Etapa 4, quando o pool
 * de NPC ganhar sua própria fase de atualização e seu próprio teste de
 * orçamento — não faz sentido fingir isso agora.
 */
export function updateFrame(state: FrameState, frameMs: number): FrameUpdateResult {
  const stepped = advance(state.loop, frameMs);

  let world = state.world;
  for (let i = 0; i < stepped.ticksToRun; i++) {
    world = tick(world);
  }

  return {
    state: { world, loop: stepped.loop },
    ticksRan: stepped.ticksToRun,
  };
}

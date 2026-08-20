import type { Command } from "../sim/core/Command";
import { tick } from "../sim/core/tick";
import type { World } from "../sim/core/World";
import { advance, type FixedStepLoop } from "./loop";

export interface FrameState {
  readonly world: World;
  readonly loop: FixedStepLoop;
  /**
   * Comandos que chegaram em frames que não rodaram tick nenhum.
   *
   * Isto NÃO é opcional nem defensivo: com TICK_MS = 100 e a tela a 60fps, a
   * maioria dos frames roda ZERO tick. Aplicar a fila só quando por acaso houver
   * tick perderia cerca de cinco de cada seis cliques, em silêncio — o jogador
   * clicaria na rocha e nada aconteceria, sem erro nenhum em lugar nenhum.
   *
   * Mora aqui, na camada de app, e não no World: o World é o que vai pro save, e
   * fila pendente no instante do save é estado ambíguo (D-016).
   */
  readonly pendingCommands: readonly Command[];
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
 * `commands` é obrigatório, sem default, pelo mesmo motivo de tick() em D-016:
 * fila opcional é convite pra alguém esquecer de passar e não notar.
 *
 * Os comandos do frame entram no PRIMEIRO tick e só nele. Repetir em cada tick
 * faria um clique valer N golpes num frame lento, o que é a mesma classe de bug
 * que multiplicar receita por deltaTime (regra inviolável nº 3): o jogador
 * ganharia mais num PC pior.
 *
 * O que falta aqui pra virar o pipeline de frame completo (aplicar câmera,
 * sincronizar view do Pixi) fica fora de propósito: essa parte é O(1) hoje
 * (só tiles estáticos) e vira relevante de verdade na Etapa 4, quando o pool
 * de NPC ganhar sua própria fase de atualização e seu próprio teste de
 * orçamento — não faz sentido fingir isso agora.
 */
export function updateFrame(
  state: FrameState,
  frameMs: number,
  commands: readonly Command[],
): FrameUpdateResult {
  const stepped = advance(state.loop, frameMs);
  const queued = state.pendingCommands.concat(commands);

  if (stepped.ticksToRun === 0) {
    return {
      state: { world: state.world, loop: stepped.loop, pendingCommands: queued },
      ticksRan: 0,
    };
  }

  let world = tick(state.world, queued);
  for (let i = 1; i < stepped.ticksToRun; i++) {
    world = tick(world, []);
  }

  return {
    state: { world, loop: stepped.loop, pendingCommands: [] },
    ticksRan: stepped.ticksToRun,
  };
}

import { sampleFlowField, type FlowField } from "../npc/flowField";
import { TILE_HEIGHT, TILE_WIDTH } from "../world/tileMap";

/**
 * A resolução espacial do flow field é UMA célula: a direção de cada célula é
 * medida do centro dela. Dentro de uma célula do alvo, portanto, o campo não pode
 * ser confiado pra apontar pro alvo — a diagonal do tile é a distância a partir
 * da qual a aproximação passa a mirar o ponto.
 */
const FINAL_APPROACH_PX = Math.hypot(TILE_WIDTH, TILE_HEIGHT);

/**
 * O que o gerente faz ao CHEGAR no destino. "none" é o clique direito: andar e
 * parar, sem agir.
 */
export type ManagerIntent = "none" | "mine" | "sell";

export interface ManagerOrder {
  readonly targetX: number;
  readonly targetY: number;
  readonly intent: ManagerIntent;
  /** Distância do alvo que já conta como chegada. Alcance do lugar, ou tolerância do clique livre. */
  readonly arrivalRadius: number;
}

/**
 * Posição e ordem atual do gerente. Vive no RENDERER, nunca no World (D-017):
 * movimento é float, e float no `sim/` traria determinismo entre máquinas e
 * migração de save que não são necessários agora.
 */
export interface Manager {
  readonly x: number;
  readonly y: number;
  readonly order: ManagerOrder | undefined;
}

export interface ManagerStep {
  readonly manager: Manager;
  /**
   * A intenção que disparou NESTE passo, se disparou. É o que a camada de app
   * traduz em Command e enfileira — o `sim/` nunca soube onde o gerente estava.
   *
   * Dispara uma vez só: a ordem é limpa no mesmo passo. "Um clique = um golpe"
   * (F1-E3) sai disto, não de um contador em outro lugar.
   */
  readonly fired: ManagerIntent | undefined;
}

export function createManager(x: number, y: number): Manager {
  return { x, y, order: undefined };
}

/** Substitui a ordem atual. Clique novo cancela o anterior, como em qualquer RTS. */
export function orderManager(manager: Manager, order: ManagerOrder): Manager {
  return { ...manager, order };
}

/**
 * Avança o gerente um tick ao longo do flow field.
 *
 * Passo fixo, sem deltaTime: `speedPerTick` é distância por tick, e o tick tem
 * duração fixa (regra inviolável nº 3).
 */
export function stepManager(manager: Manager, field: FlowField, speedPerTick: number): ManagerStep {
  const { order } = manager;
  if (!order) {
    return { manager, fired: undefined };
  }

  const remaining = Math.hypot(order.targetX - manager.x, order.targetY - manager.y);
  if (remaining <= order.arrivalRadius) {
    return {
      manager: { ...manager, order: undefined },
      fired: order.intent === "none" ? undefined : order.intent,
    };
  }

  let [dx, dy] = sampleFlowField(field, manager.x, manager.y);

  // APROXIMAÇÃO FINAL: no último passo, mira o ponto do alvo em vez do campo.
  //
  // Não é refinamento — sem isto o gerente NÃO CHEGA, e o jogo trava em silêncio.
  // O campo dá uma direção por CÉLULA, medida do centro dela; perto do alvo, essa
  // direção não aponta do lugar onde o gerente está de fato, e ele orbita o
  // destino a cerca de uma célula de distância pra sempre — a ordem nunca
  // completa, nenhum comando é enfileirado, e nada acusa. Achado por teste, não
  // por leitura: as três asserções de chegada falharam.
  //
  // A condição garante término por duas vias. Pela velocidade: com
  // `remaining <= speed + arrivalRadius`, um passo direto de
  // `min(speed, remaining)` deixa a distância em `max(0, remaining - speed)`, que
  // é <= arrivalRadius, então o passo seguinte chega. E pela geometria: dentro de
  // FINAL_APPROACH_PX o rumo é direto, então a distância cai monotonicamente até
  // entrar no raio, por menor que seja a velocidade.
  //
  // O segundo termo não é zelo: com velocidade 3 e raio 2, o gerente parado a
  // 28px do alvo DENTRO da célula dele deslizava em +x pra sempre, porque a
  // direção da célula é medida do centro e o alvo não está no centro. Achado por
  // teste.
  //
  // Isto não viola "flow field, nunca A*" (CLAUDE.md): o campo faz o trajeto
  // inteiro; isto é o último passo, dentro do alcance de um tick. O caso do vetor
  // zero fica também coberto à parte — é a célula que CONTÉM o alvo, que não tem
  // direção por construção (ver flowField.ts).
  const finalApproach =
    remaining <= Math.max(speedPerTick + order.arrivalRadius, FINAL_APPROACH_PX);
  if (finalApproach || (dx === 0 && dy === 0)) {
    dx = (order.targetX - manager.x) / remaining;
    dy = (order.targetY - manager.y) / remaining;
  }

  // Nunca passa do alvo: sem este clamp, velocidade maior que a distância
  // restante faz o gerente oscilar em torno do destino pra sempre.
  const step = Math.min(speedPerTick, remaining);

  return {
    manager: { ...manager, x: manager.x + dx * step, y: manager.y + dy * step },
    fired: undefined,
  };
}

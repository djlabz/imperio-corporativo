import { GRID_COLS, GRID_ROWS, TILE_HEIGHT, TILE_WIDTH } from "../world/tileMap";

export interface FlowField {
  readonly cols: number;
  readonly rows: number;
  /** (dx, dy) unitário intercalado por célula: vectors[i*2], vectors[i*2+1]. */
  readonly vectors: Float32Array;
}

/**
 * Para onde o campo aponta. União discriminada, e não um par (x, y), porque os
 * dois consumidores querem coisas diferentes de verdade:
 *
 * - `bearing` é um campo de TRAVESSIA: atravessa o mapa num rumo, sem alvo. É o
 *   que os NPCs decorativos sempre usaram — o "destino" deles nunca foi um ponto,
 *   era uma direção embutida no código. Aqui ela fica explícita (D-017/F1-E3),
 *   sem mudar o que eles fazem.
 * - `point` é um campo de OBJETIVO: toda célula aponta pro alvo. É o que o
 *   gerente usa ao receber um clique de destino.
 *
 * Um par (x, y) sozinho não expressaria travessia: seria preciso cravar um alvo
 * absurdamente distante pra simular "rumo", e a distância necessária pra não
 * perturbar o campo é da ordem de 1e9 px — número mágico que existiria só pra
 * fazer teste passar.
 */
export type FlowDestination =
  | { readonly kind: "bearing"; readonly angleRad: number }
  | { readonly kind: "point"; readonly x: number; readonly y: number };

/**
 * Rumo dos NPCs decorativos: atravessa o mapa inteiro na diagonal, não orbita.
 *
 * A primeira versão desta função era um redemoinho em torno do centro do mapa —
 * verifiquei no browser antes de fechar a etapa e achei o problema: NPC nasce na
 * borda (spec) e um redemoinho tangencial+radial-pra-fora só afasta do centro,
 * nunca cruza. Como a câmera fica centrada no mundo por padrão, isso deixava a
 * área visível permanentemente vazia — e nenhum teste unitário acusaria, porque
 * todos validam geometria do campo, não "o resultado aparece na câmera default".
 */
export const NPC_FLOW_ANGLE = Math.atan2(1, 3);

/** O destino dos NPCs, explícito. Era este valor, embutido na função. */
export const NPC_TRAVERSAL: FlowDestination = { kind: "bearing", angleRad: NPC_FLOW_ANGLE };

/** Perturbação por célula: dá variação real ao campo (não é uniforme) sem ameaçar o cruzamento. */
const MEANDER_AMPLITUDE = 0.5; // radianos
const MEANDER_FREQ_COL = 0.15;
const MEANDER_FREQ_ROW = 0.22;

/**
 * Campo vetorial pré-calculado sobre o grid, uma direção por célula.
 *
 * O meandro só se aplica a `bearing`. Num campo de objetivo ele seria dano puro:
 * o gerente andaria em zigue-zague até um ponto que ele sabe onde está.
 */
export function buildFlowField(destination: FlowDestination): FlowField {
  const vectors = new Float32Array(GRID_COLS * GRID_ROWS * 2);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const index = (row * GRID_COLS + col) * 2;
      let dx: number;
      let dy: number;

      if (destination.kind === "bearing") {
        const meander =
          MEANDER_AMPLITUDE * Math.sin(col * MEANDER_FREQ_COL + row * MEANDER_FREQ_ROW);
        const angle = destination.angleRad + meander;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
      } else {
        // Centro da célula, não o canto: pelo canto, a célula que CONTÉM o alvo
        // aponta pra fora dele e o gerente orbita sem nunca chegar.
        const cellX = col * TILE_WIDTH + TILE_WIDTH / 2;
        const cellY = row * TILE_HEIGHT + TILE_HEIGHT / 2;
        const toX = destination.x - cellX;
        const toY = destination.y - cellY;
        const length = Math.hypot(toX, toY);
        // A célula do próprio alvo não tem direção definida. Zero, não NaN: quem
        // já chegou não precisa de direção, e NaN se propagaria pela posição.
        dx = length === 0 ? 0 : toX / length;
        dy = length === 0 ? 0 : toY / length;
      }

      vectors[index] = dx;
      vectors[index + 1] = dy;
    }
  }

  return { cols: GRID_COLS, rows: GRID_ROWS, vectors };
}

/**
 * Direção (dx, dy unitário) na célula que contém (worldX, worldY). Fora do
 * grid, prende na borda mais próxima em vez de lançar — quem chama pode
 * estar checando um ponto de respawn ainda não normalizado.
 */
export function sampleFlowField(
  field: FlowField,
  worldX: number,
  worldY: number,
): readonly [number, number] {
  const col = clampInt(Math.floor(worldX / TILE_WIDTH), 0, field.cols - 1);
  const row = clampInt(Math.floor(worldY / TILE_HEIGHT), 0, field.rows - 1);
  const index = (row * field.cols + col) * 2;
  return [field.vectors[index] ?? 0, field.vectors[index + 1] ?? 0];
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

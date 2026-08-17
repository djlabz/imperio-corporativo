import { GRID_COLS, GRID_ROWS, TILE_HEIGHT, TILE_WIDTH } from "../world/tileMap";

export interface FlowField {
  readonly cols: number;
  readonly rows: number;
  /** (dx, dy) unitário intercalado por célula: vectors[i*2], vectors[i*2+1]. */
  readonly vectors: Float32Array;
}

/**
 * Direção dominante do fluxo: atravessa o mapa inteiro na diagonal, não
 * orbita. A primeira versão desta função era um redemoinho em torno do
 * centro do mapa — verifiquei no browser antes de fechar a etapa e achei o
 * problema: NPC nasce na borda (spec) e um redemoinho tangencial+radial-pra-
 * fora só afasta do centro, nunca cruza. Como a câmera fica centrada no
 * mundo por padrão, isso deixava a área visível permanentemente vazia — e
 * nenhum teste unitário acusaria isso, porque todos validam geometria do
 * campo, não "o resultado aparece na câmera default". Um fluxo com direção
 * dominante atravessa o mapa de ponta a ponta, garantindo que a região
 * central seja cruzada por um bom volume de NPCs o tempo todo.
 */
const FLOW_ANGLE = Math.atan2(1, 3); // leve diagonal — atravessa X e Y com o tempo

/** Perturbação por célula: dá variação real ao campo (não é uniforme) sem ameaçar o cruzamento. */
const MEANDER_AMPLITUDE = 0.5; // radianos
const MEANDER_FREQ_COL = 0.15;
const MEANDER_FREQ_ROW = 0.22;

/** Campo vetorial pré-calculado sobre o grid: direção varia por célula (meandro), sempre lida por célula. */
export function buildFlowField(): FlowField {
  const vectors = new Float32Array(GRID_COLS * GRID_ROWS * 2);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const meander = MEANDER_AMPLITUDE * Math.sin(col * MEANDER_FREQ_COL + row * MEANDER_FREQ_ROW);
      const angle = FLOW_ANGLE + meander;

      const index = (row * GRID_COLS + col) * 2;
      vectors[index] = Math.cos(angle);
      vectors[index + 1] = Math.sin(angle);
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

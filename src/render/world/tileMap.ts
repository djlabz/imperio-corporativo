export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 48;
export const GRID_COLS = 40;
export const GRID_ROWS = 30;

export const WORLD_WIDTH = GRID_COLS * TILE_WIDTH;
export const WORLD_HEIGHT = GRID_ROWS * TILE_HEIGHT;

// Checkerboard neutro — não é terreno, é só pra distinguir tile do vizinho
// enquanto não existe asset nenhum. Fase 0: sem conteúdo de jogo.
const COLOR_A = 0x3d3d3d;
const COLOR_B = 0x7a7a7a;

export interface Tile {
  readonly col: number;
  readonly row: number;
  /** Canto superior esquerdo, em espaço do mundo. */
  readonly x: number;
  readonly y: number;
  readonly color: number;
}

/** Grid completo de tiles, em ordem de leitura (linha a linha). Função pura. */
export function buildTileGrid(): Tile[] {
  const tiles: Tile[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      tiles.push({
        col,
        row,
        x: col * TILE_WIDTH,
        y: row * TILE_HEIGHT,
        color: (col + row) % 2 === 0 ? COLOR_A : COLOR_B,
      });
    }
  }
  return tiles;
}

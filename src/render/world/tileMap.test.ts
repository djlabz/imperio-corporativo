import { describe, expect, it } from "vitest";
import {
  buildTileGrid,
  GRID_COLS,
  GRID_ROWS,
  TILE_HEIGHT,
  TILE_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./tileMap";

describe("buildTileGrid()", () => {
  it("gera exatamente GRID_COLS × GRID_ROWS tiles", () => {
    expect(buildTileGrid()).toHaveLength(GRID_COLS * GRID_ROWS);
  });

  it("é pura — duas chamadas produzem grids iguais", () => {
    expect(buildTileGrid()).toEqual(buildTileGrid());
  });

  it("cobre o mundo inteiro sem sobrar nem faltar espaço", () => {
    const tiles = buildTileGrid();
    const maxX = Math.max(...tiles.map((t) => t.x + TILE_WIDTH));
    const maxY = Math.max(...tiles.map((t) => t.y + TILE_HEIGHT));
    const minX = Math.min(...tiles.map((t) => t.x));
    const minY = Math.min(...tiles.map((t) => t.y));

    expect(minX).toBe(0);
    expect(minY).toBe(0);
    expect(maxX).toBe(WORLD_WIDTH);
    expect(maxY).toBe(WORLD_HEIGHT);
  });

  it("não tem dois tiles na mesma célula (col, row)", () => {
    const tiles = buildTileGrid();
    const keys = new Set(tiles.map((t) => `${t.col},${t.row}`));
    expect(keys.size).toBe(tiles.length);
  });

  it("checkerboard: tiles vizinhos (col+1) têm cores diferentes", () => {
    const tiles = buildTileGrid();
    const byKey = new Map(tiles.map((t) => [`${t.col},${t.row}`, t]));
    for (const tile of tiles) {
      const neighbor = byKey.get(`${tile.col + 1},${tile.row}`);
      if (neighbor) {
        expect(neighbor.color).not.toBe(tile.color);
      }
    }
  });

  it("checkerboard: a cor não depende de row sozinho nem de col sozinho, só da soma", () => {
    // Um bug comum de checkerboard é trocar `(col + row) % 2` por `col % 2`
    // (ignorando row). Isso faria colunas inteiras da mesma cor, sem alternar
    // por linha — o teste de vizinho vertical abaixo pega esse caso.
    const tiles = buildTileGrid();
    const byKey = new Map(tiles.map((t) => [`${t.col},${t.row}`, t]));
    for (const tile of tiles) {
      const below = byKey.get(`${tile.col},${tile.row + 1}`);
      if (below) {
        expect(below.color).not.toBe(tile.color);
      }
    }
  });
});

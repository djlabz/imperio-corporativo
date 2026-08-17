import { Graphics } from "pixi.js";
import { describe, expect, it } from "vitest";
import { buildTileMapView } from "./TileMapView";
import { buildTileGrid, TILE_HEIGHT, type Tile } from "./tileMap";

function fakeTile(y: number, col = 0): Tile {
  return { col, row: 0, x: 0, y, color: 0x000000 };
}

describe("buildTileMapView()", () => {
  it("cria um Container com sortableChildren ligado", () => {
    const container = buildTileMapView(buildTileGrid());
    expect(container.sortableChildren).toBe(true);
  });

  it("cria um Graphics por tile", () => {
    const tiles = buildTileGrid();
    const container = buildTileMapView(tiles);
    expect(container.children).toHaveLength(tiles.length);
    expect(container.children.every((child) => child instanceof Graphics)).toBe(true);
  });

  it("posiciona cada Graphics nas coordenadas do tile", () => {
    const tiles = [fakeTile(10), fakeTile(20)];
    const container = buildTileMapView(tiles);
    expect(container.children[0]?.position.y).toBe(10);
    expect(container.children[1]?.position.y).toBe(20);
  });

  it("Y-sort: inserido fora de ordem, sortChildren() reordena pela borda inferior (y + altura)", () => {
    // Insere de propósito fora de ordem (100, 0, 50) para não depender da
    // ordem de buildTileGrid() já vir naturalmente crescente em y.
    const tiles = [fakeTile(100), fakeTile(0), fakeTile(50)];
    const container = buildTileMapView(tiles);

    container.sortChildren();

    const sortedYs = container.children.map((child) => child.position.y);
    expect(sortedYs).toEqual([0, 50, 100]);
  });

  it("zIndex de cada tile é a borda inferior (y + TILE_HEIGHT)", () => {
    const tiles = [fakeTile(30)];
    const container = buildTileMapView(tiles);
    expect(container.children[0]?.zIndex).toBe(30 + TILE_HEIGHT);
  });
});

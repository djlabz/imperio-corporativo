import { Container, Graphics } from "pixi.js";
import { TILE_HEIGHT, TILE_WIDTH, type Tile } from "./tileMap";

/**
 * Um Graphics por tile, num Container com sortableChildren=true e zIndex pela
 * borda inferior (y + altura). Hoje os tiles são planos e nunca se sobrepõem,
 * então o Y-sort não muda nada visível ainda — mas é o mesmo Container e o
 * mesmo mecanismo que a Etapa 4 vai usar para NPCs, que de fato se sobrepõem
 * entre si e com o chão.
 */
export function buildTileMapView(tiles: readonly Tile[]): Container {
  const container = new Container({ sortableChildren: true });

  for (const tile of tiles) {
    const graphics = new Graphics();
    graphics.rect(0, 0, TILE_WIDTH, TILE_HEIGHT).fill(tile.color);
    graphics.position.set(tile.x, tile.y);
    graphics.zIndex = tile.y + TILE_HEIGHT;
    container.addChild(graphics);
  }

  return container;
}

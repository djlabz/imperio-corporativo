import type { World } from "./World";

/** Avança o mundo em um tick. Função pura: mesmo World de entrada, mesmo World de saída. */
export function tick(world: World): World {
  return {
    ...world,
    tickCount: world.tickCount + 1,
  };
}

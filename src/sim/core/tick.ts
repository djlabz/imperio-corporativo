import { restoreRng } from "./rng";
import type { World } from "./World";

/** Avança o mundo em um tick. Função pura: mesmo World de entrada, mesmo World de saída. */
export function tick(world: World): World {
  const rng = restoreRng(world.rngState);
  const noise = rng.float();

  return {
    ...world,
    tickCount: world.tickCount + 1,
    rngState: rng.getState(),
    noise,
  };
}

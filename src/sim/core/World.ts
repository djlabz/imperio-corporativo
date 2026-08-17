import { centavos, type Money } from "../economy/money";
import { createRng, type RngState } from "./rng";

/**
 * Estado do jogo. Objeto puro e serializável: sem classes com métodos, sem
 * Map/Set, sem função, sem referência circular.
 */
export interface World {
  readonly version: number;
  readonly seed: string;
  readonly rngState: RngState;
  readonly tickCount: number;
  readonly money: Money;
  /**
   * Escalar descartável que só existe para o tick() consumir aleatoriedade de
   * verdade nesta etapa (senão o teste de determinismo passaria mesmo com o
   * RNG quebrado, já que tickCount por si só é determinístico). Sai da árvore
   * quando a Etapa 3 trouxer conteúdo real que consuma o Rng.
   */
  readonly noise: number;
}

const INITIAL_VERSION = 1;

/** Cria um World novo a partir de uma seed. Não avança nenhum tick. */
export function createWorld(seed: string): World {
  const rng = createRng(seed);
  return {
    version: INITIAL_VERSION,
    seed,
    rngState: rng.getState(),
    tickCount: 0,
    money: centavos(0),
    noise: 0,
  };
}

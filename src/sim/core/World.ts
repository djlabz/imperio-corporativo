import { centavos, type Money } from "../economy/money";
import { MINING } from "../data/balance";
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
  /** Minério que ainda existe no chão. Finito: o que sai não volta. */
  readonly depositKg: number;
  /** Minério extraído e ainda não vendido. */
  readonly stockKg: number;
}

/**
 * Versão da FORMA do World, para migração de save.
 *
 * Exportada e consumida por platform/save/worldSchema.ts. Antes desta etapa o
 * número existia duplicado nos dois arquivos, com o dever de concordar e nada
 * garantindo isso — a F1-E2, que precisava bumpar os dois em paralelo, era
 * exatamente a etapa em que essa duplicação cobraria. A direção do import é a
 * permitida: platform/ conhece sim/, nunca o contrário.
 *
 * v1 → v2 (F1-E2): entraram depositKg e stockKg.
 */
export const WORLD_VERSION = 2;

/** Cria um World novo a partir de uma seed. Não avança nenhum tick. */
export function createWorld(seed: string): World {
  const rng = createRng(seed);
  return {
    version: WORLD_VERSION,
    seed,
    rngState: rng.getState(),
    tickCount: 0,
    money: centavos(0),
    depositKg: MINING.initialDepositKg,
    stockKg: 0,
  };
}

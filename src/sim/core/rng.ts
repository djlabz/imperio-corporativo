import seedrandom from "seedrandom";

/**
 * Estado serializável do PRNG (algoritmo Arc4, o default do seedrandom).
 * Plain object com apenas number/number[] — passa direto pelo MessagePack.
 */
export type RngState = seedrandom.State.Arc4;

export interface Rng {
  /** Float em [0, 1). */
  float(): number;
  /** Inteiro em [min, max], ambos inclusive. */
  int(min: number, max: number): number;
  /** Elemento aleatório de um array não vazio. */
  pick<T>(items: readonly T[]): T;
  /** Estado atual, para persistir em World.rngState. */
  getState(): RngState;
}

class Arc4Rng implements Rng {
  private prng: seedrandom.StatefulPRNG<RngState>;

  constructor(prng: seedrandom.StatefulPRNG<RngState>) {
    this.prng = prng;
  }

  float(): number {
    return this.prng();
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.prng() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError("pick() não aceita array vazio");
    }
    return items[this.int(0, items.length - 1)] as T;
  }

  getState(): RngState {
    return this.prng.state();
  }
}

/** Cria um Rng novo a partir de uma seed textual. */
export function createRng(seed: string): Rng {
  return new Arc4Rng(seedrandom(seed, { state: true }));
}

/** Restaura um Rng exatamente do ponto salvo em `state`. */
export function restoreRng(state: RngState): Rng {
  return new Arc4Rng(seedrandom(undefined, { state }));
}

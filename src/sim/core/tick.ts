import { MINING } from "../data/balance";
import { mine, sell } from "../economy/mining";
import type { Command } from "./Command";
import type { World } from "./World";

function applyCommand(world: World, command: Command): World {
  switch (command.kind) {
    case "MINE":
      return mine(world, MINING);
    case "SELL":
      return sell(world, MINING);
  }
}

/**
 * Avança o mundo em um tick, aplicando antes os comandos do jogador (D-016).
 * Função pura: mesmo World e mesma fila de entrada, mesmo World de saída.
 *
 * `commands` é obrigatório, sem default. Fila opcional é convite pra alguém
 * esquecer de passar e não notar — e o sintoma seria um jogo em que o clique
 * simplesmente não faz nada, sem erro nenhum.
 *
 * Os comandos são aplicados na ordem da fila e o tickCount avança DEPOIS deles:
 * um MINE seguido de um SELL no mesmo tick extrai e vende no mesmo tick.
 */
export function tick(world: World, commands: readonly Command[]): World {
  let next = world;
  for (const command of commands) {
    next = applyCommand(next, command);
  }

  return {
    ...next,
    tickCount: next.tickCount + 1,
  };
}

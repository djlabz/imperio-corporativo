import type { World } from "../core/World";
import type { MiningBalance } from "../data/balance";
import { add, mul } from "./money";

/**
 * Um golpe de picareta. O depósito é finito: extrai `kgPerStrike`, ou o que
 * sobrou se for menos que isso.
 *
 * O `Math.min` não é defensivo por precaução — é a regra. Sem ele, o depósito
 * fica negativo e o jogador mina minério que não existe, que é bug de economia
 * silencioso: nada estoura, o número só fica errado pra sempre.
 */
export function mine(world: World, balance: MiningBalance): World {
  const extracted = Math.min(balance.kgPerStrike, world.depositKg);
  if (extracted === 0) {
    return world;
  }

  return {
    ...world,
    depositKg: world.depositKg - extracted,
    stockKg: world.stockKg + extracted,
  };
}

/**
 * Vende o estoque inteiro ao preço fixo.
 *
 * `mul(pricePerKg, stockKg)` e não `pricePerKg * stockKg`: os dois são inteiros
 * hoje, então não há fração a arredondar, mas o operador cru escapa da validação
 * de inteiro e do teto de MAX_SAFE_INTEGER que os helpers fazem (ver CLAUDE.md,
 * regra inviolável nº 2). O dia em que o preço deixar de ser fixo, o helper já
 * está no lugar.
 */
export function sell(world: World, balance: MiningBalance): World {
  if (world.stockKg === 0) {
    return world;
  }

  return {
    ...world,
    money: add(world.money, mul(balance.pricePerKg, world.stockKg)),
    stockKg: 0,
  };
}

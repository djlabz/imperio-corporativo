import type { World } from "../core/World";
import type { MiningBalance } from "../data/balance";
import { add, mul } from "./money";

/**
 * Um golpe de picareta. Extrai o MENOR entre três coisas: o tamanho do golpe, o
 * que sobrou no depósito, e o espaço livre na carga.
 *
 * Nenhum dos três limites é defensivo por precaução — os três são a regra:
 *
 * - sem o teto do depósito, ele fica negativo e o jogador mina minério que não
 *   existe. Bug de economia silencioso: nada estoura, o número só fica errado.
 * - sem o teto da CARGA, a jogada ótima é minerar o depósito inteiro e caminhar
 *   uma vez só. O atrito de D-017 deixa de existir, e com ele o motivo de o
 *   gerente ter corpo.
 *
 * O `Math.max(0, ...)` no espaço livre não é redundante: um save gravado quando
 * `carryCapacityKg` era maior pode ter `stockKg` acima do teto atual —
 * balanceamento não é dado de save e mexer nele não invalida save nenhum. Sem o
 * clamp, o espaço livre fica negativo, vira o menor dos três, e `extracted`
 * negativo DEVOLVE minério pro depósito enquanto reduz o estoque.
 */
export function mine(world: World, balance: MiningBalance): World {
  const freeSpace = Math.max(0, balance.carryCapacityKg - world.stockKg);
  const extracted = Math.min(balance.kgPerStrike, world.depositKg, freeSpace);
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

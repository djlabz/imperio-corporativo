import { z } from "zod";
import { centavos, type Money } from "../economy/money";
import miningJson from "./mining.json";

/**
 * Balanceamento da mineração. Regra inviolável nº 4: nenhum número destes vive
 * no código — todos em mining.json, validados aqui no carregamento.
 *
 * `pricePerKg` é `Money` e não `number`: o JSON guarda centavos crus
 * (`pricePerKgCents`) e a marca é aplicada UMA vez, aqui na fronteira. O resto
 * do código nunca vê o número sem marca, então não há como passar um `number`
 * cru onde uma função espera `Money`.
 */
export interface MiningBalance {
  readonly fiscalMonthTicks: number;
  readonly kgPerStrike: number;
  readonly initialDepositKg: number;
  readonly pricePerKg: Money;
  /**
   * Quanto o gerente carrega de uma vez. É o que obriga a viagem: sem teto, a
   * jogada ótima é minerar o depósito inteiro e caminhar UMA vez, e o atrito de
   * D-017 simplesmente não acontece.
   */
  readonly carryCapacityKg: number;
  /** Custo à vista de contratar um funcionário (F1-E4). */
  readonly hireCost: Money;
  /** Salário de UM funcionário, cobrado por mês fiscal inteiro, não por tick. */
  readonly wagePerEmployee: Money;
  /** Quanto cada funcionário extrai — e vende na hora — por ciclo. */
  readonly employeeKgPerCycle: number;
  /** Duração do ciclo de produção do funcionário, em ticks. */
  readonly employeeCycleTicks: number;
}

// z.int(), não z.number(): a diferença que importa aqui é a FRAÇÃO. Os dois
// rejeitam NaN e Infinity no zod 4.4.3 (medido na F1-E2 — o CLAUDE.md afirmava o
// contrário e foi corrigido), mas só z.int() barra `pricePerKgCents: 45.5`, que é
// o erro de digitação plausível num arquivo de balanceamento. Centavo fracionário
// morreria depois em centavos(), com mensagem apontando pro lugar errado.
const MiningBalanceSchema = z.object({
  fiscalMonthTicks: z.int().positive(),
  kgPerStrike: z.int().positive(),
  initialDepositKg: z.int().nonnegative(),
  pricePerKgCents: z.int().positive(),
  carryCapacityKg: z.int().positive(),
  hireCostCents: z.int().positive(),
  wagePerEmployeeCents: z.int().positive(),
  employeeKgPerCycle: z.int().positive(),
  employeeCycleTicks: z.int().positive(),
});

/**
 * Valida e monta o balanceamento. Exportada separada da constante abaixo pra que
 * o caminho de FALHA seja testável: a constante é montada no import do módulo, e
 * um teste não consegue observar um throw que já aconteceu antes dele começar.
 */
export function parseMiningBalance(raw: unknown): MiningBalance {
  const parsed = MiningBalanceSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Balanceamento de mineração inválido: ${z.prettifyError(parsed.error)}`);
  }

  return {
    fiscalMonthTicks: parsed.data.fiscalMonthTicks,
    kgPerStrike: parsed.data.kgPerStrike,
    initialDepositKg: parsed.data.initialDepositKg,
    pricePerKg: centavos(parsed.data.pricePerKgCents),
    carryCapacityKg: parsed.data.carryCapacityKg,
    hireCost: centavos(parsed.data.hireCostCents),
    wagePerEmployee: centavos(parsed.data.wagePerEmployeeCents),
    employeeKgPerCycle: parsed.data.employeeKgPerCycle,
    employeeCycleTicks: parsed.data.employeeCycleTicks,
  };
}

/**
 * Montado no carregamento do módulo, de propósito: balanceamento inválido
 * derruba o jogo na hora, com mensagem do zod, em vez de virar `undefined`
 * circulando pela economia.
 */
export const MINING: MiningBalance = parseMiningBalance(miningJson);

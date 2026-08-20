import { z } from "zod";
import { centavos } from "../../sim/economy/money";
import type { RngState } from "../../sim/core/rng";
import { WORLD_VERSION, type World } from "../../sim/core/World";
import { MINING } from "../../sim/data/balance";
import { SaveError } from "./SaveError";

// Importada de sim/core/World, não redeclarada: até a F1-E1 o número existia
// duplicado nos dois arquivos, com o dever de concordar e nada garantindo isso.
// A F1-E2, que bumpou de 1 pra 2, era exatamente a etapa em que a duplicação
// cobraria — bastaria bumpar um dos dois e o createWorld() passaria a produzir
// um World que o próprio validador recusa.
export const CURRENT_VERSION = WORLD_VERSION;

// z.int() restringe a inteiro dentro da faixa segura (exclui NaN/Infinity
// por construção — testei que os dois sobrevivem ao roundtrip de MessagePack
// sem essa guarda, então um save adulterado poderia injetar qualquer um dos
// dois num campo numérico sem isto).
const RngStateSchema = z.object({
  i: z.int().min(0).max(255),
  j: z.int().min(0).max(255),
  S: z.array(z.int().min(0).max(255)).length(256),
});

const WorldSchema = z.object({
  version: z.int().positive(),
  seed: z.string(),
  rngState: RngStateSchema,
  tickCount: z.int().nonnegative(),
  money: z.int(),
  depositKg: z.int().nonnegative(),
  stockKg: z.int().nonnegative(),
});

export type MigrationFn = (world: unknown) => unknown;

/**
 * Registro de migrações: migrations[v] leva um save na versão v para v+1.
 * A versão atual nunca é editada no lugar.
 */
export const migrations: Record<number, MigrationFn> = {
  /**
   * v1 → v2 (F1-E2): entraram depositKg e stockKg. Um save v1 é anterior à
   * mineração existir, então o depósito dele está intocado e o estoque é zero.
   *
   * Usa MINING.initialDepositKg em vez de um literal de propósito, e isso tem
   * uma consequência que vale dizer em voz alta: a saída desta migração ANDA
   * quando o balanceamento for ajustado — um save v1 migrado hoje e outro
   * migrado depois de um ajuste recebem depósitos diferentes. Aceito porque save
   * v1 não tem mineração nenhuma pra preservar e o jogo é pré-lançamento; o
   * alternativo seria cravar o número aqui e violar a regra inviolável nº 4 por
   * um caso sem consequência observável.
   */
  1: (world) => ({
    ...(world as Record<string, unknown>),
    version: 2,
    depositKg: MINING.initialDepositKg,
    stockKg: 0,
  }),
};

function hasVersionField(value: unknown): value is { version: unknown } {
  return typeof value === "object" && value !== null && "version" in value;
}

/**
 * Aplica migrações de `raw.version` até CURRENT_VERSION, então valida contra
 * o schema atual e reconstrói o World (rebrandando Money). Toda falha vira
 * SaveError com mensagem clara — nunca uma exceção crua, nunca um World
 * parcialmente montado.
 */
export function migrateToCurrentVersion(
  raw: unknown,
  // Só existe pra viabilizar testar o esqueleto de migração em cadeia hoje,
  // com CURRENT_VERSION ainda em 1 (não há v2 de verdade pra testar contra).
  // Produção nunca passa o segundo argumento.
  targetVersion: number = CURRENT_VERSION,
): World {
  if (!hasVersionField(raw)) {
    throw new SaveError("Save corrompido: não é um objeto ou não tem campo `version`.");
  }

  let version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new SaveError(`Save corrompido: version inválida (${JSON.stringify(raw.version)}).`);
  }

  if (version > targetVersion) {
    throw new SaveError(
      `Este save é da versão ${version}, mas o jogo só suporta até a versão ` +
        `${targetVersion}. Atualize o jogo antes de carregar este save.`,
    );
  }

  let state: unknown = raw;
  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) {
      throw new SaveError(
        `Não existe migração registrada da versão ${version} para a próxima — ` +
          `este save não pode ser carregado.`,
      );
    }
    state = migrate(state);
    version++;
  }

  const parsed = WorldSchema.safeParse(state);
  if (!parsed.success) {
    throw new SaveError(`Save inválido: ${z.prettifyError(parsed.error)}`);
  }

  return {
    version: parsed.data.version,
    seed: parsed.data.seed,
    rngState: parsed.data.rngState as RngState,
    tickCount: parsed.data.tickCount,
    money: centavos(parsed.data.money),
    depositKg: parsed.data.depositKg,
    stockKg: parsed.data.stockKg,
  };
}

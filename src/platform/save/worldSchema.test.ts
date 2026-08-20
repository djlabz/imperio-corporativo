import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MINING } from "../../sim/data/balance";
import { decodeWorld, encodeRaw } from "./pipeline";
import { CURRENT_VERSION, migrateToCurrentVersion, migrations } from "./worldSchema";
import { SaveError } from "./SaveError";

const RNG_STATE = { i: 10, j: 20, S: Array.from({ length: 256 }, (_, i) => i) };

/** Um save na versão ATUAL — não precisa de migração pra ser aceito. */
function validRawWorld(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: CURRENT_VERSION,
    seed: "seed-de-teste",
    rngState: RNG_STATE,
    tickCount: 42,
    money: 12_345,
    depositKg: 4_000,
    stockKg: 12,
    ...overrides,
  };
}

/** Um save v1 de verdade: a forma que o jogo gravava antes da F1-E2 existir. */
function v1RawWorld(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: 1,
    seed: "seed-v1",
    rngState: RNG_STATE,
    tickCount: 900,
    money: 55_555,
    ...overrides,
  };
}

// migrations é um registro mutável a nível de módulo, e alguns testes precisam
// adicionar entradas temporárias pra exercitar a cadeia. SNAPSHOT e restaura, em
// vez de esvaziar: esvaziar apagava também as migrações de PRODUÇÃO, o que era
// inócuo enquanto o registro era vazio (CURRENT_VERSION = 1) e passou a destruir
// a migrations[1] real na F1-E2. O sintoma foi bom — quatro testes que nada têm
// a ver com cadeia falharam com "Não existe migração registrada".
let snapshot: Record<number, (world: unknown) => unknown>;

beforeEach(() => {
  snapshot = { ...migrations };
});

afterEach(() => {
  for (const key of Object.keys(migrations)) {
    delete migrations[Number(key)];
  }
  Object.assign(migrations, snapshot);
});

describe("migrateToCurrentVersion() — caminho feliz", () => {
  it("aceita um World na versão atual e reconstrói o objeto", () => {
    const world = migrateToCurrentVersion(validRawWorld());
    expect(world.version).toBe(CURRENT_VERSION);
    expect(world.seed).toBe("seed-de-teste");
    expect(world.tickCount).toBe(42);
    expect(world.money).toBe(12_345);
    expect(world.depositKg).toBe(4_000);
    expect(world.stockKg).toBe(12);
    expect(world.rngState).toEqual(RNG_STATE);
  });

  it("money vira Money via centavos() — continua um number correto, não um objeto diferente", () => {
    const world = migrateToCurrentVersion(validRawWorld({ money: -500 }));
    expect(world.money).toBe(-500); // débito é Money válido
  });
});

describe("migrateToCurrentVersion() — caminhos ruins", () => {
  it("rejeita objeto sem campo version", () => {
    const raw = validRawWorld();
    delete (raw as Record<string, unknown>).version;
    expect(() => migrateToCurrentVersion(raw)).toThrow(SaveError);
  });

  it("rejeita valor que não é objeto", () => {
    expect(() => migrateToCurrentVersion("não sou um objeto")).toThrow(SaveError);
    expect(() => migrateToCurrentVersion(null)).toThrow(SaveError);
    expect(() => migrateToCurrentVersion(42)).toThrow(SaveError);
  });

  it("rejeita version fracionária", () => {
    expect(() => migrateToCurrentVersion(validRawWorld({ version: 1.5 }))).toThrow(SaveError);
  });

  it("rejeita version zero ou negativa", () => {
    expect(() => migrateToCurrentVersion(validRawWorld({ version: 0 }))).toThrow(SaveError);
    expect(() => migrateToCurrentVersion(validRawWorld({ version: -1 }))).toThrow(SaveError);
  });

  it("rejeita version maior que a suportada, com mensagem explícita", () => {
    expect(() => migrateToCurrentVersion(validRawWorld({ version: 99 }))).toThrow(
      new RegExp(`versão 99.*suporta até a versão ${CURRENT_VERSION}`, "s"),
    );
  });

  it("rejeita schema errado — campo faltando, com o nome do campo na mensagem", () => {
    const raw = validRawWorld();
    delete (raw as Record<string, unknown>).seed;
    expect(() => migrateToCurrentVersion(raw)).toThrow(/seed/);
  });

  it("rejeita schema errado — tipo trocado, com o campo na mensagem", () => {
    expect(() => migrateToCurrentVersion(validRawWorld({ tickCount: "quarenta e dois" }))).toThrow(
      /tickCount/,
    );
  });

  it("rejeita rngState.S com tamanho errado (não é o array de 256 do Arc4)", () => {
    const raw = validRawWorld({ rngState: { i: 0, j: 0, S: [1, 2, 3] } });
    expect(() => migrateToCurrentVersion(raw)).toThrow(SaveError);
  });

  it("rejeita NaN e Infinity nos campos numéricos — sobrevivem ao MessagePack sem essa guarda", () => {
    expect(() => migrateToCurrentVersion(validRawWorld({ money: NaN }))).toThrow(SaveError);
    expect(() => migrateToCurrentVersion(validRawWorld({ money: Infinity }))).toThrow(SaveError);
    expect(() =>
      migrateToCurrentVersion(validRawWorld({ tickCount: Number.POSITIVE_INFINITY })),
    ).toThrow(SaveError);
  });

  it("rejeita depósito e estoque negativos", () => {
    expect(() => migrateToCurrentVersion(validRawWorld({ depositKg: -1 }))).toThrow(SaveError);
    expect(() => migrateToCurrentVersion(validRawWorld({ stockKg: -1 }))).toThrow(SaveError);
  });
});

describe("migração v1 → v2 (F1-E2: depositKg e stockKg)", () => {
  it("sobe um save v1 e preenche os campos novos", () => {
    const world = migrateToCurrentVersion(v1RawWorld());

    expect(world.version).toBe(2);
    expect(world.depositKg).toBe(MINING.initialDepositKg);
    expect(world.stockKg).toBe(0);
  });

  it("preserva o que já existia no save v1 — a migração não é uma reinicialização", () => {
    const world = migrateToCurrentVersion(v1RawWorld());

    expect(world.seed).toBe("seed-v1");
    expect(world.tickCount).toBe(900);
    expect(world.money).toBe(55_555);
    expect(world.rngState).toEqual(RNG_STATE);
  });

  it("um save v1 REAL, pelo pipeline completo, carrega como v2", async () => {
    // encodeRaw existe justamente pra isto: montar um envelope válido a partir
    // de um objeto que não é o World de hoje. Passa por MessagePack, deflate,
    // XOR e HMAC de verdade, e volta por decodeWorld — que é o caminho que o
    // jogo usa. Sem esta perna, as duas asserções acima provam a função de
    // migração, não o carregamento.
    const envelope = await encodeRaw(v1RawWorld());
    const world = await decodeWorld(envelope);

    expect(world.version).toBe(2);
    expect(world.depositKg).toBe(MINING.initialDepositKg);
    expect(world.stockKg).toBe(0);
    expect(world.money).toBe(55_555);
    expect(world.tickCount).toBe(900);
  });
});

describe("migrateToCurrentVersion() — esqueleto de migração em cadeia", () => {
  it("versão sem migração registrada dá erro explícito, não tenta adivinhar", () => {
    delete migrations[1];
    expect(() => migrateToCurrentVersion(v1RawWorld(), 2)).toThrow(
      /Não existe migração registrada/,
    );
  });

  it("aplica migrações em cadeia na ordem certa (1→2→3)", () => {
    const callOrder: number[] = [];
    migrations[1] = (state) => {
      callOrder.push(1);
      return { ...(state as Record<string, unknown>), version: 2, depositKg: 1, stockKg: 0 };
    };
    migrations[2] = (state) => {
      callOrder.push(2);
      return { ...(state as Record<string, unknown>), version: 3 };
    };

    const world = migrateToCurrentVersion(v1RawWorld(), 3);
    expect(callOrder).toEqual([1, 2]);
    expect(world.version).toBe(3);
  });

  it("CURRENT_VERSION acompanha WORLD_VERSION do sim/, não é um número solto aqui", () => {
    expect(CURRENT_VERSION).toBe(2);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { CURRENT_VERSION, migrateToCurrentVersion, migrations } from "./worldSchema";
import { SaveError } from "./SaveError";

function validRawWorld(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: 1,
    seed: "seed-de-teste",
    rngState: { i: 10, j: 20, S: Array.from({ length: 256 }, (_, i) => i) },
    tickCount: 42,
    money: 12_345,
    ...overrides,
  };
}

// migrations é um registro mutável a nível de módulo — alguns testes
// precisam adicionar entradas temporárias pra exercitar o esqueleto de
// migração em cadeia. Limpa depois de cada teste pra não vazar pro resto.
afterEach(() => {
  for (const key of Object.keys(migrations)) {
    delete migrations[Number(key)];
  }
});

describe("migrateToCurrentVersion() — caminho feliz", () => {
  it("aceita um World v1 válido e reconstrói o objeto", () => {
    const world = migrateToCurrentVersion(validRawWorld());
    expect(world.version).toBe(1);
    expect(world.seed).toBe("seed-de-teste");
    expect(world.tickCount).toBe(42);
    expect(world.money).toBe(12_345);
    expect(world.rngState).toEqual({ i: 10, j: 20, S: Array.from({ length: 256 }, (_, i) => i) });
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
      /versão 99.*suporta até a versão 1/s,
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
});

describe("migrateToCurrentVersion() — esqueleto de migração em cadeia", () => {
  it("versão sem migração registrada dá erro explícito, não tenta adivinhar", () => {
    // targetVersion=2 simula um CURRENT_VERSION futuro; migrations fica vazio
    // de propósito — não existe migrations[1] registrada.
    expect(() => migrateToCurrentVersion(validRawWorld({ version: 1 }), 2)).toThrow(
      /Não existe migração registrada/,
    );
  });

  it("aplica uma migração registrada e prossegue pra validação", () => {
    migrations[1] = (state) => ({ ...(state as Record<string, unknown>), version: 2 });
    const world = migrateToCurrentVersion(validRawWorld({ version: 1 }), 2);
    expect(world.version).toBe(2);
  });

  it("aplica migrações em cadeia na ordem certa (1→2→3)", () => {
    const callOrder: number[] = [];
    migrations[1] = (state) => {
      callOrder.push(1);
      return { ...(state as Record<string, unknown>), version: 2 };
    };
    migrations[2] = (state) => {
      callOrder.push(2);
      return { ...(state as Record<string, unknown>), version: 3 };
    };

    const world = migrateToCurrentVersion(validRawWorld({ version: 1 }), 3);
    expect(callOrder).toEqual([1, 2]);
    expect(world.version).toBe(3);
  });

  it("CURRENT_VERSION hoje é 1 — documenta a base a partir da qual a cadeia acima é hipotética", () => {
    expect(CURRENT_VERSION).toBe(1);
  });
});

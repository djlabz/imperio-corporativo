import { describe, expect, it } from "vitest";
import { restoreRng } from "../../sim/core/rng";
import { tick } from "../../sim/core/tick";
import { createWorld } from "../../sim/core/World";
import { SaveError } from "./SaveError";
import { CURRENT_VERSION } from "./worldSchema";
import { decodeWorld, encodeRaw, encodeWorld } from "./pipeline";

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

describe("encodeWorld() / decodeWorld() — caminho feliz", () => {
  it("roundtrip preserva os campos do World", async () => {
    const world = createWorld("pipeline-roundtrip");
    const envelope = await encodeWorld(world);
    const loaded = await decodeWorld(envelope);
    expect(loaded).toEqual(world);
  });

  it("o envelope é maior que só o HMAC — carrega payload de verdade", async () => {
    const world = createWorld("pipeline-tamanho");
    const envelope = await encodeWorld(world);
    expect(envelope.length).toBeGreaterThan(32);
  });
});

describe("o teste que importa mais: RNG sobrevive à serialização REAL, não só em memória", () => {
  it("depois de 10.000 ticks, salvar pelo pipeline completo e carregar reproduz a MESMA sequência do RNG dali em diante", async () => {
    let world = createWorld("save-rng-fidelidade");
    for (let i = 0; i < 10_000; i++) {
      world = tick(world);
    }

    // Sequência de controle: o que o RNG deste estado produziria a seguir,
    // ANTES de qualquer serialização — puramente em memória.
    const controlRng = restoreRng(world.rngState);
    const controlSequence = Array.from({ length: 1_000 }, () => controlRng.float());

    // Agora pelo pipeline de verdade: msgpack + deflate + XOR + HMAC, e de volta.
    const envelope = await encodeWorld(world);
    const loadedWorld = await decodeWorld(envelope);

    const loadedRng = restoreRng(loadedWorld.rngState);
    const loadedSequence = Array.from({ length: 1_000 }, () => loadedRng.float());

    // A comparação que importa: a sequência, não "os objetos parecem iguais".
    // Um toEqual no rngState poderia passar com um S sutilmente embaralhado
    // que ainda tivesse os mesmos 256 números, só em ordem diferente — e o
    // seedrandom aceitaria sem reclamar, produzindo uma sequência DIFERENTE.
    expect(loadedSequence).toEqual(controlSequence);
  });
});

describe("caminhos ruins — HMAC", () => {
  it("um byte alterado no payload (depois do HMAC) é rejeitado com erro claro", async () => {
    const world = createWorld("pipeline-hmac-tamper");
    const envelope = await encodeWorld(world);

    const tampered = new Uint8Array(envelope);
    const lastIndex = tampered.length - 1;
    tampered[lastIndex] = (tampered[lastIndex] as number) ^ 0xff;

    await expect(decodeWorld(tampered as Uint8Array<ArrayBuffer>)).rejects.toThrow(SaveError);
    await expect(decodeWorld(tampered as Uint8Array<ArrayBuffer>)).rejects.toThrow(/HMAC/);
  });

  it("um byte alterado dentro do próprio HMAC também é rejeitado", async () => {
    const world = createWorld("pipeline-hmac-tamper-2");
    const envelope = await encodeWorld(world);

    const tampered = new Uint8Array(envelope);
    tampered[0] = (tampered[0] as number) ^ 0xff;

    await expect(decodeWorld(tampered as Uint8Array<ArrayBuffer>)).rejects.toThrow(/HMAC/);
  });
});

describe("caminhos ruins — payload truncado", () => {
  it("envelope menor que o HMAC (32 bytes) dá erro claro, não uma exceção crua", async () => {
    const tooShort = new Uint8Array([1, 2, 3]) as Uint8Array<ArrayBuffer>;
    await expect(decodeWorld(tooShort)).rejects.toThrow(SaveError);
    await expect(decodeWorld(tooShort)).rejects.toThrow(/menor que o HMAC|truncad/i);
  });

  it("envelope cortado no meio do payload (mas maior que 32 bytes) é pego pelo HMAC, não crasha", async () => {
    const world = createWorld("pipeline-truncado-meio");
    const envelope = await encodeWorld(world);
    const truncated = envelope.slice(0, Math.floor(envelope.length / 2)) as Uint8Array<ArrayBuffer>;

    await expect(decodeWorld(truncated)).rejects.toThrow(SaveError);
  });

  it("payload que passa no HMAC mas não é deflate válido dá erro claro (defesa em profundidade)", async () => {
    // Constrói um envelope válido (HMAC correto) em cima de bytes que não são
    // deflate de verdade — não deveria acontecer na prática (só se o HMAC
    // vazasse ou fosse forjado), mas o catch em volta do inflateSync existe
    // exatamente pra não deixar essa exceção crua vazar se acontecer. Monta
    // o envelope manualmente com o mesmo pipeline de baixo nível, pulando
    // só o passo de deflate.
    const { deriveHmacKey, deriveXorKey, computeHmac, xorBytes } = await import("./crypto");
    const notDeflated = new Uint8Array([1, 2, 3, 4, 5]) as Uint8Array<ArrayBuffer>;
    const xorKey = await deriveXorKey();
    const obfuscated = xorBytes(notDeflated, xorKey);
    const hmacKey = await deriveHmacKey();
    const hmac = await computeHmac(hmacKey, obfuscated);
    const fakeEnvelope = new Uint8Array(hmac.length + obfuscated.length) as Uint8Array<ArrayBuffer>;
    fakeEnvelope.set(hmac, 0);
    fakeEnvelope.set(obfuscated, hmac.length);

    await expect(decodeWorld(fakeEnvelope)).rejects.toThrow(SaveError);
    await expect(decodeWorld(fakeEnvelope)).rejects.toThrow(/descomprimir/);
  });
});

describe("caminhos ruins — schema e versão, através do pipeline completo", () => {
  it("schema errado (campo faltando) dá erro citando o campo, mesmo vindo de bytes de verdade", async () => {
    const raw = validRawWorld();
    delete (raw as Record<string, unknown>).seed;
    const envelope = await encodeRaw(raw);

    await expect(decodeWorld(envelope)).rejects.toThrow(/seed/);
  });

  it("version maior que a suportada dá erro explícito, mesmo vindo de bytes de verdade", async () => {
    const envelope = await encodeRaw(validRawWorld({ version: CURRENT_VERSION + 1 }));

    await expect(decodeWorld(envelope)).rejects.toThrow(SaveError);
    await expect(decodeWorld(envelope)).rejects.toThrow(/versão/i);
  });
});

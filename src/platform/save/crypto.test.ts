import { describe, expect, it } from "vitest";
import { computeHmac, deriveHmacKey, deriveXorKey, verifyHmac, xorBytes } from "./crypto";

describe("xorBytes()", () => {
  it("aplicar duas vezes com a mesma chave devolve o original — XOR é a própria inversa", () => {
    const data = new Uint8Array([1, 2, 3, 250, 0, 128]);
    const key = new Uint8Array([9, 8, 7]);
    const once = xorBytes(data, key);
    const twice = xorBytes(once, key);
    expect(twice).toEqual(data);
  });

  it("de fato ofusca — o resultado difere do original quando a chave não é toda zero", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const key = new Uint8Array([42, 17, 99]);
    expect(xorBytes(data, key)).not.toEqual(data);
  });

  it("repete a chave ao longo de dados maiores que ela", () => {
    const data = new Uint8Array([5, 5, 5, 5]);
    const key = new Uint8Array([1]);
    // XOR de 5 com 1 é 4, repetido pros 4 bytes
    expect(xorBytes(data, key)).toEqual(new Uint8Array([4, 4, 4, 4]));
  });

  it("rejeita chave vazia — não faz sentido repetir nada", () => {
    expect(() => xorBytes(new Uint8Array([1, 2]), new Uint8Array([]))).toThrow(RangeError);
  });

  it("array vazio de dados devolve array vazio, sem lançar", () => {
    expect(xorBytes(new Uint8Array([]), new Uint8Array([1]))).toEqual(new Uint8Array([]));
  });
});

describe("deriveXorKey() / deriveHmacKey() — determinística, com separação de domínio", () => {
  it("a mesma derivação dá sempre a mesma chave — precisa ser estável entre sessões", async () => {
    const a = await deriveXorKey();
    const b = await deriveXorKey();
    expect(a).toEqual(b);
  });

  it("XOR e HMAC derivam chaves diferentes — não reusam a mesma chave em dois propósitos", async () => {
    const xorKey = await deriveXorKey();
    const hmacKey = await deriveHmacKey();
    expect(xorKey).not.toEqual(hmacKey);
  });

  it("a chave derivada tem 32 bytes", async () => {
    expect((await deriveXorKey()).length).toBe(32);
    expect((await deriveHmacKey()).length).toBe(32);
  });
});

describe("computeHmac() / verifyHmac()", () => {
  it("a assinatura de dados válidos verifica como true", async () => {
    const key = await deriveHmacKey();
    const data = new Uint8Array([1, 2, 3, 4]);
    const hmac = await computeHmac(key, data);
    expect(await verifyHmac(key, data, hmac)).toBe(true);
  });

  it("um byte alterado no payload faz a verificação falhar", async () => {
    const key = await deriveHmacKey();
    const data = new Uint8Array([1, 2, 3, 4]);
    const hmac = await computeHmac(key, data);

    const tampered = new Uint8Array(data);
    tampered[2] = 99;

    expect(await verifyHmac(key, tampered, hmac)).toBe(false);
  });

  it("um byte alterado no próprio HMAC faz a verificação falhar", async () => {
    const key = await deriveHmacKey();
    const data = new Uint8Array([1, 2, 3, 4]);
    const hmac = await computeHmac(key, data);

    const tamperedHmac = new Uint8Array(hmac);
    tamperedHmac[0] = (tamperedHmac[0] as number) ^ 0xff;

    expect(await verifyHmac(key, data, tamperedHmac)).toBe(false);
  });

  it("HMAC-SHA256 tem 32 bytes de saída", async () => {
    const key = await deriveHmacKey();
    const hmac = await computeHmac(key, new Uint8Array([1]));
    expect(hmac.length).toBe(32);
  });

  it("chave errada não verifica um HMAC válido de outra chave", async () => {
    const keyA = await deriveHmacKey();
    const keyB = await deriveXorKey(); // chave "errada" de propósito, só pra ter 32 bytes válidos
    const data = new Uint8Array([1, 2, 3]);
    const hmac = await computeHmac(keyA, data);
    expect(await verifyHmac(keyB, data, hmac)).toBe(false);
  });
});

/**
 * Primitivas de ofuscação e integridade do save. LEIA ANTES DE CONFIAR NISTO:
 * save local não pode ser realmente seguro — a chave inteira (pepper +
 * derivação) mora na máquina do jogador, dentro do próprio binário que ele
 * controla. O objetivo aqui é atrito contra edição casual no bloco de
 * notas, nada além disso. Quem quiser adulterar um save com esforço vai
 * conseguir; o HMAC só garante que adulteração vira "save inválido", nunca
 * um crash ou um World corrompido carregado como se fosse válido.
 *
 * A chave usada de fato (pra XOR e pra HMAC) nunca é o literal abaixo: as
 * duas são derivadas dele via PBKDF2, com salts diferentes — separação de
 * domínio simples pra não reusar a mesma chave em dois propósitos distintos.
 */
const PEPPER = "imperio-corporativo-fase-0-save-pepper-nao-e-segredo-de-verdade";
const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH_BYTES = 32;

// TS 5.7+ tipa `Uint8Array` cru como Uint8Array<ArrayBufferLike> por padrão em
// anotações explícitas, e BufferSource (o que crypto.subtle pede) só aceita
// Uint8Array<ArrayBuffer>. Sem isto, toda chamada a crypto.subtle não compila.
type Bytes = Uint8Array<ArrayBuffer>;

async function deriveKeyBytes(salt: string): Promise<Bytes> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PEPPER),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export function deriveXorKey(): Promise<Bytes> {
  return deriveKeyBytes("xor-v1");
}

export function deriveHmacKey(): Promise<Bytes> {
  return deriveKeyBytes("hmac-v1");
}

/** XOR de fluxo com chave repetida. A mesma função cifra e decifra (XOR é a própria inversa). */
export function xorBytes(data: Bytes, key: Bytes): Bytes {
  if (key.length === 0) {
    throw new RangeError("xorBytes: chave vazia");
  }
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = (data[i] as number) ^ (key[i % key.length] as number);
  }
  return result;
}

export async function computeHmac(keyBytes: Bytes, data: Bytes): Promise<Bytes> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(signature);
}

/** Usa crypto.subtle.verify (comparação segura) em vez de comparar bytes na mão. */
export async function verifyHmac(
  keyBytes: Bytes,
  data: Bytes,
  expectedHmac: Bytes,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, expectedHmac, data);
}

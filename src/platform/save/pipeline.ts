import { decode, encode } from "@msgpack/msgpack";
import { deflateSync, inflateSync } from "fflate";
import type { World } from "../../sim/core/World";
import { computeHmac, deriveHmacKey, deriveXorKey, verifyHmac, xorBytes } from "./crypto";
import { SaveError } from "./SaveError";
import { migrateToCurrentVersion } from "./worldSchema";

type Bytes = Uint8Array<ArrayBuffer>;

/** SHA-256 sempre produz 32 bytes. */
const HMAC_LENGTH_BYTES = 32;

/**
 * Codifica um valor arbitrário pelo pipeline: MessagePack → deflate → XOR →
 * HMAC. Exportado (além de `encodeWorld`) só pra permitir que os testes
 * construam envelopes válidos a partir de objetos que não são um `World`
 * de verdade (version futura, schema errado) — código de produção sempre
 * chama `encodeWorld`, que garante o tipo em tempo de compilação.
 */
export async function encodeRaw(value: unknown): Promise<Bytes> {
  const msgpackBytes = encode(value);
  const compressed = deflateSync(msgpackBytes);

  const xorKey = await deriveXorKey();
  const obfuscated = xorBytes(compressed, xorKey);

  const hmacKey = await deriveHmacKey();
  const hmac = await computeHmac(hmacKey, obfuscated);

  const envelope = new Uint8Array(hmac.length + obfuscated.length);
  envelope.set(hmac, 0);
  envelope.set(obfuscated, hmac.length);
  return envelope;
}

/** World → bytes prontos pra gravar num SaveAdapter. */
export function encodeWorld(world: World): Promise<Bytes> {
  return encodeRaw(world);
}

/**
 * Reverte o pipeline até o objeto decodificado (ainda não migrado, ainda não
 * validado pelo zod) — separado de `decodeWorld` só pra deixar claro onde
 * cada responsabilidade começa: aqui é integridade + formato de bytes; a
 * migração e o schema ficam em `worldSchema.ts`.
 */
async function decodeToRaw(envelope: Bytes): Promise<unknown> {
  if (envelope.length < HMAC_LENGTH_BYTES) {
    throw new SaveError(
      `Save corrompido: tamanho (${envelope.length} bytes) menor que o HMAC ` +
        `(${HMAC_LENGTH_BYTES} bytes) — não há payload nenhum pra verificar.`,
    );
  }

  const hmac = envelope.slice(0, HMAC_LENGTH_BYTES) as Bytes;
  const obfuscated = envelope.slice(HMAC_LENGTH_BYTES) as Bytes;

  const hmacKey = await deriveHmacKey();
  const isValid = await verifyHmac(hmacKey, obfuscated, hmac);
  if (!isValid) {
    throw new SaveError(
      "Save inválido: a assinatura HMAC não confere. O arquivo foi adulterado, " +
        "corrompido, ou truncado.",
    );
  }

  const xorKey = await deriveXorKey();
  const compressed = xorBytes(obfuscated, xorKey);

  let msgpackBytes: Bytes;
  try {
    msgpackBytes = inflateSync(compressed);
  } catch (error) {
    throw new SaveError(`Save corrompido: falha ao descomprimir (${(error as Error).message}).`);
  }

  try {
    return decode(msgpackBytes);
  } catch (error) {
    throw new SaveError(`Save corrompido: MessagePack inválido (${(error as Error).message}).`);
  }
}

/** Bytes gravados por um SaveAdapter → World validado e migrado. */
export async function decodeWorld(envelope: Bytes): Promise<World> {
  const raw = await decodeToRaw(envelope);
  return migrateToCurrentVersion(raw);
}

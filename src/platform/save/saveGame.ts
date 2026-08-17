import type { World } from "../../sim/core/World";
import { decodeWorld, encodeWorld } from "./pipeline";
import type { SaveAdapter } from "./SaveAdapter";
import { SaveError } from "./SaveError";

/** Backup rotativo: só os N saves mais recentes sobrevivem. */
export const MAX_BACKUPS = 3;

const KEY_PREFIX = "save-";

function keyFor(timestamp: number): string {
  return `${KEY_PREFIX}${timestamp}`;
}

function timestampFromKey(key: string): number {
  return Number(key.slice(KEY_PREFIX.length));
}

async function listSaveKeysNewestFirst(adapter: SaveAdapter): Promise<string[]> {
  const keys = await adapter.list();
  return keys
    .filter((key) => key.startsWith(KEY_PREFIX))
    .sort((a, b) => timestampFromKey(b) - timestampFromKey(a));
}

/**
 * Codifica e grava o World, então poda saves além dos MAX_BACKUPS mais
 * recentes. `now` é injetável: Date.now() de verdade tem granularidade de 1ms
 * e colidiria em loops de teste que salvam várias vezes seguidas sem que o
 * relógio real avance.
 */
export async function saveWorld(
  adapter: SaveAdapter,
  world: World,
  now: () => number = Date.now,
): Promise<void> {
  const envelope = await encodeWorld(world);
  await adapter.write(keyFor(now()), envelope);

  const newestFirst = await listSaveKeysNewestFirst(adapter);
  const toRemove = newestFirst.slice(MAX_BACKUPS);
  await Promise.all(toRemove.map((key) => adapter.remove(key)));
}

/** Carrega o save mais recente. Lança SaveError se não houver nenhum. */
export async function loadLatestWorld(adapter: SaveAdapter): Promise<World> {
  const newestFirst = await listSaveKeysNewestFirst(adapter);
  const latestKey = newestFirst[0];
  if (latestKey === undefined) {
    throw new SaveError("Nenhum save encontrado.");
  }

  const envelope = await adapter.read(latestKey);
  if (!envelope) {
    throw new SaveError(`Save "${latestKey}" está listado mas não foi encontrado no adapter.`);
  }

  return decodeWorld(envelope as Uint8Array<ArrayBuffer>);
}

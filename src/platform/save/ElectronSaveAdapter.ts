import type { SaveAdapter } from "./SaveAdapter";

const NOT_IMPLEMENTED = "ElectronSaveAdapter ainda não implementado — chega na Etapa 6.";

/**
 * Stub — implementação real via IPC do Electron (filesystem) chega na
 * Etapa 6. Lança em toda chamada, de propósito: um adapter que finge
 * funcionar e perde o save do jogador é pior que um erro alto agora.
 */
export class ElectronSaveAdapter implements SaveAdapter {
  write(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  read(): Promise<Uint8Array | undefined> {
    throw new Error(NOT_IMPLEMENTED);
  }

  list(): Promise<string[]> {
    throw new Error(NOT_IMPLEMENTED);
  }

  remove(): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }
}

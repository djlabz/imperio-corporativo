import type { ElectronSaveApi } from "../electron/electronSaveApi";
import type { SaveAdapter } from "./SaveAdapter";

declare global {
  interface Window {
    /** Exposto por preload.cts via contextBridge — só existe dentro do Electron. */
    electronSave?: ElectronSaveApi;
  }
}

/**
 * Implementação real via IPC do Electron (filesystem em app.getPath('userData')).
 * Delega tudo pra `window.electronSave`, exposto pelo preload com
 * contextIsolation — este arquivo nunca toca `require`/`fs` diretamente,
 * porque roda no processo do renderer, não no main.
 */
export class ElectronSaveAdapter implements SaveAdapter {
  private readonly api: ElectronSaveApi;

  constructor() {
    if (!window.electronSave) {
      throw new Error(
        "window.electronSave indisponível — ElectronSaveAdapter só funciona dentro do Electron, com o preload carregado.",
      );
    }
    this.api = window.electronSave;
  }

  write(key: string, data: Uint8Array): Promise<void> {
    return this.api.write(key, data);
  }

  read(key: string): Promise<Uint8Array | undefined> {
    return this.api.read(key);
  }

  list(): Promise<string[]> {
    return this.api.list();
  }

  remove(key: string): Promise<void> {
    return this.api.remove(key);
  }
}

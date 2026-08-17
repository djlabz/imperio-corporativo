/**
 * Type-only: sem runtime, sem import de `electron`. Existe pra ElectronSaveAdapter.ts
 * (bundle do renderer, ESM) e preload.cts (processo Electron, CommonJS) concordarem
 * na forma da API exposta em `window.electronSave` sem duplicar a interface. `import
 * type` some por completo na emissão — os dois lados podem viver em módulos de
 * formato diferente sem conflito nenhum.
 */
export interface ElectronSaveApi {
  write(key: string, data: Uint8Array): Promise<void>;
  read(key: string): Promise<Uint8Array | undefined>;
  list(): Promise<string[]>;
  remove(key: string): Promise<void>;
}

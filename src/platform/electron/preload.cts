// Ver o comentário equivalente em main.cts sobre `= require(...)` em .cts.
import electron = require("electron");
import type { ElectronSaveApi } from "./electronSaveApi";

const { contextBridge, ipcRenderer } = electron;

// Nomes de canal literais — têm que bater exatamente com main.cts. Duplicados
// de propósito em vez de importados de um arquivo compartilhado: são 4
// strings, e um arquivo `.ts` comum importado por um `.cts` (CommonJS) e por
// código do renderer (ESM/Vite) cruzaria dois formatos de módulo diferentes
// pra um valor em runtime, não só um tipo. Não vale a complexidade.
const SAVE_WRITE = "save:write";
const SAVE_READ = "save:read";
const SAVE_LIST = "save:list";
const SAVE_REMOVE = "save:remove";

/**
 * contextIsolation:true (main.cts) significa que este é o único jeito do
 * renderer alcançar o filesystem — nada de nodeIntegration, nada de require()
 * exposto direto. `contextBridge` copia por Structured Clone, então
 * Uint8Array atravessa como valor, sem serialização manual.
 */
const electronSave: ElectronSaveApi = {
  write: (key, data) => ipcRenderer.invoke(SAVE_WRITE, key, data) as Promise<void>,
  read: (key) => ipcRenderer.invoke(SAVE_READ, key) as Promise<Uint8Array | undefined>,
  list: () => ipcRenderer.invoke(SAVE_LIST) as Promise<string[]>,
  remove: (key) => ipcRenderer.invoke(SAVE_REMOVE, key) as Promise<void>,
};

contextBridge.exposeInMainWorld("electronSave", electronSave);

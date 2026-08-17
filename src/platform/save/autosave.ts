import type { World } from "../../sim/core/World";
import { saveWorld } from "./saveGame";
import type { SaveAdapter } from "./SaveAdapter";

export const AUTOSAVE_INTERVAL_MS = 60_000;

export interface AutosaveHandle {
  stop(): void;
}

/**
 * Salva `getWorld()` a cada `intervalMs`. Recebe uma função em vez do World
 * em si porque o World muda a cada tick — o autosave sempre precisa do
 * estado atual no momento do disparo, não uma cópia congelada de quando
 * `startAutosave` foi chamado.
 *
 * Uma falha num autosave (ex.: adapter cheio) não para os próximos — só loga
 * o erro. Um problema transitório não deveria desligar o autosave pro resto
 * da sessão.
 *
 * `save` é injetável (default: saveWorld de verdade, com o pipeline
 * completo). PBKDF2 dentro do pipeline roda no thread pool real do Node via
 * crypto.subtle, não em microtasks — os fake timers do vitest não aceleram
 * isso, então testar o AGENDAMENTO (dispara a cada intervalo, stop() para,
 * usa o World atual) precisa de um `save` falso e rápido injetado.
 */
export function startAutosave(
  getWorld: () => World,
  adapter: SaveAdapter,
  intervalMs: number = AUTOSAVE_INTERVAL_MS,
  save: (adapter: SaveAdapter, world: World) => Promise<void> = saveWorld,
): AutosaveHandle {
  const timer = setInterval(() => {
    save(adapter, getWorld()).catch((error: unknown) => {
      console.error("Autosave falhou:", error);
    });
  }, intervalMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

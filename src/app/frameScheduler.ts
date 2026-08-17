export type ScheduledCallback = (nowMs: number) => void;

export interface FrameScheduler {
  start(callback: ScheduledCallback): void;
  stop(): void;
}

/**
 * Loop preso ao vsync do monitor — o modo normal do jogo. FPS nunca passa do
 * refresh rate da tela, então FPS/frame-time sozinhos não distinguem "sobrou
 * 15ms de folga" de "sobrou 0.1ms": os dois mostram o mesmo 60fps.
 *
 * Sem teste automatizado: requestAnimationFrame não existe em Node puro (só
 * em browser/jsdom), então isto é DOM glue verificado manualmente via
 * `pnpm dev`. A lógica que vale testar está em createUncappedScheduler, que
 * não depende de nenhuma API exclusiva de browser.
 */
export function createVsyncScheduler(): FrameScheduler {
  let rafId: number | undefined;
  let callback: ScheduledCallback | undefined;

  function loop(nowMs: number): void {
    callback?.(nowMs);
    rafId = requestAnimationFrame(loop);
  }

  return {
    start(cb) {
      callback = cb;
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== undefined) cancelAnimationFrame(rafId);
    },
  };
}

/**
 * Loop sem vsync: dispara de novo assim que o frame anterior termina, sem
 * esperar o refresh do monitor. É o único jeito de ver headroom real — se o
 * jogo faz 400fps aqui, sobra 6x de margem sobre o alvo de 60; se faz 70fps,
 * está no limite mesmo exibindo 60 travado no modo vsync.
 *
 * Usa MessageChannel em vez de `setTimeout(fn, 0)`: setTimeout aninhado tem
 * piso de ~4ms depois de poucas chamadas (throttle do próprio browser/Node),
 * o que capuria artificialmente o número em ~250fps. MessageChannel não tem
 * esse piso.
 */
export function createUncappedScheduler(): FrameScheduler {
  let running = false;
  let callback: ScheduledCallback | undefined;
  const channel = new MessageChannel();

  channel.port1.onmessage = () => {
    if (!running) return;
    callback?.(performance.now());
    if (running) channel.port2.postMessage(null);
  };

  return {
    start(cb) {
      callback = cb;
      running = true;
      channel.port2.postMessage(null);
    },
    stop() {
      running = false;
    },
  };
}

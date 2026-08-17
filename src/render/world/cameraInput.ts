import type { Container } from "pixi.js";
import { applyToContainer, panBy, zoomBy, type CameraState } from "./camera";

const RIGHT_MOUSE_BUTTON = 2;
const ZOOM_STEP = 1.1;

export interface CameraInputHandle {
  getState(): CameraState;
  destroy(): void;
}

/**
 * Liga pan (botão direito arrastando) e zoom (scroll) num canvas real.
 *
 * Sem teste automatizado de propósito: toda a lógica que vale testar (a
 * matemática do pan/zoom) já está em camera.ts, coberta em camera.test.ts.
 * O que sobra aqui é fiação de evento de DOM — arraste screen→delta, roda do
 * mouse→fator de zoom — sem comportamento próprio para verificar além de
 * "chama a função certa". Verificado manualmente via `pnpm dev`.
 */
export function attachCameraInput(
  canvas: HTMLCanvasElement,
  worldContainer: Container,
  initial: CameraState,
  getViewSize: () => { width: number; height: number },
): CameraInputHandle {
  let state = initial;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function apply(): void {
    const { width, height } = getViewSize();
    applyToContainer(state, worldContainer, width, height);
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== RIGHT_MOUSE_BUTTON) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    state = panBy(state, dx, dy);
    apply();
  }

  function onPointerUp(): void {
    dragging = false;
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    state = zoomBy(state, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    apply();
  }

  function onContextMenu(event: MouseEvent): void {
    // Sem isso, soltar o botão direito depois de arrastar abre o menu de
    // contexto do browser por cima do jogo.
    event.preventDefault();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);

  apply();

  return {
    getState: () => state,
    destroy(): void {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
    },
  };
}

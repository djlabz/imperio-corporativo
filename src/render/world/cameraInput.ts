import type { Container } from "pixi.js";
import { applyToContainer, panBy, zoomBy, type CameraState } from "./camera";

const RIGHT_MOUSE_BUTTON = 2;
const ZOOM_STEP = 1.1;

export interface CameraInputHandle {
  getState(): CameraState;
  /**
   * Reaplica `constrain` sobre o estado atual. Chamar UMA VEZ POR FRAME, antes de
   * ler getState().
   *
   * Por que por frame e não num listener de "resize": no instante em que o evento
   * `resize` dispara, o canvas ainda está no tamanho ANTIGO — o `resizeTo` do Pixi
   * só aplica no frame seguinte. Medido na F1-E3:
   *
   *   no evento resize:  window.innerWidth 1400, canvas.width 2400  <- defasado
   *   1 frame depois:    window.innerWidth 1400, canvas.width 1400
   *
   * Uma correção feita no listener calcula o limite com a dimensão errada, e o
   * sintoma é o que motivou isto: mundo pequeno com preto em volta depois de ir
   * pra tela cheia. Por frame não tem essa suposição de ordem, e o custo é
   * aritmética de duas linhas.
   */
  refresh(): void;
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
  /**
   * Aplicado depois de todo pan e zoom, e no estado inicial. É por aqui que o
   * limite do mundo entra (clampToWorld) sem que este módulo precise conhecer o
   * tamanho do mapa.
   *
   * Obrigatório, sem default: um `constrain` opcional seria esquecido, e o
   * sintoma é arrastar o mapa pro vazio sem forma de voltar — mesmo raciocínio de
   * D-016 pra fila de comandos.
   */
  constrain: (state: CameraState) => CameraState,
): CameraInputHandle {
  let state = constrain(initial);
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
    state = constrain(panBy(state, dx, dy));
    apply();
  }

  function onPointerUp(): void {
    dragging = false;
  }

  function onWheel(event: WheelEvent): void {
    event.preventDefault();
    state = constrain(zoomBy(state, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
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
    refresh(): void {
      state = constrain(state);
    },
    destroy(): void {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
    },
  };
}

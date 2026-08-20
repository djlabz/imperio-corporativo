import type { CameraState } from "./camera";

const LEFT_MOUSE_BUTTON = 0;
const RIGHT_MOUSE_BUTTON = 2;

/**
 * Além deste tanto de arraste, o botão direito foi PAN de câmera e não ordem de
 * movimento. O botão direito já estava ocupado pelo pan (cameraInput.ts, Etapa 3)
 * quando a F1-E3 pediu "clique direito → caminha até lá"; separar por
 * deslocamento preserva os dois, que é a convenção de qualquer RTS.
 */
const DRAG_THRESHOLD_PX = 6;

export type WorldClick =
  | { readonly kind: "move"; readonly x: number; readonly y: number }
  | { readonly kind: "act"; readonly x: number; readonly y: number };

/**
 * Converte pixel de tela em ponto do mundo. É a inversa exata de
 * `applyToContainer` em camera.ts — se um dos dois mudar, o outro tem que mudar,
 * e é por isso que existe teste comparando os dois em ida e volta.
 */
export function screenToWorld(
  camera: CameraState,
  screenX: number,
  screenY: number,
  viewWidth: number,
  viewHeight: number,
): readonly [number, number] {
  return [
    (screenX - viewWidth / 2) / camera.zoom + camera.x,
    (screenY - viewHeight / 2) / camera.zoom + camera.y,
  ];
}

export interface WorldInputHandle {
  destroy(): void;
}

/**
 * Traduz clique em intenção de mundo. Não decide NADA sobre o jogo: só diz
 * "clique de mover em (x, y)" ou "clique de agir em (x, y)". Quem resolve se
 * aquele ponto é o depósito, e se o gerente está perto, é a camada de app.
 *
 * Sem teste automatizado da fiação de DOM, mesmo critério de cameraInput.ts: a
 * matemática que vale testar (screenToWorld) é pura e está coberta à parte.
 */
export function attachWorldInput(
  canvas: HTMLCanvasElement,
  onClick: (click: WorldClick) => void,
  getCamera: () => CameraState,
  getViewSize: () => { width: number; height: number },
): WorldInputHandle {
  let downX = 0;
  let downY = 0;
  let downButton = -1;

  function onPointerDown(event: PointerEvent): void {
    downX = event.clientX;
    downY = event.clientY;
    downButton = event.button;
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.button !== downButton) return;
    const moved = Math.hypot(event.clientX - downX, event.clientY - downY);
    downButton = -1;
    if (moved > DRAG_THRESHOLD_PX) return; // foi arraste (pan), não clique

    const rect = canvas.getBoundingClientRect();
    const { width, height } = getViewSize();
    const [x, y] = screenToWorld(
      getCamera(),
      event.clientX - rect.left,
      event.clientY - rect.top,
      width,
      height,
    );

    if (event.button === RIGHT_MOUSE_BUTTON) {
      onClick({ kind: "move", x, y });
    } else if (event.button === LEFT_MOUSE_BUTTON) {
      onClick({ kind: "act", x, y });
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);

  return {
    destroy(): void {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
    },
  };
}

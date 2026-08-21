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

/** Ponto do mundo sob o ponteiro. `undefined` = ponteiro saiu do canvas. */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

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
 * Traduz clique — e agora também a posição do ponteiro — em intenção de mundo.
 * Não decide NADA sobre o jogo: só diz "clique de mover em (x, y)", "clique de
 * agir em (x, y)" ou "o ponteiro está em (x, y)". Quem resolve se aquele ponto é
 * o depósito, e se o gerente está perto, é a camada de app.
 *
 * `onHover` usa exatamente a mesma conversão tela→mundo do clique. É de propósito:
 * se o destaque de hover acender sobre um retângulo, o clique naquele pixel cai
 * no mesmo lugar, por construção. Um caminho separado pro hover poderia acender
 * num lugar e clicar em outro — que é o pior resultado possível pra uma affordance.
 *
 * Sem teste automatizado da fiação de DOM, mesmo critério de cameraInput.ts: a
 * matemática que vale testar (screenToWorld) é pura e está coberta à parte.
 */
export function attachWorldInput(
  canvas: HTMLCanvasElement,
  onClick: (click: WorldClick) => void,
  onHover: (point: WorldPoint | undefined) => void,
  getCamera: () => CameraState,
  getViewSize: () => { width: number; height: number },
): WorldInputHandle {
  let downX = 0;
  let downY = 0;
  let downButton = -1;

  function toWorld(event: PointerEvent): readonly [number, number] {
    const rect = canvas.getBoundingClientRect();
    const { width, height } = getViewSize();
    return screenToWorld(
      getCamera(),
      event.clientX - rect.left,
      event.clientY - rect.top,
      width,
      height,
    );
  }

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

    const [x, y] = toWorld(event);

    if (event.button === RIGHT_MOUSE_BUTTON) {
      onClick({ kind: "move", x, y });
    } else if (event.button === LEFT_MOUSE_BUTTON) {
      onClick({ kind: "act", x, y });
    }
  }

  function onPointerMove(event: PointerEvent): void {
    const [x, y] = toWorld(event);
    onHover({ x, y });
  }

  function onPointerLeave(): void {
    onHover(undefined);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  return {
    destroy(): void {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    },
  };
}

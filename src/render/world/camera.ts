import type { Container } from "pixi.js";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;

export interface CameraState {
  /** Ponto do mundo (espaço lógico) centralizado na tela. */
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

export function createCameraState(focusX = 0, focusY = 0, zoom = 1): CameraState {
  return { x: focusX, y: focusY, zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Move a câmera por um delta de arraste em pixels de tela. Divide por `zoom`
 * para que o arraste acompanhe o cursor 1:1 na tela, não no mundo — sem isso,
 * dar zoom mudaria a velocidade aparente do pan.
 */
export function panBy(state: CameraState, dxScreen: number, dyScreen: number): CameraState {
  return {
    ...state,
    x: state.x - dxScreen / state.zoom,
    y: state.y - dyScreen / state.zoom,
  };
}

/** Multiplica o zoom por um fator e prende ao intervalo [MIN_ZOOM, MAX_ZOOM]. */
export function zoomBy(state: CameraState, factor: number): CameraState {
  return { ...state, zoom: clamp(state.zoom * factor, MIN_ZOOM, MAX_ZOOM) };
}

/**
 * Aplica o estado da câmera a um Container real do Pixi, centralizando
 * (state.x, state.y) na tela. Único ponto onde camera.ts toca um objeto do
 * Pixi — o resto do módulo é matemática pura e testável sem ele.
 */
export function applyToContainer(
  state: CameraState,
  container: Container,
  viewWidth: number,
  viewHeight: number,
): void {
  container.scale.set(state.zoom);
  container.position.set(
    viewWidth / 2 - state.x * state.zoom,
    viewHeight / 2 - state.y * state.zoom,
  );
}

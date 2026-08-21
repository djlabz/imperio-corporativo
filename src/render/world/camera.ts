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

/**
 * Zoom que faz o mundo CABER na viewport, preso a [MIN_ZOOM, MAX_ZOOM].
 *
 * Existe porque um zoom inicial fixo é calibrado pra um tamanho de janela só: a
 * F1-E3 abria em MIN_ZOOM pra caber o mundo em 1600x900, e numa janela de
 * 2400x1300 o mundo virava um retângulo pequeno com preto em volta. Medido, não
 * suposto — reproduzido redimensionando o browser.
 *
 * `min` e não `max`: com `max`, o eixo mais folgado mandaria e o outro ficaria
 * cortado. Cabe inteiro por construção, no eixo mais apertado.
 */
export function fitZoom(
  worldWidth: number,
  worldHeight: number,
  viewWidth: number,
  viewHeight: number,
): number {
  if (worldWidth <= 0 || worldHeight <= 0) return 1;
  return clamp(Math.min(viewWidth / worldWidth, viewHeight / worldHeight), MIN_ZOOM, MAX_ZOOM);
}

/**
 * Prende o foco da câmera pra que a área visível não saia do mundo.
 *
 * Dois regimes por eixo, e o segundo é o que conserta o redimensionamento:
 *
 * - a viewport cabe DENTRO do mundo naquele eixo: o foco anda livre, mas só até
 *   onde a borda da tela encontra a borda do mundo. Sem isto, dá pra arrastar o
 *   mapa até o vazio e perder o jogo de vista, sem nenhuma forma de voltar além
 *   de recarregar.
 * - a viewport é MAIOR que o mundo naquele eixo: não há o que escolher — o foco
 *   é fixado no centro do mundo. É isto que faz o mundo continuar centrado ao
 *   aumentar a janela, em vez de ficar deslocado.
 *
 * Chamado com o tamanho de tela ATUAL, então redimensionar recalcula o limite
 * sozinho; não há evento de resize pra escutar nem estado pra invalidar.
 */
export function clampToWorld(
  state: CameraState,
  worldWidth: number,
  worldHeight: number,
  viewWidth: number,
  viewHeight: number,
): CameraState {
  const halfViewWorldX = viewWidth / 2 / state.zoom;
  const halfViewWorldY = viewHeight / 2 / state.zoom;

  return {
    ...state,
    x: clampAxis(state.x, worldWidth, halfViewWorldX),
    y: clampAxis(state.y, worldHeight, halfViewWorldY),
  };
}

function clampAxis(focus: number, worldSize: number, halfView: number): number {
  // A viewport é mais larga que o mundo neste eixo: centro, sem escolha.
  if (halfView * 2 >= worldSize) return worldSize / 2;
  return clamp(focus, halfView, worldSize - halfView);
}

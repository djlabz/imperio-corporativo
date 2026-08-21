import { Graphics } from "pixi.js";

const RADIUS = 7;
const FILL_COLOR = 0xe8452f; // laranja-vermelho da paleta travada
const OUTLINE_COLOR = 0x1a1a1a;
const OUTLINE_WIDTH = 3;
const LIFETIME_MS = 300;

/**
 * Um ponto onde o jogador clicou, que apaga em 300ms.
 *
 * Responde metade da pergunta "o jogo entendeu onde eu mirei?" — a outra metade
 * é a linha de evento. Se o ponto cair longe do cursor, o erro está na conversão
 * tela→mundo; se cair no lugar certo e nada acontecer, o erro está depois disso.
 *
 * Um Graphics só, reposicionado — nunca `new` em runtime (regra de pooling do
 * CLAUDE.md).
 */
export interface ClickMarkerView {
  readonly graphics: Graphics;
  /** Instante do clique, no mesmo relógio de `performance.now()`. */
  shownAtMs: number | undefined;
}

/** Opacidade em função da idade do marcador. Pura, sem Pixi. */
export function markerAlpha(
  shownAtMs: number | undefined,
  nowMs: number,
  lifetimeMs: number = LIFETIME_MS,
): number {
  if (shownAtMs === undefined) return 0;
  const ageMs = nowMs - shownAtMs;
  if (ageMs < 0 || ageMs >= lifetimeMs) return 0;
  return 1 - ageMs / lifetimeMs;
}

export function buildClickMarkerView(): ClickMarkerView {
  const graphics = new Graphics()
    .circle(0, 0, RADIUS)
    .fill(FILL_COLOR)
    .stroke({ color: OUTLINE_COLOR, width: OUTLINE_WIDTH });
  graphics.visible = false;
  // Por cima de tudo dentro do mundo: o marcador tem que aparecer mesmo em cima
  // do retângulo de um lugar, que é justamente onde ele mais importa.
  graphics.zIndex = Number.MAX_SAFE_INTEGER;
  return { graphics, shownAtMs: undefined };
}

export function showClickMarker(view: ClickMarkerView, x: number, y: number, nowMs: number): void {
  view.graphics.position.set(x, y);
  view.shownAtMs = nowMs;
}

/** Chamar uma vez por frame, com o timestamp do frame. */
export function syncClickMarker(view: ClickMarkerView, nowMs: number): void {
  const alpha = markerAlpha(view.shownAtMs, nowMs);
  view.graphics.alpha = alpha;
  view.graphics.visible = alpha > 0;
}

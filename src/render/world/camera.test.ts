import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  applyToContainer,
  clampToWorld,
  createCameraState,
  fitZoom,
  panBy,
  zoomBy,
} from "./camera";

describe("createCameraState()", () => {
  it("usa o foco e zoom informados", () => {
    expect(createCameraState(100, 200, 2)).toEqual({ x: 100, y: 200, zoom: 2 });
  });

  it("prende o zoom inicial também, não só o de zoomBy()", () => {
    expect(createCameraState(0, 0, 999).zoom).toBe(MAX_ZOOM);
  });
});

describe("panBy()", () => {
  it("arrastar para a direita move o foco da câmera para a esquerda (mundo 'segue' o cursor)", () => {
    const state = createCameraState(0, 0, 1);
    const moved = panBy(state, 10, 0);
    expect(moved.x).toBe(-10);
    expect(moved.y).toBe(0);
  });

  it("arrastar para baixo move o foco para cima", () => {
    const state = createCameraState(0, 0, 1);
    const moved = panBy(state, 0, 10);
    expect(moved.y).toBe(-10);
  });

  it("com zoom 2x, o mesmo arraste em pixels de tela move a metade em espaço de mundo", () => {
    const state = createCameraState(0, 0, 2);
    const moved = panBy(state, 10, 0);
    expect(moved.x).toBe(-5);
  });

  it("não muda o zoom", () => {
    const state = createCameraState(0, 0, 1.5);
    expect(panBy(state, 50, -30).zoom).toBe(1.5);
  });
});

describe("zoomBy()", () => {
  it("multiplica o zoom pelo fator", () => {
    expect(zoomBy(createCameraState(0, 0, 1), 1.5).zoom).toBe(1.5);
  });

  it("prende no teto MAX_ZOOM", () => {
    expect(zoomBy(createCameraState(0, 0, MAX_ZOOM), 2).zoom).toBe(MAX_ZOOM);
  });

  it("prende no piso MIN_ZOOM", () => {
    expect(zoomBy(createCameraState(0, 0, MIN_ZOOM), 0.1).zoom).toBe(MIN_ZOOM);
  });

  it("não muda x/y", () => {
    const state = createCameraState(42, -7, 1);
    const zoomed = zoomBy(state, 2);
    expect(zoomed.x).toBe(42);
    expect(zoomed.y).toBe(-7);
  });
});

describe("applyToContainer()", () => {
  it("aplica escala igual ao zoom", () => {
    const container = new Container();
    applyToContainer(createCameraState(0, 0, 2.5), container, 1920, 1080);
    expect(container.scale.x).toBe(2.5);
    expect(container.scale.y).toBe(2.5);
  });

  it("centraliza (x, y) da câmera no meio da tela", () => {
    const container = new Container();
    applyToContainer(createCameraState(100, 50, 1), container, 800, 600);
    // Com zoom 1: a tela mostra centro em (400,300); o mundo (100,50) precisa
    // cair exatamente ali, então o container desloca (400-100, 300-50).
    expect(container.position.x).toBe(300);
    expect(container.position.y).toBe(250);
  });

  it("o deslocamento também escala com o zoom", () => {
    const container = new Container();
    applyToContainer(createCameraState(100, 50, 2), container, 800, 600);
    expect(container.position.x).toBe(800 / 2 - 100 * 2);
    expect(container.position.y).toBe(600 / 2 - 50 * 2);
  });
});

describe("fitZoom()", () => {
  const W = 2560;
  const H = 1440;

  it("cabe o mundo inteiro: o eixo mais apertado manda", () => {
    // 2400/2560 = 0,9375 ; 1300/1440 = 0,9028 -> vale o menor
    expect(fitZoom(W, H, 2400, 1300)).toBeCloseTo(1300 / 1440, 6);
    // 1600/2560 = 0,625 ; 900/1440 = 0,625 -> empate
    expect(fitZoom(W, H, 1600, 900)).toBeCloseTo(0.625, 6);
  });

  it("com `max` em vez de `min`, um dos eixos ficaria cortado — esta é a âncora", () => {
    const zoom = fitZoom(W, H, 2400, 1300);
    expect(W * zoom).toBeLessThanOrEqual(2400 + 1e-9);
    expect(H * zoom).toBeLessThanOrEqual(1300 + 1e-9);
  });

  it("respeita os limites de zoom", () => {
    expect(fitZoom(W, H, 400, 300)).toBe(MIN_ZOOM); // janela pequena: prende no piso
    expect(fitZoom(W, H, 99_999, 99_999)).toBe(MAX_ZOOM); // enorme: prende no teto
  });

  it("mundo degenerado não devolve NaN nem Infinity", () => {
    expect(fitZoom(0, 0, 1600, 900)).toBe(1);
  });
});

describe("clampToWorld()", () => {
  const W = 2560;
  const H = 1440;

  it("viewport MAIOR que o mundo no eixo: fixa no centro (é o conserto do resize)", () => {
    // A zoom 1 uma viewport de 4000x2000 é maior que o mundo nos dois eixos.
    const state = clampToWorld(createCameraState(50, 50, 1), W, H, 4000, 2000);
    expect(state.x).toBe(W / 2);
    expect(state.y).toBe(H / 2);
  });

  it("viewport menor: o foco anda, mas a área visível não sai do mundo", () => {
    const view = { w: 1600, h: 900 };
    for (const focus of [
      [-9_999, -9_999],
      [9_999, 9_999],
      [1_280, 720],
    ] as const) {
      const state = clampToWorld(createCameraState(focus[0], focus[1], 1), W, H, view.w, view.h);
      expect(state.x - view.w / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(state.x + view.w / 2).toBeLessThanOrEqual(W + 1e-9);
      expect(state.y - view.h / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(state.y + view.h / 2).toBeLessThanOrEqual(H + 1e-9);
    }
  });

  it("não mexe num foco que já é válido", () => {
    const dentro = createCameraState(1_280, 720, 1);
    expect(clampToWorld(dentro, W, H, 1600, 900)).toEqual(dentro);
  });

  it("o limite depende do ZOOM, não só do tamanho da tela", () => {
    // Com zoom 2 a mesma tela cobre metade do mundo, então o foco anda mais.
    const perto = clampToWorld(createCameraState(0, 0, 2), W, H, 1600, 900);
    const longe = clampToWorld(createCameraState(0, 0, 1), W, H, 1600, 900);
    expect(perto.x).toBeLessThan(longe.x);
  });

  it("preserva o zoom — clamp é de posição, não de escala", () => {
    expect(clampToWorld(createCameraState(0, 0, 1.7), W, H, 1600, 900).zoom).toBe(1.7);
  });
});

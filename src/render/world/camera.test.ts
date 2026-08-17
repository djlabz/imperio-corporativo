import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { applyToContainer, createCameraState, MAX_ZOOM, MIN_ZOOM, panBy, zoomBy } from "./camera";

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

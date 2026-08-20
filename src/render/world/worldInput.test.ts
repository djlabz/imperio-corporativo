import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { applyToContainer, createCameraState } from "./camera";
import { screenToWorld } from "./worldInput";

const VIEW = { width: 1920, height: 1080 };

describe("screenToWorld()", () => {
  it("o centro da tela é o ponto focal da câmera", () => {
    const camera = createCameraState(500, 300);
    expect(screenToWorld(camera, VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height)).toEqual(
      [500, 300],
    );
  });

  it("é a inversa EXATA de applyToContainer — a ida e a volta fecham", () => {
    // Este é o teste que importa. screenToWorld duplica, invertida, a matemática
    // de applyToContainer; se um dos dois mudar sem o outro, o clique passa a cair
    // num lugar diferente de onde o jogador viu, e nenhum teste de geometria
    // isolada acusaria. Aqui o Container REAL do Pixi é o oráculo.
    for (const camera of [
      createCameraState(0, 0, 1),
      createCameraState(1_280, 720, 1),
      createCameraState(300, 900, 2),
      createCameraState(2_000, 100, 0.5),
    ]) {
      const container = new Container();
      applyToContainer(camera, container, VIEW.width, VIEW.height);

      for (const [worldX, worldY] of [
        [0, 0],
        [530, 1_220],
        [2_270, 430],
      ] as const) {
        // Onde o Pixi de fato desenha este ponto do mundo:
        const screenX = worldX * container.scale.x + container.position.x;
        const screenY = worldY * container.scale.y + container.position.y;

        const [backX, backY] = screenToWorld(camera, screenX, screenY, VIEW.width, VIEW.height);
        expect(backX).toBeCloseTo(worldX, 6);
        expect(backY).toBeCloseTo(worldY, 6);
      }
    }
  });

  it("com zoom, o mesmo pixel de tela cobre menos mundo", () => {
    const perto = createCameraState(0, 0, 2);
    const longe = createCameraState(0, 0, 0.5);

    const [xPerto] = screenToWorld(perto, VIEW.width, VIEW.height / 2, VIEW.width, VIEW.height);
    const [xLonge] = screenToWorld(longe, VIEW.width, VIEW.height / 2, VIEW.width, VIEW.height);

    expect(Math.abs(xPerto)).toBeLessThan(Math.abs(xLonge));
  });
});

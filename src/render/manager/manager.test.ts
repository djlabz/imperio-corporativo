import { describe, expect, it } from "vitest";
import { buildFlowField } from "../npc/flowField";
import { createManager, orderManager, stepManager, type Manager } from "./manager";

const SPEED = 14;
const TARGET = { x: 1_000, y: 600 };

function fieldTo(x: number, y: number) {
  return buildFlowField({ kind: "point", x, y });
}

function withOrder(m: Manager, intent: "none" | "mine" | "sell", arrivalRadius = 10): Manager {
  return orderManager(m, { targetX: TARGET.x, targetY: TARGET.y, intent, arrivalRadius });
}

describe("stepManager()", () => {
  it("sem ordem, não anda", () => {
    const m = createManager(100, 100);
    const step = stepManager(m, fieldTo(TARGET.x, TARGET.y), SPEED);

    expect(step.manager).toEqual(m);
    expect(step.fired).toBeUndefined();
  });

  it("anda na direção do alvo e chega", () => {
    const field = fieldTo(TARGET.x, TARGET.y);
    let m = withOrder(createManager(100, 1_300), "none");
    let fired: string | undefined;

    for (let i = 0; i < 500; i++) {
      const step = stepManager(m, field, SPEED);
      m = step.manager;
      if (m.order === undefined) {
        fired = step.fired;
        break;
      }
    }

    expect(m.order).toBeUndefined();
    expect(Math.hypot(TARGET.x - m.x, TARGET.y - m.y)).toBeLessThanOrEqual(10);
    expect(fired).toBeUndefined(); // intent "none" não dispara nada
  });

  it("dispara a intenção ao chegar, uma vez só", () => {
    const field = fieldTo(TARGET.x, TARGET.y);
    // 995 está a 5px do alvo, dentro do arrivalRadius de 10. O teste anterior
    // usava 960 (40px) e afirmava disparo imediato — a asserção estava errada,
    // não o código.
    let m = withOrder(createManager(995, 600), "mine");

    const first = stepManager(m, field, SPEED);
    expect(first.fired).toBe("mine");
    expect(first.manager.order).toBeUndefined();

    // O passo seguinte não redispara: a ordem foi consumida. É daqui que sai
    // "um clique = um golpe", não de um contador em outro lugar.
    m = first.manager;
    expect(stepManager(m, field, SPEED).fired).toBeUndefined();
  });

  it("dispara imediatamente se já está no alcance quando recebe a ordem", () => {
    const m = withOrder(createManager(TARGET.x, TARGET.y), "sell", 140);
    const step = stepManager(m, fieldTo(TARGET.x, TARGET.y), SPEED);

    expect(step.fired).toBe("sell");
    expect(step.manager.x).toBe(TARGET.x); // não deu um passo pra lugar nenhum
  });

  it("nunca passa do alvo, mesmo com velocidade maior que a distância restante", () => {
    // Sem o clamp do passo, ele oscilaria em torno do destino pra sempre.
    const m = orderManager(createManager(TARGET.x - 3, TARGET.y), {
      targetX: TARGET.x,
      targetY: TARGET.y,
      intent: "none",
      arrivalRadius: 1,
    });
    const step = stepManager(m, fieldTo(TARGET.x, TARGET.y), 500);

    expect(Math.hypot(TARGET.x - step.manager.x, TARGET.y - step.manager.y)).toBeLessThanOrEqual(1);
  });

  it("ordem nova cancela a anterior", () => {
    const m = withOrder(createManager(100, 100), "mine");
    const trocado = orderManager(m, {
      targetX: 50,
      targetY: 50,
      intent: "sell",
      arrivalRadius: 10,
    });

    expect(trocado.order?.intent).toBe("sell");
    expect(trocado.order?.targetX).toBe(50);
  });

  it("chega mesmo entrando na célula do alvo, onde o campo não tem direção", () => {
    // A célula que contém o alvo dá vetor zero por construção (flowField.ts).
    // Sem a aproximação final, o gerente pararia a até um tile do destino e a
    // ordem nunca completaria — travando o jogo em silêncio.
    const field = fieldTo(TARGET.x, TARGET.y);
    let m = orderManager(createManager(TARGET.x - 20, TARGET.y - 20), {
      targetX: TARGET.x,
      targetY: TARGET.y,
      intent: "mine",
      arrivalRadius: 2,
    });

    let fired: string | undefined;
    for (let i = 0; i < 100; i++) {
      const step = stepManager(m, field, 3);
      m = step.manager;
      if (step.fired) {
        fired = step.fired;
        break;
      }
    }

    expect(fired).toBe("mine");
  });
});

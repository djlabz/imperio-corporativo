import { describe, expect, it } from "vitest";
import { GRID_COLS, GRID_ROWS, WORLD_HEIGHT, WORLD_WIDTH } from "../world/tileMap";
import { buildFlowField, sampleFlowField } from "./flowField";

const FLOW_ANGLE = Math.atan2(1, 3);
const DOMINANT_DX = Math.cos(FLOW_ANGLE);
const DOMINANT_DY = Math.sin(FLOW_ANGLE);

describe("buildFlowField()", () => {
  it("gera um vetor por célula do grid", () => {
    const field = buildFlowField();
    expect(field.vectors).toHaveLength(GRID_COLS * GRID_ROWS * 2);
  });

  it("é determinístico — duas chamadas dão o mesmo campo", () => {
    const a = buildFlowField();
    const b = buildFlowField();
    expect(Array.from(a.vectors)).toEqual(Array.from(b.vectors));
  });

  it("todo vetor é unitário", () => {
    const field = buildFlowField();
    for (let i = 0; i < field.vectors.length; i += 2) {
      const dx = field.vectors[i] as number;
      const dy = field.vectors[i + 1] as number;
      expect(Math.hypot(dx, dy)).toBeCloseTo(1, 5);
    }
  });

  it("tem variação real por célula — não é um vetor uniforme disfarçado de campo", () => {
    const field = buildFlowField();
    const first: [number, number] = [field.vectors[0] as number, field.vectors[1] as number];
    let foundDifferent = false;
    for (let i = 2; i < field.vectors.length; i += 2) {
      if (field.vectors[i] !== first[0] || field.vectors[i + 1] !== first[1]) {
        foundDifferent = true;
        break;
      }
    }
    expect(foundDifferent).toBe(true);
  });

  it("nenhuma célula se desvia da direção dominante além da amplitude do meandro", () => {
    // Garante que o campo nunca inverte de sentido — é isso que assegura o
    // cruzamento do mapa de ponta a ponta, sem depender de simular o passeio
    // inteiro. Ângulo entre o vetor da célula e a direção dominante.
    const field = buildFlowField();
    const MEANDER_AMPLITUDE = 0.5;
    for (let i = 0; i < field.vectors.length; i += 2) {
      const dx = field.vectors[i] as number;
      const dy = field.vectors[i + 1] as number;
      const dot = dx * DOMINANT_DX + dy * DOMINANT_DY;
      const angleFromDominant = Math.acos(Math.min(1, Math.max(-1, dot)));
      expect(angleFromDominant).toBeLessThanOrEqual(MEANDER_AMPLITUDE + 1e-6);
    }
  });

  it("a direção média em todo o mapa é a direção dominante do fluxo", () => {
    const field = buildFlowField();
    let sumDx = 0;
    let sumDy = 0;
    let count = 0;
    for (let i = 0; i < field.vectors.length; i += 2) {
      sumDx += field.vectors[i] as number;
      sumDy += field.vectors[i + 1] as number;
      count++;
    }
    // Tolerância larga de propósito: a média de cos/sin de um ângulo com
    // ruído simétrico não é exatamente cos/sin do ângulo médio (a função é
    // côncava na vizinhança), então um desvio de ~0.06 é esperado, não bug.
    // O que importa é confirmar que a direção é predominante, não reversa.
    expect(sumDx / count).toBeGreaterThan(0.8);
    expect(Math.abs(sumDy / count - DOMINANT_DY)).toBeLessThan(0.15);
  });

  it("um NPC que entra pela borda esquerda atravessa o mapa inteiro até sair pela direita, passando perto do centro", () => {
    // Prova a correção do bug real encontrado no browser: a primeira versão
    // (redemoinho a partir do centro) nunca cruzava a área central visível,
    // porque um NPC nascido na borda só se afastava do centro. Verifiquei no
    // browser (mapa parado, câmera padrão) antes de fechar a etapa e não
    // havia NPC nenhum na tela — nenhum teste unitário anterior acusava isso,
    // porque todos validavam geometria do campo, não "o resultado passa pela
    // câmera default". Este teste simula o passeio de ponta a ponta e checa
    // as duas coisas: que ele realmente cruza (sai pelo lado oposto) e que em
    // algum momento chega perto do centro do mapa.
    const field = buildFlowField();
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    const visibleRadius = 700; // ordem de grandeza de metade de uma viewport comum

    let x = -16;
    let y = WORLD_HEIGHT / 2;
    let closestToCenter = Infinity;
    let exited = false;

    for (let step = 0; step < 2000; step++) {
      const [dx, dy] = sampleFlowField(field, x, y);
      x += dx * 12;
      y += dy * 12;
      closestToCenter = Math.min(closestToCenter, Math.hypot(x - centerX, y - centerY));
      if (x > WORLD_WIDTH + 16) {
        exited = true;
        break;
      }
    }

    expect(exited).toBe(true);
    expect(closestToCenter).toBeLessThan(visibleRadius);
  });
});

describe("sampleFlowField()", () => {
  it("prende na borda em vez de lançar para coordenadas fora do mundo", () => {
    const field = buildFlowField();
    expect(() => sampleFlowField(field, -500, -500)).not.toThrow();
    expect(() => sampleFlowField(field, WORLD_WIDTH + 500, WORLD_HEIGHT + 500)).not.toThrow();
  });
});

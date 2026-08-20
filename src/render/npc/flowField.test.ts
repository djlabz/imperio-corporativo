import { describe, expect, it } from "vitest";
import { GRID_COLS, GRID_ROWS, WORLD_HEIGHT, WORLD_WIDTH } from "../world/tileMap";
import { buildFlowField, NPC_FLOW_ANGLE, NPC_TRAVERSAL, sampleFlowField } from "./flowField";

// Vem do módulo em vez de redeclarado: era duplicação com dever de concordar, e
// a F1-E3 tornou o ângulo exportado ao explicitar o destino dos NPCs.
const DOMINANT_DX = Math.cos(NPC_FLOW_ANGLE);
const DOMINANT_DY = Math.sin(NPC_FLOW_ANGLE);

describe("buildFlowField(NPC_TRAVERSAL)", () => {
  it("gera um vetor por célula do grid", () => {
    const field = buildFlowField(NPC_TRAVERSAL);
    expect(field.vectors).toHaveLength(GRID_COLS * GRID_ROWS * 2);
  });

  it("é determinístico — duas chamadas dão o mesmo campo", () => {
    const a = buildFlowField(NPC_TRAVERSAL);
    const b = buildFlowField(NPC_TRAVERSAL);
    expect(Array.from(a.vectors)).toEqual(Array.from(b.vectors));
  });

  it("todo vetor é unitário", () => {
    const field = buildFlowField(NPC_TRAVERSAL);
    for (let i = 0; i < field.vectors.length; i += 2) {
      const dx = field.vectors[i] as number;
      const dy = field.vectors[i + 1] as number;
      expect(Math.hypot(dx, dy)).toBeCloseTo(1, 5);
    }
  });

  it("tem variação real por célula — não é um vetor uniforme disfarçado de campo", () => {
    const field = buildFlowField(NPC_TRAVERSAL);
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
    const field = buildFlowField(NPC_TRAVERSAL);
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
    const field = buildFlowField(NPC_TRAVERSAL);
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
    const field = buildFlowField(NPC_TRAVERSAL);
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

describe("buildFlowField() — objetivo (gerente)", () => {
  const TARGET = { kind: "point", x: 1_000, y: 600 } as const;

  it("toda célula aponta PARA o alvo", () => {
    const field = buildFlowField(TARGET);

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const i = (row * GRID_COLS + col) * 2;
        const dx = field.vectors[i] as number;
        const dy = field.vectors[i + 1] as number;
        const cellX = col * 64 + 32;
        const cellY = row * 48 + 24;
        const toTarget = Math.hypot(TARGET.x - cellX, TARGET.y - cellY);
        if (toTarget < 1) continue; // a célula do próprio alvo não tem direção

        // Um passo na direção do campo tem que ENCURTAR a distância ao alvo.
        // É a propriedade que importa, e é mais forte que comparar ângulos:
        // vale para qualquer célula, sem caso especial de quadrante.
        const after = Math.hypot(TARGET.x - (cellX + dx), TARGET.y - (cellY + dy));
        expect(after, `célula ${col},${row}`).toBeLessThan(toTarget);
      }
    }
  });

  it("não tem meandro — o gerente anda reto, não zigue-zague", () => {
    // Duas células na MESMA direção relativa ao alvo têm que dar o mesmo vetor.
    // Com meandro, elas divergiriam por serem col/row diferentes.
    const field = buildFlowField({ kind: "point", x: 0, y: 0 });
    const onDiagonal: [number, number][] = [];
    for (const n of [2, 4, 8]) {
      const i = (n * GRID_COLS + n) * 2;
      onDiagonal.push([field.vectors[i] as number, field.vectors[i + 1] as number]);
    }
    for (const [dx, dy] of onDiagonal) {
      expect(dx).toBeCloseTo(onDiagonal[0]?.[0] as number, 4);
      expect(dy).toBeCloseTo(onDiagonal[0]?.[1] as number, 4);
    }
  });

  it("a célula que contém o alvo dá vetor zero, não NaN", () => {
    // NaN aqui se propagaria pela posição do gerente e nunca mais sairia.
    const field = buildFlowField({ kind: "point", x: 32, y: 24 });
    expect(field.vectors[0]).toBe(0);
    expect(field.vectors[1]).toBe(0);
  });

  it("é determinístico e todo vetor é unitário (ou zero, no alvo)", () => {
    const a = buildFlowField(TARGET);
    const b = buildFlowField(TARGET);
    expect(Array.from(a.vectors)).toEqual(Array.from(b.vectors));

    for (let i = 0; i < a.vectors.length; i += 2) {
      const len = Math.hypot(a.vectors[i] as number, a.vectors[i + 1] as number);
      expect(len === 0 || Math.abs(len - 1) < 1e-5).toBe(true);
    }
  });

  it("um gerente andando pelo campo CHEGA no alvo", () => {
    // A prova de que serve pro que existe. Geometria de campo não garante que
    // caminhar por ele converge — foi exatamente esse o bug do redemoinho.
    const field = buildFlowField(TARGET);
    let x = 40;
    let y = 1_300;
    let arrived = false;

    for (let step = 0; step < 2_000; step++) {
      const [dx, dy] = sampleFlowField(field, x, y);
      x += dx * 12;
      y += dy * 12;
      if (Math.hypot(TARGET.x - x, TARGET.y - y) < 24) {
        arrived = true;
        break;
      }
    }

    expect(arrived).toBe(true);
  });
});

describe("sampleFlowField()", () => {
  it("prende na borda em vez de lançar para coordenadas fora do mundo", () => {
    const field = buildFlowField(NPC_TRAVERSAL);
    expect(() => sampleFlowField(field, -500, -500)).not.toThrow();
    expect(() => sampleFlowField(field, WORLD_WIDTH + 500, WORLD_HEIGHT + 500)).not.toThrow();
  });
});

import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { applyToContainer, createCameraState } from "../render/world/camera";
import { buildTileGrid } from "../render/world/tileMap";
import { buildTileMapView } from "../render/world/TileMapView";
import { createWorld } from "../sim/core/World";
import { updateFrame } from "./frame";
import { createFixedStepLoop } from "./loop";

/**
 * Trava de regressão de performance — headless, sem browser.
 *
 * Mede só a fase de CPU do frame (advance() + tick()s + aplicar a câmera num
 * Container real do Pixi). NÃO mede desenho de GPU de verdade: Container e
 * Graphics do Pixi funcionam parados em Node puro (confirmado antes de
 * escrever este teste), mas `renderer.render()` precisa de WebGL/WebGPU real,
 * que só existe num browser. Isso é uma limitação real, não um descuido: o
 * gargalo de GPU/fill-rate desta etapa (mapa estático, sem NPC) é
 * desprezível; o risco de verdade citado no CLAUDE.md — GC e render sob
 * pressão de centenas de NPCs — só aparece na Etapa 4, e o pool de NPC vai
 * precisar do seu PRÓPRIO teste de orçamento nesta mesma linha, não deste
 * arquivo genérico.
 *
 * Orçamento calibrado a partir de medição real (ver relatório da Etapa 3):
 * mediana ~0.0003ms, p95 ~0.002ms, pior amostra observada ~0.075ms, com mapa
 * montado e câmera aplicada. FRAME_BUDGET_MS aqui fica ~600x acima da
 * mediana medida — folga de propósito para não flakar em CI mais lento, mas
 * ainda apertado o suficiente pra pegar uma regressão real (ex.: alguém
 * clonando o array de tiles ou serializando o World a cada frame).
 */
const FRAME_BUDGET_MS = 2;
const WORST_CASE_FRAME_MS = 250; // o clamp do loop — o maior frame que o acumulador aceita
const WARMUP_SAMPLES = 100; // descarta pra não medir aquecimento de JIT
const MEASURED_SAMPLES = 500;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
}

describe("orçamento de frame — pior caso, mapa vazio (Etapa 3, sem NPC)", () => {
  it("advance() + tick()s + aplicar câmera fica dentro do orçamento no pior caso de frame", () => {
    const tileMapView = buildTileMapView(buildTileGrid());
    const stage = new Container();
    stage.addChild(tileMapView);
    const camera = createCameraState();

    let state = { world: createWorld("frame-budget"), loop: createFixedStepLoop() };
    const durations: number[] = [];

    for (let i = 0; i < WARMUP_SAMPLES + MEASURED_SAMPLES; i++) {
      const start = performance.now();
      const result = updateFrame(state, WORST_CASE_FRAME_MS);
      applyToContainer(camera, tileMapView, 1920, 1080);
      const elapsed = performance.now() - start;

      state = result.state;
      if (i >= WARMUP_SAMPLES) durations.push(elapsed);
    }

    // Mediana, não a pior amostra isolada: uma única amostra pode vir de um
    // agendamento de SO azarado e não representa o custo real do código.
    expect(median(durations)).toBeLessThan(FRAME_BUDGET_MS);
  });
});

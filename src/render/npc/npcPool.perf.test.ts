import { Container } from "pixi.js";
import { describe, expect, it } from "vitest";
import { createRng } from "../../sim/core/rng";
import { buildFlowField, NPC_TRAVERSAL } from "./flowField";
import { buildNpcPoolView, syncNpcPoolView } from "./NpcPoolView";
import { createNpcPool, stepNpcPool } from "./npcPool";

/**
 * Trava de regressão de performance pro pool de NPC — a lacuna que o próprio
 * cabeçalho de app/frame.perf.test.ts previa desde a Etapa 3 ("o pool de NPC
 * vai precisar do seu PRÓPRIO teste de orçamento nesta mesma linha"). P-03
 * (docs/DECISOES.md) ficou aberta até agora porque essa lacuna nunca foi
 * fechada: os números de escala da Etapa 4 saíram de medição manual no
 * browser, não de teste na suíte.
 *
 * Mede stepNpcPool() + syncNpcPoolView() — o caminho de CPU que roda por tick
 * em game.ts — headless, sem GPU real (mesma limitação documentada em
 * frame.perf.test.ts: Container/Graphics do Pixi funcionam parados em Node,
 * app.render() não).
 *
 * FRAME_BUDGET_MS calibrado em duas pontas:
 * 1. Medição nativa da Etapa 6 (fora do WSL, ver D-005 em DECISOES.md):
 *    custo marginal por NPC ficou em ~0.00015-0.0006ms/NPC através da faixa
 *    0-4000 (Etapa 4/WSL tinha medido 0.0006-0.00095ms/NPC) — nativo é igual
 *    ou mais rápido que o WSL/ANGLE, nunca pior.
 * 2. Medição direta deste mesmo teste, headless, nesta máquina: mediana
 *    ~0.107ms em N=500 — consistente com o número nativo (500 × ~0.0002ms
 *    marginal + custo fixo de LOD/culling bate na faixa certa).
 * FRAME_BUDGET_MS fica ~7.5x acima da mediana medida — bastante folga pra
 * não flakar numa máquina mais lenta, mas ainda apertado o suficiente pra
 * pegar uma regressão de ORDEM DE GRANDEZA no custo DOMINANTE.
 *
 * Verificado com mutação (D-011), três tentativas — a primeira duas não
 * acusaram, e isso também é sinal útil, não só a terceira que acusou:
 * 1. 30 chamadas extras de sampleFlowField() por NPC (~31x o custo dessa
 *    função) NÃO estourou o orçamento — sampleFlowField é uma fração
 *    pequena do custo total; inflar uma parte barata não move a agulha.
 * 2. Rodar o laço de syncNpcPoolView() 10x (o custo dominante de verdade)
 *    ficou bem no limiar (0.822ms vs orçamento de 0.8ms) — variando entre
 *    passar e falhar conforme o jitter da própria máquina, o que é esperado:
 *    "margem generosa" e "sensível a exatamente 10x" empurram em direções
 *    opostas, por construção.
 * 3. Rodar o mesmo laço 20x falhou de forma clara e reprodutível (mediana
 *    ~1.6ms, 2x o orçamento) — confirma que o teste pega uma regressão
 *    visivelmente pior que "ordem de grandeza", e mostra o que ele NÃO é: uma
 *    trava fina o bastante pra pegar exatamente 10x sem incerteza. Não é um
 *    substituto pra medir de novo num N muito maior — a mudança de classe de
 *    complexidade (O(n) → O(n²)) é o teste de escala 0/500/1000/2000/4000,
 *    manual até aqui, não recriado na suíte.
 */
const ACTIVE_COUNT = 500; // critério de aceite da Etapa 4 — ver NPC_ACTIVE_COUNT em app/game.ts
const CAPACITY = 600; // ver NPC_POOL_CAPACITY em app/game.ts
const FRAME_BUDGET_MS = 0.8;
const WARMUP_SAMPLES = 100; // descarta pra não medir aquecimento de JIT
const MEASURED_SAMPLES = 500;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
}

describe(`orçamento de frame — pool de NPC em N=${ACTIVE_COUNT} (P-03)`, () => {
  it("stepNpcPool() + syncNpcPoolView() ficam dentro do orçamento calibrado na medição nativa", () => {
    const rng = createRng("npc-pool-frame-budget");
    const pool = createNpcPool({
      activeCount: ACTIVE_COUNT,
      capacity: CAPACITY,
      random: () => rng.float(),
    });
    const flowField = buildFlowField(NPC_TRAVERSAL);
    const view = buildNpcPoolView(pool.capacity);
    const stage = new Container();
    stage.addChild(view.container);

    const durations: number[] = [];
    for (let i = 0; i < WARMUP_SAMPLES + MEASURED_SAMPLES; i++) {
      const start = performance.now();
      stepNpcPool(pool, flowField, i, 0, 0, () => rng.float());
      syncNpcPoolView(view, pool);
      const elapsed = performance.now() - start;
      if (i >= WARMUP_SAMPLES) durations.push(elapsed);
    }

    // Mediana, não a pior amostra isolada: uma única amostra pode vir de um
    // agendamento de SO azarado e não representa o custo real do código (ver
    // o mesmo raciocínio em app/frame.perf.test.ts).
    expect(median(durations)).toBeLessThan(FRAME_BUDGET_MS);
  });
});

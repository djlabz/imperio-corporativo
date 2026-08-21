/** Janela de amostras para o cálculo de 1% low. ~2s a 60fps. */
const WINDOW_SIZE = 120;

export interface StatsTracker {
  readonly samples: readonly number[];
}

export function createStatsTracker(): StatsTracker {
  return { samples: [] };
}

/** Registra a duração (ms) de um frame. Mantém só as últimas WINDOW_SIZE amostras. */
export function recordFrame(tracker: StatsTracker, frameMs: number): StatsTracker {
  return { samples: [...tracker.samples, frameMs].slice(-WINDOW_SIZE) };
}

export function instantFps(frameMs: number): number {
  if (frameMs <= 0) return 0;
  return 1000 / frameMs;
}

/**
 * FPS do pior 1% dos frames na janela — não a média, o pior caso. Média
 * esconde engasgo; isto é o número que corresponde ao que o jogador sente.
 * Some as amostras de MAIOR duração (piores frames), tira a média delas, e
 * converte para FPS.
 */
export function computeLow1PercentFps(tracker: StatsTracker): number {
  if (tracker.samples.length === 0) return 0;

  const sorted = [...tracker.samples].sort((a, b) => a - b);
  const worstCount = Math.max(1, Math.ceil(sorted.length * 0.01));
  const worstFrames = sorted.slice(-worstCount);
  const avgWorstMs = worstFrames.reduce((sum, ms) => sum + ms, 0) / worstFrames.length;

  return instantFps(avgWorstMs);
}

const DEFAULT_TARGET_FPS = 60;

/**
 * Quanto do orçamento de frame (1000/targetFps ms) o trabalho medido ocupou,
 * em %. Sob vsync, FPS fica preso no refresh rate e não distingue "sobrou
 * 15ms de folga" de "sobrou 0.1ms" — os dois mostram o mesmo 60fps. Ocupação
 * não tem esse problema: mede o trabalho em si, não quantos frames couberam
 * num segundo. Pode passar de 100% (significa que o trabalho não cabe mais
 * no orçamento, mesmo que o vsync ainda esconda isso no FPS).
 */
export function computeBudgetOccupancyPercent(
  workMs: number,
  targetFps: number = DEFAULT_TARGET_FPS,
): number {
  const budgetMs = 1000 / targetFps;
  return (workMs / budgetMs) * 100;
}

/** Limiares de frame longo, em ms. 20ms ~ perde um frame a 60Hz; 33ms ~ perde dois. */
export const LONG_FRAME_THRESHOLD_MS = 20;
export const VERY_LONG_FRAME_THRESHOLD_MS = 33;

/**
 * SOB VSYNC OS DOIS CONTADORES SÃO IGUAIS, E ISSO É CORRETO — não é bug, e já
 * levantou suspeita uma vez. Medido na F1-E3, com histograma temporário no call
 * site de recordLongFrame.
 *
 * CONDIÇÕES DA COLETA, porque a proporção abaixo engana se lida fora delas:
 * 1518 frames num browser dirigido por automação (Playwright via CDP), servidos
 * pelo dev server do Vite, dentro do WSL2, enquanto um script disparava 60
 * cliques sintéticos a cada ~300ms — cada um recomputando o flow field e
 * reordenando o gerente. Nenhuma captura de tela durante a janela medida.
 *
 *   faixa      frames
 *   00-05           1
 *   15-18       1.185
 *   18-20           0
 *   20-25           0     <-- vazia
 *   25-33           0     <-- vazia
 *   33-50         329
 *   50+             3
 *
 *   >20ms: 332    >33ms: 332    na faixa 20-33ms: ZERO
 *
 * ATENÇÃO AO LER ISTO COMO DESEMPENHO: a proporção de frames longos nesta tabela
 * (332 de 1518 = 21,9%) NÃO é representativa de sessão normal. O overlay em
 * sessão real, sem automação, deu 703 de 99.885 = 0,70% — duas ordens de
 * magnitude abaixo. Por que os dois diferem não foi medido, e não está afirmado
 * aqui (D-018).
 *
 * O que esta tabela demonstra é a AUSÊNCIA da faixa 20–33ms, não a frequência de
 * frame longo. E a conclusão sobre os contadores não depende da proporção:
 * contaminação, de qualquer origem, ADICIONARIA frames nas faixas do meio, e elas
 * estão zeradas.
 *
 * O motivo é o vsync: a 60Hz o compositor entrega frame em múltiplos de ~16,7ms,
 * então um frame ou cabe em uma janela de refresh (~16,7ms) ou perde e vai pra
 * duas (~33,3ms). A faixa 20–33ms é vazia POR CONSTRUÇÃO, e os dois contadores
 * medem o mesmo evento — "perdeu pelo menos um refresh".
 *
 * Os dois só divergem no modo SEM VSYNC (ver `uncapped` no OverlaySnapshot), onde
 * o tempo de frame não é quantizado. É por isso que os dois existem, e por isso
 * nenhum dos dois deve ser removido por "parecer redundante": a redundância é do
 * ambiente, não do instrumento.
 *
 * Se algum dia os números divergirem sob vsync, aí sim há o que investigar.
 */

/**
 * Contagem cumulativa de frames longos numa janela fixa (a sessão de
 * medição inteira — sem reset automático; cria um tracker novo pra
 * reiniciar a janela). Isto é a alternativa a "não ter o profiler de GC do
 * Chrome": conta o que o jogador sente de verdade (frame perdido a 60Hz),
 * sem depender de ferramenta externa nenhuma, e é testável com valores
 * sintéticos.
 */
export interface LongFrameTracker {
  readonly totalFrames: number;
  readonly framesOver20ms: number;
  readonly framesOver33ms: number;
}

export function createLongFrameTracker(): LongFrameTracker {
  return { totalFrames: 0, framesOver20ms: 0, framesOver33ms: 0 };
}

export function recordLongFrame(tracker: LongFrameTracker, frameMs: number): LongFrameTracker {
  return {
    totalFrames: tracker.totalFrames + 1,
    framesOver20ms: tracker.framesOver20ms + (frameMs > LONG_FRAME_THRESHOLD_MS ? 1 : 0),
    framesOver33ms: tracker.framesOver33ms + (frameMs > VERY_LONG_FRAME_THRESHOLD_MS ? 1 : 0),
  };
}

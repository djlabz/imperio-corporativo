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

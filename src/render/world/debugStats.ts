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

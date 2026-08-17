// Este arquivo não importa sim/ de propósito. A matemática do acumulador é
// testada com deltas falsos e zero setup (ver loop.test.ts); se importasse
// World/tick(), todo teste da matemática pura passaria a exigir um World
// montado. frame.ts é quem aplica isto ao World deste jogo especificamente
// — mantidos em arquivos separados por isso, não por "reuso futuro" (não
// vamos reusar). Não funda os dois "pra simplificar": o atrito de testar o
// acumulador isolado é o que se perde.

/** Duração fixa de um tick de simulação, em ms. Ver Regra 3 do CLAUDE.md. */
export const TICK_MS = 100;

/**
 * Teto de duração de frame aceita pelo acumulador. Sem isso, uma pausa longa
 * (aba em background, breakpoint, GC gigante) faria o loop tentar recuperar
 * o atraso todo de uma vez rodando centenas de ticks — "spiral of death".
 * Acima do teto, o tempo excedente é descartado: o jogo perde tempo simulado
 * em vez de travar tentando recuperá-lo.
 */
const MAX_FRAME_MS = 250;

export interface FixedStepLoop {
  /** Tempo acumulado, em ms, que ainda não completou um tick inteiro. */
  readonly accumulatorMs: number;
}

export function createFixedStepLoop(): FixedStepLoop {
  return { accumulatorMs: 0 };
}

export interface StepResult {
  /** Quantos ticks de simulação o chamador deve rodar agora. */
  readonly ticksToRun: number;
  readonly loop: FixedStepLoop;
  /**
   * Fração [0, 1) do próximo tick já decorrida. Serve só para o renderer
   * interpolar a posição visual entre dois estados — nunca para multiplicar
   * valor de jogo (Regra 3: deltaTime não é dinheiro).
   */
  readonly alpha: number;
}

/**
 * Consome um frame de `frameMs` de duração e devolve quantos ticks rodar.
 *
 * `frameMs` é responsabilidade de quem chama (medido com `performance.now()`
 * no loop de render de verdade, que ainda não existe — chega na Etapa 3).
 * Esta função em si não lê relógio nenhum, o que a mantém pura e testável
 * com deltas falsos, sem precisar de timer real ou fake timers do vitest.
 */
export function advance(loop: FixedStepLoop, frameMs: number): StepResult {
  let accumulatorMs = loop.accumulatorMs + Math.min(frameMs, MAX_FRAME_MS);

  let ticksToRun = 0;
  while (accumulatorMs >= TICK_MS) {
    accumulatorMs -= TICK_MS;
    ticksToRun++;
  }

  return {
    ticksToRun,
    loop: { accumulatorMs },
    alpha: accumulatorMs / TICK_MS,
  };
}

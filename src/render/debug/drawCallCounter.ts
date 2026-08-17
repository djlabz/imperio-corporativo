/**
 * CONTADOR DE DRAW CALLS — TÉCNICA NÃO OFICIAL, LEIA ANTES DE MEXER.
 *
 * O Pixi v8 não expõe um contador de draw calls público. Isto aqui intercepta
 * `drawElements`/`drawArrays` do contexto WebGL bruto — a mesma técnica que
 * libs como pixi-stats usam. Depende de `renderer.gl`, que existe e é tipado
 * (`WebGLRenderer.gl: GlRenderingContext`) mas não é anunciado como API
 * estável do Pixi: é candidato a quebrar numa atualização major sem aviso em
 * changelog. Só funciona no backend WebGL — WebGPU e Canvas não têm esse
 * contexto, e o backend é escolhido automaticamente pelo Pixi.
 *
 * Por isso este módulo fica isolado (nada mais no overlay depende dele além
 * do número que ele devolve) e nunca deixa uma exceção escapar: qualquer erro
 * aqui dentro vira "contador indisponível", nunca uma tela quebrada. Se um
 * dia parar de funcionar numa atualização do Pixi, é seguro apagar o arquivo
 * inteiro — o resto do overlay de debug continua de pé.
 */

/** Estrutura mínima que precisamos do contexto WebGL — evita depender de tipos DOM globais. */
interface DrawableGlContext {
  drawElements: (...args: never[]) => void;
  drawArrays: (...args: never[]) => void;
}

export interface DrawCallCounter {
  /** Draw calls contados desde o último reset(). */
  readonly count: number;
  reset(): void;
}

function looksLikeGlContext(value: unknown): value is DrawableGlContext {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { drawElements?: unknown }).drawElements === "function" &&
    typeof (value as { drawArrays?: unknown }).drawArrays === "function"
  );
}

/**
 * Tenta anexar o contador a um renderer do Pixi. Devolve `undefined` se o
 * backend não for WebGL, se `renderer.gl` não existir ou não parecer um
 * contexto GL, ou se qualquer coisa inesperada acontecer — nunca lança.
 */
export function attachDrawCallCounter(renderer: unknown): DrawCallCounter | undefined {
  try {
    if (renderer === null || typeof renderer !== "object" || !("gl" in renderer)) {
      return undefined;
    }

    const gl = (renderer as { gl: unknown }).gl;
    if (!looksLikeGlContext(gl)) {
      return undefined;
    }

    let count = 0;
    const originalDrawElements = gl.drawElements.bind(gl);
    const originalDrawArrays = gl.drawArrays.bind(gl);

    gl.drawElements = (...args: never[]) => {
      count++;
      originalDrawElements(...args);
    };
    gl.drawArrays = (...args: never[]) => {
      count++;
      originalDrawArrays(...args);
    };

    return {
      get count() {
        return count;
      },
      reset() {
        count = 0;
      },
    };
  } catch {
    return undefined;
  }
}

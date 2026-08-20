import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

// Trava a configuração dos DOIS subprojetos de tsconfig: src/sim/ (P-02) e
// src/platform/electron/ (o bug da Etapa 6). Os tsconfigs são as travas; este
// arquivo é a trava da trava, no padrão de test/sim-purity.test.ts (fecha a P-08).
//
// O modo de falha que isto existe pra pegar é a terceira instância do padrão de
// D-011, e a F1-E2 mediu o mecanismo dela em vez de supor:
//
//   - Programa VAZIO se denuncia: o tsc 7.0.2 emite TS18003 e sai 2, tanto com
//     `include` que não casa nada quanto com `exclude` herdado removendo tudo o
//     que o `include` casou. Não é o perigo.
//   - Programa PARCIAL é o perigo: algo sobrevive, o programa monta com um
//     subconjunto, e o tsc sai 0 EM SILÊNCIO. No Electron da Etapa 6 foram 1 de
//     3 arquivos (electronSaveApi.ts não é .cts, escapou do exclude herdado);
//     no src/sim/ a mesma forma apareceu ao mutar o `include` pra
//     ["core/tick.ts"].
//
// Daí a forma das asserções: PRESENÇA de cada arquivo esperado, nunca contagem.
// Contagem exata só treinaria a bumpar o número a cada arquivo novo, que é o
// oposto do que este teste serve.
//
// E daí a perna de EFEITO em cada projeto. As asserções de config sozinhas
// provam configuração, não comportamento: config correto que não emite (ou que
// não reprova o que deveria) é a mesma falha por outro caminho.
//
// ATENÇÃO: a parte do sim/ escreve um arquivo temporário dentro de src/sim/, com
// nome próprio — NÃO o __lint_probe.ts, que pertence a sim-purity.test.ts e seria
// sobrescrito. Não rode em paralelo com `tsc --watch`, com o dev server nem com
// `pnpm typecheck`.
//
// Sobre concorrência com sim-purity.test.ts, que usa a MESMA pasta como rascunho:
// o vitest roda arquivos de teste em paralelo, então o __lint_probe.ts dele pode
// existir durante um `tsc` daqui. Verificado: uma asserção de exit code global
// ("o projeto raiz aprova") quebra de verdade nessa janela. Serializar a suíte
// inteira custaria 1,9s -> 8,4s pra resolver um problema de dois arquivos, então
// em vez disso as asserções são imunes por construção — ancoram o diagnóstico no
// NOME e na LINHA do probe daqui, e a metade "o raiz aprova" é verificada no
// config resolvido do raiz, não rodando o programa inteiro dele.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const SIM_PROJECT = "src/sim/tsconfig.json";
const ELECTRON_PROJECT = "src/platform/electron/tsconfig.json";
const PROBE_REL = "src/sim/__tsconfig_probe.ts";
const PROBE_ABS = path.join(repoRoot, PROBE_REL);

// Mesmo idioma de sim-purity.test.ts: o entry point do pacote invocado pelo
// próprio node, em vez de `pnpm exec` ou do .bin (que no Windows ganha sufixo
// .cmd). Também evita `npx`, que resolve por pacote no registro.
const TSC_BIN = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

// O probe é um MÓDULO, não um script: sem o `export`, os `const` de topo entram no
// escopo global do programa raiz e podem colidir (TS2451). O `export` também o
// tira do alcance de `noUnusedLocals`, que está ligado.
const PROBE_SOURCE = "const arr: number[] = [1, 2, 3];\nexport const first: number = arr[0];\n";

// O erro exato que a flag produz, ancorado no arquivo e na linha:coluna do probe.
// Ancorar assim é o que torna a asserção imune a erro alheio no mesmo programa.
const PROBE_ERROR = /__tsconfig_probe\.ts\(2,14\): error TS2322/;

interface TscRun {
  status: number;
  output: string;
}

function runTsc(args: readonly string[]): TscRun {
  const result = spawnSync(process.execPath, [TSC_BIN, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return { status: result.status ?? -1, output: `${result.stdout}${result.stderr}` };
}

interface ResolvedConfig {
  compilerOptions: Record<string, unknown>;
  files: string[];
}

function showConfig(project?: string): ResolvedConfig {
  const args = project ? ["--showConfig", "-p", project] : ["--showConfig"];
  const { output } = runTsc(args);
  try {
    return JSON.parse(output) as ResolvedConfig;
  } catch {
    throw new Error(`--showConfig não devolveu JSON. Saída bruta:\n${output}`);
  }
}

// Os módulos do núcleo que o programa do sim/ tem hoje. Presença, não igualdade:
// as etapas seguintes vão adicionar arquivos ao sim/.
const SIM_FILES = [
  "./core/World.ts",
  "./core/tick.ts",
  "./core/rng.ts",
  "./core/determinism.test.ts",
  "./core/rng.test.ts",
  "./economy/money.ts",
  "./economy/money.test.ts",
] as const;

// As três entradas do `include` do Electron. Aqui a lista é fechada por natureza
// (é o `include` literal), e é exatamente a asserção que pega o 1-de-3.
const ELECTRON_FILES = ["./main.cts", "./preload.cts", "./electronSaveApi.ts"] as const;

// O que o build:win precisa encontrar em dist-electron/. `electronSaveApi.js` de
// propósito fora da lista: foi justamente ele que sobreviveu ao bug da Etapa 6 e
// deu a aparência de sucesso.
const ELECTRON_EMITTED = ["main.cjs", "preload.cjs"] as const;

describe("projeto src/sim/", () => {
  let sim: ResolvedConfig;
  let root: ResolvedConfig;

  beforeAll(() => {
    sim = showConfig(SIM_PROJECT);
    root = showConfig();
  });

  it("liga noUncheckedIndexedAccess no config resolvido, e só nele", () => {
    expect(sim.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    // A isenção do renderer (CLAUDE.md, Convenções de código) mora no raiz não
    // ligar a flag. Se alguém ligar lá, é decisão — mas é P-10, não acidente.
    expect(root.compilerOptions.noUncheckedIndexedAccess).toBeFalsy();
  });

  it("monta um programa com os módulos do núcleo, não um programa parcial", () => {
    expect(sim.files.length).toBeGreaterThanOrEqual(SIM_FILES.length);
    for (const file of SIM_FILES) {
      expect(sim.files).toContain(file);
    }
  });

  it("não alcança nada fora de src/sim/", () => {
    // Se o `include` explícito cair, o do raiz é herdado resolvido contra a pasta
    // do raiz e todo caminho vira "../...". É esse o modo de falha.
    expect(sim.files.filter((f) => f.startsWith("../"))).toEqual([]);
  });

  // EFEITO. Um programa parcial que não contenha o probe não reporta nada sobre
  // ele, então esta asserção não é satisfazível por amputação do programa.
  it("reprova acesso indexado sem checagem, e é a flag que faz isso", () => {
    writeFileSync(PROBE_ABS, PROBE_SOURCE);
    try {
      const withFlag = runTsc(["--noEmit", "-p", SIM_PROJECT]);
      expect(withFlag.status, `deveria reprovar. Saída:\n${withFlag.output}`).not.toBe(0);
      expect(withFlag.output).toMatch(PROBE_ERROR);

      // Controle: mesmo projeto, mesma lib, mesmo moduleResolution — só a flag
      // desligada. Isola a flag como causa, em vez de qualquer outra diferença
      // entre os dois configs. Asserção pela AUSÊNCIA do erro do probe, não pelo
      // exit code, pra não depender de mais nada que esteja no programa.
      const withoutFlag = runTsc([
        "--noEmit",
        "-p",
        SIM_PROJECT,
        "--noUncheckedIndexedAccess",
        "false",
      ]);
      expect(withoutFlag.output).not.toMatch(PROBE_ERROR);
    } finally {
      rmSync(PROBE_ABS, { force: true });
    }
  });

  it("não deixa o probe para trás", () => {
    expect(() => rmSync(PROBE_ABS)).toThrow();
  });
});

describe("projeto src/platform/electron/", () => {
  let electron: ResolvedConfig;

  beforeAll(() => {
    electron = showConfig(ELECTRON_PROJECT);
  });

  // A asserção que pega a regressão exata da Etapa 6: sem o `exclude: []`, o
  // exclude herdado do raiz volta a casar os dois .cts e o programa cai pra 1
  // arquivo, com o tsc saindo 0 em silêncio.
  it("monta um programa com os três arquivos do include, não com um subconjunto", () => {
    for (const file of ELECTRON_FILES) {
      expect(electron.files).toContain(file);
    }
  });

  it("não alcança nada fora de src/platform/electron/", () => {
    expect(electron.files.filter((f) => f.startsWith("../"))).toEqual([]);
  });

  it("emite de verdade: noEmit desligado", () => {
    // Ao contrário do sim/, este subprojeto existe pra EMITIR (dist-electron/).
    // Herdar o `noEmit: true` do raiz o deixaria com config perfeito e saída zero.
    expect(electron.compilerOptions.noEmit).toBe(false);
  });

  // EFEITO. Config correto que não emite é a mesma falha por outro caminho, e é a
  // forma em que o bug da Etapa 6 foi observado: dist-electron/ sem main.cjs.
  // Emite pra diretório temporário do SO — nunca pro dist-electron/ de verdade,
  // que é artefato de build e não pode ser mexido por teste.
  it("emite main.cjs e preload.cjs", () => {
    const outDir = mkdtempSync(path.join(tmpdir(), "tsconfig-electron-"));
    try {
      const run = runTsc(["-p", ELECTRON_PROJECT, "--outDir", outDir]);
      expect(run.status, `emissão deveria passar. Saída:\n${run.output}`).toBe(0);
      for (const file of ELECTRON_EMITTED) {
        expect(existsSync(path.join(outDir, file)), `${file} não foi emitido`).toBe(true);
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

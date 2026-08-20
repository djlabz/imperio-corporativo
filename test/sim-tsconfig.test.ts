import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

// Guarda a P-02: `noUncheckedIndexedAccess` ligado em src/sim/ e SÓ em src/sim/.
//
// O src/sim/tsconfig.json é a trava; este teste é a trava da trava, no mesmo
// padrão de sim-purity.test.ts (fecha a P-08). Sem ele, o único anteparo contra um
// programa silenciosamente vazio seria o documento de plano da F1-E1, que não é
// versionado.
//
// O modo de falha que isto existe pra pegar é a terceira instância do padrão de
// D-011, e ele tem duas formas bem diferentes — medidas por mutação na F1-E2:
//
//   - `include` que não casa NADA: o tsc 7.0.2 acusa (TS18003, exit 2). Ruidoso,
//     não é o perigo.
//   - `include` que casa POUCO (ex.: só core/tick.ts): exit 0, saída vazia, e a
//     flag deixa de valer pra money.ts sem ninguém notar. Este é o falso-verde
//     de verdade, e é por isso que a asserção de arquivos abaixo exige a
//     PRESENÇA de cada módulo do núcleo, não só uma contagem.
//
// ATENÇÃO: este teste escreve um arquivo temporário dentro de src/sim/, com nome
// próprio — NÃO o __lint_probe.ts, que pertence a sim-purity.test.ts e seria
// sobrescrito. Não rode em paralelo com `tsc --watch`, com o dev server nem com
// `pnpm typecheck`.
//
// Sobre concorrência com sim-purity.test.ts, que usa a MESMA pasta como rascunho:
// o vitest roda arquivos de teste em paralelo, então o __lint_probe.ts dele pode
// existir durante um `tsc` daqui. Verificado: uma asserção de exit code global
// ("o projeto raiz aprova") quebra de verdade nessa janela. Serializar a suíte
// inteira custaria 2s -> 8s pra resolver um problema de dois arquivos, então em
// vez disso as asserções abaixo são imunes por construção — ancoram o
// diagnóstico no NOME e na LINHA do probe daqui, e a metade "o raiz aprova" é
// verificada no config resolvido do raiz, não rodando o programa inteiro dele.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const SIM_PROJECT = "src/sim/tsconfig.json";
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

// Os módulos do núcleo que o programa tem hoje. A asserção é de PRESENÇA, não de
// igualdade: as etapas seguintes vão adicionar arquivos ao sim/, e um número exato
// aqui só treinaria a bumpar o número sem pensar — o oposto do que este teste
// serve. Remoção de qualquer um destes, ou um programa que encolhe, ainda é pego.
const KNOWN_FILES = [
  "./core/World.ts",
  "./core/tick.ts",
  "./core/rng.ts",
  "./core/determinism.test.ts",
  "./core/rng.test.ts",
  "./economy/money.ts",
  "./economy/money.test.ts",
] as const;

describe("configuração do tsconfig de src/sim/", () => {
  let sim: ResolvedConfig;
  let root: ResolvedConfig;

  beforeAll(() => {
    sim = showConfig(SIM_PROJECT);
    root = showConfig();
  });

  it("liga noUncheckedIndexedAccess no config resolvido do sim/, e só nele", () => {
    expect(sim.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    // A isenção do renderer (CLAUDE.md, Convenções de código) mora no raiz não
    // ligar a flag. Se alguém ligar lá, é decisão — mas é P-10, não acidente.
    expect(root.compilerOptions.noUncheckedIndexedAccess).toBeFalsy();
  });

  it("monta um programa com os módulos do núcleo, não um programa vazio", () => {
    expect(sim.files.length).toBeGreaterThanOrEqual(KNOWN_FILES.length);
    for (const file of KNOWN_FILES) {
      expect(sim.files).toContain(file);
    }
  });

  it("não alcança nada fora de src/sim/", () => {
    // Se o `include` explícito cair, o do raiz é herdado resolvido contra a pasta
    // do raiz e todo caminho vira "../...". É esse o modo de falha.
    expect(sim.files.filter((f) => f.startsWith("../"))).toEqual([]);
  });

  // A asserção que um programa vazio não consegue satisfazer: o erro tem que citar
  // ESTE arquivo, nesta linha. Programa vazio não reporta nada sobre ele.
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

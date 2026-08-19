import { spawnSync } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

// Guarda a Regra Inviolável nº 1 do CLAUDE.md: src/sim/ é puro.
//
// O .oxlintrc.json é a trava; este teste é a trava da trava. Sem ele, mexer num
// `pattern` do config poderia desligar a proteção em silêncio e ninguém notaria
// até o núcleo já estar sujo.
//
// ATENÇÃO: este teste escreve um arquivo temporário dentro de src/sim/. Não rode
// em paralelo com `tsc --watch`, com o dev server, nem com `pnpm typecheck` — todos
// veriam o probe. O `typecheck` entrou nessa lista na F1-E1: o
// `src/sim/tsconfig.json` (P-02) tem `include: ["**/*.ts"]`, então o probe — que é
// deliberadamente cheio de `pixi.js`, `window` e `Math.random` — passou a cair
// dentro daquele programa. Um typecheck concorrente estoura com erros que não têm
// nada a ver com o código sob teste.

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = path.join(repoRoot, "test", "fixtures", "sim-purity-violations.txt");
const PROBE_REL = "src/sim/__lint_probe.ts";
const PROBE_ABS = path.join(repoRoot, PROBE_REL);

// Shim ESM do oxlint, invocado pelo próprio node: evita depender de `pnpm exec`
// e do sufixo .cmd que o npm gera no Windows.
const OXLINT_BIN = path.join(repoRoot, "node_modules", "oxlint", "bin", "oxlint");

interface Diagnostic {
  code: string;
  message: string;
}

function lintProbe(): Diagnostic[] {
  copyFileSync(FIXTURE, PROBE_ABS);
  try {
    const result = spawnSync(
      process.execPath,
      // --no-ignore neutraliza .eslintignore e --ignore-pattern. Ele NÃO cobre o
      // .gitignore, que o oxlint sempre respeita e para o qual não existe flag de
      // escape — por isso o probe não pode estar no .gitignore (ver comentário lá).
      [OXLINT_BIN, PROBE_REL, "--no-ignore", "--format=json"],
      { cwd: repoRoot, encoding: "utf8" },
    );

    if (result.error) throw result.error;

    // O oxlint sai com código != 0 justamente por ter achado os erros que queremos.
    // O sinal de sucesso aqui é o conteúdo do stdout, não o exit code.
    try {
      return (JSON.parse(result.stdout) as { diagnostics?: Diagnostic[] }).diagnostics ?? [];
    } catch {
      // Causa mais provável: o oxlint não achou o probe (imprime "No files found
      // to lint" antes do JSON) porque alguém o pôs no .gitignore.
      throw new Error(
        `oxlint não devolveu JSON válido — o probe chegou a ser lintado?\n` +
          `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    }
  } finally {
    rmSync(PROBE_ABS, { force: true });
  }
}

describe("pureza do src/sim/", () => {
  let diagnostics: Diagnostic[];
  let rules: Set<string>;

  beforeAll(() => {
    diagnostics = lintProbe();
    // "eslint(no-restricted-imports)" → "no-restricted-imports"
    rules = new Set(diagnostics.map((d) => d.code.replace(/^.*\((.*)\)$/, "$1")));
  });

  // Se o config parar de ser aplicado, tudo abaixo passaria vazio. Esta é a âncora.
  it("o oxlint aplica o override de src/sim/ e reporta violações", () => {
    expect(diagnostics.length).toBeGreaterThanOrEqual(8);
  });

  it("barra import de renderer e de camadas de fora", () => {
    expect(rules).toContain("no-restricted-imports");

    const imports = diagnostics.filter((d) => d.code.includes("no-restricted-imports"));
    expect(imports.map((d) => d.message).join("\n")).toContain("pixi.js");
    expect(imports.map((d) => d.message).join("\n")).toContain("../render/world/camera");
  });

  it("barra globais de browser", () => {
    expect(rules).toContain("no-restricted-globals");

    const globals = diagnostics
      .filter((d) => d.code.includes("no-restricted-globals"))
      .map((d) => d.message)
      .join("\n");
    for (const name of ["window", "document", "localStorage"]) {
      expect(globals).toContain(name);
    }
  });

  it("barra fontes de não-determinismo", () => {
    expect(rules).toContain("no-restricted-properties");

    const props = diagnostics
      .filter((d) => d.code.includes("no-restricted-properties"))
      .map((d) => d.message)
      .join("\n");
    for (const call of ["Math.random", "Date.now", "performance.now"]) {
      expect(props).toContain(call);
    }
  });

  it("não deixa o probe para trás", () => {
    expect(() => rmSync(PROBE_ABS)).toThrow();
  });
});

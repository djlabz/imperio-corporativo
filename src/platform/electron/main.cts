// verbatimModuleSyntax (herdado do tsconfig raiz) só aceita import/export
// ESM em arquivo que É ESM. Em .cts (CommonJS por extensão, ver
// tsconfig.json desta pasta) o import de VALOR tem que ser `= require(...)`
// — import type continua em sintaxe ESM normal, é apagado na emissão e não
// tem formato de módulo pra desambiguar.
import electron = require("electron");
import fsPromises = require("node:fs/promises");
import fsSync = require("node:fs");
import path = require("node:path");
// Import type separado: `const { BrowserWindow } = electron` dá o valor
// (construtor) mas não deixa usar `BrowserWindow` como anotação de tipo
// nesta configuração NodeNext+CJS — TS2749 pede `typeof BrowserWindow`.
import type { BrowserWindow as ElectronBrowserWindow } from "electron";

const { app, BrowserWindow, ipcMain, Menu } = electron;
const { mkdir, readFile, readdir, rm, writeFile } = fsPromises;

/**
 * Um .exe empacotado (subsistema "windows", não "console") não tem stdout
 * visível — console.log desaparece no vácuo. Log em arquivo é o único jeito
 * de depurar o que aconteceu numa medição automatizada (Parte B da Etapa 6)
 * sem alguém sentado olhando a janela. Também funciona como rede de segurança
 * genérica: qualquer coisa que quebrar cedo demais pra alguma UI aparecer
 * ainda fica registrada.
 */
function resolveLogPath(): string {
  try {
    const dir = app.getPath("userData");
    fsSync.mkdirSync(dir, { recursive: true });
    return path.join(dir, "debug.log");
  } catch {
    return path.join(path.dirname(process.execPath), "debug.log");
  }
}

const LOG_PATH = resolveLogPath();

function log(message: string): void {
  try {
    fsSync.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Se nem isto funcionar, não há mais rede de segurança — mas não é motivo
    // pra derrubar o app por causa de log.
  }
}

process.on("uncaughtException", (error) => {
  log(`uncaughtException: ${error.stack ?? error.message}`);
});
process.on("unhandledRejection", (reason) => {
  log(
    `unhandledRejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  );
});

// Nomes de canal literais — têm que bater exatamente com preload.cts. Ver o
// comentário em preload.cts sobre por que não são importados de um arquivo
// compartilhado.
const SAVE_WRITE = "save:write";
const SAVE_READ = "save:read";
const SAVE_LIST = "save:list";
const SAVE_REMOVE = "save:remove";

/** Só [A-Za-z0-9_-]: barra path traversal via chave de save vinda por IPC. */
const SAFE_KEY = /^[A-Za-z0-9_-]+$/;

function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key)) {
    throw new Error(`Chave de save inválida: "${key}"`);
  }
}

async function getSaveDir(): Promise<string> {
  const dir = path.join(app.getPath("userData"), "saves");
  await mkdir(dir, { recursive: true });
  return dir;
}

function registerSaveHandlers(): void {
  ipcMain.handle(SAVE_WRITE, async (_event, key: string, data: Uint8Array) => {
    assertSafeKey(key);
    const dir = await getSaveDir();
    await writeFile(path.join(dir, key), data);
  });

  ipcMain.handle(SAVE_READ, async (_event, key: string) => {
    assertSafeKey(key);
    const dir = await getSaveDir();
    try {
      return await readFile(path.join(dir, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  });

  ipcMain.handle(SAVE_LIST, async () => {
    const dir = await getSaveDir();
    try {
      return await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  });

  ipcMain.handle(SAVE_REMOVE, async (_event, key: string) => {
    assertSafeKey(key);
    const dir = await getSaveDir();
    await rm(path.join(dir, key), { force: true });
  });
}

/**
 * `--bench=<N>` liga o modo de medição da Etapa 6 (validação da D-005 fora do
 * WSL): carrega o jogo com `?npcs=N`, espera `--bench-duration` ms (default
 * 20s — cobre o aquecimento de P-06, que estabiliza em 6-18s), lê
 * `window.__benchStats` (o OverlaySnapshot mais recente, exposto por
 * game.ts) e grava em disco. DevTools fica fechado neste modo: o painel
 * encolhe a área de render e mediria um viewport diferente do real.
 */
interface BenchArgs {
  readonly npcs: number;
  readonly durationMs: number;
}

const DEFAULT_BENCH_DURATION_MS = 20_000;

function parseBenchArgs(argv: readonly string[]): BenchArgs | undefined {
  const benchArg = argv.find((arg) => arg.startsWith("--bench="));
  if (!benchArg) return undefined;

  const npcs = Number(benchArg.slice("--bench=".length));
  const durationArg = argv.find((arg) => arg.startsWith("--bench-duration="));
  const durationMs = durationArg
    ? Number(durationArg.slice("--bench-duration=".length))
    : DEFAULT_BENCH_DURATION_MS;

  if (!Number.isFinite(npcs) || npcs < 0 || !Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`--bench inválido: npcs=${benchArg}, duration=${durationArg ?? "(default)"}`);
  }
  return { npcs, durationMs };
}

async function runBench(window: ElectronBrowserWindow, bench: BenchArgs): Promise<void> {
  log(`bench: carregando npcs=${bench.npcs} duration=${bench.durationMs}ms`);
  const indexPath = path.join(__dirname, "../dist/index.html");
  log(`bench: index em ${indexPath} (existe=${fsSync.existsSync(indexPath)})`);
  await window.loadFile(indexPath, { search: `npcs=${bench.npcs}` });
  log("bench: loadFile resolveu, aguardando aquecimento");

  await new Promise((resolve) => setTimeout(resolve, bench.durationMs));

  const statsJson = (await window.webContents.executeJavaScript(
    "JSON.stringify(window.__benchStats ?? null)",
  )) as string;
  log(`bench: __benchStats = ${statsJson}`);
  const stats: unknown = JSON.parse(statsJson);

  const resultDir = path.join(app.getPath("userData"), "bench-results");
  await mkdir(resultDir, { recursive: true });
  const resultPath = path.join(resultDir, `native-npcs-${bench.npcs}.json`);
  await writeFile(
    resultPath,
    JSON.stringify({ npcs: bench.npcs, durationMs: bench.durationMs, stats }, null, 2),
  );

  log(`bench: gravado em ${resultPath}`);
  app.quit();
}

async function readBenchStats(
  window: ElectronBrowserWindow,
): Promise<{ tickCount: number } | null> {
  const json = (await window.webContents.executeJavaScript(
    "JSON.stringify(window.__benchStats ?? null)",
  )) as string;
  return JSON.parse(json) as { tickCount: number } | null;
}

function sendKey(window: ElectronBrowserWindow, keyCode: string): void {
  window.webContents.sendInputEvent({ type: "keyDown", keyCode });
  window.webContents.sendInputEvent({ type: "keyUp", keyCode });
}

/**
 * `--save-load-check` valida o round-trip completo (IPC → preload →
 * ElectronSaveAdapter → filesystem real em userData) sem precisar de alguém
 * clicando na janela. Simula as teclas S/L do gatilho manual de game.ts via
 * `sendInputEvent` — mesmo caminho que um humano apertando a tecla de
 * verdade, não um atalho que pule o adapter.
 *
 * Prova observável: tickCount tem que CAIR de volta pro valor salvo depois
 * do load (não só "não lançar exceção") — só cai se o World carregado
 * substituiu mesmo o em memória, através do disco.
 */
async function runSaveLoadCheck(window: ElectronBrowserWindow): Promise<void> {
  log("save-load-check: início");
  await window.loadFile(path.join(__dirname, "../dist/index.html"));

  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const beforeSave = await readBenchStats(window);
  log(`save-load-check: antes do save, tick=${beforeSave?.tickCount}`);

  sendKey(window, "S");
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const beforeLoad = await readBenchStats(window);
  log(`save-load-check: antes do load (simulação seguiu rodando), tick=${beforeLoad?.tickCount}`);

  sendKey(window, "L");
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const rightAfterLoad = await readBenchStats(window);
  log(`save-load-check: logo após o load, tick=${rightAfterLoad?.tickCount}`);

  await new Promise((resolve) => setTimeout(resolve, 2_000));
  const afterLoadContinued = await readBenchStats(window);
  log(`save-load-check: 2s depois do load, tick=${afterLoadContinued?.tickCount}`);

  const tickJumpedBack =
    rightAfterLoad !== null &&
    beforeLoad !== null &&
    rightAfterLoad.tickCount < beforeLoad.tickCount;
  const tickResumedAfterLoad =
    afterLoadContinued !== null &&
    rightAfterLoad !== null &&
    afterLoadContinued.tickCount > rightAfterLoad.tickCount;

  const result = {
    beforeSaveTick: beforeSave?.tickCount ?? null,
    beforeLoadTick: beforeLoad?.tickCount ?? null,
    rightAfterLoadTick: rightAfterLoad?.tickCount ?? null,
    afterLoadContinuedTick: afterLoadContinued?.tickCount ?? null,
    tickJumpedBackOnLoad: tickJumpedBack,
    tickResumedAfterLoad: tickResumedAfterLoad,
    passed: tickJumpedBack && tickResumedAfterLoad,
  };

  const resultPath = path.join(app.getPath("userData"), "save-load-check.json");
  await writeFile(resultPath, JSON.stringify(result, null, 2));
  log(`save-load-check: gravado em ${resultPath} — passed=${result.passed}`);
  app.quit();
}

async function createWindow(): Promise<void> {
  log("createWindow: início");
  Menu.setApplicationMenu(null);

  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // Sem isto, o Chromium pode reduzir a cadência de rAF/timers de uma
      // janela sem foco — inaceitável pra medição de frame automatizada
      // (Parte B da Etapa 6), que roda sem interação nenhuma do usuário.
      backgroundThrottling: false,
    },
  });
  log("createWindow: BrowserWindow criado");

  // Encaminha o console do renderer pro mesmo log — sem isto, um erro do
  // Pixi (ex.: falha de init do WebGL num driver específico) desapareceria
  // tanto quanto qualquer outro console.log num .exe sem console.
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log(`renderer console[${level}] ${sourceId}:${line} — ${message}`);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    log(`did-fail-load: ${errorCode} ${errorDescription}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    log(`render-process-gone: ${JSON.stringify(details)}`);
  });

  if (process.argv.includes("--save-load-check")) {
    await runSaveLoadCheck(window);
    return;
  }

  const bench = parseBenchArgs(process.argv);
  if (bench) {
    await runBench(window, bench);
    return;
  }

  // DevTools aberto por padrão: este é um build de validação da Etapa 6, não
  // o build de distribuição (fora de escopo — ver CLAUDE.md/DECISOES.md).
  // Ajuda a ver o console de save/load manual (teclas S/L, ver game.ts).
  window.webContents.openDevTools();
  await window.loadFile(path.join(__dirname, "../dist/index.html"));
  log("createWindow: modo interativo carregado");
}

registerSaveHandlers();
log(`main: script carregado, argv=${JSON.stringify(process.argv)}`);

app.whenReady().then(() => {
  log("app: whenReady");
  void createWindow().catch((error: unknown) => {
    log(
      `createWindow falhou: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

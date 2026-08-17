/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  // Etapa 6: main.cts carrega dist/index.html via `file://` (loadFile), não
  // http. O default do Vite (`base: "/"`) emite asset em caminho absoluto
  // (`/assets/...`), que sob file:// resolve pra raiz do filesystem, não pra
  // pasta do index.html — o bundle inteiro falha em carregar, em silêncio (a
  // falha de rede num script tag não passa pelo forwarding de console-message
  // de main.cts). `base: "./"` emite relativo, funciona nos dois protocolos.
  base: "./",
  test: {
    // Fase 0 testa só núcleo puro e o probe de lint — nada precisa de DOM.
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
  },
});

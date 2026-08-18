# Retrospectiva — Fase 0 (spike técnico)

Fase 0 fechada em 17/08/2026, Etapas 1–6. Este documento não repete o que já
está em `DECISOES.md` — registra o que **sobrevive** daqui pra frente: os
números que toda regressão futura se compara contra, o inventário do que está
automatizado (e onde cada trava para de proteger), as armadilhas de ambiente
que não valem a pena redescobrir, e os bugs reais que o processo pegou —
incluindo do lado de quem dava a instrução.

---

## 1. Linha de base de performance (nativo, fora do WSL)

Medida no `.exe` (`electron-builder --win --dir`) rodando via `Start-Process`
fora do WSL — não WSLg, não ANGLE/D3D12. Ver adendo de D-005 em
`DECISOES.md` para a comparação completa com os números do WSL/Etapa 4.

| N    | trabalho CPU (update+render) | ocupação (orçamento 60fps) | draw calls | heap JS |
| ---- | ---------------------------- | -------------------------- | ---------- | ------- |
| 0    | 0,80ms                       | 4,8%                       | 1          | 10,68MB |
| 500  | 1,10ms                       | 6,6%                       | 1          | 10,68MB |
| 1000 | 1,30ms                       | 7,8%                       | 1          | 12,78MB |
| 2000 | 1,90ms                       | 11,4%                      | 1          | 17,36MB |
| 4000 | 2,20ms                       | 13,2%                      | 1          | 14,50MB |

- **Custo marginal por NPC:** ~0,00015–0,0006ms/NPC através da faixa 0–4000
  (WSL tinha medido 0,0006–0,00095ms/NPC no mesmo teste — nativo é igual ou
  mais rápido em todo ponto, com a vantagem crescendo com N).
- **Backend:** `webgl` em todo N. Draw calls fixo em 1 — o critério de "atlas
  único" da Regra de Performance está sendo cumprido de verdade, medido, não
  só por design.
- **Heap não é confiável como tendência** — é amostra de um único frame no
  instante da leitura (ver limite do harness abaixo), e o ruído de GC faz
  N=4000 aparecer mais baixo que N=2000. Ocupação e trabalho de CPU vieram de
  uma tendência limpa e monótona; heap não.
- **P-06 (surto de aquecimento) não reproduziu nativamente** até N=4000 —
  `framesOver20ms` ficou em 1–2 de ~2850 frames totais em todo N testado,
  contra 26 (N=2000) e 160 (N=4000) medidos no WSL.

**Limite honesto, pra não confiar demais nestes números:** `updateMs`,
`renderMs`, `heapMB` e `budgetOccupancyPercent` vêm de uma leitura pontual de
`window.__benchStats` no fim da janela de medição, não uma média — mais
ruidoso que a metodologia de mediana-de-500-amostras usada em
`app/frame.perf.test.ts` e `src/render/npc/npcPool.perf.test.ts`. `fps`,
`low1PercentFps`, `framesOver20ms` e `framesOver33ms` são agregados de
verdade (janela deslizante ou contador cumulativo) — são os números em que
mais confiar desta bateria. Suficiente para o veredito de D-005 (a diferença
nativo-vs-WSL é grande o bastante pra sobreviver ao ruído); não seria
suficiente pra decisões de calibração fina.

**Para o que serve:** qualquer regressão de performance daqui pra frente se
compara contra esta tabela, não contra os números do WSL (que tinham overhead
de ambiente que o jogo de verdade não paga) nem contra intuição. Se uma
mudança futura fizer N=500 passar de ~6,6% de ocupação pra, digamos, 15%, isso
é sinal real — não é preciso re-derivar o que é "normal" do zero.

---

## 2. Inventário de defesas automatizadas

Cada linha: o que a trava pega, e — o que importa mais — **o que ela não
pega**. Uma trava cujo limite não está escrito em algum lugar é uma trava que
alguém vai confiar além da conta mais cedo ou mais tarde.

| Defesa                                                                                             | Onde                  | Pega                                                                                                                                                                                                                    | Não pega                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| oxlint `no-restricted-imports`/`no-restricted-globals`/`no-restricted-properties` (`src/sim/**`)   | `.oxlintrc.json`      | Import de Pixi/React/render/ui/platform/app dentro de `sim/`; uso de `window`/`document`/`localStorage`/`sessionStorage`/`fetch`/`navigator`; `Math.random`/`Date.now`/`performance.now` como member expression literal | Desestruturação (`const { random } = Math`), acesso por string (`Math["random"]`), instância em vez de estático (`new Date().getTime()`), global alcançado por outro objeto (`globalThis.window`). A rede de segurança de baixo é o teste de determinismo — a de cima é o lint                                                |
| Teste de determinismo (`src/sim/core/determinism.test.ts`)                                         | suíte                 | Qualquer não-determinismo que produza estado final diferente pra mesma seed + mesma sequência de input                                                                                                                  | **Correção.** Determinismo não é corretude — um bug computado de forma consistentemente errada passa limpo. Também não cobre RNG consumido dentro de `tick()` ainda (P-01), porque nenhum sistema do `sim/` consome hoje                                                                                                      |
| `Money`/`Bps` como branded number (`src/sim/economy/money.ts`)                                     | tipo                  | Passar `number` cru como argumento onde se espera `Money`/`Bps`; atribuir `number` cru a variável desses tipos                                                                                                          | `money + 5`, `moneyA - moneyB` crus — o operador `+`/`-`/`*` do TS só exige que os operandos sejam atribuíveis a `number`, e um branded number é um number. Aritmética direta computa o valor certo mas escapa da validação de inteiro/teto. Sempre `add()`/`sub()`/`mul()`/`applyRate()` (D-009)                             |
| `z.int()` no schema de save (`worldSchema.ts`)                                                     | validação ao carregar | `NaN` e `Infinity` em campo numérico de save adulterado — `z.int()` exclui os dois por construção                                                                                                                       | Se algum campo numérico futuro trocar `z.int()` por `z.number()` "por engano", a guarda some em silêncio — não há teste hoje que baste um `z.number()` solto pra acusar                                                                                                                                                       |
| `test/sim-purity.test.ts` (controle negativo)                                                      | suíte                 | Se o override do oxlint pra `src/sim/**` realmente está ligado — planta violação, confirma que acusa; planta a mesma violação em `src/render/` (controle negativo), confirma que NÃO acusa lá                           | Violações fora dos padrões literais enumerados (mesmo limite do oxlint acima)                                                                                                                                                                                                                                                 |
| Mutação obrigatória em teste novo (D-011)                                                          | disciplina, não CI    | Teste que passaria com a implementação quebrada (falsa confiança)                                                                                                                                                       | É prática manual, rodada uma vez por teste novo — não há automação que force isso a acontecer; depende de lembrar                                                                                                                                                                                                             |
| `FRAME_BUDGET_MS` calibrado + mediana de N amostras (`frame.perf.test.ts`, `npcPool.perf.test.ts`) | suíte                 | Regressão de ORDEM DE GRANDEZA no custo medido do caminho quente, calibrada em medição real (nativo pro NPC, ver seção 1)                                                                                               | Não garante pegar uma regressão de exatamente 10x com certeza (documentado no cabeçalho de `npcPool.perf.test.ts` — "margem generosa" e "sensível a exatamente 10x" puxam em direções opostas por construção). Também não pega mudança de classe de complexidade (O(n)→O(n²)) — isso é o teste de escala multi-N, hoje manual |
| HMAC-SHA256 no pipeline de save                                                                    | `pipeline.ts`         | Edição casual de save (abrir no editor de texto, mudar um número)                                                                                                                                                       | Segurança de verdade — a chave está na máquina do jogador. O objetivo é atrito, não é, e nunca foi pra ser, inviolável (ver Save game no CLAUDE.md)                                                                                                                                                                           |
| `fake-indexeddb` (`IndexedDbSaveAdapter.test.ts`)                                                  | suíte                 | Cobertura real do contrato da IndexedDB API (write/read/list/remove, sobrescrita, chave ausente)                                                                                                                        | Quirks de browser real — é uma implementação em memória que aproxima a API, não o IndexedDB de um Chrome de verdade                                                                                                                                                                                                           |
| `tsc --strict` (typecheck)                                                                         | `pnpm typecheck`      | Erros de tipo em geral                                                                                                                                                                                                  | `noUncheckedIndexedAccess` está **desligado** em todo o projeto ainda (P-02) — acesso indexado (`array[i]`) não é forçado a `T \| undefined` fora dos poucos lugares com checagem manual explícita (ex.: `pick()` em `rng.ts`)                                                                                                |

---

## 3. Armadilhas de ambiente consolidadas

Já estão detalhadas no CLAUDE.md ("Armadilhas conhecidas do ambiente"); aqui
é só o índice, pra saber que existem sem reabrir o arquivo inteiro:

1. **`Uint8Array` cru não serve como `BufferSource` do Web Crypto** — desde
   TS 5.7 (confirmado em TS 7.0.2 deste projeto), precisa de
   `type Bytes = Uint8Array<ArrayBuffer>` nas assinaturas que tocam
   `crypto.subtle`.
2. **Fake timers do Vitest não aceleram `crypto.subtle`** — PBKDF2 roda no
   thread pool real do Node via libuv, não como microtask. Testa-se o
   agendamento com uma função rápida injetada, não o tempo real do PBKDF2.
3. **`NaN`/`Infinity` sobrevivem ao MessagePack sem guarda nenhuma** —
   `z.int()` exclui os dois por construção; `z.number()` sozinho não.
4. **Vite emite asset em caminho absoluto por padrão** — quebra em silêncio
   sob `file://` (`BrowserWindow.loadFile`). `base: "./"` resolve nos dois
   protocolos.
5. **`tsconfig` com `extends` herda o `exclude` do pai** — um subprojeto que
   precisa compilar exatamente o que o pai exclui precisa de
   `"exclude": []` explícito, senão compila um programa vazio em silêncio.
6. **Main/preload do Electron como `.cts`, não `.ts`** — projeto ESM,
   processo main roda CommonJS de fato. Precisa de `module`/`moduleResolution`
   em `NodeNext` (o `Node10` clássico foi removido no TS 7), e
   `verbatimModuleSyntax` exige `import x = require("y")` pra import de valor
   (`import type` continua em sintaxe normal).
7. **`.exe` empacotado (subsistema "windows") não tem console** —
   `console.log` do processo main desaparece. Log em arquivo é a única saída
   confiável.
8. **WSL2 (`/mnt/c/...`) pode mostrar visão desatualizada de arquivo escrito
   por processo Windows nativo** — cache de metadata do DrvFs. Ler de dentro
   do Windows (`powershell.exe`/`cmd.exe`) é confiável; `/mnt/c` do lado WSL,
   logo após a escrita, não é.

---

## 4. Bugs que a Fase 0 pegou — e do lado de quem

A lição de fundo, formulada em D-011: **num projeto onde a defesa é
automatizada, o modo de falha dominante não é a trava errada — é a trava que
não rodou.** Isso vale tanto pro código quanto pra instrução que pede o
código. Os três casos abaixo são erros **de instrução**, não de
implementação — o processo (testar antes de confiar, verificar em vez de
assumir) pegou os dois lados.

**Erros de instrução:**

1. **Branded type "barra" `money + 5`** (D-009) — a instrução original
   afirmava que o branded type de `Money` impedia aritmética crua com o
   operador `+`. Falso: o operador só exige que os operandos sejam
   atribuíveis a `number`. Descoberto testando antes de implementar, não
   depois. A alternativa cogitada (objeto opaco `{ value, brand }`) teria
   trocado um bug ruidoso por um silencioso — `a > b` compilaria, rodaria, e
   devolveria sempre `false`.
2. **Teste de determinismo pedido antes de existir o que determinar** — o
   `tick()` da Etapa em que o teste foi escrito ainda era trivial o
   suficiente pra duas seeds baterem por tautologia, não por determinismo de
   verdade. A mutação (D-011) expôs isso: um teste de determinismo que passa
   mesmo sem nenhum estado real mudando não está testando nada.
3. **Instrução de fechar P-03 e P-04 juntas** (nesta Etapa 6) — a instrução
   pediu pra marcar as duas pendências como resolvidas na Etapa 4. Só P-04
   estava. P-03 (teste de orçamento de frame específico pro pool de NPC)
   nunca foi escrito — os números de escala da Etapa 4 saíram de medição
   manual no browser, e o próprio `frame.perf.test.ts` documentava a lacuna
   no seu cabeçalho desde aquela etapa. Pego verificando a alegação contra o
   código antes de editar a tabela, não confiando na instrução.

**Bugs reais, não de instrução:**

| Bug                                                                                                                         | Como apareceu                                                                                                                    | Pego por                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `applyRate` perdia precisão em valores grandes (`money * bps` estourava `Number.MAX_SAFE_INTEGER` no intermediário)         | Revisão de código + fuzz com BigInt como oráculo independente                                                                    | Comparação exaustiva contra BigInt, não inspeção visual                                                                              |
| Fuzz de `applyRate` usava `Math.random()` — irreproduzível por construção e violava a trava de D-006                        | Revisão desta etapa                                                                                                              | Trocado por seeds literais; mensagem de falha carrega o caso exato                                                                   |
| Flow field original (redemoinho) deixava a câmera padrão sem ver nenhum NPC                                                 | Observado no browser — nenhum teste unitário acusava, porque todos validavam geometria do campo, não "aparece na câmera default" | Teste novo simulando o passeio de ponta a ponta, depois do fato                                                                      |
| Lint vermelho (`Math.random()` em `money.test.ts`) sobreviveu a dois relatórios de etapa dizendo "0 diagnósticos"           | oxlint 1.78 não imprime nada quando está limpo — indistinguível de "não rodou"                                                   | Rodar o comando de verdade nesta etapa, e depois provar com um probe plantado que o silêncio é mesmo "limpo", não "não executou"     |
| Subprojeto do Electron compilava programa vazio                                                                             | `extends` herdando `exclude` do tsconfig raiz                                                                                    | Rodar o build de verdade e ver `dist-electron/` sem os `.cjs` — não confiar no typecheck limpo sozinho                               |
| Bundle do jogo nunca carregava no `.exe`, sem erro visível em lugar nenhum                                                  | `base: "/"` do Vite resolvendo pra raiz do filesystem sob `file://`                                                              | Log em arquivo no processo main + desconfiar especificamente do HTML gerado                                                          |
| `randomEdgePoint()` aloca um objeto por respawn — candidata não confirmada pro surto de frames longos no aquecimento (P-06) | Contador de frames longos (Etapa 3) aplicado ao teste de escala da Etapa 4                                                       | Instrumentação que mede, não front-of-mind — não foi "corrigido" de propósito, por não haver profiler provando gargalo real em N=500 |

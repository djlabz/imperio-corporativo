# CLAUDE.md — Simulador de Império Corporativo

Regras permanentes deste projeto. Leia antes de qualquer alteração.

---

## O que é este projeto

Jogo de gerenciamento empresarial (tycoon) em TypeScript, renderizado com PixiJS,
empacotado com Electron para publicação na Steam.

O jogador começa minerando sozinho, escala para uma operação industrial, e é
forçado a abrir uma sede administrativa quando a carga tributária começa a
devorar o lucro. A tensão central do jogo é **folha de pagamento × carga
tributária**: contadores reduzem imposto, mas custam salário.

Estamos na **Fase 0 (spike técnico)**. Não escreva conteúdo de jogo ainda.

---

## Regras invioláveis

### 1. `src/sim/` é puro

O núcleo de simulação **não conhece o renderer**. Dentro de `src/sim/`:

- ❌ Nenhum import de `pixi.js`, `react`, ou qualquer coisa de UI
- ❌ Nenhum uso de `window`, `document`, `localStorage`, `fetch`
- ❌ Nenhum `Math.random()` — toda aleatoriedade sai do PRNG com seed
- ❌ Nenhum `Date.now()` / `performance.now()` — tempo vem do contador de ticks
- ✅ Funções puras: `tick(world: World): World`
- ✅ Todo o estado precisa ser serializável (sem classes com métodos, sem Map de
  objetos com referência circular, sem funções no estado)

**Motivo:** isso permite testar a economia no vitest, rodar a simulação em Web
Worker, e reaproveitar o núcleo num servidor Node se o multiplayer for feito.
Se você quebrar essa regra, o projeto perde essas três coisas de uma vez.

**Essas restrições são automatizadas pelo oxlint** via `overrides` em
`.oxlintrc.json` para o glob `src/sim/**`. Se o lint reclamar, a regra está
funcionando — não desabilite, corrija o código. Se você acha que precisa de uma
exceção, pare e pergunte.

### 2. Dinheiro é inteiro, em centavos

```ts
type Money = number;   // SEMPRE centavos, SEMPRE inteiro
type Bps   = number;   // basis points. 1 bp = 0,01%. 10_000 bps = 100%
```

- ❌ `saldo += lucro * 0.15` — nunca. Float acumula erro.
- ✅ `saldo += applyRate(lucro, 1500)`
- Toda operação que possa gerar fração usa `Math.floor` explicitamente
- Percentuais são `Bps` inteiros, nunca `0.15`

`Money` é um branded type (`number & { brand }`), construído só via `centavos()` /
`reais()`. Isso barra dois erros reais: passar um `number` cru como argumento
onde a função espera `Money`, e atribuir um `number` cru a uma variável `Money`
— ambos viram erro de tipo. **Não barra** `money + 5` ou `moneyA - moneyB`
crus: o operador `+`/`-`/`*` do TypeScript só exige que os operandos sejam
atribuíveis a `number`, e um branded number é um `number`. Aritmética direta
ainda computa o valor numérico correto — só escapa da validação de inteiro e
do teto de `Number.MAX_SAFE_INTEGER` que `centavos()` faz. Por isso: sempre
`add()` / `sub()` / `mul()` / `applyRate()`, nunca o operador cru.

### 3. Passo fixo, nunca deltaTime

A simulação avança em ticks de duração fixa (`TICK_MS = 100`). O acumulador fica
no loop de render. `deltaTime` só interpola o **visual**, nunca multiplica valor
de jogo.

Multiplicar receita por deltaTime faz o jogador ganhar mais dinheiro num PC ruim.

### 4. Balanceamento vive em JSON

Nenhum número de balanceamento hardcoded no código. Tudo em `src/sim/data/*.json`,
validado com `zod` no carregamento. Esses valores serão ajustados centenas de vezes.

### 5. Determinismo

Mesma seed + mesma sequência de inputs = mesmo estado final. Sempre.
Existe um teste que valida isso; não o desabilite.

---

## Arquitetura

```
src/
├── sim/                  # núcleo puro (regras acima)
│   ├── core/             # World, tick, rng, tempo
│   ├── economy/          # money, mining, market, taxes, payroll
│   ├── city/             # marcos de desbloqueio
│   └── data/             # JSON de balanceamento
├── render/               # só LÊ World, nunca escreve
│   ├── world/            # mapa top-down, tiles, prédios
│   ├── hq/               # escritório em grid
│   └── npc/              # pool de NPCs decorativos
├── ui/                   # React sobre o canvas (HUD, menus, contabilidade)
├── platform/             # save, IPC do Electron, Steamworks
└── app/                  # loop principal, orquestração
```

**Fluxo de dados:** `input → sim → World → render`. Uma direção só.
`render/` e `ui/` nunca mutam o `World` diretamente — emitem intenções que o
`sim/` processa no próximo tick.

---

## Stack

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript, `strict: true`, sem `any` |
| Gerenciador | **pnpm** (não npm, não bun — ver nota abaixo) |
| Build | Vite |
| Renderer | PixiJS v8 (init assíncrono: `await app.init()`) |
| UI | React, em DOM sobre o canvas |
| Testes | Vitest |
| Lint | **oxlint** (não ESLint) |
| Formatação | Prettier |
| Save | `@msgpack/msgpack` + `fflate` + `zod` |
| RNG | `seedrandom` |
| Desktop | Electron + electron-builder |

**Nota sobre gerenciador de pacotes:** pnpm pelo store com hardlinks (economia de
disco e velocidade). **Obrigatório** ter na raiz um `.npmrc` com:

```
node-linker=hoisted
```

Sem isso, o pnpm monta `node_modules` com symlinks, e módulo nativo
(`steamworks.js`) + electron-builder esperam o layout achatado. Com o linker
hoisted o layout fica igual ao do npm e o problema some.

npm também funciona sem nenhum ajuste, se preferir. Bun **não** é recomendado
aqui: ele bloqueia postinstall por padrão e o pacote `electron` depende do
postinstall pra extrair o binário do Chromium.

**Nota sobre lint:** oxlint não faz regras type-aware sem o pacote
`oxlint-tsgolint` (ainda em preview). Não precisamos delas — segurança de tipo
vem do `tsc --noEmit` com `strict`. Não instale `oxlint-tsgolint`.

**Não adicione dependências sem justificar.** Especialmente: não traga engine de
física, não traga ECS, não traga state manager global. Não precisamos.

**Decisão de engine (16/08/2026):** Godot foi avaliado e descartado. Mantemos a
stack web (TypeScript + PixiJS + Electron). O risco assumido é GC/engasgo de
frame; a Etapa 4 (500 NPCs a 60fps) é o teste que valida ou invalida essa
decisão. Decisão registrada não se rediscute por impulso.

---

## Perspectiva e arte

- **Top-down achatado.** Não é isométrico. Não é 3D.
- Tile: **64 × 48 px** no espaço lógico
- Espaço lógico do jogo: **1920 × 1080**; assets exportados em 2×
- Ordenação de profundidade: por coordenada Y
- Estilo: cartoon vetorial, contorno preto de **4 px**, cores chapadas, sem gradiente
- Sombra: elipse preta chapada, 20% de opacidade
- Variação de NPC via `sprite.tint` e `scale.y` — nunca sprites separados

Paleta travada (não invente cores novas):
```
#1A1A1A #F5EDD8
#A31E14 #C42B1E #E8452F
#D9631A #F07A20 #FF9A3C
#FFD23F #FCEE8A
#6FD8E8 #2B6CB0
#2E7D32 #4CAF50
#5C3A1E #8B5A2B
#E86BA0
#3D3D3D #7A7A7A
#F2C79B #D89B6A #8C5A3C
```

---

## Performance

Alvo: **60fps com 500 NPCs na tela**.

Regras:
- **Object pooling obrigatório** para NPCs. Nunca `new` / destruir em runtime.
  Pressão de GC é a causa nº1 de engasgo em JS.
- Atlas único → 1 draw call
- Pathfinding de NPC por **flow field**, nunca A* individual
- Consultas espaciais por **spatial hash grid**, nunca O(n²)
- Culling do que está fora da tela; LOD de tick para o que está longe

**Não pré-otimize.** Nada de WASM, Rust ou AssemblyScript sem que o profiler
prove um gargalo real. O gargalo esperado é GC e render, não aritmética.

---

## Save game

Pipeline: `estado → MessagePack → fflate → ofuscação XOR → HMAC-SHA256`

Obrigatório desde o primeiro save:
- Campo `version` + funções de migração `v1→v2→v3`
- Validação com `zod` ao carregar — save inválido dá erro claro, nunca crash silencioso
- Backup rotativo dos 3 últimos autosaves
- Acesso a disco fica atrás de uma interface `SaveAdapter`, para trocar entre
  browser e Electron sem tocar no resto

Save local **não pode ser realmente seguro** — a chave está na máquina do jogador.
O objetivo é atrito contra edição casual, nada além disso.

---

## Convenções de código

- Identificadores e nomes de arquivo em **inglês**; comentários e commits em pt-BR
- Um arquivo por conceito. Se passar de ~250 linhas, provavelmente tem dois conceitos ali
- Testes junto do código: `taxes.ts` → `taxes.test.ts`
- Nada de comentário explicando o óbvio; comente o **porquê**, não o **o quê**
- Commits pequenos e atômicos
- Parâmetro não usado prefixado com `_` (`_dt`, `_index`) — é o escape hatch do
  TypeScript para `noUnusedParameters`, que fica ligado
- `noUncheckedIndexedAccess` fica **desligado** na Fase 0 — o código de grid e flow field
  (Etapas 3 e 4) é acesso indexado denso, e a flag ali vira atrito puro. **Ligar em
  `src/sim/` assim que a Fase 1 começar**, via `src/sim/tsconfig.json` próprio
  (`"extends": "../../tsconfig.json"` + `"noUncheckedIndexedAccess": true`), com o script
  `typecheck` passando a rodar os dois projetos. O núcleo é onde erro de índice vira bug
  de economia silencioso; o renderer aguenta ficar sem.

---

## Como trabalhar comigo

- **Uma etapa por vez.** Termine, mostre, espere retorno antes da próxima.
- Se algo neste documento conflitar com o que eu pedir no chat, **me avise** antes
  de seguir. Não assuma qual dos dois vence.
- Se precisar violar uma regra invioláve, pare e pergunte. Não contorne em silêncio.
- Quando terminar uma etapa, diga explicitamente o que foi feito e o que ficou
  pendente.
- Ao fim de cada etapa: commit **e** push. Não deixe trabalho só no local.

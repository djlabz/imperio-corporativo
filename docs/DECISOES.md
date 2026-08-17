# Log de Decisões — Simulador de Império Corporativo

Registro do **porquê** das decisões, não do **quê**. O `CLAUDE.md` diz as regras;
este arquivo diz por que elas existem.

Ordem cronológica. Decisão registrada não se rediscute por impulso — mas pode ser
revista com motivo novo, e nesse caso a revisão entra aqui, não substitui o
original.

---

## D-001 · Escopo cortado antes de começar
**16/08/2026 · Fechada**

O documento de design original continha, na prática, quatro jogos: construtor de
escritório 2D, mundo aberto 3D procedural, simulação econômica com NPCs
consumidores, e multiplayer coop **e** competitivo, multiplicado por cinco ramos
de negócio. Escopo de estúdio com 8–15 pessoas por 3 anos.

Cortes aceitos:

| Corte | O que se ganha |
|---|---|
| 3D real → top-down 2D achatado | Sem modelagem, rigging, câmera 3D, iluminação |
| Multiplayer → pós-lançamento | Sem servidor, netcode, matchmaking, anti-cheat, infra recorrente |
| 5 ramos → 1 no lançamento | Os outros viram updates gratuitos (bom pro algoritmo da Steam) |
| Prefeitura por IA → por marcos | 90% da sensação, 10% do trabalho |
| Escritório encaixe livre → grid | Encaixe livre é problema chato de UX e algoritmo |

Resultado: de "impossível solo" para ~12–15 meses em tempo parcial.

**Motivo de fundo:** a referência que inspirou o projeto (*Messenger*, da Abeto) é
um jogo com 5 quests e 5 NPCs, feito por dois devs profissionais, que virou
notícia mundial. Escopo minúsculo bem executado ganha de escopo gigante mal
executado.

---

## D-002 · Direção visual: cartoon vetorial, não pixel art
**16/08/2026 · Fechada**

O design original pedia pixel art 8/16-bit. As referências visuais fornecidas
mostravam outra coisa: contorno preto grosso e uniforme, cores chapadas
saturadas, formas propositalmente toscas, zero gradiente ou textura. Linhagem
Flash/Newgrounds — família do *Castle Crashers*, não do *Stardew Valley*.

**Por que é a escolha certa para este dev:** pixel art exige grid rígido, paleta
disciplinada e colocação pixel a pixel — é técnica que se estuda. Neste estilo a
imperfeição é a assinatura. É a estética mais viável para quem não tem formação
em arte.

Ganhos colaterais:
- Independente de resolução (vetor → export 2×, nunca borra em 4K)
- Recolorir NPC via `sprite.tint` parece **intencional**, não gambiarra
- **Animação cutout** em vez de frame a frame: peças separadas rotacionando em
  hierarquia de `Container`. Walk cycle em ~20 linhas em vez de 8 desenhos por
  direção por personagem. Multiplica a produção de arte por ~5.

Ferramentas: Figma / Inkscape / Krita. **Aseprite não serve** — era para pixel art.

Sem filtro de CRT/scanline — o grão nas imagens de referência era artefato de
foto de monitor, não estilo pretendido.

---

## D-003 · Perspectiva: top-down achatado
**16/08/2026 · Fechada**

Descartados: isométrico (contorno grosso em iso dá muito mais trabalho de
desenhar, e exige múltiplos ângulos por prédio) e palco em planos empilhados
(bonito, mas não escala para mapa que cresce — serve para a Sede, não para o
mundo).

Implicações técnicas: grid retangular 64×48, ordenação de profundidade só por Y,
cada prédio desenhado uma única vez sem rotação.

---

## D-004 · Vertical slice: Mineração
**16/08/2026 · Fechada**

Entre mineração, restaurante e logística, mineração é a única que **vende para o
mercado atacadista em vez de para o NPC**. Isso permite adiar o subsistema inteiro
de demanda local, reputação e NPC consumidor — que é o mais difícil de balancear.

O núcleo é testado com **uma variável só**: o preço do minério.

E encaixa na fantasia central: começar com a picareta na mão, sozinho.

**Critério de sucesso do slice:** jogar 20 minutos e querer continuar. Nada mais.

**O passo que importa:** o primeiro imposto tem que doer. Se o jogador passar
batido por ele, o slice falhou e se reescreve antes de adicionar conteúdo.

---

## D-005 · Engine: stack web (PixiJS + Electron), Godot descartada
**16/08/2026 · Fechada, com risco assumido**

Godot foi avaliada seriamente após questionamento externo. **Para um jogo 2D
genérico na Steam, Godot é a resposta correta.** A avaliação honesta ficou em
~55/45 pró-Godot.

Onde Godot ganhava: GC/engasgo de frame, ferramental incluso (tilemap editor,
Y-sort nativo, câmera, animação), GodotSteam mais robusto que `steamworks.js`,
footprint (~70MB vs 150MB+), portabilidade para console.

Onde a stack web ganhou:
1. **A UI deste jogo.** Tabela de contabilidade, folha de pagamento,
   decomposição tributária, construtor de escritório em grid — facilmente 40% do
   jogo. `Control` nodes fazem, mas tabela de dados densa é mais trabalhosa que
   HTML/CSS.
2. **Velocidade do dev.** Expertise real em TS/React; GDScript custaria 2–3
   semanas até produtividade.
3. **Assistência de IA.** Projeto solo de 12 meses com Claude Code; a qualidade
   em TS é mensuravelmente melhor que em GDScript.

**Risco assumido:** GC e engasgo de frame. Boa parte do plano de performance
(object pooling obrigatório, TypedArrays, nunca instanciar em runtime) é
mitigação da própria plataforma.

**Condição de reabertura:** a Etapa 4 (500 NPCs a 60fps) é o teste que valida ou
invalida esta decisão. Se não fechar com folga, a decisão volta à mesa — não é
para otimizar de teimoso até o número fechar.

O spike comparativo em Godot foi oferecido e recusado. O risco é conhecido e
aceito.

**Adendo · 17/08/2026 · D-005 não fica validada na Etapa 4**

A Etapa 4 mediu 500–4000 NPCs em vsync: orçamento de frame escala linear com a
contagem de NPC (custo marginal ~0,0006–0,00095ms/NPC, estável através de uma
faixa de 8×, sem sinal de O(n²)), draw calls ficam em 1 mesmo em 4000 NPCs, e
o estado estacionário pós-aquecimento sustenta 60fps/60 de 1% low de forma
limpa. Números bons — mas medidos através de ANGLE/D3D12, a camada de
passthrough de GPU do WSL2, não o ambiente alvo (Windows nativo via Electron).
Essa camada tem overhead que o build real não paga; a leitura de "piso
conservador" é provavelmente correta, mas é uma leitura, não uma medição no
ambiente que importa.

**Consequência:** a condição de reabertura desta decisão ("a Etapa 4 é o teste
que valida ou invalida") não está satisfeita ainda. **A validação real de
D-005 fica para a Etapa 6**, quando o `.exe` roda nativo no Windows. Até lá,
D-005 permanece com risco assumido, não risco medido no ambiente de verdade.

---

## D-006 · Núcleo de simulação puro e headless
**16/08/2026 · Fechada**

`src/sim/` não conhece renderer, DOM, disco, nem tempo real. Funções puras, todo
estado serializável, aleatoriedade só via PRNG com seed, tempo só via contador de
ticks.

Compra três coisas de uma vez:
1. Economia testável no vitest (sem isso, balancear é chute)
2. Simulação em Web Worker sem engasgar o render
3. Núcleo reaproveitável em servidor Node se o multiplayer vier

**Automatizado, não confiado à memória:** override do oxlint no glob `src/sim/**`
barrando imports de Pixi/React, imports relativos para `render`/`ui`/`platform`/
`app`, globais de browser, e `Math.random` / `Date.now` / `performance.now`.

Validado por teste permanente com controle negativo (mesmas violações em
`src/render/` dão exit 0) e teste de mutação.

---

## D-007 · Gerenciador de pacotes: pnpm com linker hoisted
**16/08/2026 · Fechada · baixo impacto**

pnpm pelo store com hardlinks. **Obrigatório** `node-linker=hoisted` no `.npmrc`:
módulo nativo (`steamworks.js`) e electron-builder esperam layout achatado.

Bun descartado: bloqueia postinstall por padrão, e o pacote `electron` depende do
postinstall para extrair o binário do Chromium.

npm funcionaria sem ajuste nenhum. Decisão de baixo impacto — não vale reabrir.

Também: `save-exact=true`. Versões pinadas sem `^`, atualização é ato deliberado.

---

## D-008 · Lint: oxlint, não ESLint
**16/08/2026 · Fechada**

Escolhido por ter `no-restricted-imports` nativo com `overrides` por glob — a
regra que sustenta D-006. Velocidade (binário Rust) foi bônus, não motivo.

Duas pegadinhas descobertas na doc durante a implementação: a categoria
`restriction` **não** liga por default (as regras precisam ser declaradas
explicitamente com `"error"`), e declarar `plugins` **sobrescreve** o set padrão.

`env: { browser: true }` no root é necessário para `no-restricted-globals`
enxergar `window`/`document`.

Sem `oxlint-tsgolint` — regras type-aware não são necessárias; segurança de tipo
vem do `tsc --noEmit` com `strict`.

**Efeito colateral favorável:** o TypeScript 7.0 (GA em 08/07/2026) não tem API
programática estável até o 7.1, o que bloqueia typescript-eslint, ts-jest,
ts-morph e os type-checkers de Vue/Svelte/Astro. A escolha do oxlint + vitest
passou ao lado de toda essa lista por acidente.

---

## D-009 · `Money` como branded number, não objeto opaco
**16/08/2026 · Fechada · corrigiu erro de instrução**

Dinheiro é **inteiro em centavos**. Percentuais em basis points inteiros.

`type Money = number & { readonly [brand]: true }`.

**A instrução original estava errada:** afirmei que o branded type barra
`money + 5`. Não barra — o operador `+` do TypeScript só exige operandos
atribuíveis a `number`, e um branded number é um number. Descoberto ao testar
antes de implementar.

A alternativa (objeto opaco `{ value, brand }`) barra `+` de verdade, mas cria
buraco pior: `a > b` compila, roda, e retorna **sempre `false`** — compara
`"[object Object]"` com `"[object Object]"`. Sem erro, sem warning, sem quebrar
teste óbvio.

**Trocaria bug ruidoso por bug silencioso**, num sistema onde comparação é
operação constante ("tenho saldo?", "o lucro cobriu o custo?"). Além de quebrar a
serialização direta em MessagePack, que sustenta save, determinismo e Web Worker.

**Limite da trava, registrado:** barra construção e passagem de argumento. **Não**
barra `+`, `-`, `*` cru. Aritmética direta computa valor correto mas escapa da
validação de inteiro e de teto. Sempre use os helpers.

Teto: `Number.MAX_SAFE_INTEGER` centavos ≈ **R$ 90 trilhões**. Balanceamento
projetado para caber aí. `break_infinity.js` só se o design exigir escala
exponencial infinita.

---

## D-010 · Skills: nada até a Fase 1
**16/08/2026 · Fechada**

Na Fase 0 não se instala skill nenhuma. O prompt de implementação já é um plano
escrito à mão com escopo e critérios de aceite — cadeia de planejamento por cima
disso só cria conflito.

**A partir da Fase 1:** `brainstorming` + `writing-plans` (Superpowers). É quando
o trabalho muda de "executar checklist" para "projetar feature sem spec".

**Deliberadamente fora:** `subagent-driven-development` e os gates de TDD da
cadeia. São para equipe e codebase grande, e **brigam com o `CLAUDE.md`**, que
manda uma etapa por vez com parada para revisão.

Regras de instalação:
1. Ler o `SKILL.md` inteiro antes de instalar. São curtos. Resolve 90% do risco.
2. **Vendorar a cópia** em `.claude/skills/` do repo e commitar. Nunca linkar em
   marketplace com auto-update — atualização automática é supply chain.
3. Project-local, nunca `~/.claude/skills/`. Raio de explosão de um repo.
4. `CLAUDE.md` tem precedência sobre qualquer skill.

**O risco relevante não é skill-bomba.** É erosão comportamental: uma skill
bem-intencionada dizendo "não sobre-engenhe, entregue rápido" que seis meses
depois faz o agente contornar uma regra de lint porque "atrapalhava". Ninguém te
ataca; as invariantes só evaporam devagar.

---

## D-011 · Rigor de teste: mutação obrigatória
**17/08/2026 · Fechada**

Todo teste novo é validado quebrando a implementação de propósito e confirmando
que o teste certo falha, antes de restaurar.

**Não é cerimônia — está pegando erros de verdade:**

| Achado | Como apareceu |
|---|---|
| Teste de lint com falso-verde | Probe no `.gitignore` → oxlint retorna `diagnostics: []` → assert com `.filter()` passaria verde sem testar nada. Pego por ancorar em `length >= 8` |
| Instrução errada sobre branded type | Testar antes de implementar (D-009) |
| Teste de determinismo vazio | `tick()` trivial → duas seeds batem tautologicamente |
| Mutação inválida | Remover `sortableChildren` não quebrou nada: o Pixi liga a flag sozinho ao setar `zIndex`. A própria mutação estava errada |
| `instanceof WebGLRenderingContext` | Falharia sempre — Pixi v8 usa contexto WebGL2, que não herda dessa classe. Trocado por duck-typing |

**Princípio:** teste que passaria com o código quebrado é pior que teste ausente —
dá confiança falsa. Ausente você sabe que não tem cobertura.

**Ritmo:** durante o desenvolvimento, rodar só o arquivo afetado. Suíte completa
uma vez antes do commit. Mutação apenas no código novo da etapa.

---

## D-012 · Commit e push ao fim de cada etapa
**17/08/2026 · Fechada · aprendida na prática**

`main` direto, sem branch por etapa. Commits atômicos já dão ponto de reversão.
Branch passa a valer quando uma mudança tocar muitos arquivos e o diff inteiro
precisar de revisão antes de entrar.

**Push é obrigatório, não opcional.** O repositório remoto foi excluído por
engano e descobriu-se que `origin/main` estava parado no primeiro commit —
Etapas 1 e 2 existiam só no local. Nada foi perdido porque a pasta estava
intacta, mas perder o WSL naquele momento apagaria o projeto.

---

## Pendências abertas

| # | Item | Volta quando |
|---|---|---|
| P-01 | Teste de divergência por seed (removido quando o campo `noise` saiu) | Algum sistema do `sim/` consumir o RNG dentro de `tick()` — provavelmente Etapa 4, com spawn e movimento de NPC |
| P-02 | `noUncheckedIndexedAccess` em `src/sim/` via tsconfig próprio | Início da Fase 1 |
| P-03 | Teste de orçamento de frame específico para o pool de NPC | Etapa 4 — NPC decorativo é lógica de `render/npc/`, não de `sim/` |
| P-04 | Instrumentação de custo real de frame (vsync mascara o número) | Antes da Etapa 4 — ver D-005, é o que valida a decisão de engine |
| P-05 | Skills `brainstorming` + `writing-plans`, vendoradas | Início da Fase 1 |
| P-06 | Surto de frames longos no aquecimento, escalando com N (26 frames a 2000 NPCs, 160 a 4000), estabilizando em 6–18s sem resíduo. Hipótese não confirmada: alocação por respawn em `randomEdgePoint()`. Correção candidata: escrever direto em x/y em vez de retornar `{x, y}` | Se o surto aparecer com N ≤ 600 (o teto de pool real), ou se o `.exe` nativo da Etapa 6 mostrar comportamento pior |

---

## Estado atual

**Fase 0 (spike técnico) — Etapas 1 a 5 concluídas:**

1. Scaffolding + travas de pureza do `sim/` automatizadas no oxlint
2. Núcleo de simulação (rng, World, tick, money, loop de passo fixo)
3. Mapa top-down, câmera, instrumentação de performance que sobrevive ao vsync
4. NPCs decorativos — 500 a 60fps com folga real, escala linear medida até 4000
5. Save/load — pipeline completo, HMAC, migração, RNG sobrevivendo à serialização real

**Pendente:** Etapa 6 (Electron). É a que valida D-005 de verdade — com `.exe`
nativo no Windows, fora do WSL. Até lá, a decisão de engine segue com risco
assumido, não risco medido no ambiente que importa (ver adendo em D-005).

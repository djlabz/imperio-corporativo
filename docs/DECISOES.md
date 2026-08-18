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

**Adendo · 17/08/2026 · D-005 validada — risco medido e aceito**

Etapa 6: mesmo teste de escala (0/500/1000/2000/4000 NPCs, vsync), agora no
`.exe` nativo (`electron-builder --win --dir`), fora do WSL — build copiado
pra um path NTFS de verdade e executado via `Start-Process` do PowerShell, não
dentro do WSLg (que reintroduziria o mesmo passthrough de GPU que este teste
existe pra evitar).

| N | trabalho WSL (update+render) | ocupação WSL | trabalho nativo | ocupação nativa |
|---|---|---|---|---|
| 0 | 1,30ms | 7,8% | 0,80ms | 4,8% |
| 500 | 1,30ms | 9,3%¹ | 1,10ms | 6,6% |
| 1000 | 1,60ms | 11,4% | 1,30ms | 7,8% |
| 2000 | 2,50ms | 21,0% | 1,90ms | 11,4% |
| 4000 | 4,40ms | 35,4% | 2,20ms | 13,2% |

¹ número de WSL como reportado antes desta etapa — o salto de 7,8% (N=0) pra
9,3% (N=500) sem crescer de novo até 1000 não bate com os outros pontos;
provavelmente arredondamento na transcrição manual da época, não recalculado
aqui.

**Nativo é igual ou mais rápido que o WSL/ANGLE em todo N, com a vantagem
crescendo com N** — em 4000 NPCs, nativo gasta quase exatamente metade do
trabalho de CPU do WSL. Confirma a leitura registrada no adendo anterior
("piso conservador é provavelmente correto"): a camada de passthrough
ANGLE/D3D12 do WSL2 tinha overhead de verdade, e o ambiente real não paga
esse custo — só ganha.

Draw calls: 1 em todo N (confirma o critério de Etapa 4 no ambiente real).
Backend: `webgl` em todo N (Pixi escolheu o mesmo backend do WSL).

**P-06 (surto de aquecimento) não reproduziu nativamente.** `framesOver20ms`
ficou em 1-2 de ~2850 frames totais em TODOS os N testados, incluindo 4000 —
nada parecido com os 26 (N=2000) e 160 (N=4000) frames medidos no WSL. A
condição de reabertura de P-06 ("se aparecer com N ≤ 600, ou se o nativo
mostrar pior") não foi satisfeita — o nativo mostrou melhor. Isso **não**
prova que a alocação em `randomEdgePoint()` (a hipótese não confirmada de
P-06) deixou de existir — só que ela não se manifesta como problema visível
no ambiente que importa, pelo menos até 4000. P-06 continua registrada como
está: hipótese não confirmada, correção não aplicada de propósito.

**Save/load através do adapter de filesystem, verificado no `.exe`:**
automatizado via `webContents.sendInputEvent` simulando as teclas S/L do
gatilho manual (game.ts) — sem depender de alguém clicando na janela.
`tickCount` caiu de 49 pra 28 no instante seguinte ao load (voltou pra perto
do valor salvo, ~19, e um pouco de tempo real passou entre o load de verdade
completar e a leitura) e seguiu subindo depois (28→49 nos 2s seguintes) — a
prova observável de que o World em memória foi mesmo substituído pelo que
veio do disco via IPC → preload → main → filesystem, não só "não lançou
exceção".

**Limite honesto da medição:** `updateMs`/`renderMs`/`heapMB`/`budgetOccupancyPercent`
no harness de bench (ver D-014) são amostra de um único frame no instante em
que a medição lê `window.__benchStats`, não média sobre a janela — mais
ruidoso que a metodologia de mediana-de-500-amostras de
`app/frame.perf.test.ts`. `fps`/`low1PercentFps`/`framesOver20ms`/
`framesOver33ms` SÃO agregados de verdade (janela deslizante ou contador
cumulativo) e são os números em que mais confiar aqui. Por sorte a tendência
de ocupação saiu monótona e limpa (4,8→6,6→7,8→11,4→13,2%); `heapMB` não
saiu monótono (ruído de GC num sample único) e não deveria ser lido como
tendência.

**Condição de reabertura satisfeita. D-005 muda de "risco assumido" para
"risco medido e aceito", com os números acima.** Não se rediscute engine de
novo sem motivo novo — mesma regra do topo deste arquivo.

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
| Fuzz sem seed é irreproduzível por construção | O fuzz de `applyRate` usava `Math.random()`. Se ele achasse uma divergência real de precisão, avisaria que existe bug e recusaria dizer qual caso o produziu. Trocado por três seeds literais do PRNG do projeto, com a mensagem de falha carregando seed, índice da amostra, `money`, `bps` e os dois resultados — reproduzir passou a ser copiar um número. Bônus: `Math.random()` em `src/sim/**` é barrado pelo lint de D-006, então o teste também deixava `pnpm lint` vermelho |
| Relatório de etapa não é verificação | As Etapas 4 e 5 reportaram "lint ✅ 0 diagnósticos" com o lint vermelho desde `ea9717d`. O comando não tinha sido rodado; o relatório repetiu o estado esperado, não o medido. Correção de processo: rodar os cinco comandos (`typecheck`, `lint`, `test`, `build`, `format:check`) um por um e colar a saída bruta, nunca o resumo |
| Orçamento calibrado errado por confundir inclinação com total | Primeira tentativa do orçamento de P-03 usou o custo MARGINAL por NPC (a inclinação entre pontos da Etapa 4) como se fosse o custo TOTAL por frame em N=500 — resultou num orçamento ~40x acima do real. Duas mutações (chamar `sampleFlowField` 31x mais, e inflar `syncNpcPoolView` em 10x) passaram verde quando não deveriam. Corrigido medindo o baseline de verdade neste mesmo runtime (~0.107ms) antes de fixar o número, e confirmado com uma mutação 2x mais forte (20x) que falha de forma clara e reprodutível |
| tsconfig `extends` herda `exclude` do pai | O subprojeto `src/platform/electron/tsconfig.json` (Etapa 6) precisa compilar exatamente os dois arquivos (`main.cts`/`preload.cts`) que o tsconfig raiz exclui (ver D-006 nesta etapa). Sem `"exclude": []` explícito no filho, `extends` herdava o exclude do pai e o subprojeto compilava um projeto vazio — `tsc --noEmit` passava limpo (nada pra checar) e `tsc -p ...` sem `--noEmit` não emitia nada, os dois em silêncio. Pego rodando o build de verdade e vendo `dist-electron/` sem `main.cjs`/`preload.cjs`, não confiando no typecheck limpo sozinho |

**Princípio:** teste que passaria com o código quebrado é pior que teste ausente —
dá confiança falsa. Ausente você sabe que não tem cobertura.

**Padrão que atravessa a Fase 0 inteira, formulado explícito porque apareceu
três vezes independentes:** num projeto onde a defesa é automatizada, o modo
de falha dominante não é a trava errada — **é a trava que não rodou**. As três
instâncias, em ordem:

1. Falso-verde do `.gitignore` (Etapa 1) — o probe de pureza do `sim/` seria
   ignorado pelo oxlint e o teste passaria sem checar nada, se não fosse
   ancorado em `length >= 8` em vez de só "sem erro".
2. oxlint silencioso (Etapa 6) — a versão 1.78 não imprime **nada** quando
   está limpo (nem "0 diagnósticos"), o que é indistinguível de "o comando
   não rodou". É exatamente essa ambiguidade que deixou o lint vermelho
   sobreviver a dois relatórios de etapa sem ninguém notar (linha "Relatório
   de etapa não é verificação" acima).
3. `exclude` herdado do `extends` (Etapa 6) — o subprojeto do Electron
   compilava um programa vazio, e tanto `tsc --noEmit` quanto `tsc` sem essa
   flag terminavam em exit 0, sem diferenciar "nada pra checar" de "checou e
   passou".

Nos três casos a ferramenta funcionava perfeitamente — o problema nunca foi a
regra, foi a certeza de que ela estava mesmo olhando pro arquivo certo.
**Toda verificação nova precisa de prova de que rodou sobre os arquivos
certos** — não basta "saiu verde"; tem que existir um jeito de saber que
"verde" não é sinônimo de "não executou". Na prática: plantar uma violação de
propósito e confirmar que ela aparece, antes de confiar no caminho limpo (o
mesmo raciocínio da mutação, aplicado à ferramenta de verificação em vez de
ao código).

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

## D-013 · Empacotamento Windows sem instalador, sem wine
**17/08/2026 · Fechada**

Escopo mínimo da Etapa 6: validar D-005, não distribuir. `electron-builder
--win --dir` gera só uma pasta (`release/win-unpacked/`) com o `.exe` e os
recursos — sem NSIS, sem instalador, sem code signing.

**`win.signAndEditExecutable: false` evita depender de wine**, que não está
instalado neste WSL. Sem essa flag, o electron-builder chama `rcedit.exe`
(um binário Windows) pra gravar ícone/versão no `.exe` — em Linux isso roda
via wine por padrão. Como a Etapa 6 não tem ícone nem metadata de produto
pra gravar mesmo (fora de escopo), desligar o passo inteiro é estritamente
melhor que instalar wine só pra isso. Se a Etapa de distribuição precisar de
ícone/versão sem assinar, a opção certa lá é `signExecutable: false` (só pula
a assinatura, mantém edição de recurso) — o electron-builder sugere isso no
próprio log quando `signAndEditExecutable: false` está ativo.

`asarUnpack: ["**/*.node"]` fica na config desde já — placeholder genérico
pra módulo nativo (o candidato óbvio é `steamworks.js`, que ainda não existe
no projeto). Custa uma linha agora; custaria descobrir o porquê de um native
addon falhar dentro do asar mais tarde, sob pressão, quando o Steamworks
entrar.

`postinstall: "electron-builder install-app-deps"` — necessário mesmo sem
módulo nativo nenhum hoje: sem ele, adicionar um no futuro exigiria lembrar
de rodar o rebuild manualmente uma vez.

---

## D-014 · Harness de medição nativa automatizado, sem humano clicando
**17/08/2026 · Fechada**

A Etapa 6 pedia medição fora do WSL — o que normalmente significaria alguém
sentado no Windows, olhando o overlay de debug, anotando números à mão (como
a Etapa 4 fez). Construído em vez disso: `--bench=<N>` em `main.cts` carrega
o jogo com `?npcs=N`, espera o aquecimento, lê `window.__benchStats` (o
`OverlaySnapshot` mais recente — já existia pro overlay visual, só precisou
ficar exposto) via `executeJavaScript`, e grava um JSON em
`app.getPath('userData')/bench-results/`. Rodado 5x (N=0/500/1000/2000/4000)
via `Start-Process` do PowerShell a partir do WSL, sem tocar a janela.

**Dois bugs reais achados construindo isto, nenhum na lógica de jogo:**

1. **Vite emite asset em caminho absoluto (`/assets/...`) por padrão** — sob
   `file://` (como `BrowserWindow.loadFile` carrega), isso resolve pra raiz
   do filesystem, não pra pasta do `index.html`. O bundle inteiro falhava em
   carregar, em silêncio: `loadFile()` resolvia normalmente (achou o HTML),
   mas o jogo nunca rodava, e a falha de rede do `<script>` não passava pelo
   forwarding de `console-message` que main.cts já tinha. `window.__benchStats`
   ficava `null` pra sempre, sem nenhum erro visível em lugar nenhum — até eu
   desconfiar especificamente do `base` do Vite e checar o HTML gerado.
   Corrigido com `base: "./"` em `vite.config.ts` (asset relativo, funciona
   nos dois protocolos). **Achado de mutação, ao contrário do de sempre**: não
   quebrei de propósito pra testar — quebrei sem querer e o silêncio total foi
   o sintoma que apontou pra cá.
2. **O WSL2 (`/mnt/c/...`) mostra visão desatualizada de arquivo escrito por
   processo Windows nativo**, não só WSL. `ls`/`cat`/`find` direto em
   `/mnt/c` não viam o `debug.log` nem os JSONs de resultado logo depois do
   `.exe` terminar — apesar do arquivo existir de verdade (confirmado lendo
   via `Get-Content` do PowerShell no mesmo instante). Cache de metadata do
   DrvFs, não bug do harness. Lição: pra ler algo que um processo Windows
   nativo acabou de escrever, ler *de dentro* do Windows (`powershell.exe`/
   `cmd.exe`), não confiar em `/mnt/c` imediatamente depois.

**Debug log em arquivo foi necessário, não luxo.** Um `.exe` empacotado com
subsistema "windows" (não "console") não tem stdout visível — `console.log`
do processo main desaparece. `main.cts` grava cada estágio do ciclo de vida
(`whenReady`, janela criada, `loadFile` resolvido, stats lidos) em
`userData/debug.log`, mais forwarding do console do renderer e dos eventos
`did-fail-load`/`render-process-gone`. Foi o que permitiu achar o bug do
`base` do Vite em vez de adivinhar.

**Limite do harness, registrado (ver também o adendo de D-005):**
`updateMs`/`renderMs`/`heapMB` lidos são de um único frame no instante da
leitura, não média — mais ruidoso que a metodologia de
`app/frame.perf.test.ts`. Suficiente pro veredito de D-005 (a diferença
WSL-vs-nativo é grande o bastante pra sobreviver ao ruído), não seria
suficiente pra decisões de calibração fina.

`--save-load-check` (mesmo arquivo) valida o pipeline de save completo
(IPC → preload → `ElectronSaveAdapter` → filesystem) via `sendInputEvent`
simulando as teclas S/L reais de `game.ts`, sem atalho que pule o adapter —
ver adendo de D-005 pro resultado.

---

## Pendências abertas

| # | Item | Volta quando |
|---|---|---|
| P-01 | Teste de divergência por seed (removido quando o campo `noise` saiu) | Algum sistema do `sim/` consumir o RNG dentro de `tick()` — provavelmente Etapa 4, com spawn e movimento de NPC |
| P-02 | `noUncheckedIndexedAccess` em `src/sim/` via tsconfig próprio | Início da Fase 1 |
| P-05 | Skills `brainstorming` + `writing-plans`, vendoradas | Início da Fase 1 |
| P-06 | Surto de frames longos no aquecimento, escalando com N no WSL (26 frames a 2000 NPCs, 160 a 4000), estabilizando em 6–18s sem resíduo. Hipótese não confirmada: alocação por respawn em `randomEdgePoint()`. Correção candidata: escrever direto em x/y em vez de retornar `{x, y}`. **Atualizado na Etapa 6:** não reproduziu nativamente até N=4000 (`framesOver20ms` ficou em 1-2 de ~2850 em todo N, ver adendo de D-005) — a condição de reabertura abaixo não foi satisfeita, mas isso não confirma nem descarta a hipótese, só diz que não é visível no ambiente real nesta faixa | Se o surto aparecer com N ≤ 600 (o teto de pool real) no ambiente nativo, fora do padrão de aquecimento já observado |

## Pendências fechadas

Ficam registradas em vez de apagadas: saber que a pendência existiu e o que a
fechou vale mais que uma tabela curta.

| # | Item | Fechada por |
|---|---|---|
| P-03 | Teste de orçamento de frame específico para o pool de NPC, na suíte | `src/render/npc/npcPool.perf.test.ts` (Etapa 6), calibrado no custo por NPC medido nativamente (ver adendo de D-005) e verificado por mutação: uma regressão real no custo dominante (o laço de `syncNpcPoolView`) estoura o orçamento com folga; inflar uma parte barata (`sampleFlowField`) não, e isso também está documentado no cabeçalho do teste — nem toda mutação precisa "passar" pra ser informativa |
| P-04 | Instrumentação de custo real de frame (vsync mascara o número) | Etapa 3: `computeBudgetOccupancyPercent()`, contador de frames longos nos limiares de 20ms/33ms, 1% low em janela deslizante, modo sem vsync e overlay separando update/render do frame total. Todos com teste em `debugStats.test.ts` / `DebugOverlayView.test.ts`. Foi o instrumento que produziu os números da Etapa 4 e localizou o surto de aquecimento da P-06 |

---

## Estado atual

**Fase 0 (spike técnico) — concluída. Etapas 1 a 6:**

1. Scaffolding + travas de pureza do `sim/` automatizadas no oxlint
2. Núcleo de simulação (rng, World, tick, money, loop de passo fixo)
3. Mapa top-down, câmera, instrumentação de performance que sobrevive ao vsync
4. NPCs decorativos — 500 a 60fps com folga real, escala linear medida até 4000
5. Save/load — pipeline completo, HMAC, migração, RNG sobrevivendo à serialização real
6. Electron nativo — `.exe` funcional (janela, IPC de save via filesystem,
   `electron-builder --win --dir` sem wine), D-005 validada com medição real
   fora do WSL (nativo mais rápido que WSL em todo N, ver adendo), P-06 não
   reproduziu nativamente, save/load verificado no `.exe` via automação, e
   P-03 fechada com teste de orçamento calibrado na medição nativa

**Critério de aceite da Fase 0 fechado de verdade**, não só o de Etapa 4: as
duas decisões que dependiam de medição no ambiente real (D-005 engine, P-06
warmup) agora têm número do `.exe` nativo, não só do WSL.

**Próximo:** Fase 1 — sai do spike técnico pra conteúdo de jogo (mineração,
vertical slice de D-004). Pendências que essa transição dispara: P-02
(`noUncheckedIndexedAccess` em `src/sim/`) e P-05 (skills `brainstorming` +
`writing-plans`) ficam no início da Fase 1, por decisão já registrada em
D-010/convenções de código.

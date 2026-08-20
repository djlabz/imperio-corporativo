# F1-E3 — Plano de implementação

**Spec:** [f1-e3-spec.md](f1-e3-spec.md).

> **Mesma declaração de ordem da spec:** escrito depois da execução. Serve como
> registro de como a etapa foi decomposta e do que cada commit carregou — não como
> previsão. Um plano honesto escrito depois é um relatório; está rotulado como tal.

**Execução:** uma etapa por vez, com parada para revisão (`CLAUDE.md` → "Como
trabalhar comigo").

## Restrições globais

- Identificadores em inglês; comentários e commits em pt-BR.
- `src/sim/` puro; `render/` só LÊ o World e emite intenções.
- Dinheiro pelos helpers de `money.ts`, nunca operador cru.
- Balanceamento em `src/sim/data/*.json`, validado por zod.
- Flow field, nunca A*.
- Mutação obrigatória em cada teste novo (D-011).
- Coleta de verificação via `rtk proxy` (adendo de D-011).
- Mecanismo em documento é medido ou é rotulado (D-018).

## Commits, na ordem em que saíram

| Commit    | Conteúdo                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------- |
| `9754d2a` | Item 0: D-019 (visão), P-11 (atores), refinaria em D-017, e o rótulo D-018 na hipótese do flow field |
| `9a632c4` | Capacidade de carga — a única mudança no `sim/`, feita primeiro                                      |
| `ff31ca6` | Flow field com destino explícito + a medição que fechou a hipótese do D-017                          |
| `1dce13c` | Gerente, lugares, input, leitura numérica, e a fiação no `game.ts`                                   |
| este      | Os dois artefatos da etapa                                                                           |

## Arquivos

**Novos:**

| Arquivo                         | Responsabilidade                                                |
| ------------------------------- | --------------------------------------------------------------- |
| `sim/data/map.json`             | geometria e velocidade (dado; ver a nota de camada na spec)     |
| `render/world/layout.ts`        | schema zod, `MAP`, `centerOf`, `isWithinReach`, `containsPoint` |
| `render/world/PlacesView.ts`    | os dois retângulos rotulados + círculo de alcance               |
| `render/world/worldInput.ts`    | `screenToWorld` e a fiação de clique esquerdo/direito           |
| `render/manager/manager.ts`     | posição, ordem, `stepManager`                                   |
| `render/manager/ManagerView.ts` | o retângulo e o Y-sort                                          |
| `render/debug/ReadoutView.ts`   | `formatReadoutText` puro + o `Text` do Pixi                     |

**Modificados:** `sim/data/balance.ts` e `sim/economy/mining.ts` (teto de carga),
`render/npc/flowField.ts` (destino), `app/game.ts` (fiação), mais os três
chamadores de `buildFlowField`.

## Verificação

Cinco comandos um por um, saída bruta, via `rtk proxy`: `typecheck` 0, `lint` 0,
`test` 0 (34 arquivos, 307 testes), `build` 0, `format:check` 0.

**Mais o que teste não alcança:** o jogo foi aberto no browser e o ciclo completo
percorrido — 25 cliques enchem a carga, a viagem leva ~13s, vender 50 kg credita
exatamente R$ 22,50 e o depósito cai de 5000 pra 4950. Três bugs de tela saíram
daí e só dali poderiam sair (leitura sobre o overlay, câmera sem enquadrar nada,
gerente invisível dentro do prédio). Estão descritos no corpo de `1dce13c`.

## O que fica aberto

Nada novo. **P-01** segue aberta e esta etapa não a toca: preço fixo, extração
determinística, nada em `sim/` consumindo RNG dentro de `tick()`. **P-11** vence
no início da F1-E4, antes de folha de pagamento.

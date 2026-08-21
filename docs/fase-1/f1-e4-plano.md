# F1-E4 — Plano de implementação

**Spec:** [f1-e4-spec.md](f1-e4-spec.md).

> **Mesma declaração de ordem das etapas anteriores:** escrito depois da
> execução. Serve como registro de como a etapa foi decomposta e do que cada
> commit carregou — não como previsão.

**Execução:** uma etapa por vez, com parada obrigatória depois do item 0 (P-11)
antes de seguir pros itens 1 a 7 — ver `CLAUDE.md` → "Como trabalhar comigo".

## Restrições globais

- Identificadores em inglês; comentários e commits em pt-BR.
- `src/sim/` puro; `render/`/`app/` só leem o World e emitem intenções.
- Dinheiro pelos helpers de `money.ts`, nunca operador cru — inclusive nos
  comparadores novos (`hire()`, `hireOutcome()`): comparação não é aritmética,
  mas produzir um valor novo (soma, subtração, negação de propósito) ainda é.
- Balanceamento em `src/sim/data/*.json`, validado por zod.
- Sem acumulador fracionário pra cadência — a cadência sai de `tickCount % N`.
- Mutação obrigatória em cada teste novo (D-011).
- `payPayroll` detecta a virada por COMPARAÇÃO de mês, não por dividir
  `tickCount` — mesma derivação do `ReadoutView`.

## Commits, na ordem em que saíram

| Commit    | Conteúdo                                                                                |
| --------- | --------------------------------------------------------------------------------------- |
| `327dc94` | Item 0 (P-11) + estado/comando/produção/folha no `sim/` + D-021 e P-13 no `DECISOES.md` |
| `4a23dea` | Migração de save v2 → v3 (`employeeCount`)                                              |
| `97bf883` | Tecla H, `hireOutcome()` na linha de evento, leitura numérica de folha e próxima virada |
| este      | Os dois artefatos da etapa                                                              |

Cada commit deixou a árvore verde (`typecheck`, `lint`, `test`, `format:check`)
antes do próximo — não é reconstrução: os três primeiros foram checados um a um
durante a implementação, não só ao final.

## Arquivos

**Novos:**

| Arquivo                         | Responsabilidade                                   |
| ------------------------------- | -------------------------------------------------- |
| `sim/economy/employees.ts`      | `hire()`, `runEmployees()`, `payPayroll()` — puros |
| `sim/economy/employees.test.ts` | Unidade de cada função acima, isolada              |
| `docs/fase-1/f1-e4-spec.md`     | Este par de artefatos                              |
| `docs/fase-1/f1-e4-plano.md`    | Este par de artefatos                              |

**Modificados:**

| Arquivo                               | Mudança                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `sim/core/World.ts`                   | `employeeCount`, `WORLD_VERSION` 2→3                                      |
| `sim/core/Command.ts`                 | `HIRE`                                                                    |
| `sim/core/tick.ts`                    | `HIRE` no switch; `runEmployees`/`payPayroll` depois do incremento        |
| `sim/core/time.ts`                    | `nextFiscalMonthTick()`                                                   |
| `sim/data/balance.ts` + `mining.json` | `hireCost`, `wagePerEmployee`, `employeeKgPerCycle`, `employeeCycleTicks` |
| `sim/economy/mining.test.ts`          | fixture `BALANCE` local ganhou os 4 campos novos (tipo, não uso)          |
| `platform/save/worldSchema.ts`        | schema + migração `2 → 3`                                                 |
| `render/debug/eventLog.ts`            | `ActionRecord` união discriminada, `hireOutcome()`, `OutcomeContext`      |
| `render/debug/ReadoutView.ts`         | duas linhas novas, `nextFiscalMonthTick`, `mul()` pra folha total         |
| `render/debug/EventLineView.ts`       | reposicionado (y=312 → y=352)                                             |
| `app/game.ts`                         | tecla H, `drainActions`/`updateReadout` com os campos novos               |
| `docs/DECISOES.md`                    | P-11 (estimativa de custo), D-021, P-13                                   |

## Verificação

Quatro comandos, saída bruta, via `rtk proxy`, repetidos depois de CADA um dos
três commits de código: `typecheck` 0, `lint` 0, `test` 0 (37 arquivos, 390
testes), `format:check` 0. `build` (que roda os três `tsc` mais `vite build`)
também 0 no final.

Mutação verificada à mão em dois pontos de `runEmployees`/`payPayroll` (não só
prometida): trocar o guard de cadência por só "`tickCount === 0`" (produção
todo tick) e remover o `Math.min` do clamp de depósito — as duas quebraram
teste existente, confirmando que a rede pega o que deveria pegar.

**Mais o que teste não alcança:** ciclo completo dirigido no browser — sem
dinheiro mostra o preço, com dinheiro mostra `contratou funcionário nº 1`, e o
funcionário produz sozinho nos ticks seguintes sem clique nenhum (depósito e
dinheiro andando visivelmente na leitura numérica). A virada de mês (cobrança
de folha) não foi observada no browser — levaria minutos reais de sessão — e
fica coberta só pelo teste de 1800 ticks contra a conta feita à mão.

## O que fica aberto

**P-01** segue aberta, intocada: nada nesta etapa consumiu RNG dentro de
`tick()`. **P-11** foi avaliada e **continua aberta**, com a estimativa de
custo registrada por extenso pra não ser relitigada. **P-13** (nova): o que
acontece quando o jogador fica no vermelho — sem falência, sem consequência
ainda; volta quando a F1-E5 calibrar o imposto. **P-12** (área sem rede de
`game.ts`) não foi tocada por esta etapa — a tecla H soma mais um pouco de
fiação de DOM não testada automaticamente à mesma pilha.

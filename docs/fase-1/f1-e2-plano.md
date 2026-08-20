# F1-E2 — Plano de implementação

**Spec:** [f1-e2-spec.md](f1-e2-spec.md) — o plano argumenta a partir dela.

**Execução:** uma etapa por vez, com parada para revisão. Ver `CLAUDE.md` →
"Como trabalhar comigo".

## Restrições globais

- Identificadores em inglês; comentários e commits em pt-BR (`CLAUDE.md`).
- `src/sim/` é puro: nada de `Math.random`, `Date.now`, `window`, nem import de
  `render/`, `ui/`, `platform/`, `app/`.
- Dinheiro é inteiro em centavos, sempre pelos helpers de `money.ts` — nunca
  `+`/`-`/`*` cru.
- Nenhum número de balanceamento no código: tudo em `src/sim/data/*.json`,
  validado por zod no carregamento.
- Mutação obrigatória em cada teste novo (D-011): quebrar a implementação,
  confirmar vermelho, relatar o que quebrou e o que o teste disse.
- Coleta de verificação via `rtk proxy` (adendo de D-011).

## Arquivos

**Novos, em `src/sim/`:**

| Arquivo             | Responsabilidade                                                |
| ------------------- | --------------------------------------------------------------- |
| `core/Command.ts`   | a união discriminada. Só o tipo, nada de lógica                 |
| `core/time.ts`      | `fiscalMonth(tickCount, ticksPerMonth)` — derivação, sem estado |
| `data/mining.json`  | os quatro números de balanceamento                              |
| `data/balance.ts`   | schema zod + `parseMiningBalance()` + a constante carregada     |
| `economy/mining.ts` | `mine()` e `sell()`, as duas puras sobre `World`                |

**Modificados:**

| Arquivo                                              | Mudança                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `sim/core/World.ts`                                  | `depositKg`, `stockKg`, `WORLD_VERSION = 2` exportada          |
| `sim/core/tick.ts`                                   | assinatura nova; despacha comando para `economy/mining.ts`     |
| `platform/save/worldSchema.ts`                       | schema v2, migração 1→2, `CURRENT_VERSION` importada do `sim/` |
| `sim/core/determinism.test.ts`                       | passa `[]` nos `tick()`                                        |
| `app/frame.ts`                                       | passa a fila de comandos adiante                               |
| `platform/save/{autosave,saveGame,pipeline}.test.ts` | passa `[]` nos `tick()`                                        |

## Interfaces

```ts
// core/Command.ts
export type Command = { readonly kind: "MINE" } | { readonly kind: "SELL" };

// core/time.ts
export function fiscalMonth(tickCount: number, ticksPerMonth: number): number;

// data/balance.ts
export interface MiningBalance {
  readonly fiscalMonthTicks: number;
  readonly kgPerStrike: number;
  readonly initialDepositKg: number;
  readonly pricePerKg: Money; // já brandado no carregamento
}
export function parseMiningBalance(raw: unknown): MiningBalance;
export const MINING: MiningBalance;

// economy/mining.ts
export function mine(world: World, balance: MiningBalance): World;
export function sell(world: World, balance: MiningBalance): World;

// core/tick.ts
export function tick(world: World, commands: readonly Command[]): World;
```

`mine`/`sell` recebem o balanceamento por parâmetro (testável com números
próprios); `tick()` não, porque a assinatura dela é fixada pela spec — ela usa a
constante carregada do módulo.

## Tarefas

**T1 — balanceamento.** `data/mining.json` e `data/balance.ts`. Teste: schema
rejeita campo faltando, tipo errado, `NaN`, `Infinity` e não-inteiro; o
`pricePerKg` sai como `Money`. Commit junto de T2.

**T2 — `Command` e a fronteira.** `core/Command.ts`, assinatura nova de
`tick()`, e os cinco chamadores atualizados. Teste: comando desconhecido não
compila (checado por tipo, não por teste), fila vazia só avança o tick, ordem de
aplicação é a da fila, `tickCount` avança depois dos comandos.

**T3 — extração e venda.** `economy/mining.ts`. Testes, um por linha da tabela
de comportamento da spec: golpe move a mesma quantidade dos dois lados; golpe em
depósito parcial extrai o que resta e não fica negativo; golpe em depósito zero
não cria minério; venda zera estoque e credita o valor exato; venda com estoque
zero não move dinheiro.

**T4 — mês derivado.** `core/time.ts`. Teste da virada: 1799 → mês 1, 1800 →
mês 2, e o tick 0 é mês 1.

**T5 — determinismo com comandos.** `(World + mesma sequência de comandos)`
reproduz o mesmo `World` duas vezes, com checkpoints intermediários, no padrão
que `determinism.test.ts` já usa.

**T6 — save v2.** Bump, schema, migração, e o teste do save v1 real pelo
pipeline completo. Este é o teste que não pode faltar.

T1–T5 num commit (a forma do `World` muda e o save quebra junto, então não dá
pra separar sem deixar `typecheck` vermelho no meio); T6 no mesmo commit por
isso mesmo.

## Verificação

Os cinco comandos um por um, saída bruta colada, via `rtk proxy`:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm format:check
```

Mais, específico da etapa: um save v1 construído pelo pipeline real carrega como
v2 com `depositKg` e `stockKg` preenchidos; e o relato de mutação de cada teste
novo.

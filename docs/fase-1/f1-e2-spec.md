# F1-E2 — Economia de mineração no `sim/`

**Escopo:** só `src/sim/` e `src/sim/data/`, mais a camada de save que a mudança
de forma do `World` obriga a acompanhar. Zero renderer, zero React, zero UI.
Nada aparece na tela nesta etapa — isso é a F1-E3.

**O que esta etapa entrega:** o jogador pode, em teste, dar golpes de picareta,
acumular estoque e vender ao preço fixo, com o dinheiro certo no fim. Ninguém
vê nada ainda.

---

## Decisões de entrada (dadas, não rediscutidas aqui)

|                  |                                                                                   |
| ---------------- | --------------------------------------------------------------------------------- |
| 1 mês fiscal     | 1800 ticks (`TICK_MS = 100` → 10 ticks/s → 3 min reais)                           |
| Extração         | por **clique manual**. Automação é upgrade, não é desta etapa                     |
| Preço do minério | **fixo**. Sem oscilação, sem choque, sem RNG                                      |
| Depósito         | **finito**. Minério que sai não volta                                             |
| Corpo do gerente | decidido (D-017), mas **fora** desta etapa: nada de posição, movimento ou alcance |

Idioma: identificadores em inglês, conforme `CLAUDE.md`. Comentários, commits e
este documento em pt-BR.

---

## 1. Fronteira de comandos (D-016)

Clique é I/O; `src/sim/` é puro. A assinatura do tick muda:

```ts
tick(world: World, commands: readonly Command[]): World
```

`Command` é união discriminada, serializável, sem função e sem classe — a mesma
restrição que o `World` já tem.

```ts
export type Command = { readonly kind: "MINE" } | { readonly kind: "SELL" };
```

- `MINE` — um golpe de picareta.
- `SELL` — vende o estoque inteiro ao preço fixo.

**A fila não mora no `World`.** Entra como argumento. O `World` é o que vai pro
save, e fila pendente no momento do save é estado ambíguo que ninguém quer
migrar depois.

**Sem parâmetro opcional.** Fila opcional é convite pra alguém esquecer de
passar e não notar. Todo chamador de `tick()` é atualizado — o que hoje são
cinco lugares, um deles produção (`src/app/frame.ts`).

Ordem de aplicação dentro de um tick: os comandos são aplicados na ordem em que
chegam, e o `tickCount` avança **depois** deles. Um `MINE` e um `SELL` no mesmo
tick, nessa ordem, extraem e vendem no mesmo tick.

## 2. Estado novo no `World`

```ts
readonly depositKg: number;   // minério que ainda existe no chão
readonly stockKg: number;     // extraído e não vendido
```

**Mês fiscal não é campo.** Deriva de `tickCount`. Estado duplicado sai de
sincronia, e o mês é função pura do tick.

## 3. Balanceamento em `src/sim/data/`

`mining.json`, validado por zod no carregamento — mesma disciplina do save.

```json
{
  "fiscalMonthTicks": 1800,
  "kgPerStrike": 2,
  "initialDepositKg": 5000,
  "pricePerKgCents": 45
}
```

Nenhum número de balanceamento no código. O `pricePerKgCents` atravessa
`centavos()` no carregamento e vira `Money` ali, uma vez só — o resto do código
nunca vê o número cru.

Venda usa `mul(pricePerKg, stockKg)`: os dois são inteiros, então não há fração
a arredondar, mas o helper é usado de qualquer forma. Aritmética crua não entra.

## 4. Save: a forma do `World` muda

A Fase 0 construiu save com zod, versão e migração exatamente pra isto.

- `WORLD_VERSION` sobe de 1 para 2.
- Schema do zod ganha os dois campos, como `z.int().nonnegative()`.
- Migração `v1 → v2` dá valor inicial aos campos novos.
- Teste que carrega um save **v1 de verdade** — construído pelo pipeline real
  (`encodeRaw` → MessagePack → deflate → XOR → HMAC) e lido de volta por
  `decodeWorld` — e confirma que sobe pra v2 com os campos preenchidos.

Save antigo quebrando em silêncio é o pior bug que este jogo pode ter.

**Uma duplicação que sai no caminho:** `World.ts` tinha `INITIAL_VERSION = 1` e
`worldSchema.ts` tinha `CURRENT_VERSION = 1`, dois lugares que precisam
concordar e que esta etapa teria que bumpar em paralelo. `worldSchema.ts` passa
a importar a constante do `sim/` (a direção de import permitida). Um número, uma
fonte.

## 5. Comportamento, ponto a ponto

| Situação                              | Resultado                                              |
| ------------------------------------- | ------------------------------------------------------ |
| `MINE` com depósito suficiente        | `depositKg -= kgPerStrike`, `stockKg += kgPerStrike`   |
| `MINE` com depósito menor que o golpe | extrai o que resta; depósito chega a 0, nunca negativo |
| `MINE` com depósito 0                 | nada muda. Não cria minério                            |
| `SELL` com estoque                    | `money += pricePerKg × stockKg`, `stockKg = 0`         |
| `SELL` com estoque 0                  | nada muda. Não move dinheiro                           |
| tick sem comando                      | só `tickCount + 1`                                     |

## 6. Fora de escopo, explicitamente

Contratação, folha, imposto, automação, oscilação de preço, posição do gerente,
movimento, alcance, e qualquer coisa que apareça na tela.

## 7. O que fica aberto

**P-01** continua aberta, e esta etapa **não** a fecha: preço fixo e extração
determinística significam que nada em `sim/` consome o RNG dentro de `tick()`.
Não se força RNG artificial só pra fechar pendência.

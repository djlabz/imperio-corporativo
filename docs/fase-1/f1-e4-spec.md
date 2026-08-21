# F1-E4 — Contratação e folha

> **Mesma declaração de ordem da F1-E3:** esta spec foi escrita **depois** da
> implementação. O bloco da etapa veio detalhado o bastante pra servir de spec de
> fato; a sequência (item 0, depois 1 a 7) veio dada. Isto é registro do que foi
> decidido e medido, não previsão.

**Objetivo único:** dar ao jogador um jeito de converter trabalho ativo em renda
passiva, e fazer a dívida da folha ser real — sem falência, sem imposto, sem UI
além de uma tecla e três linhas na leitura numérica.

**Escopo:** `src/sim/` (estado novo, comandos, produção, folha), `src/platform/save/`
(migração v2→v3), e o mínimo de `src/app/`/`src/render/debug/` pra jogar e medir.
Nada de demissão, edifício, imposto ou UI além do combinado.

---

## 0. P-11 vence, e a resposta é "não fecha nada"

`employeeCount` é um escalar do mesmo tipo que `money`/`depositKg`/`stockKg`, que
já assumiam ator único desde a F1-E2. Adicionar um quarto campo ao mesmo balde
não cimenta uma porta nova — cimenta a mesma porta um pouco mais, na mesma
direção em que já estava. O custo de abrir essa porta depois (envolver os quatro
escalares num struct por empresa) é mecânico e proporcional ao número de
referências, sem bloqueio estrutural. Ver P-11 (atualizada) pro texto completo,
incluindo a alternativa considerada e recusada (aninhar agora, já que a migração
v2→v3 seria escrita de qualquer jeito).

## 1. D-021 — o funcionário faz o laço inteiro

Extrai, carrega e vende sozinho, mais devagar que o jogador. Não é carregador
(deixaria os outros 22% do ciclo — golpe e venda — manuais) nem mineiro parcial
(não tocaria nos 78% que pesam: a caminhada). Só o laço completo converte
trabalho ativo em renda passiva. Ver D-021 pro número e o raciocínio completo.

No `sim/`, o funcionário **não tem posição** — é taxa de produção mais folha.
`World` ganha só `employeeCount: number`.

## 2. Estado novo e a virada do mês

Um campo: `employeeCount`. Produção via `runEmployees()`: cada funcionário
extrai `employeeKgPerCycle` kg a cada `employeeCycleTicks` ticks e vende na
hora, ao mesmo preço do jogador — sem estoque intermediário. A cadência é um
marco GLOBAL (`world.tickCount % employeeCycleTicks`), não um relógio por
funcionário: `employeeCount` é contagem, não lista, e não há onde guardar
"há quanto tempo cada um foi contratado" sem inventar um array de estado que a
etapa pediu pra evitar.

A produção clampa no que resta do depósito — o mesmo limite que `mine()` já
aplica pro jogador (sem isso, funcionário venderia minério depois do depósito
esgotar, dinheiro do nada e silencioso).

A folha é cobrada em `payPayroll()`, na virada do mês fiscal — a primeira vez
que essa fronteira faz alguma coisa; até aqui ela só era exibida. Detecção por
COMPARAÇÃO de mês (`fiscalMonth` do tick anterior contra o atual), a mesma
derivação que `ReadoutView` usa pra mostrar o mês — "quando vira" tem uma
definição só no jogo inteiro.

Dinheiro PODE FICAR NEGATIVO quando a folha não cabe. Sem falência, sem
consequência ainda — é o que a P-13 registra, e o que o imposto da F1-E5
precisa encontrar pela frente.

**Ordem dentro de `tick()`:** comandos → incremento de `tickCount` → produção →
folha. Isto torna a ordem (comandos antes do incremento) OBSERVÁVEL por um
comando de verdade pela primeira vez — `HIRE` bem no marco de produção já
produz no mesmo tick, porque `hire()` roda antes de `runEmployees()`. A nota que
o `tick.test.ts` carregava desde a F1-E2 apontava a F1-E5 (imposto) como
candidata; era o raciocínio certo com o candidato errado.

## 3. Comando HIRE

`{ kind: "HIRE" }` custa `hireCost` à vista e incrementa `employeeCount`. Sem
dinheiro suficiente, é no-op — mesma convenção de golpe em depósito vazio: o
comando não falha, só não faz nada, e quem mede a diferença é a linha de
evento, comparando o `World` (D-020 se estende sem exceção: `hireOutcome()`
mede `employeeCount` e dinheiro, nunca assume que a tecla funcionou).

Sem demissão nesta etapa.

## 4. Balanceamento

| Campo                  | Valor           | De onde sai                                                                           |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------- |
| `hireCostCents`        | 6000 (R$60)     | tempo de retorno ~1,8 mês fiscal (~5min)                                              |
| `wagePerEmployeeCents` | 2000 (R$20/mês) | funcionário rende ~R$54/mês, líquido ~R$34                                            |
| `employeeKgPerCycle`   | 1               | —                                                                                     |
| `employeeCycleTicks`   | 15              | 0,67 kg/s — ~55% dos 1,22 kg/s do jogador: ajuda real, sem tornar o jogador supérfluo |

Com `kgPerStrike` em 10 (fechamento da F1-E3), o jogador junta R$60 em menos de
2 minutos — contratar é acessível rápido, e o retorno do funcionário (~5min)
ainda é sentido como investimento, não como trivialidade.

## 5. Save: v2 → v3

`employeeCount` muda a forma do `World`. `WORLD_VERSION` 2 → 3, migração
`2: (world) => ({ ...world, version: 3, employeeCount: 0 })` — um save v2 é
anterior a funcionário existir, então zero é o único valor correto. Teste com
um save v2 REAL, pelo pipeline completo (MessagePack + deflate + XOR + HMAC),
mais um teste de cadeia v1→v2→v3 confirmando que os dois `employeeCount: 0` e
`depositKg` cheio convivem.

## 6. UI mínima

Tecla H contrata — sem posição, sem alcance, entra na fila igual a um golpe já
em alcance (resolve em até 100ms, o mesmo tick seguinte). A leitura numérica
ganhou duas linhas: `Funcionários: N (folha: R$ X / mês)` e
`Próxima virada: tick N` (via `nextFiscalMonthTick()`, novo em `core/time.ts`,
ao lado de `fiscalMonth()`). O `EventLineView` desceu de y=312 pra y=352 pra
não sobrepor o `ReadoutView`, que cresceu de 5 pra 7 linhas.

## 7. Fora de escopo

Demissão, edifício, imposto, UI além do combinado, arte, som, animação.

## O que a etapa mediu no browser (não só em teste)

Ciclo completo dirigido no browser: contratar sem dinheiro mostra o preço
(`sem dinheiro para contratar (precisa de R$ 60,00)`); minerar, vender, e
contratar com dinheiro suficiente mostra `contratou funcionário nº 1`; o
funcionário produz sozinho nos ticks seguintes (depósito e dinheiro andando sem
clique nenhum); a leitura numérica mostra as linhas novas sem sobrepor o log de
evento. A virada de mês (cobrança de folha) **não** foi observada no browser —
levaria minutos reais de sessão — e fica coberta só pelos testes de `tick.ts`
(inclusive o de 1800 ticks contra a conta feita à mão).

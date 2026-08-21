import { fiscalMonth } from "../core/time";
import type { World } from "../core/World";
import type { MiningBalance } from "../data/balance";
import { add, mul, sub } from "./money";

/**
 * Contrata um funcionário à vista. Sem dinheiro suficiente, é no-op — mesma
 * convenção de golpe em depósito vazio (`mine()`): o comando não falha, só não
 * faz nada, e quem mede a diferença é a linha de evento, comparando o World
 * antes e depois (D-020).
 *
 * `world.money < balance.hireCost` é comparação, não aritmética monetária — a
 * Regra 2 do CLAUDE.md barra `+`/`-`/`*` cru sobre `Money` porque eles PRODUZEM
 * um valor novo que pode precisar arredondar; `<` não produz nada, só compara
 * dois inteiros que já existem.
 */
export function hire(world: World, balance: MiningBalance): World {
  if (world.money < balance.hireCost) {
    return world;
  }

  return {
    ...world,
    money: sub(world.money, balance.hireCost),
    employeeCount: world.employeeCount + 1,
  };
}

/**
 * Produção passiva dos funcionários: sem posição, sem viagem, sem estoque
 * intermediário (D-021) — extrai e vende no mesmo instante, ao mesmo preço do
 * jogador.
 *
 * A cadência é um marco GLOBAL (`world.tickCount % employeeCycleTicks`), não um
 * relógio por funcionário. `employeeCount` é uma CONTAGEM, não uma lista: não há
 * onde guardar "há quanto tempo cada um foi contratado" sem inventar um array de
 * estado que esta etapa pediu explicitamente pra evitar ("se você achar que
 * precisa guardar resto, pare e pergunte"). Consequência aceita: um funcionário
 * contratado no meio de um ciclo só produz no próximo marco, junto com todo
 * mundo — não no seu próprio aniversário de contratação.
 *
 * Só chamada de dentro de `tick()`, depois do incremento de `tickCount` — então
 * na prática `world.tickCount` aqui já é >= 1 sempre. O `=== 0` abaixo não é
 * pra esse caminho: é pra quem chamar esta função direto num teste com um World
 * construído à mão em `tickCount: 0`, onde "o marco 0 dispara produção" seria
 * uma resposta errada (o mundo ainda não rodou tick nenhum).
 */
export function runEmployees(world: World, balance: MiningBalance): World {
  if (world.tickCount === 0 || world.tickCount % balance.employeeCycleTicks !== 0) {
    return world;
  }

  // min() com o depósito: o mesmo limite que mine() já aplica pro jogador. Sem
  // ele, funcionários continuariam vendendo minério depois do depósito esgotar —
  // dinheiro do nada, silencioso, exatamente a classe de bug que mine() já evita.
  const produced = Math.min(world.employeeCount * balance.employeeKgPerCycle, world.depositKg);
  if (produced === 0) {
    return world;
  }

  return {
    ...world,
    depositKg: world.depositKg - produced,
    money: add(world.money, mul(balance.pricePerKg, produced)),
  };
}

/**
 * Cobra a folha na virada do mês fiscal — a primeira vez que a fronteira do mês
 * faz alguma coisa; até aqui ela só era exibida (`ReadoutView`).
 *
 * Detecção por COMPARAÇÃO de mês (`fiscalMonth` do tick anterior contra o
 * atual), não por dividir `tickCount` direto: é a mesma derivação que o
 * `ReadoutView` já usa pra mostrar o mês, então "quando vira" tem uma definição
 * só no jogo inteiro, e não duas que podem discordar.
 *
 * `previousTickCount` é o tick ANTES do incremento desta chamada de `tick()` —
 * quem chama (tick.ts) precisa passar o `world.tickCount` de entrada, não o já
 * incrementado, ou a comparação sempre dá "mesmo mês" e a folha nunca cobra.
 *
 * Dinheiro PODE FICAR NEGATIVO aqui, de propósito (P-13): não há falência nem
 * consequência ainda. Sem isso a folha seria sugestão, não compromisso — e é o
 * compromisso que o imposto da F1-E5 precisa encontrar pela frente.
 */
export function payPayroll(world: World, previousTickCount: number, balance: MiningBalance): World {
  const monthBefore = fiscalMonth(previousTickCount, balance.fiscalMonthTicks);
  const monthAfter = fiscalMonth(world.tickCount, balance.fiscalMonthTicks);
  if (monthAfter === monthBefore || world.employeeCount === 0) {
    return world;
  }

  return {
    ...world,
    money: sub(world.money, mul(balance.wagePerEmployee, world.employeeCount)),
  };
}

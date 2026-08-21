import type { World } from "../../sim/core/World";
import type { Money } from "../../sim/economy/money";
import { fmt, sub } from "../../sim/economy/money";

/**
 * A linha de evento: o que cliquei → onde caiu → o que aconteceu DE FATO.
 *
 * A regra que dá sentido a este arquivo: o resultado de uma ação sai de COMPARAR
 * o World antes e depois do tick, nunca da intenção que a camada de app tinha.
 * "minerou 2 kg" é `stockKg` depois menos `stockKg` antes; "vendeu 50 kg por
 * R$ 22,50" é o delta de `stockKg` e o delta de `money`, medidos.
 *
 * Uma linha que reportasse a INTENÇÃO seria mais uma coisa afirmando sucesso sem
 * ter medido — o padrão que D-011 e D-018 existem pra impedir. Se o `sim/` não
 * fizer o que o app esperava, é obrigação desta linha mostrar isso, não esconder:
 * daí os ramos "MEDIDA INESPERADA" e os dois "nada aconteceu, e nem o motivo
 * conhecido se aplica" abaixo, que são o ponto do arquivo e não zelo defensivo.
 */

/** Recorte econômico do World, tirado antes e depois do tick. */
export interface EconomySample {
  readonly money: World["money"];
  readonly stockKg: number;
  readonly depositKg: number;
  readonly employeeCount: number;
  readonly tickCount: number;
}

export function sampleEconomy(world: World): EconomySample {
  return {
    money: world.money,
    stockKg: world.stockKg,
    depositKg: world.depositKg,
    employeeCount: world.employeeCount,
    tickCount: world.tickCount,
  };
}

/**
 * As ações que viram comando. "mine"/"sell" vêm do gerente (mesmas strings de
 * ManagerIntent, de propósito) e carregam o lugar clicado; "hire" vem da tecla H
 * e não tem lugar — HIRE não tem posição nenhuma (D-021).
 */
export type ActionRecord =
  { readonly kind: "mine" | "sell"; readonly placeLabel: string } | { readonly kind: "hire" };

const LEFT = "clique esquerdo";
const RIGHT = "clique direito";
const KEY_H = "tecla H";

/** Contexto de balanceamento que os outcomes precisam pra formatar a linha. */
export interface OutcomeContext {
  readonly carryCapacityKg: number;
  readonly hireCost: Money;
}

function signed(delta: number): string {
  return delta >= 0 ? `+${delta}` : String(delta);
}

/** Ponto do mundo como o log escreve: inteiro, pra dar pra comparar com o mapa. */
function point(x: number, y: number): string {
  return `(${Math.round(x)}, ${Math.round(y)})`;
}

/**
 * Sufixo de ordem cancelada. Foi medido, não suposto: dez cliques no depósito com
 * o gerente parado na refinaria renderam UM "minerou 2 kg", dez segundos depois
 * do último clique — porque cada clique substituiu o anterior e o gerente andou
 * uma vez só. Sem esta anotação, o log dizia dez ordens e um resultado e não
 * explicava a diferença.
 */
function replacedSuffix(replacedOrder: boolean): string {
  return replacedOrder ? " (cancela a ordem anterior)" : "";
}

export function moveLine(x: number, y: number, replacedOrder: boolean): string {
  return `${RIGHT} → caminhando para ${point(x, y)}${replacedSuffix(replacedOrder)}`;
}

/**
 * Ordem de agir ACEITA — não é resultado, e a redação existe pra isso não se
 * confundir nunca: "ordem na fila" e "a caminho" descrevem o que o app fez com o
 * clique; só "minerou N kg" e "vendeu N kg" saem de medir o World.
 *
 * Existe porque um clique num lugar longe ficava mudo até a chegada. Medido no
 * browser: dez cliques no depósito, dez segundos inteiros sem uma linha, e aí um
 * resultado só. Silêncio de dez segundos é indistinguível de clique perdido —
 * exatamente o sintoma que esta etapa foi aberta pra matar.
 */
export interface ActionOrder {
  readonly placeLabel: string;
  readonly distancePx: number;
  /** Já dá pra agir daqui: a mesma condição que stepManager usa pra chegada. */
  readonly inReach: boolean;
  readonly replacedOrder: boolean;
}

export function actionOrderLine(order: ActionOrder): string {
  const state = order.inReach
    ? "em alcance, ordem na fila"
    : `a caminho, ${Math.round(order.distancePx)} px`;
  return `${LEFT} → ${order.placeLabel} → ${state}${replacedSuffix(order.replacedOrder)}`;
}

export function emptyClickLine(): string {
  return `${LEFT} → vazio (nem depósito nem refinaria)`;
}

/**
 * `label` é o rótulo do lugar, ou o ponto solto do clique direito.
 *
 * Leva o tick porque as linhas se intercalam: num mesmo frame sai primeiro o
 * resultado do comando ANTERIOR (a drenagem vem antes do passo do gerente, e por
 * bom motivo — ver drainActions) e só depois a chegada NOVA. Sem o tick nas duas,
 * a leitura vira "minerou, e aí chegou", que parece fora de ordem e não está.
 *
 * Só linha causada por TICK carrega tick. Linha causada por clique ou tecla não
 * carrega: ela acontece entre ticks, e um número ali sugeriria uma precisão que
 * ela não tem.
 */
export function arrivalLine(label: string, tickCount: number): string {
  return `chegou em ${label}  (tick ${tickCount})`;
}

export function destinationLabel(x: number, y: number): string {
  return point(x, y);
}

export function npcToggleLine(visible: boolean): string {
  return `tecla N → NPCs ${visible ? "on" : "off"}`;
}

function mineOutcome(before: EconomySample, after: EconomySample, carryCapacityKg: number): string {
  const stockDelta = after.stockKg - before.stockKg;
  const depositDelta = after.depositKg - before.depositKg;

  // Só conta como extração se o que entrou na carga saiu do depósito. Um "ganhou
  // 2 kg do nada" é bug de economia, e tem que aparecer como bug, não como golpe.
  if (stockDelta > 0 && depositDelta === -stockDelta) {
    return `minerou ${stockDelta} kg`;
  }

  if (stockDelta === 0 && depositDelta === 0) {
    // Carga cheia antes de depósito vazio: quando as duas coisas valem, "carga
    // cheia" é a que diz o que fazer em seguida (ir vender).
    if (before.stockKg >= carryCapacityKg) return "carga cheia, nada extraído";
    if (before.depositKg === 0) return "depósito vazio";
    return "nada extraído, e nem a carga estava cheia nem o depósito vazio";
  }

  return `MEDIDA INESPERADA: carga ${signed(stockDelta)} kg, depósito ${signed(depositDelta)} kg`;
}

function sellOutcome(before: EconomySample, after: EconomySample): string {
  const stockDelta = after.stockKg - before.stockKg;
  const moneyDelta = sub(after.money, before.money);

  if (stockDelta < 0 && moneyDelta > 0) {
    return `vendeu ${-stockDelta} kg por ${fmt(moneyDelta)}`;
  }

  if (stockDelta === 0 && moneyDelta === 0) {
    if (before.stockKg === 0) return "carga vazia, nada a vender";
    return "nada vendido, e a carga não estava vazia";
  }

  return `MEDIDA INESPERADA: carga ${signed(stockDelta)} kg, dinheiro ${fmt(moneyDelta)}`;
}

/**
 * Igual em espírito a mineOutcome/sellOutcome: mede o delta de employeeCount e
 * dinheiro, nunca assume que a tecla funcionou. `MINING.hireCost` não entra
 * aqui como número cravado — vem de `context.hireCost`, o mesmo balanceamento
 * que `hire()` usa de verdade, pra mensagem e medida não poderem discordar.
 */
function hireOutcome(before: EconomySample, after: EconomySample, hireCost: Money): string {
  const employeeDelta = after.employeeCount - before.employeeCount;
  // Comparação, não aritmética monetária: -hireCost só inverte o sinal de um
  // valor que já existe, não deriva um novo — a Regra 2 barra operador cru
  // sobre Money quando ele PRODUZ um valor (que poderia precisar arredondar).
  const moneyDelta = sub(after.money, before.money);

  if (employeeDelta === 1 && moneyDelta === -hireCost) {
    return `contratou funcionário nº ${after.employeeCount}`;
  }

  if (employeeDelta === 0 && moneyDelta === 0) {
    return `sem dinheiro para contratar (precisa de ${fmt(hireCost)})`;
  }

  return `MEDIDA INESPERADA: funcionários ${signed(employeeDelta)}, dinheiro ${fmt(moneyDelta)}`;
}

/**
 * Linha (ou linhas) de uma leva de comandos que acabou de rodar no tick.
 *
 * Com mais de um comando na mesma leva, o delta medido é AGREGADO e não dá pra
 * atribuir por comando — então sai uma linha só, dizendo isso. Hoje a fila nunca
 * passa de um (só frames que rodaram tick avançam o gerente, e esses mesmos
 * frames drenam a fila), mas depender desse encadeamento em silêncio é como se
 * perde a medida: se ele mudar, a linha avisa em vez de mentir.
 */
export function describeActions(
  actions: readonly ActionRecord[],
  before: EconomySample,
  after: EconomySample,
  context: OutcomeContext,
): readonly string[] {
  if (actions.length === 0) return [];
  const at = `(tick ${after.tickCount})`;

  if (actions.length === 1) {
    const action = actions[0];
    if (action.kind === "hire") {
      return [`${KEY_H} → ${hireOutcome(before, after, context.hireCost)}  ${at}`];
    }
    const outcome =
      action.kind === "mine"
        ? mineOutcome(before, after, context.carryCapacityKg)
        : sellOutcome(before, after);
    return [`${LEFT} → ${action.placeLabel} → ${outcome}  ${at}`];
  }

  // Leva mista (ex.: um clique e uma tecla H no mesmo tick): "CONTRATAR" no
  // lugar de um placeLabel que hire não tem. Ainda cai no ramo AGREGADO — a
  // atribuição por comando já não dava pra fazer antes disto existir.
  const labels = actions
    .map((action) => (action.kind === "hire" ? "CONTRATAR" : action.placeLabel))
    .join(", ");
  const stockDelta = signed(after.stockKg - before.stockKg);
  const moneyDelta = fmt(sub(after.money, before.money));
  return [
    `${LEFT} ×${actions.length} → ${labels} → carga ${stockDelta} kg, dinheiro ${moneyDelta}  ${at} — delta AGREGADO, ${actions.length} comandos no mesmo tick`,
  ];
}

/**
 * As ações já disparadas pelo gerente cujo comando ainda não rodou no `sim/`.
 *
 * Existe porque o comando entra na fila e só roda no próximo tick (até 100ms
 * depois): a linha precisa esperar o efeito acontecer pra poder medi-lo. Anda em
 * paralelo com `FrameState.pendingCommands` — mesmo momento de enfileiramento,
 * mesmo momento de drenagem.
 */
export interface ActionQueue {
  readonly actions: readonly ActionRecord[];
}

export const EMPTY_ACTION_QUEUE: ActionQueue = { actions: [] };

export function queueAction(queue: ActionQueue, action: ActionRecord): ActionQueue {
  return { actions: queue.actions.concat([action]) };
}

export interface DrainResult {
  readonly queue: ActionQueue;
  readonly lines: readonly string[];
}

/**
 * Fecha a conta das ações pendentes, se o frame rodou tick.
 *
 * `ticksRan === 0` é a condição de "a fila NÃO foi consumida": updateFrame só
 * limpa `pendingCommands` quando roda pelo menos um tick. Com TICK_MS = 100 e
 * tela a 60fps, a maioria dos frames cai aqui — drenar sem essa checagem
 * inventaria um resultado zerado pra um comando que ainda nem rodou.
 */
export function drainActions(
  queue: ActionQueue,
  ticksRan: number,
  before: EconomySample,
  after: EconomySample,
  context: OutcomeContext,
): DrainResult {
  if (ticksRan === 0 || queue.actions.length === 0) {
    return { queue, lines: [] };
  }
  return {
    queue: EMPTY_ACTION_QUEUE,
    lines: describeActions(queue.actions, before, after, context),
  };
}

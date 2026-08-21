import { Text } from "pixi.js";
import { fiscalMonth, nextFiscalMonthTick } from "../../sim/core/time";
import { fmt, mul, type Money } from "../../sim/economy/money";
import type { World } from "../../sim/core/World";

/**
 * Leitura numérica crua do estado econômico. NÃO é HUD — é instrumento, no mesmo
 * espírito do DebugOverlayView: existe pra eu conseguir julgar o ritmo jogando
 * cinco minutos, não pra ser bonito. HUD é a F1-E6.
 */
export interface ReadoutSnapshot {
  readonly money: World["money"];
  readonly stockKg: number;
  readonly carryCapacityKg: number;
  readonly depositKg: number;
  readonly tickCount: number;
  readonly fiscalMonthTicks: number;
  readonly employeeCount: number;
  /** Salário de UM funcionário — a linha multiplica pra mostrar a folha total. */
  readonly wagePerEmployee: Money;
}

/** Formatação pura, sem Pixi — testável sem precisar de um Text real. */
export function formatReadoutText(snapshot: ReadoutSnapshot): string {
  const month = fiscalMonth(snapshot.tickCount, snapshot.fiscalMonthTicks);
  const intoMonth = snapshot.tickCount % snapshot.fiscalMonthTicks;
  const monthProgress = ((intoMonth / snapshot.fiscalMonthTicks) * 100).toFixed(0);
  const full = snapshot.stockKg >= snapshot.carryCapacityKg ? "  [CHEIO]" : "";
  const payroll = mul(snapshot.wagePerEmployee, snapshot.employeeCount);
  const nextTurnover = nextFiscalMonthTick(snapshot.tickCount, snapshot.fiscalMonthTicks);

  return [
    `Dinheiro: ${fmt(snapshot.money)}`,
    `Carga: ${snapshot.stockKg} / ${snapshot.carryCapacityKg} kg${full}`,
    `Depósito: ${snapshot.depositKg} kg restantes`,
    `Mês fiscal: ${month}  (${monthProgress}% — tick ${intoMonth}/${snapshot.fiscalMonthTicks})`,
    `Funcionários: ${snapshot.employeeCount}  (folha: ${fmt(payroll)} / mês)`,
    `Próxima virada: tick ${nextTurnover}`,
    `Tick: ${snapshot.tickCount}`,
  ].join("\n");
}

export function createReadout(): Text {
  const text = new Text({
    text: "",
    style: { fill: 0xf5edd8, fontFamily: "monospace", fontSize: 16, lineHeight: 20 },
  });
  // Abaixo do DebugOverlayView, que ocupa o topo-esquerdo com ~9 linhas. Sem
  // este deslocamento os dois textos se escrevem um sobre o outro e nenhum dos
  // dois é legível — achado abrindo o jogo, não por teste: os dois são Text do
  // Pixi em app.stage e nada em código sabe onde o outro está.
  text.position.set(12, 200);
  return text;
}

export function updateReadout(view: Text, snapshot: ReadoutSnapshot): void {
  view.text = formatReadoutText(snapshot);
}

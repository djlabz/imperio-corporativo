/**
 * Mês fiscal derivado do contador de ticks. NÃO é campo do World de propósito:
 * estado duplicado sai de sincronia, e o mês é função pura do tick.
 *
 * Mês 1 é o primeiro: o tick 0 já está dentro dele. Com 1800 ticks por mês, o
 * tick 1799 ainda é mês 1 e o 1800 é o primeiro tick do mês 2.
 */
export function fiscalMonth(tickCount: number, ticksPerMonth: number): number {
  return Math.floor(tickCount / ticksPerMonth) + 1;
}

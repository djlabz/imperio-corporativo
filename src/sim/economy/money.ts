declare const MoneyBrand: unique symbol;

/**
 * SEMPRE centavos, SEMPRE inteiro. Construção só via `centavos()` / `reais()`.
 *
 * O brand barra passar um `number` cru como argumento onde se espera `Money`
 * e atribuir `number` cru a uma variável `Money` — mas NÃO barra `money + 5`
 * cru: o operador `+`/`-`/`*` do TypeScript só exige que os operandos sejam
 * atribuíveis a `number`, e um branded number é um `number`. Sempre passe
 * por `add`/`sub`/`mul`/`applyRate`, nunca pelo operador cru.
 */
export type Money = number & { readonly [MoneyBrand]: true };

/** Basis points. 1 bp = 0,01%. 10_000 bps = 100%. */
export type Bps = number;

function assertSafeCents(value: number): Money {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Money precisa ser inteiro em centavos; recebeu ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(
      `Money excede Number.MAX_SAFE_INTEGER centavos (${Number.MAX_SAFE_INTEGER}); recebeu ${value}`,
    );
  }
  return value as Money;
}

/** Constrói Money a partir de um valor já em centavos. */
export function centavos(value: number): Money {
  return assertSafeCents(value);
}

/**
 * Constrói Money a partir de um valor em reais (pode ser fracionário, ex. 19.9).
 *
 * Usa `Math.round`, não `Math.floor`: `19.9 * 100` dá `1989.9999999999998` em
 * ponto flutuante, e floor cortaria para 1989 centavos — errado por 1 centavo.
 * Isto não é a aritmética de percentual da Regra 2 (essa usa floor); é a
 * correção do erro de representação do próprio float na borda de entrada.
 */
export function reais(value: number): Money {
  return assertSafeCents(Math.round(value * 100));
}

/** Formata em pt-BR: `R$ 1.234,56`. Negativo vira `-R$ 1.234,56`. */
export function fmt(money: Money): string {
  const sign = money < 0 ? "-" : "";
  const abs = Math.abs(money);
  const reaisPart = Math.floor(abs / 100);
  const centsPart = abs % 100;
  return `${sign}R$ ${reaisPart.toLocaleString("pt-BR")},${centsPart.toString().padStart(2, "0")}`;
}

export function add(a: Money, b: Money): Money {
  return assertSafeCents(a + b);
}

export function sub(a: Money, b: Money): Money {
  return assertSafeCents(a - b);
}

/** Multiplica por um fator inteiro (ex.: preço unitário × quantidade). */
export function mul(money: Money, factor: number): Money {
  return assertSafeCents(Math.floor(money * factor));
}

/** Aplica uma taxa em basis points. Math.floor: nunca deixa o jogador ganhar a fração perdida. */
export function applyRate(money: Money, bps: Bps): Money {
  return assertSafeCents(Math.floor((money * bps) / 10_000));
}

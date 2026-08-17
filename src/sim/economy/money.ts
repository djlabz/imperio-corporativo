declare const MoneyBrand: unique symbol;
declare const BpsBrand: unique symbol;

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

/**
 * Basis points. 1 bp = 0,01%. 10_000 bps = 100%. SEMPRE inteiro, SEMPRE em
 * [0, MAX_BPS]. Construção só via `bps()` — sem isso, `applyRate(m, 0.15)`
 * (querendo dizer 15%) compila, roda, e devolve 0 em silêncio.
 */
export type Bps = number & { readonly [BpsBrand]: true };

/** Teto de sanidade (1000%), não regra de negócio — ajuste se o balanceamento pedir mais. */
const MAX_BPS = 100_000;

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
 * Isto não é a aritmética de percentual da Regra 2 (essa usa trunc — ver
 * applyRate); é a correção do erro de representação do próprio float na
 * borda de entrada.
 */
export function reais(value: number): Money {
  return assertSafeCents(Math.round(value * 100));
}

/**
 * Constrói Bps a partir de um inteiro. `bps(1500)` é 15%, nunca `0.15` —
 * a Regra 2 do CLAUDE.md pede exatamente essa forma, e sem essa validação
 * `applyRate(m, 0.15)` compilava, rodava, e devolvia 0 (Math.floor(0.15) = 0).
 */
export function bps(value: number): Bps {
  if (!Number.isInteger(value)) {
    throw new RangeError(`Bps precisa ser inteiro; recebeu ${value}. 15% é bps(1500), não 0.15.`);
  }
  if (value < 0 || value > MAX_BPS) {
    throw new RangeError(`Bps fora da faixa [0, ${MAX_BPS}]; recebeu ${value}.`);
  }
  return value as Bps;
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

/**
 * Multiplica por um fator inteiro (ex.: preço unitário × quantidade).
 *
 * `Math.trunc`, não `Math.floor`: floor arredonda sempre em direção a
 * -infinito, o que troca de sentido com `money` negativo — perde fração a
 * favor da casa quando positivo (`floor(50.5) = 50`), mas GANHA fração de
 * dívida quando negativo (`floor(-50.5) = -51`, dívida maior que a exata).
 * `trunc` arredonda em direção a zero nos dois sinais: a casa sempre fica
 * com a fração, nunca o contrário. Ver commit que corrigiu isto para os
 * números medidos que motivaram a troca.
 */
export function mul(money: Money, factor: number): Money {
  return assertSafeCents(Math.trunc(money * factor));
}

/**
 * Aplica uma taxa em basis points.
 *
 * Duas correções sobre a versão anterior:
 *
 * 1. Sinal: usa BigInt em vez de `Math.trunc(money * bps / 10_000)` em
 *    float. `Math.trunc` sozinho já resolveria a inversão de sinal (ver
 *    mul() acima), mas...
 * 2. Precisão: o intermediário `money * bps` estoura `Number.MAX_SAFE_INTEGER`
 *    bem antes do RESULTADO final estourar — money no teto do projeto
 *    (~R$90tri) × bps alto já passa de 2^53 no produto, e dividir de volta
 *    por 10_000 em float devolve um valor que PARECE seguro (passa em
 *    `Number.isSafeInteger`) mas está errado por 1 centavo. Medido: 0
 *    divergências em 200k amostras a ~1e12 centavos, 142 a ~1e14, 823 a
 *    ~1e15 — silencioso, sem esse teste ninguém veria.
 *
 * BigInt multiplica e divide exato (sem passar por float em nenhum ponto
 * intermediário) e, por construção, trunca a divisão em direção a zero nos
 * dois sinais — mesma semântica de mul(). Custo de BigInt aqui é irrelevante:
 * applyRate não roda por NPC nem por frame, roda por evento fiscal.
 */
export function applyRate(money: Money, rate: Bps): Money {
  const exact = (BigInt(money) * BigInt(rate)) / 10_000n;
  return assertSafeCents(Number(exact));
}

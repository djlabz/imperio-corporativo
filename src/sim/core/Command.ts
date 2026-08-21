/**
 * Intenção do jogador entrando no núcleo (D-016). União discriminada,
 * serializável: sem função, sem classe, sem referência — a mesma restrição que o
 * World carrega, porque um comando pode precisar atravessar um Web Worker.
 *
 * A fila NÃO mora no World. Ela é argumento de tick(); ver D-016 pro porquê.
 */
export type Command =
  { readonly kind: "MINE" } | { readonly kind: "SELL" } | { readonly kind: "HIRE" };

import { Text } from "pixi.js";

/**
 * A linha do último evento, na tela e no console.
 *
 * Existe porque o único retorno que o jogo dava era um número num canto que
 * ninguém olha jogando: sem isto, clicar na rocha e nada acontecer é
 * indistinguível de clicar na rocha e o jogo não ter entendido o clique.
 *
 * O `console.log` mora AQUI, junto do texto da tela, e não em quem chama: as duas
 * saídas têm que ser a mesma string, e o jeito de garantir isso é elas saírem do
 * mesmo lugar. Instrumento, não HUD — HUD é a F1-E6.
 */
export function createEventLine(): Text {
  const text = new Text({
    text: "—",
    style: { fill: 0x6fd8e8, fontFamily: "monospace", fontSize: 16 },
  });
  // Abaixo do ReadoutView, que começa em y=200 e ocupa 5 linhas de 20px.
  // Mesmo cuidado (e mesmo motivo) do deslocamento que o readout já carrega:
  // nada em código sabe onde o outro Text está.
  text.position.set(12, 312);
  return text;
}

export function showEvent(view: Text, line: string): void {
  view.text = line;
  console.log(line);
}

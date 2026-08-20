import { Container, Graphics, Text } from "pixi.js";
import type { Manager } from "./manager";

const BODY_WIDTH = 22;
const BODY_HEIGHT = 34;
const OUTLINE_COLOR = 0x1a1a1a; // preto da paleta travada, não #000 puro
const OUTLINE_WIDTH = 4; // convenção de arte do CLAUDE.md
const BODY_COLOR = 0x2b6cb0; // azul da paleta — destaca do cinza dos NPCs decorativos

/**
 * O gerente: retângulo placeholder, maior e de cor diferente dos NPCs pra ser
 * achável na tela. Arte de verdade é outra etapa.
 *
 * Origem nos PÉS (y=0 na base, centralizado em x), igual ao NpcPoolView: o pé é
 * o que toca o chão, então é ele que decide o Y-sort.
 */
export interface ManagerView {
  readonly container: Container;
}

export function buildManagerView(): ManagerView {
  const container = new Container();

  const body = new Graphics()
    .rect(-BODY_WIDTH / 2, -BODY_HEIGHT, BODY_WIDTH, BODY_HEIGHT)
    .fill(BODY_COLOR)
    .stroke({ color: OUTLINE_COLOR, width: OUTLINE_WIDTH });
  container.addChild(body);

  // Rótulo acima da cabeça: sem arte, é o que distingue "aquele é você" de
  // "aquele é decorativo".
  const label = new Text({
    text: "VOCÊ",
    style: { fill: 0xf5edd8, fontFamily: "monospace", fontSize: 14, fontWeight: "bold" },
  });
  label.anchor.set(0.5, 1);
  label.position.set(0, -BODY_HEIGHT - 4);
  container.addChild(label);

  return { container };
}

/** Copia a posição do gerente pro Container. Não cria nem destrói nada. */
export function syncManagerView(view: ManagerView, manager: Manager): void {
  view.container.position.set(manager.x, manager.y);
  view.container.zIndex = manager.y; // mesmo critério do NpcPoolView
}

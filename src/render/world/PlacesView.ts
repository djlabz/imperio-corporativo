import { Container, Graphics, Text } from "pixi.js";
import { centerOf, type Place } from "./layout";

const OUTLINE_COLOR = 0x1a1a1a;
const OUTLINE_WIDTH = 4;
const REACH_COLOR = 0xfcee8a; // amarelo claro da paleta
const HOVER_COLOR = 0xffd23f; // amarelo forte da paleta
const HOVER_WIDTH = 6;
const HOVER_INSET = 4; // por fora do contorno do prédio, pra não brigar com ele

/**
 * Depósito e refinaria como retângulos rotulados. Placeholder declarado: arte de
 * verdade é outra etapa, e o que importa aqui é ter DOIS pontos separados no mapa
 * pra caminhada custar tempo (D-017, complemento).
 *
 * Desenha também o círculo de alcance, tracejado por opacidade baixa: sem ele o
 * jogador não tem como saber de onde o clique já funciona, e "por que ele andou
 * até o meio do prédio?" viraria bug aparente.
 */
export interface PlaceView {
  readonly container: Container;
  /**
   * Moldura de destaque, ligada quando o ponteiro está sobre o lugar. Sem ela não
   * há nada dizendo que o retângulo é clicável — foi o relato de jogar a F1-E3 e
   * não conseguir minerar: o alvo existia e não se anunciava.
   */
  readonly hoverOutline: Graphics;
}

export function buildPlaceView(place: Place, fillColor: number, reachRadius: number): PlaceView {
  const container = new Container();
  const [cx, cy] = centerOf(place);

  const reach = new Graphics()
    .circle(cx, cy, reachRadius)
    .fill({ color: REACH_COLOR, alpha: 0.12 });
  container.addChild(reach);

  const body = new Graphics()
    .rect(place.x, place.y, place.width, place.height)
    .fill(fillColor)
    .stroke({ color: OUTLINE_COLOR, width: OUTLINE_WIDTH });
  container.addChild(body);

  const label = new Text({
    text: place.label,
    style: { fill: 0x1a1a1a, fontFamily: "monospace", fontSize: 18, fontWeight: "bold" },
  });
  label.anchor.set(0.5, 0.5);
  label.position.set(cx, cy);
  container.addChild(label);

  const hoverOutline = new Graphics()
    .rect(
      place.x - HOVER_INSET,
      place.y - HOVER_INSET,
      place.width + HOVER_INSET * 2,
      place.height + HOVER_INSET * 2,
    )
    .stroke({ color: HOVER_COLOR, width: HOVER_WIDTH });
  hoverOutline.visible = false;
  container.addChild(hoverOutline);

  // Y-sort pela base do retângulo, mesmo critério do TileMapView e do NpcPoolView.
  container.zIndex = place.y + place.height;
  return { container, hoverOutline };
}

export function setPlaceHovered(view: PlaceView, hovered: boolean): void {
  view.hoverOutline.visible = hovered;
}

import { Container, Graphics, Text } from "pixi.js";
import { centerOf, type Place } from "./layout";

const OUTLINE_COLOR = 0x1a1a1a;
const OUTLINE_WIDTH = 4;
const REACH_COLOR = 0xfcee8a; // amarelo claro da paleta

/**
 * Depósito e refinaria como retângulos rotulados. Placeholder declarado: arte de
 * verdade é outra etapa, e o que importa aqui é ter DOIS pontos separados no mapa
 * pra caminhada custar tempo (D-017, complemento).
 *
 * Desenha também o círculo de alcance, tracejado por opacidade baixa: sem ele o
 * jogador não tem como saber de onde o clique já funciona, e "por que ele andou
 * até o meio do prédio?" viraria bug aparente.
 */
export function buildPlaceView(place: Place, fillColor: number, reachRadius: number): Container {
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

  // Y-sort pela base do retângulo, mesmo critério do TileMapView e do NpcPoolView.
  container.zIndex = place.y + place.height;
  return container;
}

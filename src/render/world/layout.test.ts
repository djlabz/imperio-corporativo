import { describe, expect, it } from "vitest";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./tileMap";
import { MAP, centerOf, containsPoint, isWithinReach, parseMapLayout } from "./layout";

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    deposit: { x: 10, y: 20, width: 100, height: 80, label: "D" },
    refinery: { x: 500, y: 600, width: 100, height: 80, label: "R" },
    managerSpeedPerTick: 14,
    reachRadius: 140,
    arrivalRadius: 10,
    ...overrides,
  };
}

describe("parseMapLayout()", () => {
  it("aceita o layout válido", () => {
    expect(parseMapLayout(valid()).managerSpeedPerTick).toBe(14);
  });

  it("rejeita campo faltando, com o nome na mensagem", () => {
    const raw = valid();
    delete (raw as Record<string, unknown>).refinery;
    expect(() => parseMapLayout(raw)).toThrow(/refinery/);
  });

  it("rejeita rótulo vazio — o retângulo é placeholder, mas tem que dizer o que é", () => {
    const semRotulo = valid({
      deposit: { x: 10, y: 20, width: 100, height: 80, label: "" },
    });
    expect(() => parseMapLayout(semRotulo)).toThrow(/label/);
  });

  it("rejeita velocidade e alcance zero ou negativos", () => {
    expect(() => parseMapLayout(valid({ managerSpeedPerTick: 0 }))).toThrow(/managerSpeedPerTick/);
    expect(() => parseMapLayout(valid({ reachRadius: -1 }))).toThrow(/reachRadius/);
  });

  it("rejeita NaN e não-inteiro", () => {
    expect(() => parseMapLayout(valid({ reachRadius: NaN }))).toThrow(/reachRadius/);
    expect(() => parseMapLayout(valid({ managerSpeedPerTick: 1.5 }))).toThrow(
      /managerSpeedPerTick/,
    );
  });
});

describe("o map.json de verdade", () => {
  it("põe os dois lugares dentro do mundo", () => {
    for (const place of [MAP.deposit, MAP.refinery]) {
      expect(place.x).toBeGreaterThanOrEqual(0);
      expect(place.y).toBeGreaterThanOrEqual(0);
      expect(place.x + place.width).toBeLessThanOrEqual(WORLD_WIDTH);
      expect(place.y + place.height).toBeLessThanOrEqual(WORLD_HEIGHT);
    }
  });

  it("separa os dois o bastante pra caminhada custar tempo", () => {
    // A âncora do atrito de D-017. Se alguém puser os dois lado a lado ajustando
    // o balanceamento, o "gerente tem corpo" volta a ser só animação — e nenhum
    // outro teste acusaria.
    const [dx, dy] = centerOf(MAP.deposit);
    const [rx, ry] = centerOf(MAP.refinery);
    const distance = Math.hypot(rx - dx, ry - dy);
    const effective = distance - MAP.reachRadius * 2;
    const secondsOneWay = effective / (MAP.managerSpeedPerTick * 10);

    expect(effective).toBeGreaterThan(0); // os alcances não se sobrepõem
    expect(secondsOneWay).toBeGreaterThan(5);
  });

  it("os alcances não se sobrepõem — vender de dentro do depósito mataria a viagem", () => {
    const [dx, dy] = centerOf(MAP.deposit);
    expect(isWithinReach(dx, dy, MAP.refinery, MAP.reachRadius)).toBe(false);
  });
});

describe("isWithinReach() e containsPoint()", () => {
  const place = { x: 100, y: 100, width: 100, height: 100, label: "P" };

  it("alcance é medido do CENTRO do lugar", () => {
    expect(centerOf(place)).toEqual([150, 150]);
    expect(isWithinReach(150, 150, place, 10)).toBe(true);
    expect(isWithinReach(150 + 10, 150, place, 10)).toBe(true); // na borda conta
    expect(isWithinReach(150 + 11, 150, place, 10)).toBe(false);
  });

  it("containsPoint pega o retângulo, incluindo as bordas", () => {
    expect(containsPoint(place, 100, 100)).toBe(true);
    expect(containsPoint(place, 200, 200)).toBe(true);
    expect(containsPoint(place, 99, 150)).toBe(false);
    expect(containsPoint(place, 201, 150)).toBe(false);
  });
});

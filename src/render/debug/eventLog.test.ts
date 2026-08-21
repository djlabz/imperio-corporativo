import { describe, expect, it } from "vitest";
import { centavos } from "../../sim/economy/money";
import { MINING } from "../../sim/data/balance";
import { mine, sell } from "../../sim/economy/mining";
import { createWorld } from "../../sim/core/World";
import { tick } from "../../sim/core/tick";
import {
  actionOrderLine,
  arrivalLine,
  describeActions,
  destinationLabel,
  drainActions,
  emptyClickLine,
  EMPTY_ACTION_QUEUE,
  moveLine,
  npcToggleLine,
  queueAction,
  sampleEconomy,
  type EconomySample,
} from "./eventLog";

function sample(partial: Partial<EconomySample> = {}): EconomySample {
  return {
    money: centavos(0),
    stockKg: 0,
    depositKg: 5_000,
    tickCount: 1,
    ...partial,
  };
}

const CAP = MINING.carryCapacityKg;

describe("linhas imediatas", () => {
  it("clique direito diz para onde", () => {
    expect(moveLine(1_234.6, 567.2, false)).toBe("clique direito → caminhando para (1235, 567)");
  });

  it("ordem que substitui outra DIZ que substituiu", () => {
    // Medido no browser: dez cliques no depósito com o gerente na refinaria deram
    // UM "minerou 2 kg". Nove ordens foram canceladas pela seguinte, e sem esta
    // anotação o log mostrava a discrepância sem explicá-la.
    expect(moveLine(10, 20, true)).toBe(
      "clique direito → caminhando para (10, 20) (cancela a ordem anterior)",
    );
    expect(
      actionOrderLine({
        placeLabel: "DEPÓSITO",
        distancePx: 1_902.7,
        inReach: false,
        replacedOrder: true,
      }),
    ).toBe("clique esquerdo → DEPÓSITO → a caminho, 1903 px (cancela a ordem anterior)");
  });

  it("ordem em alcance não promete resultado nenhum", () => {
    // A redação importa: esta linha não pode passar por resultado medido. Só
    // "minerou"/"vendeu" saem de comparar o World.
    const line = actionOrderLine({
      placeLabel: "REFINARIA",
      distancePx: 12,
      inReach: true,
      replacedOrder: false,
    });
    expect(line).toBe("clique esquerdo → REFINARIA → em alcance, ordem na fila");
    expect(line).not.toContain("minerou");
    expect(line).not.toContain("vendeu");
  });

  it("clique esquerdo no vazio DIZ que caiu no vazio", () => {
    // Silêncio aqui é indistinguível de "o clique não chegou" — foi o sintoma
    // relatado ao jogar a F1-E3.
    expect(emptyClickLine()).toBe("clique esquerdo → vazio (nem depósito nem refinaria)");
  });

  it("chegada e tecla N", () => {
    expect(arrivalLine("DEPÓSITO", 244)).toBe("chegou em DEPÓSITO  (tick 244)");
    expect(arrivalLine(destinationLabel(10, 20), 7)).toBe("chegou em (10, 20)  (tick 7)");
    expect(npcToggleLine(false)).toBe("tecla N → NPCs off");
    expect(npcToggleLine(true)).toBe("tecla N → NPCs on");
  });
});

describe("describeActions() — minerar", () => {
  it("relata o kg MEDIDO, não o kg esperado", () => {
    const before = sample({ stockKg: 0, depositKg: 5_000 });
    const after = sample({ stockKg: 2, depositKg: 4_998, tickCount: 2 });

    expect(describeActions([{ kind: "mine", placeLabel: "DEPÓSITO" }], before, after, CAP)).toEqual(
      ["clique esquerdo → DEPÓSITO → minerou 2 kg  (tick 2)"],
    );
  });

  it("carga cheia", () => {
    const before = sample({ stockKg: CAP });
    expect(
      describeActions([{ kind: "mine", placeLabel: "DEPÓSITO" }], before, before, CAP)[0],
    ).toContain("carga cheia, nada extraído");
  });

  it("depósito vazio", () => {
    const before = sample({ stockKg: 10, depositKg: 0 });
    expect(
      describeActions([{ kind: "mine", placeLabel: "DEPÓSITO" }], before, before, CAP)[0],
    ).toContain("depósito vazio");
  });

  it("nada extraído sem motivo conhecido NÃO passa por golpe silencioso", () => {
    // Este é o ramo que importa: o sim não fez nada e nenhuma das duas
    // explicações conhecidas se aplica. Uma linha que reportasse a intenção
    // ("minerou 2 kg") esconderia exatamente isto.
    const before = sample({ stockKg: 10, depositKg: 5_000 });
    expect(
      describeActions([{ kind: "mine", placeLabel: "DEPÓSITO" }], before, before, CAP)[0],
    ).toContain("nada extraído, e nem a carga estava cheia nem o depósito vazio");
  });

  it("minério que aparece sem sair do depósito é MEDIDA INESPERADA", () => {
    const before = sample({ stockKg: 0, depositKg: 5_000 });
    const after = sample({ stockKg: 2, depositKg: 5_000, tickCount: 2 });
    expect(
      describeActions([{ kind: "mine", placeLabel: "DEPÓSITO" }], before, after, CAP)[0],
    ).toContain("MEDIDA INESPERADA: carga +2 kg, depósito +0 kg");
  });
});

describe("describeActions() — vender", () => {
  it("relata kg e dinheiro MEDIDOS", () => {
    const before = sample({ stockKg: 50, money: centavos(0) });
    const after = sample({ stockKg: 0, money: centavos(2_250), tickCount: 2 });

    expect(
      describeActions([{ kind: "sell", placeLabel: "REFINARIA" }], before, after, CAP),
    ).toEqual(["clique esquerdo → REFINARIA → vendeu 50 kg por R$ 22,50  (tick 2)"]);
  });

  it("carga vazia", () => {
    const before = sample({ stockKg: 0 });
    expect(
      describeActions([{ kind: "sell", placeLabel: "REFINARIA" }], before, before, CAP)[0],
    ).toContain("carga vazia, nada a vender");
  });

  it("carga cheia e nada vendido é reportado, não silenciado", () => {
    const before = sample({ stockKg: 30 });
    expect(
      describeActions([{ kind: "sell", placeLabel: "REFINARIA" }], before, before, CAP)[0],
    ).toContain("nada vendido, e a carga não estava vazia");
  });

  it("venda sem dinheiro entrando é MEDIDA INESPERADA", () => {
    const before = sample({ stockKg: 50 });
    const after = sample({ stockKg: 0, tickCount: 2 });
    expect(
      describeActions([{ kind: "sell", placeLabel: "REFINARIA" }], before, after, CAP)[0],
    ).toContain("MEDIDA INESPERADA");
  });
});

describe("describeActions() — leva com mais de um comando", () => {
  it("diz que o delta é agregado em vez de atribuir por comando", () => {
    const before = sample({ stockKg: 0, depositKg: 5_000 });
    const after = sample({ stockKg: 4, depositKg: 4_996, tickCount: 2 });
    const lines = describeActions(
      [
        { kind: "mine", placeLabel: "DEPÓSITO" },
        { kind: "mine", placeLabel: "DEPÓSITO" },
      ],
      before,
      after,
      CAP,
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("clique esquerdo ×2 → DEPÓSITO, DEPÓSITO");
    expect(lines[0]).toContain("carga +4 kg");
    expect(lines[0]).toContain("delta AGREGADO");
  });
});

describe("drainActions()", () => {
  it("frame sem tick NÃO drena — o comando ainda não rodou", () => {
    // Com TICK_MS = 100 e tela a 60fps, a maioria dos frames cai aqui. Drenar
    // aqui inventaria um "nada aconteceu" pra um comando que nem rodou.
    const queue = queueAction(EMPTY_ACTION_QUEUE, { kind: "mine", placeLabel: "DEPÓSITO" });
    const result = drainActions(queue, 0, sample(), sample(), CAP);

    expect(result.lines).toEqual([]);
    expect(result.queue).toBe(queue);
  });

  it("frame com tick drena e zera a fila", () => {
    const queue = queueAction(EMPTY_ACTION_QUEUE, { kind: "mine", placeLabel: "DEPÓSITO" });
    const before = sample({ stockKg: 0, depositKg: 5_000 });
    const after = sample({ stockKg: 2, depositKg: 4_998, tickCount: 2 });
    const result = drainActions(queue, 1, before, after, CAP);

    expect(result.lines).toEqual(["clique esquerdo → DEPÓSITO → minerou 2 kg  (tick 2)"]);
    expect(result.queue.actions).toEqual([]);
  });

  it("fila vazia com tick não produz linha", () => {
    expect(drainActions(EMPTY_ACTION_QUEUE, 1, sample(), sample(), CAP).lines).toEqual([]);
  });
});

describe("a medida fecha com o sim/ de verdade", () => {
  // Os testes acima usam amostras montadas à mão, o que verifica a FORMATAÇÃO mas
  // não que o delta lido corresponde ao que o núcleo faz. Aqui o oráculo é o
  // próprio sim/: o texto sai do World antes e depois de tick() de verdade.
  it("MINE de verdade produz 'minerou 2 kg'", () => {
    const before = createWorld("teste");
    const after = tick(before, [{ kind: "MINE" }]);

    expect(
      describeActions(
        [{ kind: "mine", placeLabel: "DEPÓSITO" }],
        sampleEconomy(before),
        sampleEconomy(after),
        MINING.carryCapacityKg,
      )[0],
    ).toBe(`clique esquerdo → DEPÓSITO → minerou ${MINING.kgPerStrike} kg  (tick 1)`);
  });

  it("SELL de verdade produz o kg e o valor que o núcleo calculou", () => {
    let world = createWorld("teste");
    for (let i = 0; i < 5; i++) world = mine(world, MINING);
    const before = world;
    const after = tick(sell(world, MINING), []);

    const expectedKg = MINING.kgPerStrike * 5;
    expect(
      describeActions(
        [{ kind: "sell", placeLabel: "REFINARIA" }],
        sampleEconomy(before),
        sampleEconomy(after),
        MINING.carryCapacityKg,
      )[0],
    ).toContain(`vendeu ${expectedKg} kg por R$ `);
  });

  it("MINE com a carga cheia de verdade produz 'carga cheia'", () => {
    let world = createWorld("teste");
    while (world.stockKg < MINING.carryCapacityKg) world = mine(world, MINING);
    const after = tick(world, [{ kind: "MINE" }]);

    expect(
      describeActions(
        [{ kind: "mine", placeLabel: "DEPÓSITO" }],
        sampleEconomy(world),
        sampleEconomy(after),
        MINING.carryCapacityKg,
      )[0],
    ).toContain("carga cheia, nada extraído");
  });
});

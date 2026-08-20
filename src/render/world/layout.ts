import { z } from "zod";
import mapJson from "../../sim/data/map.json";

/**
 * Geometria do mapa e velocidade do gerente.
 *
 * SOBRE A CAMADA, porque duas regras se cruzam aqui e a resolução foi
 * deliberada:
 *
 * - a regra inviolável nº 4 do CLAUDE.md manda todo número de balanceamento
 *   morar em `src/sim/data/*.json`, validado por zod. Distância entre depósito e
 *   refinaria e velocidade do gerente SÃO balanceamento: mudam o ritmo do jogo,
 *   e vão ser ajustados muitas vezes.
 * - D-017 manda a posição do gerente ficar FORA do `sim/`.
 *
 * A saída é separar onde o DADO mora de onde o CÓDIGO mora: o JSON fica em
 * `src/sim/data/` (regra 4 satisfeita, tudo ajustável no mesmo lugar) e o loader
 * fica aqui, no renderer. Nenhum módulo de `src/sim/` importa este arquivo nem o
 * map.json, então o núcleo continua sem saber que existe geometria — que é o que
 * D-017 protege.
 */
export interface Place {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
}

export interface MapLayout {
  readonly deposit: Place;
  readonly refinery: Place;
  /** Passo do gerente por tick. A 10 ticks/s, 14 px/tick = 140 px/s. */
  readonly managerSpeedPerTick: number;
  /** Distância do CENTRO do lugar dentro da qual dá pra minerar/vender. */
  readonly reachRadius: number;
  /** Tolerância pra considerar que chegou num destino livre (clique direito). */
  readonly arrivalRadius: number;
}

const PlaceSchema = z.object({
  x: z.int(),
  y: z.int(),
  width: z.int().positive(),
  height: z.int().positive(),
  label: z.string().min(1),
});

const MapLayoutSchema = z.object({
  deposit: PlaceSchema,
  refinery: PlaceSchema,
  managerSpeedPerTick: z.int().positive(),
  reachRadius: z.int().positive(),
  arrivalRadius: z.int().positive(),
});

export function parseMapLayout(raw: unknown): MapLayout {
  const parsed = MapLayoutSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Layout do mapa inválido: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export const MAP: MapLayout = parseMapLayout(mapJson);

/** Centro do lugar. É o ponto que o gerente busca, não o canto. */
export function centerOf(place: Place): readonly [number, number] {
  return [place.x + place.width / 2, place.y + place.height / 2];
}

/** O gerente está perto o bastante pra agir neste lugar? */
export function isWithinReach(x: number, y: number, place: Place, reachRadius: number): boolean {
  const [cx, cy] = centerOf(place);
  return Math.hypot(cx - x, cy - y) <= reachRadius;
}

/** O ponto (x, y) do mundo cai dentro do retângulo deste lugar? */
export function containsPoint(place: Place, x: number, y: number): boolean {
  return x >= place.x && x <= place.x + place.width && y >= place.y && y <= place.y + place.height;
}

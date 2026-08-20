# F1-E3 — Jogável cru: o gerente no mapa

> **Ordem, declarada:** ao contrário da F1-E2, esta spec foi escrita **depois** da
> implementação. O bloco da etapa já era detalhado o bastante pra ser a spec de
> fato, e a sequência (item 0, depois 1 a 5) veio dada. Então isto é **registro
> do que foi decidido e medido**, não previsão. Onde a implementação divergiu ou
> descobriu algo, está marcado.

**Objetivo único:** jogar cinco minutos e dizer se o ritmo está certo. Arte é
placeholder, leitura é número cru. Esta etapa não decide nada sobre o ritmo —
quem decide é o dedo de quem joga.

**Escopo:** `src/render/`, `src/app/`, e UMA mudança no `sim/` (capacidade de
carga). Nada de contratação, imposto, automação, locomoção comprável ou edifício.

---

## 1. Capacidade de carga — a mudança no `sim/`

Sem teto, a jogada ótima é minerar o depósito inteiro e caminhar UMA vez: a
caminhada vira viagem única no fim e o atrito de D-017 não acontece.

`mine()` extrai o **menor** entre três coisas: o tamanho do golpe, o que sobra no
depósito, e o espaço livre na carga. Golpe com carga cheia é no-op.

**Um terceiro limite que o bloco não pediu e é necessário:** `Math.max(0, ...)` no
espaço livre. `carryCapacityKg` é balanceamento, não dado de save — baixar o
número não invalida save nenhum, então um `stockKg` gravado sob um teto maior
chega acima do teto atual. Sem o clamp, o espaço livre fica negativo, vira o menor
dos três, e `extracted` negativo **devolve** minério ao depósito.

**Não é mudança de forma do `World`**, e isto foi confirmado por bytes: o envelope
de save de `createWorld("save-shape-check")` tem o mesmo sha256
(`46ca1a38…`), os mesmos 7 campos e os mesmos 469 bytes antes e depois. Sem bump,
sem migração.

## 2. Flow field com destino

O campo dos NPCs nunca teve destino: é **travessia** (rumo + meandro), não
objetivo. O destino implícito deles é um **rumo**, não um ponto. Daí a união
discriminada:

```ts
{
  kind: ("bearing", angleRad);
} // travessia, com meandro. Os NPCs.
{
  kind: ("point", x, y);
} // objetivo, sem meandro. O gerente.
```

Um par `(x, y)` sozinho exigiria cravar um alvo a ~1e9 px pra simular rumo sem
perturbar o campo — número mágico existindo só pra fazer teste passar. Os 8 testes
de travessia passam **sem alteração**, que é a evidência de que os NPCs não
mudaram.

**Custo medido** (500 amostras, 200 de aquecimento, WSL):

| Campo     | mediana  | p95      | max      |
| --------- | -------- | -------- | -------- |
| `bearing` | 0,0752ms | 0,1797ms | 0,4704ms |
| `point`   | 0,1185ms | 0,2584ms | 1,9771ms |

0,7% de um frame de 16,67ms, e por clique, não por frame. A hipótese que estava
rotulada no D-017 fechou com número.

## 3. O gerente

Retângulo azul da paleta, rótulo "VOCÊ", Y-sort pelos pés. Posição no renderer,
nunca no `World` (D-017).

```
Clique DIREITO em qualquer ponto  → caminha até lá
Clique ESQUERDO no depósito       → caminha até o alcance e dá UM golpe
Clique ESQUERDO na refinaria      → caminha até o alcance e vende tudo
```

Um clique = um golpe: a ordem é consumida no passo em que dispara. Não há
mineração contínua — isso seria automação.

**O botão direito já estava ocupado** pelo pan de câmera (Etapa 3). Separado por
deslocamento: acima de 6px foi arraste, abaixo foi clique. Preserva os dois.

**Aproximação final, e é correção de bug, não refinamento.** O campo dá uma
direção por célula, medida do centro dela. Perto do alvo, essa direção não aponta
de onde o gerente está, e ele orbitava o destino a cerca de uma célula **para
sempre** — a ordem nunca completava, nenhum comando era enfileirado, e nada
acusava. Dentro de `max(speed + arrivalRadius, diagonal do tile)`, o rumo passa a
ser direto ao ponto. Não viola "flow field, nunca A*": o campo faz o trajeto
inteiro; isto é o último passo.

## 4. Geometria e ritmo

|                                  |                       |
| -------------------------------- | --------------------- |
| Depósito                         | (530, 1220), 220×160  |
| Refinaria                        | (2270, 430), 260×180  |
| Distância centro-a-centro        | 1911 px               |
| Distância fora dos dois alcances | 1631 px               |
| Velocidade                       | 14 px/tick = 140 px/s |
| Viagem só-ida                    | 11,6s                 |
| Ida e volta                      | 23,3s                 |
| Alcance                          | 140 px                |

Um teste **ancora** isso: se alguém aproximar os dois ajustando o balanceamento, o
atrito de D-017 morre e nada mais acusaria.

**Camada do `map.json`, resolvida de propósito:** a regra inviolável nº 4 manda
balanceamento em `src/sim/data/*.json`, e distância e velocidade são
balanceamento; D-017 manda posição ficar fora do `sim/`. Separado onde o **dado**
mora de onde o **código** mora: JSON em `src/sim/data/`, loader em
`src/render/world/`. Nenhum módulo do `sim/` importa nenhum dos dois.

## 5. A fila

A intenção que dispara ao chegar entra em `pendingCommands`, não no tick do frame
corrente: os ticks daquele frame já rodaram, e perguntar ao acumulador quantos
_vão_ rodar duplicaria a decisão que `updateFrame` já toma. Custa ≤100ms de
espera, e a fila é o mecanismo que a F1-E2 construiu pra isso.

## 6. Fora de escopo

Contratação, folha, imposto, automação, locomoção comprável, edifício, arte, HUD,
e câmera que segue o gerente (candidata para a F1-E6).

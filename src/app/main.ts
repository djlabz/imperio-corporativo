import { startGame } from "./game";

const root = document.getElementById("game");
if (!root) {
  throw new Error("#game não encontrado em index.html");
}

void startGame(root);

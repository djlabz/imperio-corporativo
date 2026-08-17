/**
 * Erro de save/load distinguível de uma exceção crua vazando. Toda falha
 * esperada do pipeline (HMAC inválido, payload truncado, schema errado,
 * versão incompatível) lança isto, com mensagem clara e acionável — nunca
 * um crash silencioso nem um estado parcialmente carregado.
 */
export class SaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveError";
  }
}

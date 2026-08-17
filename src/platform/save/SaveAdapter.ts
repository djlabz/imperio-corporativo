/**
 * Interface de baixo nível: lê/escreve blobs de bytes por chave. Não sabe
 * nada de World, MessagePack, HMAC ou versão — isso é responsabilidade de
 * `pipeline.ts` e `saveGame.ts`, que ficam por cima de qualquer implementação
 * desta interface. Nada no resto do código sabe onde o save mora.
 */
export interface SaveAdapter {
  write(key: string, data: Uint8Array): Promise<void>;
  read(key: string): Promise<Uint8Array | undefined>;
  /** Chaves existentes, em qualquer ordem — quem usa decide a ordenação. */
  list(): Promise<string[]>;
  remove(key: string): Promise<void>;
}

/**
 * Ceia de Natal: regras da encomenda (fora do cardápio do dia).
 * - Só entrega (sem coleta), grátis até 9 milhas; acima disso, fala com a loja.
 * - Só cartão (pago na hora, no site).
 * - Pedidos até o último dia; entrega na data escolhida.
 * Os kits, carnes e porções são itens do cardápio na categoria "natal" (preços editáveis no painel).
 */
export const CEIA = {
  categoria: "natal",
  /** Último dia para encomendar (Londres). */
  ultimoDia: "2026-12-20",
  /** Fecha às 22:00 de Londres do último dia (em dezembro Londres = UTC). Depois disso some o banner e a página /natal volta para o site. */
  encerraEm: "2026-12-20T22:00:00.000Z",
  raioMilhas: 9,
  /** Dias/horários de entrega que o cliente pode escolher (valor = instante ISO, usado no pedido). */
  datas: [{ valor: "2026-12-24T14:00:00.000Z", rotulo: "Quinta, 24/12 · véspera de Natal (à tarde)" }],
};

export const encomendaAberta = (agora = Date.now()) => agora < Date.parse(CEIA.encerraEm);
/** Itens de sobremesa da ceia (feitos pela parceira de doces). */
export const ehDoceNatal = (itemId: string) => itemId.startsWith("natal-doce-");
export const ehItemNatal = (categoria: string) => categoria === CEIA.categoria;
/** Dentro do kit, cada kg de carne extra sai este tanto mais barato que avulso ("preço de kit"). */
export const DESCONTO_KG_NO_KIT = 2;

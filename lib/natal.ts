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
  raioMilhas: 9,
  /** Dias/horários de entrega que o cliente pode escolher (valor = instante ISO, usado no pedido). */
  datas: [{ valor: "2026-12-24T14:00:00.000Z", rotulo: "Quinta, 24/12 · véspera de Natal (à tarde)" }],
};

export const encomendaAberta = (hoje: string) => hoje <= CEIA.ultimoDia;
export const ehItemNatal = (categoria: string) => categoria === CEIA.categoria;

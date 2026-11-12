/**
 * Pagamento online pela Square (a mesma conta da maquininha).
 * O site cria o pedido na Square e manda o cliente para a página de pagamento dela
 * (cartão, Apple Pay, Google Pay). A confirmação vem por webhook e é conferida na API.
 *
 * Variáveis (Cloudflare → Variáveis e segredos):
 *   SQUARE_ACCESS_TOKEN            token de produção do app (developer.squareup.com)
 *   SQUARE_LOCATION_ID             id da loja (Locations)
 *   SQUARE_WEBHOOK_SIGNATURE_KEY   chave de assinatura do webhook
 *   SQUARE_AMBIENTE                "sandbox" para testes (padrão: produção)
 */

import type { LinhaPedido } from "./cardapio";

export const squareConfigurado = () => !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);

const base = () =>
  process.env.SQUARE_API_URL || (process.env.SQUARE_AMBIENTE === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com");

export class ErroSquare extends Error {
  constructor(public status: number, public detalhes: unknown) {
    super(`Square ${status}`);
  }
}

async function chamar<T>(caminho: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(base() + caminho, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error("[square]", caminho, r.status, JSON.stringify(d).slice(0, 800));
    throw new ErroSquare(r.status, d);
  }
  return d as T;
}

const dinheiro = (pence: number) => ({ amount: pence, currency: "GBP" });

/** Cria o pedido na Square e devolve o link da página de pagamento. */
export async function criarPagamentoSquare(p: {
  numero: number;
  linhas: LinhaPedido[];
  taxa: number;
  total: number;
  voltarPara: string;
  telefone?: string;
}) {
  const itens = p.linhas.map((l) => ({
    name: l.nome.slice(0, 500),
    quantity: String(l.qtd),
    base_price_money: dinheiro(l.unitario),
    ...(l.detalhes.length || l.obs ? { note: [...l.detalhes, l.obs ? `Obs.: ${l.obs}` : ""].filter(Boolean).join(" | ").slice(0, 2000) } : {}),
  }));
  if (p.taxa) itens.push({ name: "Taxa de entrega", quantity: "1", base_price_money: dinheiro(p.taxa) });

  const d = await chamar<{ payment_link: { id: string; url: string; order_id: string } }>("/v2/online-checkout/payment-links", {
    method: "POST",
    body: {
      // Mesmo pedido nunca gera dois links (se o cliente clicar duas vezes).
      idempotency_key: `panela-pedido-${p.numero}`,
      description: `Panela do Chef · pedido #${p.numero}`,
      order: {
        location_id: process.env.SQUARE_LOCATION_ID,
        reference_id: String(p.numero),
        line_items: itens,
        metadata: { numero: String(p.numero) },
      },
      checkout_options: {
        redirect_url: p.voltarPara,
        ask_for_shipping_address: false,
        accepted_payment_methods: { apple_pay: true, google_pay: true },
      },
      payment_note: `Panela do Chef - pedido #${p.numero}`,
    },
  });
  return { url: d.payment_link.url, orderId: d.payment_link.order_id, linkId: d.payment_link.id };
}

type Pagamento = { id: string; status: string; order_id?: string; amount_money?: { amount: number; currency: string }; total_money?: { amount: number } };

/**
 * Confere na Square se o pedido foi pago por completo.
 * Não confia em voltar da página de pagamento: olha os pagamentos concluídos do pedido.
 */
export async function pedidoSquarePago(orderId: string, totalPence: number) {
  const d = await chamar<{ order?: { tenders?: { payment_id?: string }[]; state?: string } }>(`/v2/orders/${encodeURIComponent(orderId)}`);
  const ids = (d.order?.tenders ?? []).map((t) => t.payment_id).filter(Boolean) as string[];
  let pago = 0;
  for (const id of ids) {
    const p = await chamar<{ payment: Pagamento }>(`/v2/payments/${encodeURIComponent(id)}`);
    if (p.payment.status === "COMPLETED") pago += p.payment.amount_money?.amount ?? 0;
  }
  return pago >= totalPence;
}

/** Confere a assinatura do webhook da Square: base64(HMAC-SHA256(chave, url + corpo)). */
export async function assinaturaSquareValida(urlNotificacao: string, corpo: string, assinatura: string | null) {
  const chave = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!chave || !assinatura) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(chave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(urlNotificacao + corpo)));
  let bin = "";
  for (const b of mac) bin += String.fromCharCode(b);
  const esperado = btoa(bin);
  // Comparação em tempo constante.
  if (esperado.length !== assinatura.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ assinatura.charCodeAt(i);
  return dif === 0;
}

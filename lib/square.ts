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
import { lerConfig, salvarConfig } from "./db";

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

/** 07123 456789 -> +447123456789 */
function telefoneE164(tel: string) {
  let n = tel.replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) n = "44" + n.slice(1);
  return "+" + n;
}

/** Cria o pedido na Square e devolve o link da página de pagamento. */
export async function criarPagamentoSquare(p: {
  numero: number;
  linhas: LinhaPedido[];
  taxa: number;
  total: number;
  voltarPara: string;
  telefone?: string;
  nome?: string;
  endereco?: string;
  postcode?: string;
}) {
  const itens = p.linhas.map((l) => ({
    name: l.nome.slice(0, 500),
    quantity: String(l.qtd),
    base_price_money: dinheiro(l.unitario),
    ...(l.detalhes.length || l.obs ? { note: [...l.detalhes, l.obs ? `Obs.: ${l.obs}` : ""].filter(Boolean).join(" | ").slice(0, 2000) } : {}),
  }));
  if (p.taxa) itens.push({ name: "Taxa de entrega", quantity: "1", base_price_money: dinheiro(p.taxa) });

  const criar = (comDados: boolean) => chamar<{ payment_link: { id: string; url: string; order_id: string } }>("/v2/online-checkout/payment-links", {
    method: "POST",
    body: {
      // Mesmo pedido nunca gera dois links (se o cliente clicar duas vezes).
      idempotency_key: `panela-pedido-${p.numero}${comDados ? "" : "-simples"}`,
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
      // Dados que o cliente já digitou no site: a Square não pede de novo.
      pre_populated_data: !comDados ? undefined : {
        ...(p.telefone ? { buyer_phone_number: telefoneE164(p.telefone) } : {}),
        ...(p.endereco && p.postcode
          ? {
              buyer_address: {
                address_line_1: p.endereco.slice(0, 120),
                postal_code: p.postcode,
                country: "GB",
                ...(p.nome ? { first_name: p.nome.split(" ")[0].slice(0, 60), last_name: p.nome.split(" ").slice(1).join(" ").slice(0, 60) || undefined } : {}),
              },
            }
          : {}),
      },
    },
  });
  let d;
  try {
    d = await criar(true);
  } catch (e) {
    // Telefone ou endereço que a Square não aceitou: cria sem os dados preenchidos (o cliente digita lá).
    if (e instanceof ErroSquare && e.status === 400) d = await criar(false);
    else throw e;
  }
  return { url: d.payment_link.url, orderId: d.payment_link.order_id, linkId: d.payment_link.id };
}

type Pagamento = { id: string; status: string; order_id?: string; amount_money?: { amount: number; currency: string }; total_money?: { amount: number } };

export type InfoPedidoSquare = { numero: number | null; pagoPence: number; quitado: boolean };

/**
 * Lê um pedido da Square: de qual pedido do site ele é (reference_id / metadata) e quanto foi pago
 * em pagamentos CONCLUÍDOS. Não confia em voltar da página de pagamento.
 * (Ao pagar, a Square pode registrar o pagamento num pedido com outro id; a referência continua a mesma.)
 */
export async function infoPedidoSquare(orderId: string): Promise<InfoPedidoSquare> {
  const d = await chamar<{
    order?: {
      reference_id?: string;
      metadata?: Record<string, string>;
      location_id?: string;
      tenders?: { payment_id?: string }[];
      net_amount_due_money?: { amount?: number };
    };
  }>(
    `/v2/orders/${encodeURIComponent(orderId)}`,
  );
  const o = d.order;
  if (!o || (process.env.SQUARE_LOCATION_ID && o.location_id && o.location_id !== process.env.SQUARE_LOCATION_ID)) return { numero: null, pagoPence: 0, quitado: false };
  const ref = Number(o.metadata?.numero ?? o.reference_id);
  const ids = (o.tenders ?? []).map((t) => t.payment_id).filter(Boolean) as string[];
  let pago = 0;
  for (const id of ids) {
    const p = await chamar<{ payment: Pagamento }>(`/v2/payments/${encodeURIComponent(id)}`);
    if (p.payment.status === "COMPLETED") pago += p.payment.amount_money?.amount ?? 0;
  }
  // Quitado: a Square diz que não falta nada a pagar (já conta descontos e vouchers aplicados por ela).
  const quitado = pago > 0 && (o.net_amount_due_money?.amount ?? 1) === 0;
  return { numero: Number.isFinite(ref) && ref > 0 ? ref : null, pagoPence: pago, quitado };
}

/** true se algum dos pedidos da Square informados pertence ao pedido do site e está pago por completo. */
export async function pedidoSquarePago(orderIds: (string | null | undefined)[], numero: number, totalPence: number, idOriginal?: string | null) {
  for (const id of [...new Set(orderIds.filter(Boolean) as string[])]) {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) continue;
    try {
      const info = await infoPedidoSquare(id);
      const dele = id === idOriginal || info.numero === numero;
      if (dele && (info.pagoPence >= totalPence || info.quitado)) return true;
    } catch (e) {
      console.error("[square] conferir", id, e);
    }
  }
  return false;
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

/* ------------------- Apple Pay / Google Pay direto no site ------------------- */

/** Id do app na Square (público): a Square devolve pelo próprio token. Fica guardado no banco. */
let appIdCache: string | null = null;
export async function appIdSquare(): Promise<string | null> {
  if (process.env.SQUARE_APPLICATION_ID) return process.env.SQUARE_APPLICATION_ID;
  if (appIdCache) return appIdCache;
  const salvo = await lerConfig<{ appId: string; token: string }>("square-app").catch(() => null);
  const marca = (process.env.SQUARE_ACCESS_TOKEN || "").slice(-6);
  if (salvo?.appId && salvo.token === marca) return (appIdCache = salvo.appId);
  try {
    const d = await chamar<{ client_id?: string }>("/oauth2/token/status", { method: "POST", body: {} });
    if (d.client_id) {
      appIdCache = d.client_id;
      await salvarConfig("square-app", { appId: d.client_id, token: marca });
    }
  } catch (e) {
    console.error("[square] app id", e);
  }
  return appIdCache;
}

/**
 * Registra o domínio do site na Apple Pay pela Square (precisa do arquivo de verificação no ar).
 * Feito uma vez por domínio; se falhar, tenta de novo depois de 1 hora.
 */
export async function garantirDominioApplePay(dominio: string) {
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dominio) || dominio.endsWith("localhost")) return;
  const chave = "applepay-dominios";
  const estado = (await lerConfig<Record<string, { ok?: boolean; em?: number }>>(chave).catch(() => null)) ?? {};
  const atual = estado[dominio];
  if (atual?.ok || (atual?.em && Date.now() - atual.em < 3600_000)) return;
  let ok = false;
  try {
    const d = await chamar<{ status?: string }>("/v2/apple-pay/domains", { method: "POST", body: { domain_name: dominio } });
    ok = d.status === "VERIFIED";
  } catch (e) {
    console.error("[square] apple pay domínio", dominio, e);
  }
  await salvarConfig(chave, { ...estado, [dominio]: { ok, em: Date.now() } });
}

/** Cobra o pedido com o token da carteira (Apple Pay / Google Pay) gerado no navegador. */
export async function pagarComCarteira(p: { sourceId: string; numero: number; total: number; orderId: string | null }) {
  const d = await chamar<{ payment?: { id: string; status: string; order_id?: string; amount_money?: { amount: number } } }>("/v2/payments", {
    method: "POST",
    body: {
      source_id: p.sourceId,
      idempotency_key: `panela-${p.numero}-${crypto.randomUUID()}`.slice(0, 45),
      amount_money: dinheiro(p.total),
      location_id: process.env.SQUARE_LOCATION_ID,
      ...(p.orderId ? { order_id: p.orderId } : {}),
      reference_id: String(p.numero),
      note: `Panela do Chef - pedido #${p.numero}`,
      autocomplete: true,
    },
  });
  return d.payment;
}

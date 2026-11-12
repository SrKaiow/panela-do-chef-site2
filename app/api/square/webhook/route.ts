import { NextResponse } from "next/server";
import { buscarPorPedidoSquare, confirmarPagamentoCartao } from "@/lib/db";
import { assinaturaSquareValida, pedidoSquarePago } from "@/lib/square";
import { avisarLojaNovoPedido } from "@/lib/avisoLoja";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Aviso da Square quando um pagamento muda (payment.created / payment.updated).
 * Só aceita avisos com a assinatura certa, e ainda confere o pedido direto na API da Square.
 */
export async function POST(req: Request) {
  const corpo = await req.text();
  // A Square assina usando exatamente a URL cadastrada no webhook.
  const url = process.env.SQUARE_WEBHOOK_URL || `${siteUrl(req)}/api/square/webhook`;
  if (!(await assinaturaSquareValida(url, corpo, req.headers.get("x-square-hmacsha256-signature")))) {
    return NextResponse.json({ erro: "assinatura inválida" }, { status: 401 });
  }

  let evento: { type?: string; data?: { object?: { payment?: { status?: string; order_id?: string } } } };
  try {
    evento = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const pagamento = evento.data?.object?.payment;
  if (pagamento?.status === "COMPLETED" && pagamento.order_id) {
    const pedido = await buscarPorPedidoSquare(pagamento.order_id);
    if (pedido && !pedido.pago && (await pedidoSquarePago(pagamento.order_id, pedido.total))) {
      await confirmarPagamentoCartao(pedido.numero);
      await avisarLojaNovoPedido(pedido.numero, siteUrl(req));
    }
  }
  // Sempre 200 para avisos válidos: a Square não precisa reenviar os que não são nossos.
  return NextResponse.json({ ok: true });
}

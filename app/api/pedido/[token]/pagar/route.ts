import { NextResponse } from "next/server";
import { buscarPorToken, confirmarPagamentoCartao, salvarPagamentoSquare } from "@/lib/db";
import { criarPedidoCarteira, ErroSquare, pagarComCarteira, registrarErroSquare, squareConfigurado } from "@/lib/square";
import { avisarLojaNovoPedido } from "@/lib/avisoLoja";
import { permitir } from "@/lib/seguranca";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const recusaDoCartao = (e: unknown) =>
  e instanceof ErroSquare && ((e.detalhes as { errors?: { category?: string }[] })?.errors ?? []).some((x) => x.category === "PAYMENT_METHOD_ERROR");

/** Paga o pedido com Apple Pay / Google Pay direto no site (o token vem da carteira do cliente). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!(await permitir(req, "pagar", 12, 10 * 60))) return NextResponse.json({ erro: "Muitas tentativas. Espere alguns minutos." }, { status: 429 });
  const { token } = await ctx.params;
  const p = await buscarPorToken(token);
  if (!p) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
  if (p.pago) return NextResponse.json({ ok: true });
  if (p.pagamento !== "cartao" || p.status !== "aguardando_pagamento" || !squareConfigurado())
    return NextResponse.json({ erro: "Este pedido não pode ser pago aqui." }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const sourceId = typeof b.sourceId === "string" ? b.sourceId : "";
  if (!/^[A-Za-z0-9:_-]{10,400}$/.test(sourceId)) return NextResponse.json({ erro: "Pagamento inválido. Tente de novo." }, { status: 400 });

  // Pedido próprio na Square (com os itens), separado do pedido do link de pagamento.
  let orderId: string | null = null;
  try {
    const o = await criarPedidoCarteira({ numero: p.numero, linhas: p.itens, taxa: p.taxa });
    if (o?.id && (o.total_money?.amount ?? p.total) === p.total) orderId = o.id;
  } catch (e) {
    await registrarErroSquare("criar pedido carteira", e);
  }

  try {
    const pg = await pagarComCarteira({ sourceId, numero: p.numero, total: p.total, orderId });
    if (pg?.status === "COMPLETED" && (pg.amount_money?.amount ?? 0) >= p.total) {
      // O webhook passa a achar o pedido por este id também.
      if (pg.order_id && p.linkPagamento) await salvarPagamentoSquare(p.numero, pg.order_id, p.linkPagamento);
      if (await confirmarPagamentoCartao(p.numero)) await avisarLojaNovoPedido(p.numero, siteUrl(req));
      return NextResponse.json({ ok: true });
    }
    await registrarErroSquare("pagamento não concluído", JSON.stringify(pg).slice(0, 1500));
    return NextResponse.json({ erro: "O pagamento não foi concluído. Se aparecer cobrança, ela volta sozinha. Tente de novo." }, { status: 402 });
  } catch (e) {
    await registrarErroSquare("pagamento carteira", e);
    return NextResponse.json(
      {
        erro: recusaDoCartao(e)
          ? "O banco recusou o pagamento. Tente de novo ou use outro cartão."
          : "Não conseguimos concluir o pagamento. Se aparecer cobrança, ela volta sozinha. Tente de novo.",
      },
      { status: 402 },
    );
  }
}

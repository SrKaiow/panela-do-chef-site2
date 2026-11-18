import { NextResponse } from "next/server";
import { buscarPorToken, confirmarPagamentoCartao } from "@/lib/db";
import { ErroSquare, pagarComCarteira, squareConfigurado } from "@/lib/square";
import { avisarLojaNovoPedido } from "@/lib/avisoLoja";
import { permitir } from "@/lib/seguranca";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

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

  try {
    let pg;
    try {
      pg = await pagarComCarteira({ sourceId, numero: p.numero, total: p.total, orderId: p.squarePedido });
    } catch (e) {
      // Se a Square não aceitar ligar ao pedido dela (não é recusa do cartão), cobra sem o vínculo.
      const cat = (e as ErroSquare)?.detalhes as { errors?: { category?: string }[] } | undefined;
      const recusa = cat?.errors?.some((x) => x.category === "PAYMENT_METHOD_ERROR");
      if (e instanceof ErroSquare && e.status === 400 && !recusa && p.squarePedido) pg = await pagarComCarteira({ sourceId, numero: p.numero, total: p.total, orderId: null });
      else throw e;
    }
    if (pg?.status === "COMPLETED" && (pg.amount_money?.amount ?? 0) >= p.total) {
      if (await confirmarPagamentoCartao(p.numero)) await avisarLojaNovoPedido(p.numero, siteUrl(req));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ erro: "O pagamento não foi aprovado. Tente de novo ou use outro cartão." }, { status: 402 });
  } catch (e) {
    const recusado = e instanceof ErroSquare && e.status < 500;
    return NextResponse.json(
      { erro: recusado ? "O pagamento foi recusado pelo banco. Tente de novo ou use outro cartão." : "Não foi possível falar com o banco agora. Tente de novo." },
      { status: recusado ? 402 : 502 },
    );
  }
}

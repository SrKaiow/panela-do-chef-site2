import { NextResponse } from "next/server";
import { buscarPorToken, trocarParaDinheiro } from "@/lib/db";
import { avisarLojaNovoPedido } from "@/lib/avisoLoja";
import { getAjustes } from "@/lib/dados";
import { permitir } from "@/lib/seguranca";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** O cartão não passou: o cliente escolhe pagar em dinheiro na entrega/coleta e o pedido vai para a cozinha. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!(await permitir(req, "pagar-na-entrega", 6, 10 * 60))) return NextResponse.json({ erro: "Muitas tentativas. Espere alguns minutos." }, { status: 429 });
  const { token } = await ctx.params;
  const p = await buscarPorToken(token);
  if (!p) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
  if (p.pago) return NextResponse.json({ erro: "Este pedido já foi pago." }, { status: 400 });
  // Ceia de Natal é só no cartão.
  if (p.itens.some((l) => l.itemId.startsWith("natal-"))) return NextResponse.json({ erro: "A Ceia de Natal é só no cartão." }, { status: 400 });
  if (!(await getAjustes()).pagamentos.dinheiro) return NextResponse.json({ erro: "Pagamento em dinheiro indisponível no momento." }, { status: 400 });
  if (!(await trocarParaDinheiro(p.numero))) return NextResponse.json({ erro: "Não deu para trocar o pagamento deste pedido." }, { status: 400 });
  await avisarLojaNovoPedido(p.numero, siteUrl(req));
  return NextResponse.json({ ok: true });
}

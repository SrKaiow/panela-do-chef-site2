import { NextResponse } from "next/server";
import { identidadeDoPedido, pedidoParaAvaliar } from "@/lib/avaliacaoPedido";
import { permitir } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/** Confere o pedido antes de avaliar e devolve como o cliente vai aparecer (nome e bairro do pedido). */
export async function POST(req: Request) {
  if (!(await permitir(req, "avaliacao-conferir", 15, 60 * 60))) return NextResponse.json({ erro: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const r = await pedidoParaAvaliar(b);
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: 400 });
  return NextResponse.json(await identidadeDoPedido(r.pedido));
}

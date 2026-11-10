import { NextResponse } from "next/server";
import { buscarPorToken } from "@/lib/db";
import { situacaoAoVivo } from "@/lib/rastreio";

export const dynamic = "force-dynamic";

/** Status ao vivo de um pedido. Só quem tem o link do pedido (token) consegue ver. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const params = await ctx.params;
  const p = await buscarPorToken(params.token);
  if (!p) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
  return NextResponse.json(await situacaoAoVivo(p), { headers: { "Cache-Control": "no-store" } });
}

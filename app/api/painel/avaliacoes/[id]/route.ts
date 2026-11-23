import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { mudarStatusAvaliacao, trocarFotoAvaliacao } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const id = Number(params.id);
  const b = await req.json();
  if (Number.isInteger(id) && typeof b.foto === "string") {
    if (!/^\/api\/fotos\/[A-Za-z0-9_-]{6,40}$/.test(b.foto)) return NextResponse.json({ erro: "Foto inválida." }, { status: 400 });
    await trocarFotoAvaliacao(id, b.foto);
    return NextResponse.json({ ok: true });
  }
  if (!Number.isInteger(id) || !["pendente", "aprovada", "oculta"].includes(b.status)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  await mudarStatusAvaliacao(id, b.status);
  return NextResponse.json({ ok: true });
}

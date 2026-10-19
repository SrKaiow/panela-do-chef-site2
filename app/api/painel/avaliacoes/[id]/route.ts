import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { mudarStatusAvaliacao } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!logado("painel")) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const id = Number(params.id);
  const b = await req.json();
  if (!Number.isInteger(id) || !["pendente", "aprovada", "oculta"].includes(b.status)) {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  await mudarStatusAvaliacao(id, b.status);
  return NextResponse.json({ ok: true });
}

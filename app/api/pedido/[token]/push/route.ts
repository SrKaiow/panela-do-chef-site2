import { NextResponse } from "next/server";
import { buscarPorToken } from "@/lib/db";
import { inscreverPush } from "@/lib/push";
import { permitir, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/** Liga o alarme com a tela bloqueada: guarda a inscrição do aparelho para este pedido. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!(await permitir(req, "push", 10, 10 * 60))) return respostaLimite();
  const { token } = await ctx.params;
  const p = await buscarPorToken(token);
  if (!p) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const endpoint = typeof b.endpoint === "string" ? b.endpoint : "";
  if (!/^https:\/\/[a-z0-9.-]+\//i.test(endpoint) || endpoint.length > 1000) return NextResponse.json({ erro: "Inscrição inválida." }, { status: 400 });
  await inscreverPush(p.numero, endpoint);
  return NextResponse.json({ ok: true });
}

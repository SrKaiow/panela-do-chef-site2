import { NextResponse } from "next/server";
import { buscarPorToken, lerConfig, salvarConfig } from "@/lib/db";
import { permitir } from "@/lib/seguranca";
import { avisarCartaoRecusado } from "@/lib/avisoLoja";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type Falha = { numero: number; em: string; carteira: string; etapa: string; detalhe: string; aparelho: string };

/** Guarda por que a Apple Pay / Google Pay falhou no celular do cliente (as 30 últimas), para o painel ver. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!(await permitir(req, "erro-carteira", 20, 3600))) return new NextResponse(null, { status: 204 });
  const { token } = await ctx.params;
  const p = await buscarPorToken(token);
  if (!p) return new NextResponse(null, { status: 204 });
  const b = await req.json().catch(() => ({}));
  const nova: Falha = {
    numero: p.numero,
    em: new Date().toISOString(),
    carteira: String(b.carteira ?? "").slice(0, 20),
    etapa: String(b.etapa ?? "").slice(0, 40),
    detalhe: String(b.detalhe ?? "").slice(0, 800),
    aparelho: (req.headers.get("user-agent") || "").slice(0, 200),
  };
  const lista = ((await lerConfig<Falha[]>("carteira-falhas")) ?? []).slice(-29);
  await salvarConfig("carteira-falhas", [...lista, nova]).catch(() => {});
  await avisarCartaoRecusado(p.numero, `${nova.carteira || "Apple/Google Pay"} não abriu no celular do cliente`, siteUrl(req));
  return new NextResponse(null, { status: 204 });
}

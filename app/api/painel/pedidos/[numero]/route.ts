import { siteUrl } from "@/lib/site";
import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { STATUS, mudarStatus, marcarPago, marcarAviso, type Status, pedirImpressao, fretePedido } from "@/lib/db";
import { aoMudarStatus } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ numero: string }> }) {
  const params = await ctx.params;
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const numero = Number(params.numero);
  if (!Number.isInteger(numero)) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });

  const b = await req.json();
  if (b.frete === "tirar" || b.frete === "devolver") {
    try {
      await fretePedido(numero, b.frete === "tirar");
    } catch (e) {
      return NextResponse.json({ erro: e instanceof Error ? e.message : "Não consegui mudar o frete." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
    await mudarStatus(numero, b.status as Status);
    await aoMudarStatus(numero, b.status as Status, siteUrl(req));
  }
  if (typeof b.pago === "boolean") await marcarPago(numero, b.pago);
  if (b.imprimirNaLoja === true) await pedirImpressao(numero);
  if (b.avisoManual === "saiu" || b.avisoManual === "chegando") await marcarAviso(numero, b.avisoManual);
  return NextResponse.json({ ok: true });
}

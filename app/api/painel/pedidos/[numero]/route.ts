import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { STATUS, mudarStatus, marcarPago, marcarAviso, type Status } from "@/lib/db";
import { aoMudarStatus } from "@/lib/avisos";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { numero: string } }) {
  if (!logado("painel")) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const numero = Number(params.numero);
  if (!Number.isInteger(numero)) return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });

  const b = await req.json();
  if (b.status !== undefined) {
    if (!STATUS.includes(b.status)) return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
    await mudarStatus(numero, b.status as Status);
    await aoMudarStatus(numero, b.status as Status);
  }
  if (typeof b.pago === "boolean") await marcarPago(numero, b.pago);
  if (b.avisoManual === "saiu" || b.avisoManual === "chegando") await marcarAviso(numero, b.avisoManual);
  return NextResponse.json({ ok: true });
}

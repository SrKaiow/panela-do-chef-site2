import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { marcarAviso, marcarPago, mudarStatus, buscarPorNumero } from "@/lib/db";
import { aoMudarStatus } from "@/lib/avisos";

export const dynamic = "force-dynamic";

/** O entregador só pode: sair para entrega, marcar entregue, marcar dinheiro recebido e registrar aviso manual. */
export async function PATCH(req: Request, { params }: { params: { numero: string } }) {
  if (!logado("entregador")) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  const numero = Number(params.numero);
  const p = Number.isInteger(numero) ? await buscarPorNumero(numero) : null;
  if (!p) return NextResponse.json({ erro: "Pedido não encontrado." }, { status: 404 });

  const b = await req.json();
  if (b.status === "saiu" || b.status === "entregue") {
    await mudarStatus(numero, b.status);
    await aoMudarStatus(numero, b.status);
  }
  if (b.avisoManual === "saiu" || b.avisoManual === "chegando") await marcarAviso(numero, b.avisoManual);
  if (b.dinheiroRecebido === true && p.pagamento === "dinheiro") await marcarPago(numero, true);
  return NextResponse.json({ ok: true });
}

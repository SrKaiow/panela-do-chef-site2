import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { lerLocal, limparAtraso, registrarAtraso } from "@/lib/db";

export const dynamic = "force-dynamic";

const MOTIVOS = ["transito", "acidente", "obras"];

/** O entregador avisa um imprevisto no caminho: todos os clientes com pedido no carro veem o atraso e onde foi. */
export async function POST(req: Request) {
  if (!(await logado("entregador"))) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.limpar === true) {
    await limparAtraso();
    return NextResponse.json({ ok: true });
  }
  const minutos = Number(b.minutos);
  const motivo = MOTIVOS.includes(b.motivo) ? b.motivo : "transito";
  if (![5, 10, 15].includes(minutos)) return NextResponse.json({ erro: "Escolha 5, 10 ou 15 minutos." }, { status: 400 });
  // Onde está o problema: a última posição do entregador, se for recente.
  const local = await lerLocal();
  const onde = local && Date.now() - new Date(local.atualizadoEm).getTime() < 10 * 60000 ? { lat: local.lat, lng: local.lng } : null;
  await registrarAtraso(minutos, motivo, onde);
  return NextResponse.json({ ok: true, comLocal: !!onde });
}

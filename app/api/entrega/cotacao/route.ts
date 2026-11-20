import { NextResponse } from "next/server";
import { getAjustes } from "@/lib/dados";
import { coordenadasDoPostcode, cotarEntrega, distanciaMetros, entregaEspecial } from "@/lib/entrega";
import { permitir, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/** Taxa de entrega para um postcode e subtotal (pence), antes de fechar o pedido. */
export async function GET(req: Request) {
  if (!(await permitir(req, "cotacao", 60, 10 * 60))) return respostaLimite();
  const u = new URL(req.url);
  const postcode = (u.searchParams.get("postcode") || "").slice(0, 10);
  const subtotal = Math.max(0, Math.round(Number(u.searchParams.get("subtotal")) || 0));
  const coords = await coordenadasDoPostcode(postcode);
  if (!coords) return NextResponse.json({ ok: false, motivo: "Não encontramos esse postcode. Confira e tente de novo (ex.: KT17 1JW)." });
  const a = await getAjustes();
  const d = distanciaMetros(a.entrega.cozinha, coords);
  const especial = entregaEspecial(postcode, u.searchParams.get("endereco") || "");
  if (especial != null) return NextResponse.json({ ok: true, milhas: Math.round((d / 1609.344) * 10) / 10, taxa: especial, gratisAcima: null, gratis: false });
  return NextResponse.json(cotarEntrega(d, subtotal, a.entrega.faixas, a.entrega.raioMilhas));
}

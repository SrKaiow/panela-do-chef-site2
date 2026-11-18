import { NextResponse } from "next/server";
import { getAjustes } from "@/lib/dados";
import { conferirColeta } from "@/lib/entrega";
import { permitir, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/** Coleta: distância da localização do cliente até a cozinha. */
export async function GET(req: Request) {
  if (!(await permitir(req, "perto", 30, 10 * 60))) return respostaLimite();
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return NextResponse.json({ ok: false, motivo: "Localização inválida." });
  const a = await getAjustes();
  const r = conferirColeta(a.entrega.cozinha, { lat, lng }, a.entrega.raioMilhas);
  return NextResponse.json({ ok: r.ok, milhas: r.milhas, motivo: r.ok ? undefined : r.motivo });
}

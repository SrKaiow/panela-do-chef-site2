import { NextResponse } from "next/server";
import { senhaCorreta } from "@/lib/auth";
import { salvarLocal } from "@/lib/db";
import { verificarChegadas } from "@/lib/avisos";
import { permitir, respostaLimite } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/**
 * Localização do entregador pelo app OwnTracks (iPhone/Android), que continua mandando
 * a posição com a tela apagada ou em outro app (Waze). Modo HTTP do OwnTracks:
 *   URL:      https://SEU-SITE/api/entregador/owntracks
 *   Usuário:  qualquer (ex.: kaio)    Senha: a mesma senha da tela do entregador (DRIVER_PASSWORD)
 */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  let senha = "";
  if (auth.startsWith("Basic ")) {
    try { senha = atob(auth.slice(6)).split(":").slice(1).join(":"); } catch {}
  }
  if (!senhaCorreta("entregador", senha)) {
    if (!(await permitir(req, "owntracks-erro", 10, 15 * 60))) return respostaLimite();
    return NextResponse.json({ erro: "Senha errada." }, { status: 401, headers: { "WWW-Authenticate": 'Basic realm="entregador"' } });
  }

  const b = await req.json().catch(() => null);
  // O OwnTracks também manda outros tipos (status, waypoints...): só a posição interessa.
  if (!b || b._type !== "location") return NextResponse.json([]);
  const lat = Number(b.lat);
  const lng = Number(b.lon);
  const precisao = Number.isFinite(Number(b.acc)) ? Number(b.acc) : null;
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return NextResponse.json([]);
  // Posição imprecisa demais (antena de celular) ou antiga (fila de quando estava sem internet): ignora.
  if (precisao != null && precisao > 150) return NextResponse.json([]);
  if (Number.isFinite(Number(b.tst)) && Date.now() / 1000 - Number(b.tst) > 120) return NextResponse.json([]);

  await salvarLocal(lat, lng, precisao);
  await verificarChegadas({ lat, lng, precisao, atualizadoEm: new Date().toISOString() });
  return NextResponse.json([]);
}

import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { salvarLocal } from "@/lib/db";
import { verificarChegadas } from "@/lib/avisos";

export const dynamic = "force-dynamic";

/** O celular do entregador manda a posição aqui a cada poucos segundos. */
export async function POST(req: Request) {
  if (!logado("entregador")) return NextResponse.json({ erro: "Entre de novo na tela do entregador." }, { status: 401 });
  const b = await req.json();
  const lat = Number(b.lat);
  const lng = Number(b.lng);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return NextResponse.json({ erro: "Posição inválida." }, { status: 400 });
  const precisao = Number.isFinite(Number(b.precisao)) ? Number(b.precisao) : null;
  await salvarLocal(lat, lng, precisao);
  const avisarManual = await verificarChegadas({ lat, lng, precisao, atualizadoEm: new Date().toISOString() });
  return NextResponse.json({ ok: true, avisarManual });
}

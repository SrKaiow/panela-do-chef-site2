import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { lerConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Último erro da Square (só para o dono, logado no painel). */
export async function GET() {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  const [ultimo, carteira] = await Promise.all([lerConfig("square-ultimo-erro"), lerConfig("carteira-falhas")]);
  return NextResponse.json({ ...((ultimo as object) ?? { nada: true }), carteiraFalhas: carteira ?? [] });
}

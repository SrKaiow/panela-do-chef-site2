import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { testarAvisos } from "@/lib/avisoLoja";

export const dynamic = "force-dynamic";

/** Abre logado no painel: manda uma notificação de teste. null = canal não configurado, true = enviado, false = falhou. */
export async function GET() {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel primeiro." }, { status: 401 });
  return NextResponse.json(await testarAvisos());
}

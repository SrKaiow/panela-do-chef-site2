import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { testarAvisos } from "@/lib/avisoLoja";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Abre logado no painel: manda uma notificação de teste e liga os botões do Telegram. null = canal não configurado, true = enviado, false = falhou. */
export async function GET(req: Request) {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel primeiro." }, { status: 401 });
  return NextResponse.json(await testarAvisos(siteUrl(req)));
}

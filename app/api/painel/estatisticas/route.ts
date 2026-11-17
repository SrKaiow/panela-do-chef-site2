import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { estatisticasVisitas } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  const dias = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 7));
  try {
    return NextResponse.json(await estatisticasVisitas(dias));
  } catch (e) {
    console.error("[estatisticas]", e);
    return NextResponse.json({ erro: "Não consegui carregar os números agora." }, { status: 500 });
  }
}

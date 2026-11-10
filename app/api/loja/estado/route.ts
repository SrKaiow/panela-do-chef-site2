import { NextResponse } from "next/server";
import { getAjustes } from "@/lib/dados";
import { estadoLoja, horariosParaAgendar } from "@/lib/horario";

export const dynamic = "force-dynamic";

/** Aberto ou fechado agora, e os horários para agendar. A loja consulta a cada minuto. */
export async function GET() {
  const a = await getAjustes();
  return NextResponse.json(
    { estado: estadoLoja(a.horarios, a.pausado), horarios: horariosParaAgendar(a.horarios) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { NextResponse } from "next/server";
import { mensagemPush } from "@/lib/push";

export const dynamic = "force-dynamic";

/** O service worker pergunta qual mensagem mostrar (o push chega sem conteúdo). */
export async function GET(req: Request) {
  const e = new URL(req.url).searchParams.get("e") || "";
  if (!/^https:\/\//.test(e) || e.length > 1000) return NextResponse.json(null);
  return NextResponse.json(await mensagemPush(e), { headers: { "Cache-Control": "no-store" } });
}

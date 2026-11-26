import { NextResponse } from "next/server";
import { pessoasOnline, sairOnline } from "@/lib/db";
import { permitir } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/**
 * "Pessoas vendo agora": o site manda um sinal a cada 25s com o id anônimo do navegador
 * (o mesmo da contagem de visitas, sem nome, IP ou cookie). Responde quantos estão online.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const v = typeof b?.v === "string" && /^[a-z0-9]{16,40}$/.test(b.v) ? b.v : undefined;
  if (v && b?.sair === true) {
    await sairOnline(v).catch(() => {});
    return new NextResponse(null, { status: 204 });
  }
  const ua = req.headers.get("user-agent") || "";
  const robo = /bot|crawl|spider|preview|headless|lighthouse/i.test(ua);
  const conta = v && !robo && b?.contar !== false && (await permitir(req, "online", 400, 3600));
  try {
    return NextResponse.json({ agora: await pessoasOnline(conta ? v : undefined) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ agora: null }, { status: 200 });
  }
}

import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { infoMeta, salvarMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel." }, { status: 401 });
  return NextResponse.json(await infoMeta());
}

export async function POST(req: Request) {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const valor = Math.round(Number(String(b.valor ?? "").replace(",", ".")) * 100);
  if (!(valor >= 1000 && valor <= 10000000)) return NextResponse.json({ erro: "Meta inválida." }, { status: 400 });
  await salvarMeta(valor);
  return NextResponse.json(await infoMeta());
}

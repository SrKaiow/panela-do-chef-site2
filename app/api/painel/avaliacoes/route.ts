import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { listarAvaliacoes } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!logado("painel")) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  return NextResponse.json({ avaliacoes: await listarAvaliacoes(false) });
}

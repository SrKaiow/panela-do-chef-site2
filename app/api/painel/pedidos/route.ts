import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { listarPedidos } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!logado("painel")) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const pedidos = await listarPedidos(300);
  return NextResponse.json({ pedidos });
}

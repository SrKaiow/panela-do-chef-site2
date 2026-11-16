import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { squareConfigurado } from "@/lib/square";
import { adicionaisDaSquare } from "@/lib/squareCatalogo";

export const dynamic = "force-dynamic";

/** Lista os adicionais cadastrados na Square (para importar no painel). */
export async function GET() {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  if (!squareConfigurado()) return NextResponse.json({ erro: "A Square não está ligada no site." }, { status: 400 });
  try {
    return NextResponse.json({ listas: await adicionaisDaSquare() });
  } catch (e) {
    console.error("[square-adicionais]", e);
    return NextResponse.json({ erro: "Não consegui ler os adicionais da Square agora." }, { status: 502 });
  }
}

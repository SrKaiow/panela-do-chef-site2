import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { lerConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Último erro da Square (só para o dono, logado no painel). */
export async function GET() {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  return NextResponse.json((await lerConfig("square-ultimo-erro")) ?? { nada: true });
}

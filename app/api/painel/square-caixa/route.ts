import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { caixaSquare, segundaDe } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Caixa Square da semana: quanto tem que ter na Square, dia a dia, já sem a taxa. */
export async function GET(req: Request) {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel." }, { status: 401 });
  const semana = new URL(req.url).searchParams.get("semana");
  return NextResponse.json(await caixaSquare(segundaDe(semana || undefined)));
}

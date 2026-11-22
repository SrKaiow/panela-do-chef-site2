import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { apagarGasto, mudarCategoriaGasto, relatorioSemana, salvarGasto, segundaDe } from "@/lib/db";

export const dynamic = "force-dynamic";

const sair = () => NextResponse.json({ erro: "Entre de novo." }, { status: 401 });

export async function GET(req: Request) {
  if (!(await logado("painel"))) return sair();
  const inicio = segundaDe(new URL(req.url).searchParams.get("semana"));
  return NextResponse.json(await relatorioSemana(inicio));
}

/** Gastos: lançar ou apagar. */
export async function POST(req: Request) {
  if (!(await logado("painel"))) return sair();
  const b = await req.json().catch(() => ({}));
  if (b.acao === "apagar") {
    await apagarGasto(Number(b.id));
  } else if (b.acao === "categoria") {
    const categoria = String(b.categoria || "").trim().slice(0, 40);
    if (!categoria) return NextResponse.json({ erro: "Escolha a categoria." }, { status: 400 });
    await mudarCategoriaGasto(Number(b.id), categoria);
  } else {
    const valor = Math.round(Number(String(b.valor).replace(",", ".")) * 100);
    if (!(valor > 0 && valor <= 1000000)) return NextResponse.json({ erro: "Valor inválido." }, { status: 400 });
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b.data)) ? String(b.data) : new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const categoria = String(b.categoria || "Outros").trim().slice(0, 40) || "Outros";
    await salvarGasto({ data, categoria, descricao: String(b.descricao || "").trim().slice(0, 120), valor });
  }
  return NextResponse.json(await relatorioSemana(segundaDe(b.semana)));
}

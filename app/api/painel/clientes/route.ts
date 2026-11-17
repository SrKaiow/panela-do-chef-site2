import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { listarClientes, registrarResgate } from "@/lib/db";
import { lerFidelidade, salvarFidelidade } from "@/lib/fidelidade";

export const dynamic = "force-dynamic";

const sair = () => NextResponse.json({ erro: "Entre de novo." }, { status: 401 });

export async function GET() {
  if (!(await logado("painel"))) return sair();
  const fidelidade = await lerFidelidade();
  const clientes = await listarClientes(Math.round(fidelidade.minimo * 100));
  return NextResponse.json({ clientes, fidelidade });
}

/** Marca (ou desfaz) a entrega de um brinde do cartão fidelidade. */
export async function POST(req: Request) {
  if (!(await logado("painel"))) return sair();
  const b = await req.json().catch(() => ({}));
  const tel = typeof b.telefone === "string" ? b.telefone : "";
  if (!/^\d{6,15}$/.test(tel)) return NextResponse.json({ erro: "Cliente inválido." }, { status: 400 });
  await registrarResgate(tel, b.acao === "desfazer" ? -1 : 1);
  return NextResponse.json({ ok: true });
}

/** Ajusta a regra do cartão fidelidade. */
export async function PUT(req: Request) {
  if (!(await logado("painel"))) return sair();
  try {
    return NextResponse.json(await salvarFidelidade(await req.json().catch(() => null)));
  } catch (e: any) {
    return NextResponse.json({ erro: e.message || "Não consegui salvar." }, { status: 400 });
  }
}

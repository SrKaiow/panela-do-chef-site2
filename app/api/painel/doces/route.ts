import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { exec, lerConfig, salvarConfig } from "@/lib/db";
import { ehDoceNatal } from "@/lib/natal";
import type { LinhaPedido } from "@/lib/cardapio";

export const dynamic = "force-dynamic";

/** Parceira que faz os doces (WhatsApp para onde vai cada pedido). */
type Parceira = { nome: string; telefone: string };
/** Pedidos já mandados para a parceira: número -> quando. */
type Enviados = Record<string, string>;

const PADRAO: Parceira = { nome: "D'Laura Doces", telefone: "" };

async function dados() {
  // Só pedidos que têm doce da ceia, pagos e não cancelados.
  const r = await exec(
    "SELECT numero, criado_em, nome, itens, status, pago, pagamento, agendado_para FROM pedidos WHERE itens LIKE ? AND status NOT IN ('cancelado','aguardando_pagamento') ORDER BY numero DESC LIMIT 500",
    ['%"natal-doce-%'],
  );
  const pedidos = r.rows
    .map((x) => {
      const itens = JSON.parse(String(x.itens)) as LinhaPedido[];
      const doces = itens.filter((l) => ehDoceNatal(l.itemId));
      return {
        numero: Number(x.numero),
        criadoEm: String(x.criado_em),
        nome: String(x.nome),
        status: String(x.status),
        pago: Number(x.pago) === 1,
        pagamento: String(x.pagamento),
        agendadoPara: (x.agendado_para as string) ?? null,
        doces,
        valor: doces.reduce((s, l) => s + l.total, 0),
      };
    })
    .filter((p) => p.doces.length);
  const [parceira, enviados] = await Promise.all([lerConfig<Parceira>("doces-parceira"), lerConfig<Enviados>("doces-enviados")]);
  return { pedidos, parceira: parceira ?? PADRAO, enviados: enviados ?? {} };
}

export async function GET() {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel." }, { status: 401 });
  return NextResponse.json(await dados());
}

/** { parceira: {nome, telefone} } salva o contato; { enviado: numero, sim: boolean } marca/desmarca o envio. */
export async function POST(req: Request) {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.parceira) {
    const nome = String(b.parceira.nome ?? "").trim().slice(0, 60) || PADRAO.nome;
    const telefone = String(b.parceira.telefone ?? "").replace(/[^\d+]/g, "").slice(0, 20);
    if (telefone.replace(/\D/g, "").length < 10) return NextResponse.json({ erro: "Confira o número do WhatsApp." }, { status: 400 });
    await salvarConfig("doces-parceira", { nome, telefone });
  }
  if (b.enviado != null) {
    const n = String(Math.trunc(Number(b.enviado)));
    const atual = (await lerConfig<Enviados>("doces-enviados")) ?? {};
    if (b.sim) atual[n] = new Date().toISOString();
    else delete atual[n];
    await salvarConfig("doces-enviados", atual);
  }
  return NextResponse.json(await dados());
}

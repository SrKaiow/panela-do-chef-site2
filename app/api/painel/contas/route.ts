import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { apagarLancamento, arquivarConta, lancarConta, listarContas, salvarConta } from "@/lib/db";

export const dynamic = "force-dynamic";

const sair = () => NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
const erro = (m: string) => NextResponse.json({ erro: m }, { status: 400 });
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Clientes a pagar (fiado / semanal): lista com saldo e lançamentos. */
export async function GET() {
  if (!(await logado("painel"))) return sair();
  return NextResponse.json({ contas: await listarContas() });
}

/** Ações: salvar cliente, lançar compra/pagamento, apagar lançamento, arquivar cliente. */
export async function POST(req: Request) {
  if (!(await logado("painel"))) return sair();
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "salvar") {
      const nome = texto(b.nome, 80);
      if (!nome) return erro("Coloque o nome do cliente.");
      const id = await salvarConta({ id: Number(b.id) || undefined, nome, telefone: texto(b.telefone, 30), obs: texto(b.obs, 200), semanal: b.semanal === true });
      return NextResponse.json({ ok: true, id, contas: await listarContas() });
    }
    if (b.acao === "lancar") {
      const contaId = Number(b.contaId);
      const valor = Math.round(Number(String(b.valor).replace(",", ".")) * 100);
      const tipo = b.tipo === "pagamento" ? "pagamento" : "compra";
      if (!contaId) return erro("Cliente inválido.");
      if (!(valor > 0 && valor <= 500000)) return erro("Valor inválido.");
      const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b.data)) ? String(b.data) : new Date().toISOString().slice(0, 10);
      await lancarConta({ contaId, tipo, valor, descricao: texto(b.descricao, 160), data });
      return NextResponse.json({ ok: true, contas: await listarContas() });
    }
    if (b.acao === "apagar-lancamento") {
      await apagarLancamento(Number(b.id));
      return NextResponse.json({ ok: true, contas: await listarContas() });
    }
    if (b.acao === "arquivar") {
      await arquivarConta(Number(b.id));
      return NextResponse.json({ ok: true, contas: await listarContas() });
    }
    return erro("Ação inválida.");
  } catch (e) {
    console.error("[contas]", e);
    return NextResponse.json({ erro: "Não consegui salvar. Tente de novo." }, { status: 500 });
  }
}

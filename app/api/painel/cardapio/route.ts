import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { getCardapio, salvarCardapio } from "@/lib/dados";
import type { Cardapio } from "@/lib/cardapio";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!logado("painel")) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  return NextResponse.json(await getCardapio());
}

/** Salva o cardápio inteiro (itens, categorias e adicionais), conferindo o formato. */
export async function PUT(req: Request) {
  if (!logado("painel")) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const c = (await req.json()) as Cardapio;
  const erro = validar(c);
  if (erro) return NextResponse.json({ erro }, { status: 400 });
  await salvarCardapio(c);
  return NextResponse.json({ ok: true });
}

function validar(c: Cardapio): string | null {
  if (!c || !Array.isArray(c.itens) || !Array.isArray(c.categorias) || typeof c.adicionais !== "object") return "Cardápio inválido.";
  const cats = new Set(c.categorias.map((x) => x.id));
  const ids = new Set<string>();
  for (const i of c.itens) {
    if (!i.id || ids.has(i.id)) return `Item com código repetido: ${i.nome || i.id}.`;
    ids.add(i.id);
    if (!i.nome?.trim()) return "Todo item precisa de nome.";
    if (!(typeof i.preco === "number" && i.preco > 0 && i.preco < 1000)) return `Preço inválido em ${i.nome}.`;
    if (i.precoAntigo != null && !(typeof i.precoAntigo === "number" && i.precoAntigo > 0)) return `Preço antigo inválido em ${i.nome}.`;
    if (!cats.has(i.categoria)) return `${i.nome} está numa categoria que não existe.`;
    if (i.imagem && !/^\/(api\/fotos|fotos)\//.test(i.imagem)) return `Foto inválida em ${i.nome}.`;
    for (const e of i.escolhas ?? []) {
      if (!c.adicionais[e.grupo]) return `${i.nome} usa um grupo de adicionais que não existe.`;
      if (!(e.min >= 0 && e.max >= 1 && e.min <= e.max)) return `Mínimo e máximo inválidos em ${i.nome}.`;
    }
  }
  return null;
}

import { IDS_ALERGENICOS } from "@/lib/alergenicos";
import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { getCardapio, salvarCardapio } from "@/lib/dados";
import type { Cardapio } from "@/lib/cardapio";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  return NextResponse.json(await getCardapio());
}

/** Salva o cardápio inteiro (itens, categorias e adicionais), conferindo o formato. */
export async function PUT(req: Request) {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const c = (await req.json()) as Cardapio;
  const erro = validar(c);
  if (erro) return NextResponse.json({ erro }, { status: 400 });
  await salvarCardapio(c);
  return NextResponse.json({ ok: true });
}

function validar(c: Cardapio): string | null {
  if (!c || !Array.isArray(c.itens) || !Array.isArray(c.categorias) || typeof c.adicionais !== "object") return "Cardápio inválido.";
  const cats = new Set(c.categorias.map((x) => x.id));
  for (const [id, g] of Object.entries(c.adicionais)) {
    if (!g?.nome?.trim() || !Array.isArray(g.opcoes) || !g.opcoes.length) return `O grupo "${g?.nomeInterno || id}" precisa de nome e de pelo menos uma opção.`;
    const nomes = new Set<string>();
    for (const o of g.opcoes) {
      if (!o.nome?.trim()) return `Opção sem nome em "${g.nome}".`;
      if (nomes.has(o.nome)) return `Opção repetida em "${g.nome}": ${o.nome}.`;
      nomes.add(o.nome);
      if (o.preco != null && !(typeof o.preco === "number" && o.preco >= 0 && o.preco < 100)) return `Preço inválido em "${o.nome}".`;
      if (o.imagem && !/^\/(api\/fotos|fotos)\//.test(o.imagem)) return `Foto inválida em "${o.nome}".`;
    }
    if (g.regras && !(g.regras.max >= 1 && g.regras.max <= 50)) return `Máximo de seleções inválido em "${g.nome}".`;
  }
  const ids = new Set<string>();
  for (const i of c.itens) {
    if (!i.id || ids.has(i.id)) return `Item com código repetido: ${i.nome || i.id}.`;
    ids.add(i.id);
    if (!i.nome?.trim()) return "Todo item precisa de nome.";
    if (!(typeof i.preco === "number" && i.preco > 0 && i.preco < 1000)) return `Preço inválido em ${i.nome}.`;
    if (i.precoAntigo != null && !(typeof i.precoAntigo === "number" && i.precoAntigo > 0)) return `Preço antigo inválido em ${i.nome}.`;
    if (!cats.has(i.categoria)) return `${i.nome} está numa categoria que não existe.`;
    if (i.imagem && !/^\/(api\/fotos|fotos)\//.test(i.imagem)) return `Foto inválida em ${i.nome}.`;
    if (i.alergenicos != null && (!Array.isArray(i.alergenicos) || i.alergenicos.some((a) => !IDS_ALERGENICOS.includes(a)))) return `Alergênicos inválidos em ${i.nome}.`;
    for (const e of i.escolhas ?? []) {
      if (!c.adicionais[e.grupo]) return `${i.nome} usa um grupo de adicionais que não existe.`;
      if (!(e.min >= 0 && e.max >= 1 && e.min <= e.max && e.max <= 50)) return `Mínimo e máximo inválidos em ${i.nome}.`;
    }
  }
  return null;
}

import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { getAjustes, salvarAjustes } from "@/lib/dados";
import type { Ajustes } from "@/lib/ajustes";
import { coordenadasDoPostcode } from "@/lib/entrega";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!logado("painel")) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  return NextResponse.json(await getAjustes());
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PUT(req: Request) {
  if (!logado("painel")) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const novo = (await req.json()) as Ajustes;
  const atual = await getAjustes();

  if (!Array.isArray(novo.horarios) || novo.horarios.length !== 7) return NextResponse.json({ erro: "Horários inválidos." }, { status: 400 });
  for (const h of novo.horarios) {
    if (h === null) continue;
    if (!HORA.test(h[0]) || !HORA.test(h[1]) || h[0] >= h[1]) return NextResponse.json({ erro: "Cada dia precisa abrir antes de fechar (ex.: 12:00 às 22:00)." }, { status: 400 });
  }
  const faixas = [...(novo.entrega?.faixas ?? [])].sort((a, b) => a.ateMilhas - b.ateMilhas);
  if (!faixas.length || faixas.some((f) => !(f.ateMilhas > 0) || !(f.taxa >= 0))) return NextResponse.json({ erro: "Confira as faixas de entrega." }, { status: 400 });

  // Postcode da cozinha mudou: busca as coordenadas de novo.
  let cozinha = atual.entrega.cozinha;
  const pc = (novo.entrega?.cozinha?.postcode || "").toUpperCase().trim();
  if (pc && pc !== atual.entrega.cozinha.postcode) {
    const c = await coordenadasDoPostcode(pc);
    if (!c) return NextResponse.json({ erro: "Não encontramos o postcode da cozinha." }, { status: 400 });
    cozinha = { postcode: pc, ...c };
  }

  const final: Ajustes = {
    ...atual,
    ...novo,
    preparoMin: Math.min(120, Math.max(5, Math.round(Number(novo.preparoMin) || atual.preparoMin))),
    entrega: { ...atual.entrega, ...novo.entrega, faixas, cozinha },
  };
  await salvarAjustes(final);
  return NextResponse.json(final);
}

import { NextResponse } from "next/server";
import { criarAvaliacao } from "@/lib/db";
import { permitir } from "@/lib/seguranca";
import { pratoDoLink } from "@/lib/almoco";

export const dynamic = "force-dynamic";

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Avaliação do almoço (link mandado no WhatsApp para quem pediu marmita).
 * Não tem pedido no site: o cliente digita nome e região. Entra como "pendente" e só vai para o site depois da sua aprovação.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.site) return NextResponse.json({ ok: true }); // campo-isca de robô
  if (!(await permitir(req, "avaliacao-almoco", 5, 60 * 60))) return NextResponse.json({ erro: "Muitas avaliações seguidas. Tente mais tarde." }, { status: 429 });

  const prato = pratoDoLink(String(b.prato ?? ""));
  if (!prato) return NextResponse.json({ erro: "Link de avaliação inválido." }, { status: 400 });
  const nota = Math.round(Number(b.nota));
  if (!(nota >= 1 && nota <= 5)) return NextResponse.json({ erro: "Escolha de 1 a 5 estrelas." }, { status: 400 });
  const corpo = texto(b.texto, 500);
  if (corpo.length < 3) return NextResponse.json({ erro: "Escreve um pouquinho sobre o almoço." }, { status: 400 });
  // Nome: só letras (sem emoji, número ou link).
  const nome = texto(b.nome, 40).replace(/[^\p{L}\s.'-]/gu, "").replace(/\s+/g, " ").trim();
  if (nome.length < 2) return NextResponse.json({ erro: "Coloque o seu nome." }, { status: 400 });
  const local = texto(b.local, 30).replace(/[^\p{L}\s.'-]/gu, "").trim();
  if (local.length < 2) return NextResponse.json({ erro: "Escolha a sua região." }, { status: 400 });

  const nossa = (v: unknown) => (typeof v === "string" && /^\/api\/fotos\/[A-Za-z0-9_-]{6,40}$/.test(v) ? v : null);
  await criarAvaliacao({ nome, local, nota, texto: corpo, pedidoNumero: null, foto: nossa(b.foto), assunto: `Almoço · ${prato}` });
  return NextResponse.json({ ok: true });
}

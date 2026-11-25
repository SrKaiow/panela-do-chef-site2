import { NextResponse } from "next/server";
import { criarAvaliacao } from "@/lib/db";
import { identidadeDoPedido, pedidoParaAvaliar } from "@/lib/avaliacaoPedido";
import { permitir } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");


/** Cliente envia uma avaliação. Ela entra como "pendente" e só aparece no site depois que você aprovar no painel. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.site) return NextResponse.json({ ok: true }); // robô preencheu o campo-isca: finge que deu certo
  if (!(await permitir(req, "avaliacao", 5, 60 * 60))) return NextResponse.json({ erro: "Muitas avaliações seguidas. Tente mais tarde." }, { status: 429 });

  const corpo = texto(b.texto, 500);
  const nota = Math.round(Number(b.nota));
  if (corpo.length < 3) return NextResponse.json({ erro: "Escreve um pouquinho sobre o pedido." }, { status: 400 });
  if (!(nota >= 1 && nota <= 5)) return NextResponse.json({ erro: "Escolha de 1 a 5 estrelas." }, { status: 400 });

  // Só avalia quem fez um pedido entregue. Nome e bairro saem do pedido (ninguém inventa nome nem endereço).
  const achado = await pedidoParaAvaliar(b);
  if ("erro" in achado) return NextResponse.json({ erro: achado.erro }, { status: 400 });
  const { nome, local, numero: pedidoNumero } = await identidadeDoPedido(achado.pedido);

  // Só aceita foto enviada para o nosso próprio site (e ela só aparece depois da sua aprovação).
  const nossa = (v: unknown) => (typeof v === "string" && /^\/api\/fotos\/[A-Za-z0-9_-]{6,40}$/.test(v) ? v : null);
  await criarAvaliacao({ nome, local, nota, texto: corpo, pedidoNumero, foto: nossa(b.foto), avatar: nossa(b.avatar) });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { buscarPorToken, criarAvaliacao, pedidoJaAvaliado } from "@/lib/db";
import { permitir } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");


/** Cliente envia uma avaliação. Ela entra como "pendente" e só aparece no site depois que você aprovar no painel. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.site) return NextResponse.json({ ok: true }); // robô preencheu o campo-isca: finge que deu certo
  if (!(await permitir(req, "avaliacao", 5, 60 * 60))) return NextResponse.json({ erro: "Muitas avaliações seguidas. Tente mais tarde." }, { status: 429 });

  const nome = texto(b.nome, 40);
  const local = texto(b.local, 40) || null;
  const corpo = texto(b.texto, 500);
  const nota = Math.round(Number(b.nota));
  if (!nome) return NextResponse.json({ erro: "Escreva seu nome." }, { status: 400 });
  if (corpo.length < 10) return NextResponse.json({ erro: "Conta um pouquinho mais sobre o pedido (mínimo 10 letras)." }, { status: 400 });
  if (!(nota >= 1 && nota <= 5)) return NextResponse.json({ erro: "Escolha de 1 a 5 estrelas." }, { status: 400 });

  // Veio da página do pedido: vira "cliente verificado".
  let pedidoNumero: number | null = null;
  if (typeof b.token === "string" && b.token) {
    const p = await buscarPorToken(b.token);
    if (p && p.status === "entregue") {
      if (await pedidoJaAvaliado(p.numero)) return NextResponse.json({ erro: "Este pedido já foi avaliado. Obrigado!" }, { status: 400 });
      pedidoNumero = p.numero;
    }
  }

  await criarAvaliacao({ nome, local, nota, texto: corpo, pedidoNumero });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { buscarPorToken, pedidoJaAvaliado, salvarFoto } from "@/lib/db";
import { permitir, tipoRealDaImagem } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/**
 * Foto de como o pedido chegou. Vem da página do pedido (com o link dele) ou do quadro de avaliações.
 * A foto só aparece no site depois que a avaliação é aprovada no painel.
 */
export async function POST(req: Request) {
  if (!(await permitir(req, "foto-avaliacao", 6, 60 * 60))) return NextResponse.json({ erro: "Muitas fotos seguidas. Tente mais tarde." }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const token = form?.get("token");
  const arquivo = form?.get("foto");
  if (!(arquivo instanceof File)) return NextResponse.json({ erro: "Envie uma foto." }, { status: 400 });

  // Pela página do pedido: o pedido precisa estar entregue e sem avaliação.
  if (typeof token === "string" && token) {
    const p = await buscarPorToken(token);
    if (!p || p.status !== "entregue") return NextResponse.json({ erro: "Só dá para mandar foto de um pedido entregue." }, { status: 400 });
    if (await pedidoJaAvaliado(p.numero)) return NextResponse.json({ erro: "Este pedido já foi avaliado. Obrigado!" }, { status: 400 });
  }
  if (arquivo.size > 2_000_000) return NextResponse.json({ erro: "Foto muito grande." }, { status: 400 });

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoRealDaImagem(bytes);
  if (!tipo) return NextResponse.json({ erro: "Esse arquivo não é uma foto." }, { status: 400 });
  const id = await salvarFoto(tipo, bytes);
  return NextResponse.json({ url: `/api/fotos/${id}` });
}

import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { salvarFoto } from "@/lib/db";
import { tipoRealDaImagem } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

const TIPOS = ["image/webp", "image/jpeg", "image/png"];
const MAX = 1.5 * 1024 * 1024; // o painel já reduz a foto antes de enviar

/** Recebe a foto de um produto (já reduzida no navegador) e devolve o endereço dela. */
export async function POST(req: Request) {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  const form = await req.formData();
  const arquivo = form.get("foto");
  if (!(arquivo instanceof Blob)) return NextResponse.json({ erro: "Escolha uma foto." }, { status: 400 });
  if (!TIPOS.includes(arquivo.type)) return NextResponse.json({ erro: "Use uma foto em JPG, PNG ou WebP." }, { status: 400 });
  if (arquivo.size > MAX) return NextResponse.json({ erro: "Foto grande demais. Tente uma menor que 1,5 MB." }, { status: 400 });
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  // Não confia no tipo informado: confere pelo conteúdo que é mesmo JPG, PNG ou WebP.
  const tipo = tipoRealDaImagem(bytes);
  if (!tipo) return NextResponse.json({ erro: "Esse arquivo não é uma foto válida." }, { status: 400 });
  const id = await salvarFoto(tipo, bytes);
  return NextResponse.json({ url: `/api/fotos/${id}` });
}

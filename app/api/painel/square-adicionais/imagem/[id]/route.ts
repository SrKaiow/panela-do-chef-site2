import { logado } from "@/lib/auth";
import { fotoDaSquare } from "@/lib/squareCatalogo";

export const dynamic = "force-dynamic";

/** Entrega a foto de um adicional da Square para o painel reduzir e salvar. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await logado("painel"))) return new Response("Entre no painel de novo.", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return new Response("Foto inválida.", { status: 400 });
  const f = await fotoDaSquare(id).catch(() => null);
  if (!f) return new Response("Foto não encontrada.", { status: 404 });
  return new Response(f.bytes, { headers: { "Content-Type": f.tipo, "Cache-Control": "private, no-store" } });
}

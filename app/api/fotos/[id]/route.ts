import { lerFoto } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Serve a foto de um produto. O id muda a cada upload, então pode ficar em cache por um ano. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params;
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(params.id)) return new Response("Foto não encontrada", { status: 404 });
  const f = await lerFoto(params.id);
  if (!f) return new Response("Foto não encontrada", { status: 404 });
  return new Response(Buffer.from(f.dados), {
    headers: {
      "Content-Type": ["image/jpeg", "image/png", "image/webp"].includes(f.tipo) ? f.tipo : "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}

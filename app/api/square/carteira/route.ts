import { NextResponse } from "next/server";
import { appIdSquare, garantirDominioApplePay, squareConfigurado } from "@/lib/square";

export const dynamic = "force-dynamic";

/** Dados públicos para mostrar os botões Apple Pay / Google Pay (id do app e da loja na Square). */
export async function GET(req: Request) {
  if (!squareConfigurado()) return NextResponse.json({ ok: false });
  const appId = await appIdSquare();
  if (!appId) return NextResponse.json({ ok: false });
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(":")[0].toLowerCase();
  // Na primeira vez, registra o domínio na Apple Pay (sem atrasar a resposta).
  const registro = garantirDominioApplePay(host).catch(() => {});
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    getCloudflareContext().ctx.waitUntil(registro);
  } catch {
    await registro;
  }
  return NextResponse.json(
    { ok: true, appId, locationId: process.env.SQUARE_LOCATION_ID, sandbox: process.env.SQUARE_AMBIENTE === "sandbox" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

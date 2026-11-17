import { NextResponse } from "next/server";
import { registrarVisita } from "@/lib/db";
import { permitir } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

/** Conta uma visita ao site. O id é anônimo (gerado no navegador), sem nome, IP ou dados pessoais. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const v = typeof b?.v === "string" ? b.v : "";
  if (!/^[a-z0-9]{16,40}$/.test(v)) return new NextResponse(null, { status: 204 });
  // Robôs conhecidos não contam.
  const ua = req.headers.get("user-agent") || "";
  if (/bot|crawl|spider|preview|headless|lighthouse/i.test(ua)) return new NextResponse(null, { status: 204 });
  if (!(await permitir(req, "visita", 40, 3600))) return new NextResponse(null, { status: 204 });
  await registrarVisita(v).catch((e) => console.error("[visita]", e));
  return new NextResponse(null, { status: 204 });
}

import { NextResponse } from "next/server";
import { chavePublicaPush } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Chave pública para o navegador do cliente se inscrever nas notificações. */
export async function GET() {
  return NextResponse.json({ chave: await chavePublicaPush() });
}

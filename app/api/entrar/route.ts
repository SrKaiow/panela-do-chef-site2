import { NextResponse } from "next/server";
import { nomeCookie, senhaCorreta, valorSessao, type Area } from "@/lib/auth";
import { zerarLimite } from "@/lib/db";
import { ipDe, permitir } from "@/lib/seguranca";

export const dynamic = "force-dynamic";

const DESTINO: Record<Area, string> = { painel: "/painel", entregador: "/entregador" };
// Redireciona com caminho relativo: funciona em qualquer endereço (Cloudflare, domínio próprio, local).
const ir = (caminho: string) => new NextResponse(null, { status: 303, headers: { Location: caminho } });

export async function POST(req: Request) {
  const form = await req.formData();
  const area: Area = form.get("area") === "entregador" ? "entregador" : "painel";
  const senha = String(form.get("senha") || "");
  const url = new URL(req.url);
  // Trava contra quem tenta adivinhar a senha: 8 tentativas a cada 15 minutos por IP.
  if (!(await permitir(req, `login-${area}`, 8, 15 * 60))) return ir(`${DESTINO[area]}/entrar?erro=limite`);
  if (!senhaCorreta(area, senha)) {
    await new Promise((r) => setTimeout(r, 800)); // freia tentativas de adivinhar a senha
    return ir(`${DESTINO[area]}/entrar?erro=1`);
  }
  await zerarLimite(`login-${area}:${ipDe(req)}`).catch(() => {});
  const res = ir(DESTINO[area]);
  res.cookies.set(nomeCookie(area), valorSessao(area), {
    httpOnly: true, sameSite: "lax", secure: url.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

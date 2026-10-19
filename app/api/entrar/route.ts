import { NextResponse } from "next/server";
import { nomeCookie, senhaCorreta, valorSessao, type Area } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DESTINO: Record<Area, string> = { painel: "/painel", entregador: "/entregador" };

export async function POST(req: Request) {
  const form = await req.formData();
  const area: Area = form.get("area") === "entregador" ? "entregador" : "painel";
  const senha = String(form.get("senha") || "");
  const url = new URL(req.url);
  if (!senhaCorreta(area, senha)) {
    await new Promise((r) => setTimeout(r, 800)); // freia tentativas de adivinhar a senha
    return NextResponse.redirect(new URL(`${DESTINO[area]}/entrar?erro=1`, url), 303);
  }
  const res = NextResponse.redirect(new URL(DESTINO[area], url), 303);
  res.cookies.set(nomeCookie(area), valorSessao(area), {
    httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

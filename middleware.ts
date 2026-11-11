import { NextResponse, type NextRequest } from "next/server";

/**
 * Trava contra ataques vindos de outros sites (CSRF): qualquer envio para a API
 * (criar, salvar, apagar) precisa vir de uma página do próprio site.
 * A Stripe é a exceção: ela avisa os pagamentos direto, com assinatura própria.
 */
export function middleware(req: NextRequest) {
  const metodo = req.method.toUpperCase();
  if (metodo === "GET" || metodo === "HEAD" || metodo === "OPTIONS") return NextResponse.next();
  if (req.nextUrl.pathname === "/api/stripe/webhook") return NextResponse.next();

  const origem = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  let mesmoSite = false;
  try {
    mesmoSite = !!origem && !!host && new URL(origem).host === host;
  } catch {
    mesmoSite = false;
  }
  if (!mesmoSite) return NextResponse.json({ erro: "Envio bloqueado." }, { status: 403 });
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };

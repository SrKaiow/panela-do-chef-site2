import { ARQUIVO_APPLE_PAY } from "@/lib/applePayDominio";

/** Servido em /.well-known/apple-developer-merchantid-domain-association (ver next.config). */
export function GET() {
  return new Response(ARQUIVO_APPLE_PAY, { headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=86400" } });
}

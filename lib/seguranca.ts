import { NextResponse } from "next/server";
import { dentroDoLimite } from "./db";

/** IP de quem fez o pedido. Na Cloudflare vem em cf-connecting-ip (não dá para falsificar). */
export function ipDe(req: Request) {
  const h = req.headers;
  return h.get("cf-connecting-ip") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
}

/** Resposta pronta para quem passou do limite. */
export const respostaLimite = (msg = "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.") =>
  NextResponse.json({ erro: msg }, { status: 429, headers: { "Retry-After": "600" } });

/** true = pode seguir; false = bloqueado. Se o banco falhar, deixa passar (não derruba a loja). */
export async function permitir(req: Request, area: string, max: number, janelaSeg: number) {
  try {
    return await dentroDoLimite(`${area}:${ipDe(req)}`, max, janelaSeg);
  } catch (e) {
    console.error("[limite]", e);
    return true;
  }
}

/** Erros de validação que podem ser mostrados ao cliente. Qualquer outro erro vira mensagem genérica. */
export class ErroCliente extends Error {}

export function mensagemSegura(e: unknown, generica: string) {
  if (e instanceof ErroCliente) return e.message;
  // Erros comuns (new Error) do nosso código de validação são textos para o cliente;
  // erros de banco, Stripe ou rede têm outras classes e não são mostrados.
  if (e instanceof Error && e.constructor === Error) return e.message;
  return generica;
}

/** Confere se o arquivo é mesmo uma imagem pelo começo dele (não confia no nome nem no tipo informado). */
export function tipoRealDaImagem(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { confirmarPagamentoCartao, listarPedidos, type Pedido } from "@/lib/db";
import { pedidoSquarePago, squareConfigurado } from "@/lib/square";
import { avisarLojaNovoPedido } from "@/lib/avisoLoja";

export const dynamic = "force-dynamic";

// Confere na Square, no máximo a cada 20 s, os pedidos de cartão das últimas 6 horas que ainda constam como "aguardando".
// Assim o pedido pago entra sozinho, mesmo se o aviso da Square se perder.
let ultimaConferencia = 0;
async function conferirPendentesSquare(pedidos: Pedido[]) {
  if (!squareConfigurado() || Date.now() - ultimaConferencia < 20_000) return false;
  ultimaConferencia = Date.now();
  const limite = Date.now() - 6 * 60 * 60 * 1000;
  const pendentes = pedidos
    .filter((p) => p.status === "aguardando_pagamento" && p.pagamento === "cartao" && p.squarePedido && new Date(p.criadoEm).getTime() > limite)
    .slice(0, 5);
  let mudou = false;
  for (const p of pendentes) {
    if (await pedidoSquarePago([p.squarePedido], p.numero, p.total, p.squarePedido)) {
      await confirmarPagamentoCartao(p.numero);
      await avisarLojaNovoPedido(p.numero);
      mudou = true;
    }
  }
  return mudou;
}

export async function GET() {
  if (!(await logado("painel"))) return NextResponse.json({ erro: "Entre no painel de novo." }, { status: 401 });
  let pedidos = await listarPedidos(300);
  try {
    if (await conferirPendentesSquare(pedidos)) pedidos = await listarPedidos(300);
  } catch (e) {
    console.error("[painel] conferir square", e);
  }
  return NextResponse.json({ pedidos });
}

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { confirmarPagamentoCartao } from "@/lib/db";

export const dynamic = "force-dynamic";

// No Stripe: Developers > Webhooks > Add endpoint
// URL: https://SEU-SITE/api/stripe/webhook  · Evento: checkout.session.completed
export async function POST(req: Request) {
  const segredo = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segredo) return NextResponse.json({ erro: "Webhook não configurado" }, { status: 400 });

  const corpo = await req.text();
  const assinatura = req.headers.get("stripe-signature") || "";
  let evento;
  try {
    evento = stripe().webhooks.constructEvent(corpo, assinatura, segredo);
  } catch {
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 400 });
  }

  if (evento.type === "checkout.session.completed") {
    const s = evento.data.object;
    const numero = Number(s.metadata?.numero);
    if (numero && s.payment_status === "paid") await confirmarPagamentoCartao(numero);
  }
  return NextResponse.json({ ok: true });
}

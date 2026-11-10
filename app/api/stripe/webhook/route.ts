import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, siteUrl } from "@/lib/stripe";
import { confirmarPagamentoCartao } from "@/lib/db";
import { avisarLojaNovoPedido } from "@/lib/avisoLoja";

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
    evento = await stripe().webhooks.constructEventAsync(corpo, assinatura, segredo, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return NextResponse.json({ erro: "Assinatura inválida" }, { status: 400 });
  }

  // Pagamento na hora (cartão) ou que confirma depois (transferência pelo banco).
  if (evento.type === "checkout.session.completed" || evento.type === "checkout.session.async_payment_succeeded") {
    const s = evento.data.object;
    const numero = Number(s.metadata?.numero);
    if (numero && s.payment_status === "paid") {
      await confirmarPagamentoCartao(numero);
      await avisarLojaNovoPedido(numero, siteUrl(req));
    }
  }
  return NextResponse.json({ ok: true });
}

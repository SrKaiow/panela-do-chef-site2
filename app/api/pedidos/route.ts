import { NextResponse } from "next/server";
import { emPence, validarCarrinho } from "@/lib/cardapio";
import { getAjustes, getCardapio, cartaoConfigurado } from "@/lib/dados";
import { estadoLoja, horariosParaAgendar } from "@/lib/horario";
import { criarPedido, salvarSessaoStripe } from "@/lib/db";
import { stripe, siteUrl } from "@/lib/stripe";
import { avisarLojaNovoPedido } from "@/lib/avisoLoja";
import { coordenadasDoPostcode, cotarEntrega, distanciaMetros } from "@/lib/entrega";

export const dynamic = "force-dynamic";

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  try {
    const [ajustes, cardapio] = await Promise.all([getAjustes(), getCardapio()]);
    const b = await req.json();

    // Fora do horário: só aceita pedido agendado para um horário válido da próxima abertura.
    const estado = estadoLoja(ajustes.horarios, ajustes.pausado);
    let agendadoPara: string | null = null;
    if (typeof b.agendadoPara === "string" && b.agendadoPara) {
      const valido = horariosParaAgendar(ajustes.horarios).some((h) => h.valor === b.agendadoPara);
      if (!valido) throw new Error("Esse horário não está mais disponível. Escolha outro.");
      agendadoPara = b.agendadoPara;
    } else if (!estado.aberto) {
      throw new Error("A cozinha está fechada agora. Escolha um horário para receber o seu pedido.");
    }

    const nome = texto(b.nome, 80);
    const telefone = texto(b.telefone, 30);
    const endereco = texto(b.endereco, 160);
    const postcode = texto(b.postcode, 10).toUpperCase();
    const observacao = texto(b.observacao, 300) || null;
    if (!nome || !telefone || !endereco || !postcode) throw new Error("Preencha nome, telefone, endereço e postcode.");

    const pagamento = b.pagamento === "cartao" ? "cartao" : "dinheiro";
    if (pagamento === "cartao" && !(ajustes.pagamentos.cartao && cartaoConfigurado())) throw new Error("Pagamento com cartão indisponível no momento.");
    if (pagamento === "dinheiro" && !ajustes.pagamentos.dinheiro) throw new Error("Pagamento em dinheiro indisponível no momento.");

    const { linhas, subtotal } = validarCarrinho(cardapio, b.itens);
    const minimo = emPence(ajustes.entrega.pedidoMinimo);
    if (minimo && subtotal < minimo) throw new Error("O pedido não atingiu o valor mínimo para entrega.");

    // Taxa de entrega pela distância da cozinha até o postcode (mesma regra da Square).
    const coords = await coordenadasDoPostcode(postcode);
    if (!coords) throw new Error("Não encontramos esse postcode. Confira e tente de novo (ex.: KT17 1JW).");
    const distanciaM = Math.round(distanciaMetros(ajustes.entrega.cozinha, coords));
    const cotacao = cotarEntrega(distanciaM, subtotal, ajustes.entrega.faixas, ajustes.entrega.raioMilhas);
    if (!cotacao.ok) throw new Error(cotacao.motivo);
    const taxa = cotacao.taxa;
    const total = subtotal + taxa;

    let trocoPara: number | null = null;
    if (pagamento === "dinheiro" && b.trocoPara != null && b.trocoPara !== "") {
      trocoPara = emPence(Number(b.trocoPara));
      if (!(trocoPara >= total)) throw new Error("O valor do troco precisa ser maior que o total.");
    }

    const { numero, token } = await criarPedido({
      nome, telefone, endereco, postcode, observacao,
      lat: coords.lat, lng: coords.lng, agendadoPara, distanciaM,
      itens: linhas, subtotal, taxa, total, pagamento, trocoPara,
      pago: false,
      // Pedido em dinheiro vai direto para a cozinha; no cartão, só depois de pago.
      status: pagamento === "dinheiro" ? "novo" : "aguardando_pagamento",
    });

    const origem = siteUrl(req);
    if (pagamento === "dinheiro") {
      await avisarLojaNovoPedido(numero, origem);
      return NextResponse.json({ numero, redirecionar: `/pedido/${token}` });
    }

    const lineItems = linhas.map((l) => ({
      quantity: l.qtd,
      price_data: {
        currency: "gbp",
        unit_amount: l.unitario,
        product_data: { name: l.nome, ...(l.detalhes.length ? { description: l.detalhes.join(" | ").slice(0, 500) } : {}) },
      },
    }));
    if (taxa) lineItems.push({ quantity: 1, price_data: { currency: "gbp", unit_amount: taxa, product_data: { name: "Taxa de entrega" } } });

    const sessao = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      metadata: { numero: String(numero) },
      client_reference_id: String(numero),
      // Sem lista fixa: a Stripe mostra o que estiver ligado no painel dela (cartão, Apple Pay, Google Pay, Pay by Bank...).
      payment_intent_data: { description: `Panela do Chef · pedido #${numero}`, metadata: { numero: String(numero) } },
      success_url: `${origem}/pedido/${token}?sessao={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origem}/pedido/${token}?cancelado=1`,
    });
    await salvarSessaoStripe(numero, sessao.id);
    return NextResponse.json({ numero, redirecionar: sessao.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar o pedido.";
    console.error("[pedidos]", e);
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
}

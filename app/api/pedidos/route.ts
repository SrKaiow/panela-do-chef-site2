import { NextResponse } from "next/server";
import { loja, emPence, validarCarrinho, cartaoAtivo, dinheiroAtivo } from "@/lib/cardapio";
import { criarPedido, salvarSessaoStripe } from "@/lib/db";
import { stripe, siteUrl } from "@/lib/stripe";
import { coordenadasDoPostcode } from "@/lib/entrega";

export const dynamic = "force-dynamic";

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  try {
    if (!loja.aberto) throw new Error(loja.mensagemFechado);
    const b = await req.json();

    const nome = texto(b.nome, 80);
    const telefone = texto(b.telefone, 30);
    const endereco = texto(b.endereco, 160);
    const postcode = texto(b.postcode, 10).toUpperCase();
    const observacao = texto(b.observacao, 300) || null;
    if (!nome || !telefone || !endereco || !postcode) throw new Error("Preencha nome, telefone, endereço e postcode.");

    const pagamento = b.pagamento === "cartao" ? "cartao" : "dinheiro";
    if (pagamento === "cartao" && !cartaoAtivo()) throw new Error("Pagamento com cartão indisponível no momento.");
    if (pagamento === "dinheiro" && !dinheiroAtivo()) throw new Error("Pagamento em dinheiro indisponível no momento.");

    const { linhas, subtotal } = validarCarrinho(b.itens);
    const minimo = emPence(loja.entrega.pedidoMinimo);
    if (minimo && subtotal < minimo) throw new Error("O pedido não atingiu o valor mínimo para entrega.");
    const taxa = emPence(loja.entrega.taxa);
    const total = subtotal + taxa;

    let trocoPara: number | null = null;
    if (pagamento === "dinheiro" && b.trocoPara != null && b.trocoPara !== "") {
      trocoPara = emPence(Number(b.trocoPara));
      if (!(trocoPara >= total)) throw new Error("O valor do troco precisa ser maior que o total.");
    }

    // Coordenadas do endereço para o rastreio e o aviso de "chegando" (se falhar, o pedido segue normal).
    const coords = await coordenadasDoPostcode(postcode);

    const { numero, token } = await criarPedido({
      nome, telefone, endereco, postcode, observacao,
      lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      itens: linhas, subtotal, taxa, total, pagamento, trocoPara,
      pago: false,
      // Pedido em dinheiro vai direto para a cozinha; no cartão, só depois de pago.
      status: pagamento === "dinheiro" ? "novo" : "aguardando_pagamento",
    });

    if (pagamento === "dinheiro") {
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
      success_url: `${siteUrl()}/pedido/${token}?sessao={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/pedido/${token}?cancelado=1`,
    });
    await salvarSessaoStripe(numero, sessao.id);
    return NextResponse.json({ numero, redirecionar: sessao.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar o pedido.";
    console.error("[pedidos]", e);
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
}

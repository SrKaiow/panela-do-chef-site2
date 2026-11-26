import { NextResponse } from "next/server";
import { emPence, validarCarrinho } from "@/lib/cardapio";
import { getAjustes, getCardapio, cartaoConfigurado, provedorCartao } from "@/lib/dados";
import { criarPagamentoSquare } from "@/lib/square";
import { estadoLoja, horariosParaAgendar } from "@/lib/horario";
import { criarPedido, salvarPagamentoSquare, salvarSessaoStripe } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { siteUrl } from "@/lib/site";
import { avisarLojaNovoPedido } from "@/lib/avisoLoja";
import { conferirColeta, coordenadasDoPostcode, cotarEntrega, distanciaMetros, entregaEspecial } from "@/lib/entrega";
import { mensagemSegura, permitir, respostaLimite } from "@/lib/seguranca";
import { CEIA, ehItemNatal, encomendaAberta } from "@/lib/natal";
import { hojeLondres } from "@/lib/cardapio";

export const dynamic = "force-dynamic";

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  // Contra pedidos falsos em massa: 6 a cada 10 minutos e 20 por hora, por IP.
  if (!(await permitir(req, "pedido", 6, 10 * 60)) || !(await permitir(req, "pedido-hora", 20, 60 * 60))) {
    return respostaLimite("Muitos pedidos seguidos daqui. Espere alguns minutos ou fale com a gente no WhatsApp.");
  }
  try {
    const [ajustes, cardapio] = await Promise.all([getAjustes(), getCardapio()]);
    const b = await req.json();
    // Campo-isca invisível: só robô preenche.
    if (b.site) throw new Error("Não foi possível enviar o pedido.");

    // Ceia de Natal: encomenda à parte (só entrega, só cartão, data da ceia, grátis até 9 milhas).
    const natal = b.natal === true;
    const itensNatal = Array.isArray(b.itens) && b.itens.some((l: { itemId?: string }) => ehItemNatal(cardapio.itens.find((i) => i.id === l?.itemId)?.categoria ?? ""));
    if (natal !== itensNatal || (natal && b.itens.some((l: { itemId?: string }) => !ehItemNatal(cardapio.itens.find((i) => i.id === l?.itemId)?.categoria ?? "")))) {
      throw new Error("A Ceia de Natal é uma encomenda separada. Monte a ceia na página da Ceia de Natal.");
    }
    if (natal) {
      if (!encomendaAberta(hojeLondres())) throw new Error("As encomendas da Ceia de Natal já fecharam. Fale com a gente no WhatsApp.");
      b.retirada = false;
      b.pagamento = "cartao";
      if (!CEIA.datas.some((d) => d.valor === b.agendadoPara)) throw new Error("Escolha o dia da entrega da ceia.");
    }

    // Reserva de horário é só para coleta na porta; entrega é sempre "agora", com a cozinha aberta.
    const estado = estadoLoja(ajustes.horarios, ajustes.pausado);
    let agendadoPara: string | null = natal ? b.agendadoPara : null;
    if (natal) {
      // encomenda: não depende da cozinha estar aberta agora
    } else if (b.retirada !== true) {
      if (!estado.aberto) throw new Error("A entrega é só com a cozinha aberta. Para deixar reservado para mais tarde, escolha \"Coletar\".");
    } else if (typeof b.agendadoPara === "string" && b.agendadoPara) {
      const valido = horariosParaAgendar(ajustes.horarios).some((h) => h.valor === b.agendadoPara);
      if (!valido) throw new Error("Esse horário não está mais disponível. Escolha outro.");
      agendadoPara = b.agendadoPara;
    } else if (!estado.aberto) {
      throw new Error("A cozinha está fechada agora. Escolha um horário para vir buscar o seu pedido.");
    }

    // Coletar na porta: sem endereço e sem taxa de entrega.
    const retirada = b.retirada === true;
    const nome = texto(b.nome, 80);
    const telefone = texto(b.telefone, 30);
    const endereco = retirada ? "Coleta na porta" : texto(b.endereco, 160);
    const postcode = retirada ? ajustes.entrega.cozinha.postcode.toUpperCase() : texto(b.postcode, 10).toUpperCase();
    let semLocal = false;
    const observacaoCliente = texto(b.observacao, 300) || null;
    if (!nome || !telefone) throw new Error("Preencha nome e telefone.");
    if (!endereco || !postcode) throw new Error("Preencha nome, telefone, endereço e postcode.");
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10 || digitos.length > 15) throw new Error("Confira o telefone (ex.: 07123 456789).");

    const pagamento = b.pagamento === "cartao" ? "cartao" : "dinheiro";
    if (pagamento === "cartao" && !(ajustes.pagamentos.cartao && cartaoConfigurado())) throw new Error("Pagamento com cartão indisponível no momento.");
    if (pagamento === "dinheiro" && !ajustes.pagamentos.dinheiro) throw new Error("Pagamento em dinheiro indisponível no momento.");

    const { linhas, subtotal } = validarCarrinho(cardapio, b.itens);
    if (natal && linhas.some((l) => l.unitario <= 0)) throw new Error("Os preços da ceia ainda não foram definidos. Fale com a gente no WhatsApp.");
    let coords = { lat: ajustes.entrega.cozinha.lat, lng: ajustes.entrega.cozinha.lng };
    let distanciaM = 0;
    let taxa = 0;
    if (retirada) {
      // Coleta: só com a localização do celular dentro do raio (contra pedido de quem está longe e não vem).
      const lat = Number(b.local?.lat);
      const lng = Number(b.local?.lng);
      const temLocal = b.local != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
      if (temLocal) {
        // Com localização: só bloqueia quem está longe de verdade.
        const perto = conferirColeta(ajustes.entrega.cozinha, { lat, lng }, ajustes.entrega.raioMilhas);
        if (!perto.ok) throw new Error(perto.motivo);
        distanciaM = perto.distanciaM;
      } else {
        // Sem localização (o celular não deixou): o pedido entra, e a cozinha vê o aviso no pedido.
        semLocal = true;
      }
    } else if (natal) {
      const achou = await coordenadasDoPostcode(postcode);
      if (!achou) throw new Error("Não encontramos esse postcode. Confira e tente de novo (ex.: KT17 1JW).");
      coords = achou;
      distanciaM = Math.round(distanciaMetros(ajustes.entrega.cozinha, coords));
      if (distanciaM / 1609.344 > CEIA.raioMilhas) throw new Error(`Infelizmente o seu postcode ultrapassa o nosso raio de entrega da Ceia de Natal (${CEIA.raioMilhas} milhas). Fale com a loja pelo WhatsApp.`);
      taxa = 0;
    } else {
      const minimo = emPence(ajustes.entrega.pedidoMinimo);
      if (minimo && subtotal < minimo) throw new Error("O pedido não atingiu o valor mínimo para entrega.");
      // Taxa de entrega pela distância da cozinha até o postcode (mesma regra da Square).
      const achou = await coordenadasDoPostcode(postcode);
      if (!achou) throw new Error("Não encontramos esse postcode. Confira e tente de novo (ex.: KT17 1JW).");
      coords = achou;
      distanciaM = Math.round(distanciaMetros(ajustes.entrega.cozinha, coords));
      // Cliente liberado fora do raio (postcode + número da casa), com taxa fixa.
      const especial = entregaEspecial(postcode, endereco);
      if (especial != null) taxa = especial;
      else {
        const cotacao = cotarEntrega(distanciaM, subtotal, ajustes.entrega.faixas, ajustes.entrega.raioMilhas);
        if (!cotacao.ok) throw new Error(cotacao.motivo);
        taxa = cotacao.taxa;
      }
    }
    const total = subtotal + taxa;

    let trocoPara: number | null = null;
    if (pagamento === "dinheiro" && b.trocoPara != null && b.trocoPara !== "") {
      trocoPara = emPence(Number(b.trocoPara));
      if (!(trocoPara >= total)) throw new Error("O valor do troco precisa ser maior que o total.");
      if (trocoPara > total + 50000) throw new Error("Valor do troco muito alto. Confira o valor.");
    }

    const { numero, token } = await criarPedido({
      nome, telefone, endereco, postcode,
      observacao: natal
        ? [`🎄 CEIA DE NATAL · entrega ${CEIA.datas.find((d) => d.valor === agendadoPara)?.rotulo ?? ""}`, observacaoCliente].filter(Boolean).join(" · ")
        : semLocal ? ["⚠ COLETA SEM LOCALIZAÇÃO CONFIRMADA", observacaoCliente].filter(Boolean).join(" · ") : observacaoCliente,
      lat: coords.lat, lng: coords.lng, agendadoPara, distanciaM, retirada,
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

    // Pagamento online pela Square (mesma conta da maquininha): cai direto no painel da Square.
    if (provedorCartao() === "square") {
      const sq = await criarPagamentoSquare({
        numero,
        linhas,
        taxa,
        total: subtotal + taxa,
        voltarPara: `${origem}/pedido/${token}?pago=1`,
        telefone,
        nome,
        endereco,
        postcode,
      });
      await salvarPagamentoSquare(numero, sq.orderId, sq.url);
      // Paga no próprio site (Apple Pay / Google Pay); o link da Square fica de reserva para outro cartão.
      return NextResponse.json({ numero, redirecionar: `/pedido/${token}` });
    }

    // Foto de cada item na página da Stripe (precisa de endereço completo).
    const fotoDe = (itemId: string) => {
      const img = cardapio.itens.find((i) => i.id === itemId)?.imagem;
      if (!img) return undefined;
      const url = img.startsWith("http") ? img : `${origem}${img}`;
      return url.startsWith("https://") ? [url] : undefined;
    };
    const lineItems = linhas.map((l) => ({
      quantity: l.qtd,
      price_data: {
        currency: "gbp",
        unit_amount: l.unitario,
        product_data: {
          name: l.nome,
          ...(l.detalhes.length ? { description: l.detalhes.join(" | ").slice(0, 500) } : {}),
          ...(fotoDe(l.itemId) ? { images: fotoDe(l.itemId) } : {}),
        },
      },
    }));
    if (taxa) lineItems.push({ quantity: 1, price_data: { currency: "gbp", unit_amount: taxa, product_data: { name: "Taxa de entrega" } } });

    const sessao = await (await stripe()).checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      metadata: { numero: String(numero) },
      client_reference_id: String(numero),
      // Sem lista fixa: a Stripe mostra o que estiver ligado no painel dela (cartão, Apple Pay, Google Pay, Pay by Bank...).
      payment_intent_data: { description: `Panela do Chef · pedido #${numero}`, metadata: { numero: String(numero) } },
      locale: "auto",
      // Página de pagamento com a cara da Panela: preto piano, botão amarelo, logo e ícone.
      ...(origem.startsWith("https://")
        ? {
            branding_settings: {
              display_name: "Panela do Chef",
              background_color: "#0a0a0a",
              button_color: "#ffd814",
              border_style: "rounded" as const,
              font_family: "montserrat" as const,
              icon: { type: "url" as const, url: `${origem}/fotos/icone-panela.png` },
              logo: { type: "url" as const, url: `${origem}/fotos/logo-panela-do-chef.png` },
            },
          }
        : {}),
      custom_text: {
        submit: { message: `Pedido #${numero}. Assim que o pagamento entrar, ele vai direto para a cozinha.` },
      },
      success_url: `${origem}/pedido/${token}?sessao={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origem}/pedido/${token}?cancelado=1`,
    });
    await salvarSessaoStripe(numero, sessao.id);
    return NextResponse.json({ numero, redirecionar: sessao.url });
  } catch (e) {
    const msg = mensagemSegura(e, "Não deu para concluir o pedido agora. Tente de novo em instantes ou fale com a gente no WhatsApp.");
    console.error("[pedidos]", e);
    return NextResponse.json({ erro: msg }, { status: 400 });
  }
}

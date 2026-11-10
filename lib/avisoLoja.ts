import { buscarPorNumero, marcarAvisoLoja, type Pedido } from "./db";
import { getAjustes } from "./dados";
import { telefoneInternacional } from "./whatsapp";
import { rotuloAgendado } from "./horario";
import { siteUrl } from "./stripe";

/**
 * Aviso de pedido novo no WhatsApp da empresa.
 * Usa o CallMeBot (grátis, manda mensagem para o seu próprio número): defina CALLMEBOT_APIKEY.
 * O número que recebe é WHATSAPP_LOJA ou, se vazio, o telefone dos ajustes da loja.
 */

const libra = (p: number) => "£" + (p / 100).toFixed(2);

export function textoPedido(p: Pedido, origem?: string) {
  const linhas: string[] = [];
  linhas.push(`🔔 *NOVO PEDIDO #${p.numero}*`);
  if (p.pagamento === "cartao") {
    linhas.push(`✅ *PAGO NO SITE* · ${libra(p.total)}`);
  } else {
    linhas.push(`💵 *DINHEIRO NA ENTREGA* · cobrar ${libra(p.total)}`);
    linhas.push(p.trocoPara ? `Troco para ${libra(p.trocoPara)} → levar *${libra(p.trocoPara - p.total)}* de troco` : "Vai pagar o valor exato (sem troco)");
  }
  if (p.agendadoPara) linhas.push(`🕒 Reservado para *${rotuloAgendado(p.agendadoPara)}*`);
  linhas.push("");
  for (const l of p.itens) {
    linhas.push(`${l.qtd}× ${l.nome}${l.detalhes.length ? ` (${l.detalhes.join(", ")})` : ""}`);
    if (l.obs) linhas.push(`   Obs.: ${l.obs}`);
  }
  linhas.push("");
  linhas.push(`Entrega ${p.taxa ? libra(p.taxa) : "grátis"} · Total ${libra(p.total)}`);
  linhas.push(`👤 ${p.nome} · ${p.telefone}`);
  linhas.push(`📍 ${p.endereco}, ${p.postcode}`);
  if (p.observacao) linhas.push(`📝 ${p.observacao}`);
  linhas.push("");
  linhas.push(`Painel: ${(origem || siteUrl())}/painel#pedidos`);
  return linhas.join("\n");
}

async function enviarCallMeBot(tel: string, texto: string) {
  const chave = process.env.CALLMEBOT_APIKEY;
  if (!chave) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const url = `${process.env.CALLMEBOT_API_URL || "https://api.callmebot.com"}/whatsapp.php?phone=${telefoneInternacional(tel)}&text=${encodeURIComponent(texto)}&apikey=${encodeURIComponent(chave)}`;
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    if (!r.ok) console.error("[aviso loja] callmebot", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error("[aviso loja]", e);
    return false;
  }
}

/** Avisa a loja uma única vez por pedido. Chamar quando o pedido vai para a cozinha (dinheiro: na hora; cartão: depois de pago). */
export async function avisarLojaNovoPedido(numero: number, origem?: string) {
  try {
    if (!process.env.CALLMEBOT_APIKEY) return;
    const p = await buscarPorNumero(numero);
    if (!p || p.status === "aguardando_pagamento" || p.status === "cancelado") return;
    if (!(await marcarAvisoLoja(numero))) return;
    const tel = process.env.WHATSAPP_LOJA || (await getAjustes()).telefone;
    await enviarCallMeBot(tel, textoPedido(p, origem));
  } catch (e) {
    console.error("[aviso loja]", e);
  }
}

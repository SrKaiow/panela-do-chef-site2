import { buscarPorNumero, lerConfig, marcarAvisoLoja, salvarConfig, type Pedido } from "./db";
import { getAjustes } from "./dados";
import { telefoneInternacional } from "./whatsapp";
import { rotuloAgendado } from "./horario";
import { siteUrl } from "./stripe";

/**
 * Aviso de pedido novo no WhatsApp da empresa.
 * Usa o CallMeBot (grátis, manda mensagem para o seu próprio número): defina CALLMEBOT_APIKEY.
 * O número que recebe é WHATSAPP_LOJA ou, se vazio, o telefone dos ajustes da loja.
 * Também manda notificação com som no celular pelo Telegram (grátis): defina TELEGRAM_BOT_TOKEN.
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
  linhas.push(p.retirada ? `Coleta · Total ${libra(p.total)}` : `Entrega ${p.taxa ? libra(p.taxa) : "grátis"} · Total ${libra(p.total)}`);
  linhas.push(`👤 ${p.nome} · ${p.telefone}`);
  linhas.push(p.retirada ? "🏠 *COLETA NA PORTA* (sem entrega)" : `📍 ${p.endereco}, ${p.postcode}`);
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

/**
 * Notificação no celular pelo Telegram (grátis, toca na hora, mesmo com o app fechado).
 * Defina TELEGRAM_BOT_TOKEN (do @BotFather). O chat é achado sozinho: basta mandar /start para o bot.
 */
async function chatTelegram(token: string): Promise<string | null> {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID;
  const salvo = await lerConfig<{ chat: string }>("telegram-chat").catch(() => null);
  if (salvo?.chat) return salvo.chat;
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, { cache: "no-store" });
  const d = (await r.json().catch(() => ({}))) as { result?: { message?: { chat?: { id: number } } }[] };
  const chat = d.result?.map((u) => u.message?.chat?.id).filter(Boolean).pop();
  if (!chat) return null;
  await salvarConfig("telegram-chat", { chat: String(chat) });
  return String(chat);
}

type Botoes = { text: string; callback_data?: string; url?: string }[][];

/** Segredo do webhook do Telegram (derivado do token: muda se o token mudar). */
export async function segredoTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("webhook:" + token));
  return Array.from(new Uint8Array(dig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

/** Chat que recebe os avisos (só ele pode usar os botões). */
export async function chatDoTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return token ? chatTelegram(token) : null;
}

export async function salvarChatTelegram(chat: string) {
  await salvarConfig("telegram-chat", { chat });
}

/** Chamadas simples à API do Telegram (responder botão, mandar mensagem). */
export async function apiTelegram(metodo: string, corpo: object) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  return r.json().catch(() => null);
}

async function enviarTelegram(texto: string, botoes?: Botoes) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const chat = await chatTelegram(token);
    if (!chat) {
      console.error("[aviso loja] telegram: mande /start para o bot");
      return false;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: texto.replace(/\*/g, "").slice(0, 4000), disable_web_page_preview: true, ...(botoes ? { reply_markup: { inline_keyboard: botoes } } : {}) }),
    });
    clearTimeout(t);
    if (!r.ok) console.error("[aviso loja] telegram", r.status, (await r.text()).slice(0, 200));
    return r.ok;
  } catch (e) {
    console.error("[aviso loja] telegram", e);
    return false;
  }
}

/** Avisa a loja uma única vez por pedido. Chamar quando o pedido vai para a cozinha (dinheiro: na hora; cartão: depois de pago). */
export async function avisarLojaNovoPedido(numero: number, origem?: string) {
  try {
    if (!process.env.CALLMEBOT_APIKEY && !process.env.TELEGRAM_BOT_TOKEN) return;
    const p = await buscarPorNumero(numero);
    if (!p || p.status === "aguardando_pagamento" || p.status === "cancelado") return;
    if (!(await marcarAvisoLoja(numero))) return;
    const tel = process.env.WHATSAPP_LOJA || (await getAjustes()).telefone;
    const texto = textoPedido(p, origem);
    // Botões no Telegram: imprimir na impressora da loja e aceitar, direto da notificação.
    const botoes: Botoes = [
      [{ text: "🖨 Imprimir na loja", callback_data: `imp:${p.numero}` }, { text: "✅ Aceitar pedido", callback_data: `ok:${p.numero}` }],
      [{ text: "Abrir o painel", url: `${origem || siteUrl()}/painel#pedidos` }],
    ];
    // Pagamento no site aprovado: uma notificação curta só do pagamento, antes do pedido.
    if (p.pagamento === "cartao" && p.pago) {
      const pagou = `💳 PAGAMENTO APROVADO · ${libra(p.total)}\nPedido #${p.numero} · ${p.nome.split(" ")[0]} · pago no site (Square)`;
      await enviarTelegram(pagou);
    }
    await Promise.all([enviarTelegram(texto, botoes), process.env.CALLMEBOT_APIKEY ? enviarCallMeBot(tel, texto) : null]);
  } catch (e) {
    console.error("[aviso loja]", e);
  }
}

/** Teste dos avisos (painel). null = canal não configurado, true = enviado, false = falhou. */
export async function testarAvisos(origem?: string) {
  // Liga os botões do Telegram (webhook). Primeiro acha o chat (o getUpdates para de funcionar depois do webhook).
  if (process.env.TELEGRAM_BOT_TOKEN && origem && /^https:\/\//.test(origem)) {
    await chatDoTelegram().catch(() => null);
    await apiTelegram("setWebhook", { url: `${origem}/api/telegram/webhook`, secret_token: await segredoTelegram(), allowed_updates: ["callback_query", "message"] }).catch(() => null);
  }
  const msg = "🔔 Teste: os avisos de pedido novo da Panela do Chef estão funcionando.";
  const tel = process.env.WHATSAPP_LOJA || (await getAjustes()).telefone;
  const [telegram, whatsapp] = await Promise.all([
    process.env.TELEGRAM_BOT_TOKEN ? enviarTelegram(msg) : Promise.resolve(null),
    process.env.CALLMEBOT_APIKEY ? enviarCallMeBot(tel, msg) : Promise.resolve(null),
  ]);
  return { telegram, whatsapp };
}

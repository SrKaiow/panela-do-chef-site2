import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { apiTelegram, chatDoTelegram, salvarChatTelegram, segredoTelegram } from "@/lib/avisoLoja";
import { buscarPorNumero, mudarStatus, pedirImpressao } from "@/lib/db";
import { aoMudarStatus } from "@/lib/avisos";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Botões das notificações do Telegram: "Imprimir na loja" e "Aceitar pedido".
 * Só aceita chamadas do Telegram (cabeçalho secreto) e só do chat da loja.
 */
export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return NextResponse.json({ ok: false }, { status: 404 });
  const recebido = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") || "");
  const esperado = Buffer.from(await segredoTelegram());
  if (recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) return NextResponse.json({ ok: false }, { status: 403 });

  const u = await req.json().catch(() => ({}));
  const chatLoja = await chatDoTelegram();

  // /start de quem ainda não tem chat salvo: vira o chat da loja.
  if (u.message?.chat?.id) {
    if (!chatLoja) await salvarChatTelegram(String(u.message.chat.id));
    return NextResponse.json({ ok: true });
  }

  const cb = u.callback_query;
  if (!cb?.id) return NextResponse.json({ ok: true });
  const chat = String(cb.message?.chat?.id ?? "");
  const responder = (text: string) => apiTelegram("answerCallbackQuery", { callback_query_id: cb.id, text, show_alert: false });
  if (!chatLoja || chat !== chatLoja) {
    await responder("Sem permissão.");
    return NextResponse.json({ ok: true });
  }

  const [acao, n] = String(cb.data || "").split(":");
  const numero = Number(n);
  const p = Number.isInteger(numero) ? await buscarPorNumero(numero) : null;
  if (!p) {
    await responder("Pedido não encontrado.");
    return NextResponse.json({ ok: true });
  }
  if (acao === "imp") {
    await pedirImpressao(numero);
    await responder(`🖨 Mandei imprimir o pedido #${numero} na loja.`);
    await apiTelegram("sendMessage", { chat_id: chat, text: `🖨 Pedido #${numero} enviado para a impressora da loja (sai em alguns segundos, com o painel aberto no computador).` });
  } else if (acao === "ok") {
    if (p.status === "novo") {
      await mudarStatus(numero, "confirmado");
      await aoMudarStatus(numero, "confirmado", siteUrl(req));
      await responder(`✅ Pedido #${numero} aceito.`);
      await apiTelegram("sendMessage", { chat_id: chat, text: `✅ Pedido #${numero} aceito. O cliente já vê no acompanhamento.` });
    } else {
      await responder(`O pedido #${numero} já foi aceito.`);
    }
  } else {
    await responder("Ação desconhecida.");
  }
  return NextResponse.json({ ok: true });
}

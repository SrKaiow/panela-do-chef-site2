/**
 * Avisos no WhatsApp do cliente.
 * Automático: WhatsApp Business Cloud API (Meta), com modelos de mensagem aprovados.
 * Sem configuração: o site mostra um botão que abre o WhatsApp já com a mensagem pronta.
 */

/** 07123 456789 -> 447123456789 (formato internacional sem +) */
export function telefoneInternacional(tel: string) {
  let n = tel.replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) n = "44" + n.slice(1);
  return n;
}

export function linkWhatsapp(tel: string, texto: string) {
  return `https://wa.me/${telefoneInternacional(tel)}?text=${encodeURIComponent(texto)}`;
}

export const mensagens = {
  /** "Invoice" do pedido para o cliente pagar por transferência. */
  transferencia: (o: { nome: string; numero: number; linhas: { qtd: number; nome: string; detalhes: string[]; total: number }[]; taxa: number; total: number; conta: { beneficiario: string; conta: string; sortCode: string }; link: string }) => {
    const gbp = (p: number) => "£" + (p / 100).toFixed(2);
    return [
      `Oi, ${o.nome}! Aqui é da *Panela do Chef*.`,
      ``,
      `*Pedido #${o.numero}*`,
      ...o.linhas.map((l) => `${l.qtd}× ${l.nome}${l.detalhes.length ? ` (${l.detalhes.join(", ")})` : ""} · ${gbp(l.total)}`),
      ...(o.taxa > 0 ? [`Entrega · ${gbp(o.taxa)}`] : []),
      ``,
      `*Total: ${gbp(o.total)}*`,
      ``,
      `*Dados para transferência (conta Business)*`,
      `Beneficiário: ${o.conta.beneficiario}`,
      `Conta: ${o.conta.conta}`,
      `Sort Code: ${o.conta.sortCode}`,
      `Valor: ${gbp(o.total)}`,
      `Referência: Pedido ${o.numero}`,
      ``,
      `Seu pedido: ${o.link}`,
      ``,
      `Quando fizer a transferência, é só mandar o comprovante aqui. Obrigado!`,
    ].join("\n");
  },
  saiu: (nome: string, link: string) =>
    `Oi, ${nome}! Aqui é da *Panela do Chef*.\n\nSeu pedido acabou de *sair para entrega*.\n\nAcompanhe o entregador ao vivo no mapa:\n${link}`,
  chegando: (nome: string) =>
    `Oi, ${nome}! Seu pedido da *Panela do Chef* está *chegando*: falta mais ou menos 1 minuto.\n\nJá pode ir até a porta!`,
};

export const whatsappAutomatico = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

/**
 * Envia um modelo aprovado. Modelos esperados no WhatsApp Manager:
 *  - WHATSAPP_MODELO_SAIU (2 variáveis: {{1}} nome, {{2}} link do rastreio)
 *  - WHATSAPP_MODELO_CHEGANDO (1 variável: {{1}} nome)
 */
export async function enviarModelo(tel: string, modelo: string, variaveis: string[]) {
  if (!whatsappAutomatico() || !modelo) return false;
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefoneInternacional(tel),
        type: "template",
        template: {
          name: modelo,
          language: { code: process.env.WHATSAPP_IDIOMA || "pt_BR" },
          components: [{ type: "body", parameters: variaveis.map((text) => ({ type: "text", text })) }],
        },
      }),
    });
    if (!r.ok) console.error("[whatsapp]", r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.error("[whatsapp]", e);
    return false;
  }
}

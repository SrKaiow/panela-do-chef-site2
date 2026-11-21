import { buscarPorNumero, entregaAtualDe, listarPorStatus, marcarAviso, type Local, type Status } from "./db";
import { distanciaMetros } from "./entrega";
import { getAjustes } from "./dados";
import { whatsappAutomatico, enviarModelo } from "./whatsapp";
import { siteUrl } from "./stripe";
import { enviarPushPedido } from "./push";
import { marcarPushChegando } from "./db";

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n;

/** Quando o pedido sai para entrega, manda o link do rastreio no WhatsApp (uma vez). */
export async function aoMudarStatus(numero: number, status: Status, origem?: string) {
  if (status !== "saiu") return;
  const p = await buscarPorNumero(numero);
  // Coleta: "pronto para coletar" vai como notificação no celular do cliente (mesmo com a tela bloqueada).
  if (p?.retirada) await enviarPushPedido(numero, "🔔 Pedido pronto para coletar!", "O Chef já está indo até a porta com o seu pedido. Pode encostar!", `/pedido/${p.token}`).catch(() => {});
  if (!p || p.avisadoSaiu || p.retirada) return;
  const ok = await enviarModelo(p.telefone, process.env.WHATSAPP_MODELO_SAIU || "", [primeiroNome(p.nome), `${origem || siteUrl()}/pedido/${p.token}`]);
  if (ok) await marcarAviso(numero, "saiu");
}

/**
 * A cada posição nova do entregador: se algum pedido em rota estiver a ~1 minuto,
 * avisa o cliente no WhatsApp (uma vez por pedido).
 * Devolve os pedidos que precisam de aviso manual (quando o envio automático não está ligado).
 */
export async function verificarChegadas(local: Local) {
  // Só a entrega que está sendo feita agora (os outros pedidos no carro esperam a vez deles).
  const [noCarro, ajustes] = await Promise.all([listarPorStatus(["saiu"]), getAjustes()]);
  const atual = entregaAtualDe(noCarro);
  const emRota = noCarro.filter((p) => p.numero === atual);
  const limite = ajustes.entrega.avisoChegandoMetros;
  const manuais: number[] = [];
  for (const p of emRota) {
    if (p.avisadoChegando || p.lat == null || p.lng == null) continue;
    const d = distanciaMetros(local, { lat: p.lat, lng: p.lng });
    if (d > limite) continue;
    // Notificação no celular do cliente (toca mesmo com a tela bloqueada, se ele ligou o alarme). Uma vez só.
    if (await marcarPushChegando(p.numero))
      await enviarPushPedido(p.numero, "🔔 Seu pedido está chegando!", "Falta mais ou menos 1 minuto. Já pode ir até a porta!", `/pedido/${p.token}`).catch(() => {});
    // Sem WhatsApp automático: o alarme da página do cliente toca sozinho pela distância, mas isso só funciona
    // com a página aberta. Por isso NÃO marca como avisado: o entregador ainda vê o botão do WhatsApp.
    if (!whatsappAutomatico()) { manuais.push(p.numero); continue; }
    const ok = await enviarModelo(p.telefone, process.env.WHATSAPP_MODELO_CHEGANDO || "", [primeiroNome(p.nome)]);
    if (ok) await marcarAviso(p.numero, "chegando");
    else manuais.push(p.numero);
  }
  return manuais;
}

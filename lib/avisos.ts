import { buscarPorNumero, listarPorStatus, marcarAviso, type Local, type Status } from "./db";
import { distanciaMetros, metrosAviso } from "./entrega";
import { enviarModelo } from "./whatsapp";
import { siteUrl } from "./stripe";

const primeiroNome = (n: string) => n.trim().split(/\s+/)[0] || n;

/** Quando o pedido sai para entrega, manda o link do rastreio no WhatsApp (uma vez). */
export async function aoMudarStatus(numero: number, status: Status) {
  if (status !== "saiu") return;
  const p = await buscarPorNumero(numero);
  if (!p || p.avisadoSaiu) return;
  const ok = await enviarModelo(p.telefone, process.env.WHATSAPP_MODELO_SAIU || "", [primeiroNome(p.nome), `${siteUrl()}/pedido/${p.token}`]);
  if (ok) await marcarAviso(numero, "saiu");
}

/**
 * A cada posição nova do entregador: se algum pedido em rota estiver a ~1 minuto,
 * avisa o cliente no WhatsApp (uma vez por pedido).
 * Devolve os pedidos que precisam de aviso manual (quando o envio automático não está ligado).
 */
export async function verificarChegadas(local: Local) {
  const emRota = await listarPorStatus(["saiu"]);
  const manuais: number[] = [];
  for (const p of emRota) {
    if (p.avisadoChegando || p.lat == null || p.lng == null) continue;
    const d = distanciaMetros(local, { lat: p.lat, lng: p.lng });
    if (d > metrosAviso()) continue;
    const ok = await enviarModelo(p.telefone, process.env.WHATSAPP_MODELO_CHEGANDO || "", [primeiroNome(p.nome)]);
    if (ok) await marcarAviso(p.numero, "chegando");
    else manuais.push(p.numero);
  }
  return manuais;
}

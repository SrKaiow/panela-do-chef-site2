import { lerLocal, type Pedido } from "./db";
import { distanciaMetros, metrosAviso, minutosAte } from "./entrega";

/** Situação ao vivo de um pedido (usada pela página do pedido e pela API que ela consulta). */
export async function situacaoAoVivo(p: Pedido) {
  let entregador = null;
  let distancia: number | null = null;
  let minutos: number | null = null;

  // A posição do entregador só aparece enquanto o pedido está a caminho, e se for recente.
  if (p.status === "saiu") {
    const local = await lerLocal();
    if (local && Date.now() - new Date(local.atualizadoEm).getTime() < 10 * 60 * 1000) {
      entregador = { lat: local.lat, lng: local.lng, atualizadoEm: local.atualizadoEm };
      if (p.lat != null && p.lng != null) {
        distancia = Math.round(distanciaMetros(local, { lat: p.lat, lng: p.lng }));
        minutos = minutosAte(distancia);
      }
    }
  }

  return {
    status: p.status,
    statusEm: p.statusEm,
    destino: p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null,
    entregador,
    distancia,
    minutos,
    chegando: p.avisadoChegando || (distancia != null && distancia <= metrosAviso()),
  };
}

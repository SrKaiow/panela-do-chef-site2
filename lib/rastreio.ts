import { lerLocal, pedidosNaFrente, type Pedido, type Status } from "./db";
import { distanciaMetros, direcaoGraus, minutosAte } from "./entrega";
import { getAjustes } from "./dados";

export type AoVivo = {
  status: Status;
  statusEm: string | null;
  criadoEm: string;
  agendadoPara: string | null;
  aceitoEm: string | null;
  preparoEm: string | null;
  saiuEm: string | null;
  entregueEm: string | null;
  /** Pedidos na frente na cozinha (só antes de sair). */
  naFrente: number | null;
  /** Previsão de chegada (ISO), quando dá para estimar. */
  previsao: string | null;
  cozinha: { lat: number; lng: number };
  destino: { lat: number; lng: number } | null;
  entregador: { lat: number; lng: number; direcao: number | null; atualizadoEm: string } | null;
  distancia: number | null;
  minutos: number | null;
  chegando: boolean;
};

// Guarda a última posição vista para calcular a direção do carro.
let ultimaPosicao: { lat: number; lng: number; direcao: number | null } | null = null;

/** Situação ao vivo de um pedido (página do pedido e a API que ela consulta). */
export async function situacaoAoVivo(p: Pedido): Promise<AoVivo> {
  const a = await getAjustes();
  const vel = a.entrega.velocidadeMediaKmh;
  const destino = p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null;
  const cozinha = { lat: a.entrega.cozinha.lat, lng: a.entrega.cozinha.lng };

  let entregador: AoVivo["entregador"] = null;
  let distancia: number | null = null;
  let minutos: number | null = null;
  let naFrente: number | null = null;
  let previsao: string | null = null;

  const trajeto = destino ? minutosAte(distanciaMetros(cozinha, destino), vel) : 15;

  if (["novo", "confirmado", "preparando"].includes(p.status)) {
    naFrente = await pedidosNaFrente(p);
    // Cada pedido na frente ocupa a cozinha por ~1/2 do tempo de preparo (vários saem juntos).
    const base = Math.max(Date.now(), new Date(p.agendadoPara ?? p.criadoEm).getTime());
    const preparoRestante =
      p.status === "preparando" && p.preparoEm
        ? Math.max(3, a.preparoMin - (Date.now() - new Date(p.preparoEm).getTime()) / 60000)
        : a.preparoMin + naFrente * (a.preparoMin / 2);
    previsao = new Date(base + (preparoRestante + trajeto) * 60000).toISOString();
    // Reserva para mais tarde: o horário escolhido pelo cliente é a previsão.
    if (p.agendadoPara && new Date(p.agendadoPara).getTime() > Date.now() + (preparoRestante + trajeto) * 60000) previsao = p.agendadoPara;
  }

  // A posição do entregador só aparece enquanto o pedido está a caminho, e se for recente.
  if (p.status === "saiu") {
    const local = await lerLocal();
    if (local && Date.now() - new Date(local.atualizadoEm).getTime() < 10 * 60 * 1000) {
      let direcao: number | null = ultimaPosicao?.direcao ?? null;
      if (ultimaPosicao && distanciaMetros(ultimaPosicao, local) > 8) direcao = direcaoGraus(ultimaPosicao, local);
      else if (direcao == null && destino) direcao = direcaoGraus(local, destino);
      ultimaPosicao = { lat: local.lat, lng: local.lng, direcao };
      entregador = { lat: local.lat, lng: local.lng, direcao, atualizadoEm: local.atualizadoEm };
      if (destino) {
        distancia = Math.round(distanciaMetros(local, destino));
        minutos = minutosAte(distancia, vel);
        previsao = new Date(Date.now() + Math.max(1, minutos) * 60000).toISOString();
      }
    } else if (p.saiuEm) {
      previsao = new Date(new Date(p.saiuEm).getTime() + trajeto * 60000).toISOString();
    }
  }

  return {
    status: p.status,
    statusEm: p.statusEm,
    criadoEm: p.criadoEm,
    agendadoPara: p.agendadoPara,
    aceitoEm: p.aceitoEm,
    preparoEm: p.preparoEm,
    saiuEm: p.saiuEm,
    entregueEm: p.entregueEm,
    naFrente,
    previsao,
    cozinha,
    destino,
    entregador,
    distancia,
    minutos,
    chegando: p.avisadoChegando || (distancia != null && distancia <= a.entrega.avisoChegandoMetros),
  };
}

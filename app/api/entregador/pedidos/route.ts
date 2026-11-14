import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { entregaAtual, listarPorStatus, lerLocal } from "@/lib/db";
import { distanciaMetros, minutosAte } from "@/lib/entrega";
import { getAjustes } from "@/lib/dados";
import { linkWhatsapp, mensagens, whatsappAutomatico } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await logado("entregador"))) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  const local = await lerLocal();
  const ajustes = await getAjustes();
  const pedidos = await listarPorStatus(["confirmado", "preparando", "saiu"]);
  const atual = await entregaAtual();
  const nome = (n: string) => n.trim().split(/\s+/)[0] || n;
  return NextResponse.json({
    automatico: whatsappAutomatico(),
    metrosAviso: ajustes.entrega.avisoChegandoMetros,
    pedidos: pedidos.map((p) => {
      const distancia = local && p.lat != null && p.lng != null ? Math.round(distanciaMetros(local, { lat: p.lat, lng: p.lng })) : null;
      return {
        numero: p.numero,
        nome: p.nome,
        telefone: p.telefone,
        endereco: p.endereco,
        postcode: p.postcode,
        observacao: p.observacao,
        status: p.status,
        pagamento: p.pagamento,
        pago: p.pago,
        total: p.total,
        trocoPara: p.trocoPara,
        itens: p.itens.map((l) => `${l.qtd}× ${l.nome}`),
        distancia,
        minutos: distancia != null ? minutosAte(distancia, ajustes.entrega.velocidadeMediaKmh) : null,
        avisadoSaiu: p.avisadoSaiu,
        avisadoChegando: p.avisadoChegando,
        temCoordenadas: p.lat != null,
        atual: p.numero === atual,
        atraso: p.atraso,
        waSaiu: linkWhatsapp(p.telefone, mensagens.saiu(nome(p.nome), `${siteUrl(req)}/pedido/${p.token}`)),
        waChegando: linkWhatsapp(p.telefone, mensagens.chegando(nome(p.nome))),
        // Waze: vai direto para as coordenadas do postcode; sem coordenadas, busca pelo endereço.
        waze: p.lat != null && p.lng != null
          ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`
          : `https://waze.com/ul?q=${encodeURIComponent(p.endereco + ", " + p.postcode)}&navigate=yes`,
        mapa: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.endereco + ", " + p.postcode)}&travelmode=driving`,
      };
    }),
  });
}

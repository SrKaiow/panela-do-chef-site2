import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { listarPorStatus, lerLocal } from "@/lib/db";
import { distanciaMetros, metrosAviso, minutosAte } from "@/lib/entrega";
import { linkWhatsapp, mensagens, whatsappAutomatico } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!logado("entregador")) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  const local = await lerLocal();
  const pedidos = await listarPorStatus(["confirmado", "preparando", "saiu"]);
  const nome = (n: string) => n.trim().split(/\s+/)[0] || n;
  return NextResponse.json({
    automatico: whatsappAutomatico(),
    metrosAviso: metrosAviso(),
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
        minutos: distancia != null ? minutosAte(distancia) : null,
        avisadoSaiu: p.avisadoSaiu,
        avisadoChegando: p.avisadoChegando,
        temCoordenadas: p.lat != null,
        waSaiu: linkWhatsapp(p.telefone, mensagens.saiu(nome(p.nome), `${siteUrl()}/pedido/${p.token}`)),
        waChegando: linkWhatsapp(p.telefone, mensagens.chegando(nome(p.nome))),
        mapa: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.endereco + ", " + p.postcode)}&travelmode=driving`,
      };
    }),
  });
}

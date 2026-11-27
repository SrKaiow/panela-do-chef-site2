import { NextResponse } from "next/server";
import { logado } from "@/lib/auth";
import { entregaAtualDe, listarPorStatus, lerLocal, pedidosNaConta } from "@/lib/db";
import { rotaCarro, rotaEstimada } from "@/lib/rota";
import { getAjustes } from "@/lib/dados";
import { linkWhatsapp, mensagens, whatsappAutomatico } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/site";
import { DADOS_BANCARIOS } from "@/lib/contas";
import { MARCA_TRANSFERENCIA } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await logado("entregador"))) return NextResponse.json({ erro: "Entre de novo." }, { status: 401 });
  // Tudo ao mesmo tempo (antes era uma consulta depois da outra e a tela demorava no 4G).
  const [local, ajustes, todos, naConta] = await Promise.all([
    lerLocal(),
    getAjustes(),
    listarPorStatus(["confirmado", "preparando", "saiu"]),
    pedidosNaConta().catch(() => new Set<number>()),
  ]);
  const atual = entregaAtualDe(todos);
  // Coleta na porta não passa pelo entregador.
  const pedidos = todos.filter((p) => !p.retirada);
  const nome = (n: string) => n.trim().split(/\s+/)[0] || n;
  // Tempo e distância pelas ruas (como o Waze), não em linha reta.
  const rotas = await Promise.all(
    // Rota de verdade só para a entrega atual (as outras usam estimativa, para a tela não ficar lenta).
    pedidos.map((p) => {
      if (!local || p.lat == null || p.lng == null || p.status !== "saiu") return Promise.resolve(null);
      const destino = { lat: p.lat, lng: p.lng };
      return p.numero === atual ? rotaCarro(local, destino, ajustes.entrega.velocidadeMediaKmh) : Promise.resolve(rotaEstimada(local, destino, ajustes.entrega.velocidadeMediaKmh));
    }),
  );
  return NextResponse.json({
    automatico: whatsappAutomatico(),
    metrosAviso: ajustes.entrega.avisoChegandoMetros,
    pedidos: pedidos.map((p, i) => {
      const distancia = rotas[i]?.metros ?? null;
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
        naConta: naConta.has(p.numero),
        itens: p.itens.map((l) => `${l.qtd}× ${l.nome}`),
        distancia,
        minutos: rotas[i]?.minutos ?? null,
        avisadoSaiu: p.avisadoSaiu,
        avisadoChegando: p.avisadoChegando,
        temCoordenadas: p.lat != null,
        atual: p.numero === atual,
        atraso: p.atraso,
        waSaiu: linkWhatsapp(p.telefone, mensagens.saiu(nome(p.nome), `${siteUrl(req)}/pedido/${p.token}`)),
        waChegando: linkWhatsapp(p.telefone, mensagens.chegando(nome(p.nome))),
        // Cliente que ia pagar em dinheiro e vai transferir: manda o pedido com a conta e o valor.
        transferencia: (p.observacao ?? "").includes(MARCA_TRANSFERENCIA),
        waTransferencia: p.pagamento === "dinheiro" && !p.pago && !naConta.has(p.numero)
          ? linkWhatsapp(p.telefone, mensagens.transferencia({
              nome: nome(p.nome), numero: p.numero, taxa: p.taxa, total: p.total, conta: DADOS_BANCARIOS,
              linhas: p.itens.map((l) => ({ qtd: l.qtd, nome: l.nome, detalhes: l.detalhes ?? [], total: l.total })),
              link: `${siteUrl(req)}/pedido/${p.token}`,
            }))
          : null,
        // Waze: vai direto para as coordenadas do postcode; sem coordenadas, busca pelo endereço.
        waze: p.lat != null && p.lng != null
          ? `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`
          : `https://waze.com/ul?q=${encodeURIComponent(p.endereco + ", " + p.postcode)}&navigate=yes`,
        mapa: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.endereco + ", " + p.postcode)}&travelmode=driving`,
      };
    }),
  });
}

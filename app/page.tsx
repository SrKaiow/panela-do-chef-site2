import Loja from "@/components/Loja";
import { NaCozinha, SobreChef } from "@/components/Historia";
import { loja, cartaoAtivo, dinheiroAtivo } from "@/lib/cardapio";

import Avaliacoes, { type Depoimento } from "@/components/Avaliacoes";
import avaliacoesJson from "@/data/avaliacoes.json";
import { listarAvaliacoes } from "@/lib/db";

// A página busca as avaliações aprovadas a cada visita.
export const dynamic = "force-dynamic";

async function depoimentos(): Promise<Depoimento[]> {
  const fixas: Depoimento[] = avaliacoesJson.fixas.map((d) => ({ ...d, local: d.local || null }));
  try {
    const novas = await listarAvaliacoes(true);
    return [
      ...novas.map((a) => ({ nome: a.nome, local: a.local, nota: a.nota, texto: a.texto, verificado: a.pedidoNumero != null, data: a.criadoEm })),
      ...fixas,
    ];
  } catch {
    return fixas; // se o banco estiver fora do ar, o site continua mostrando as fixas
  }
}

export default async function Home() {
  const lista = await depoimentos();
  const pagamentos = { dinheiro: dinheiroAtivo(), cartao: cartaoAtivo() };

  return (
    <>
      <Loja pagamentos={pagamentos} />
      <NaCozinha />
      <SobreChef />

      <Avaliacoes lista={lista} clientes={loja.clientesSatisfeitos} />

      <div className="bandeira" aria-hidden="true" />
      <footer className="rodape miolo">
        <div className="rodape-col">
          <img className="logo-rodape" src="/fotos/logo-panela-do-chef.png" alt="Panela do Chef" />
          <span>{loja.slogan}</span>
        </div>
        <div className="rodape-col">
          <span>
            Instagram: <a href={`https://instagram.com/${loja.contato.instagram}`} target="_blank" rel="noreferrer">@{loja.contato.instagram}</a>
          </span>
          {loja.contato.grupoVip && (
            <span>
              Promoções primeiro no <a href={loja.contato.grupoVip} target="_blank" rel="noreferrer">Grupo VIP do WhatsApp</a>
            </span>
          )}
          <span>Entregamos em {loja.entrega.regiao}</span>
          <span>© {new Date().getFullYear()} {loja.nome}</span>
        </div>
      </footer>
    </>
  );
}

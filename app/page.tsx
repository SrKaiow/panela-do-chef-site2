import Loja from "@/components/Loja";
import { NaCozinha, SobreChef } from "@/components/Historia";
import { getAjustes, getCardapio, cartaoConfigurado } from "@/lib/dados";
import { publicos, telefoneBonito, whatsappInternacional } from "@/lib/ajustes";
import { estadoLoja, horariosParaAgendar } from "@/lib/horario";

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
  const [lista, ajustes, cardapio] = await Promise.all([depoimentos(), getAjustes(), getCardapio()]);
  const loja = publicos(ajustes, cartaoConfigurado());
  const agora = new Date();
  const estado = estadoLoja(ajustes.horarios, ajustes.pausado, agora);
  const horarios = horariosParaAgendar(ajustes.horarios, agora);

  return (
    <>
      <Loja cardapio={cardapio} loja={loja} estadoInicial={estado} horariosIniciais={horarios} pausado={ajustes.pausado} />
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
            WhatsApp: <a href={`https://wa.me/${whatsappInternacional(loja.telefone)}`} target="_blank" rel="noreferrer">{telefoneBonito(loja.telefone)}</a>
          </span>
          <span>
            E-mail: <a href={`mailto:${loja.email}`}>{loja.email}</a>
          </span>
          <span>
            Instagram: <a href={`https://instagram.com/${loja.instagram}`} target="_blank" rel="noreferrer">@{loja.instagram}</a>
          </span>
          {loja.grupoVip && (
            <span>
              Promoções primeiro no <a href={loja.grupoVip} target="_blank" rel="noreferrer">Grupo VIP do WhatsApp</a>
            </span>
          )}
          <span>Entregamos em {loja.regiao}</span>
          <span>
            <a href="/privacidade">Privacidade</a> · <a href="#cardapio">Alergênicos</a>
          </span>
          <span>© {new Date().getFullYear()} {loja.nome}</span>
        </div>
      </footer>
    </>
  );
}

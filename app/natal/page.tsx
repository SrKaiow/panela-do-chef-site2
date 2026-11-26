import type { Metadata } from "next";
import Natal from "@/components/Natal";
import { getAjustes, getCardapio, provedorCartao, cartaoConfigurado } from "@/lib/dados";
import { publicos, whatsappInternacional } from "@/lib/ajustes";
import { hojeLondres } from "@/lib/cardapio";
import { CEIA, ehItemNatal, encomendaAberta } from "@/lib/natal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ceia de Natal | Panela do Chef",
  description: "Monte o seu kit natalino: kits completos, Chester, peru, pernil, carnes recheadas e porções. Entrega grátis até 9 milhas.",
};

export default async function PaginaNatal() {
  const [ajustes, cardapio] = await Promise.all([getAjustes(), getCardapio()]);
  const loja = publicos(ajustes, provedorCartao());
  const soNatal = { ...cardapio, categorias: cardapio.categorias.filter((c) => ehItemNatal(c.id)), itens: cardapio.itens.filter((i) => ehItemNatal(i.categoria)) };
  return (
    <Natal
      cardapio={soNatal}
      datas={CEIA.datas}
      aberta={encomendaAberta(hojeLondres())}
      raioMilhas={CEIA.raioMilhas}
      ultimoDia={CEIA.ultimoDia}
      whatsapp={whatsappInternacional(loja.telefone)}
      cartao={ajustes.pagamentos.cartao && cartaoConfigurado()}
    />
  );
}

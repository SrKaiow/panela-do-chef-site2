import type { Metadata } from "next";
import Natal from "@/components/Natal";
import PessoasOnline from "@/components/PessoasOnline";
import { getAjustes, getCardapio, provedorCartao, cartaoConfigurado } from "@/lib/dados";
import { publicos, whatsappInternacional } from "@/lib/ajustes";
import { redirect } from "next/navigation";
import { CEIA, ehItemNatal, encomendaAberta } from "@/lib/natal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ceia de Natal | Panela do Chef",
  description: "Monte o seu kit natalino: kits completos, Chester, peru, pernil, carnes recheadas e porções. Entrega grátis até 9 milhas.",
};

export default async function PaginaNatal() {
  // Depois de 20/12 às 22:00 a ceia sai do ar e o site volta a ser só o cardápio do dia.
  if (!encomendaAberta()) redirect("/");
  const [ajustes, cardapio] = await Promise.all([getAjustes(), getCardapio()]);
  const loja = publicos(ajustes, provedorCartao());
  const soNatal = { ...cardapio, categorias: cardapio.categorias.filter((c) => ehItemNatal(c.id)), itens: cardapio.itens.filter((i) => ehItemNatal(i.categoria)) };
  return (
    <>
    <PessoasOnline />
    <Natal
      cardapio={soNatal}
      datas={CEIA.datas}
      aberta
      raioMilhas={CEIA.raioMilhas}
      ultimoDia={CEIA.ultimoDia}
      encerraEm={CEIA.encerraEm}
      whatsapp={whatsappInternacional(loja.telefone)}
      cartao={ajustes.pagamentos.cartao && cartaoConfigurado()}
    />
    </>
  );
}

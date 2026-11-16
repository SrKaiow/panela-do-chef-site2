import type { Cardapio } from "./cardapio";

/**
 * Fotos dos produtos que vêm junto com o site (public/fotos/cardapio/<id>.jpg).
 * Item sem foto no painel usa a daqui; ao trocar a foto no painel, vale a do painel.
 */
const COM_FOTO = new Set<string>(["acai-350","acai-500","batata-4-queijos","batata-calabacon","batidinha-acai","caldo-de-cana","coca-zero","fanta-laranja","j2o-apple-mango","j2o-apple-raspberry","j2o-orange-passion","pastel-4-queijos","pastel-banana-queijo","pastel-brigadeiro","pastel-carne-gueroba","pastel-carne-queijo","pastel-carne","pastel-doce-de-leite","pastel-frango-catupiry","pastel-frango","pastel-ninho-morango","pastel-nutella-morango","pastel-pizza","pastel-x-tudo"]);

/** Destaques ("Mais pedidos") até alguém marcar ou desmarcar algum no painel. */
const DESTAQUES_INICIAIS = ["acai-500", "acai-350", "pastel-x-tudo", "batata-calabacon", "pastel-carne-queijo", "pastel-nutella-morango", "batidinha-acai"];

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function aplicarFotosPadrao(c: Cardapio): Cardapio {
  const semEscolha = !c.itens.some((i) => typeof i.destaque === "boolean");
  return {
    ...c,
    itens: c.itens.map((i) => {
      const id = COM_FOTO.has(i.id) ? i.id : COM_FOTO.has(normal(i.nome)) ? normal(i.nome) : null;
      return {
        ...i,
        imagem: i.imagem || (id ? `/fotos/cardapio/${id}.jpg` : undefined),
        destaque: semEscolha ? DESTAQUES_INICIAIS.includes(i.id) || undefined : i.destaque,
      };
    }),
  };
}

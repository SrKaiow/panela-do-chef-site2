import cardapioJson from "@/data/cardapio.json";
import lojaJson from "@/data/loja.json";

export type Opcao = { nome: string; preco?: number; esgotado?: boolean };
export type GrupoAdicional = { nome: string; opcoes: Opcao[] };
export type Escolha = { grupo: string; min: number; max: number };
export type Item = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  preco: number;
  precoAntigo?: number;
  disponivel: boolean;
  imagem?: string;
  escolhas?: Escolha[];
};
export type Categoria = { id: string; nome: string };
export type Cardapio = {
  categorias: Categoria[];
  adicionais: Record<string, GrupoAdicional>;
  itens: Item[];
};

export const cardapio = cardapioJson as Cardapio;
export const loja = lojaJson;

/** Libras (8.5) para pence (850). Todo cálculo é feito em pence para não errar centavos. */
export const emPence = (libras: number) => Math.round(libras * 100);
export const formatar = (pence: number) => "£" + (pence / 100).toFixed(2);

/** O que o navegador manda para o servidor. Preços NUNCA vêm do navegador. */
export type LinhaCarrinho = {
  itemId: string;
  qtd: number;
  selecoes: Record<string, string[]>; // grupo -> nomes escolhidos
  obs?: string;
};

export type LinhaPedido = {
  itemId: string;
  nome: string;
  qtd: number;
  unitario: number; // pence
  total: number; // pence
  detalhes: string[];
  obs?: string;
};

export function precoUnitario(item: Item, selecoes: Record<string, string[]>) {
  let total = emPence(item.preco);
  for (const e of item.escolhas ?? []) {
    const grupo = cardapio.adicionais[e.grupo];
    for (const nome of selecoes[e.grupo] ?? []) {
      const op = grupo?.opcoes.find((o) => o.nome === nome);
      if (op?.preco) total += emPence(op.preco);
    }
  }
  return total;
}

/** Confere o carrinho contra o cardápio e calcula os valores no servidor. */
export function validarCarrinho(linhas: LinhaCarrinho[]): { linhas: LinhaPedido[]; subtotal: number } {
  if (!Array.isArray(linhas) || linhas.length === 0) throw new Error("Seu carrinho está vazio.");
  if (linhas.length > 50) throw new Error("Pedido grande demais. Fale com a gente pelo Instagram.");

  const resultado: LinhaPedido[] = [];
  for (const l of linhas) {
    const item = cardapio.itens.find((i) => i.id === l.itemId);
    if (!item) throw new Error("Um item do carrinho não existe mais. Atualize a página.");
    if (!item.disponivel) throw new Error(`${item.nome} esgotou. Tire do carrinho para continuar.`);
    const qtd = Math.floor(Number(l.qtd));
    if (!(qtd >= 1 && qtd <= 20)) throw new Error(`Quantidade inválida em ${item.nome}.`);

    const selecoes: Record<string, string[]> = {};
    const detalhes: string[] = [];
    for (const e of item.escolhas ?? []) {
      const grupo = cardapio.adicionais[e.grupo];
      const escolhidos = Array.from(new Set((l.selecoes?.[e.grupo] ?? []).map(String)));
      if (escolhidos.length < e.min) throw new Error(`Escolha pelo menos ${e.min} em "${grupo.nome}" (${item.nome}).`);
      if (escolhidos.length > e.max) throw new Error(`No máximo ${e.max} em "${grupo.nome}" (${item.nome}).`);
      for (const nome of escolhidos) {
        const op = grupo.opcoes.find((o) => o.nome === nome);
        if (!op) throw new Error(`Opção "${nome}" não existe mais em ${item.nome}.`);
        if (op.esgotado) throw new Error(`"${nome}" esgotou. Troque a opção em ${item.nome}.`);
      }
      selecoes[e.grupo] = escolhidos;
      if (escolhidos.length) detalhes.push(`${grupo.nome}: ${escolhidos.join(", ")}`);
    }

    const unitario = precoUnitario(item, selecoes);
    const obs = typeof l.obs === "string" ? l.obs.trim().slice(0, 150) : "";
    resultado.push({ itemId: item.id, nome: item.nome, qtd, unitario, total: unitario * qtd, detalhes, obs: obs || undefined });
  }
  return { linhas: resultado, subtotal: resultado.reduce((s, l) => s + l.total, 0) };
}

export const cartaoAtivo = () => loja.pagamentos.cartao && !!process.env.STRIPE_SECRET_KEY;
export const dinheiroAtivo = () => loja.pagamentos.dinheiro;

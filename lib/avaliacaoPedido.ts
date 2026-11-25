import { buscarPorNumero, buscarPorToken, pedidoJaAvaliado, telefoneChave, type Pedido } from "./db";
import { bairroDoPostcode } from "./entrega";

/**
 * Avaliação sempre presa a um pedido entregue: o nome e o bairro vêm do pedido, ninguém digita.
 * Nome: primeiro nome + inicial do sobrenome (ex.: "Juan P."). Bairro: só o nome do bairro pelo postcode.
 */
export function nomePublico(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  if (!partes.length) return "Cliente";
  const primeiro = cap(partes[0]).slice(0, 24);
  return partes.length > 1 ? `${primeiro} ${partes[partes.length - 1].charAt(0).toUpperCase()}.` : primeiro;
}

export async function identidadeDoPedido(p: Pedido) {
  return { nome: nomePublico(p.nome), local: p.retirada ? null : await bairroDoPostcode(p.postcode), numero: p.numero };
}

/** Acha o pedido para avaliar: pelo link do pedido (token) ou pelo nº do pedido + telefone usado nele. */
export async function pedidoParaAvaliar(dados: { token?: unknown; numero?: unknown; telefone?: unknown }): Promise<{ pedido: Pedido } | { erro: string }> {
  let p: Pedido | null = null;
  if (typeof dados.token === "string" && dados.token) {
    p = await buscarPorToken(dados.token);
  } else {
    const numero = Number(String(dados.numero ?? "").replace(/\D/g, ""));
    const tel = telefoneChave(String(dados.telefone ?? ""));
    if (!numero || tel.length < 10) return { erro: "Informe o número do pedido e o telefone que você usou nele." };
    const achado = await buscarPorNumero(numero);
    if (achado && telefoneChave(achado.telefone) === tel) p = achado;
  }
  if (!p) return { erro: "Não achamos esse pedido. Confira o número do pedido e o telefone." };
  if (p.status !== "entregue") return { erro: "Dá para avaliar assim que o pedido for entregue." };
  if (await pedidoJaAvaliado(p.numero)) return { erro: "Este pedido já foi avaliado. Obrigado!" };
  return { pedido: p };
}

import cardapioInicial from "@/data/cardapio.json";
import lojaInicial from "@/data/loja.json";
import type { Cardapio } from "./cardapio";
import type { Ajustes } from "./ajustes";
import { lerConfig, salvarConfig } from "./db";

/**
 * O cardápio e os ajustes ficam no banco e são editados pelo painel.
 * Na primeira vez (banco vazio), usamos os arquivos de data/ como ponto de partida.
 */

export async function getCardapio(): Promise<Cardapio> {
  try {
    const c = await lerConfig<Cardapio>("cardapio");
    if (c && Array.isArray(c.itens)) return c;
  } catch (e) {
    console.error("[dados] cardápio", e);
  }
  return cardapioInicial as Cardapio;
}

export async function salvarCardapio(c: Cardapio) {
  await salvarConfig("cardapio", c);
}

export async function getAjustes(): Promise<Ajustes> {
  const base = lojaInicial as unknown as Ajustes;
  try {
    const a = await lerConfig<Partial<Ajustes>>("ajustes");
    if (a) return { ...base, ...a, entrega: { ...base.entrega, ...(a.entrega ?? {}) }, pagamentos: { ...base.pagamentos, ...(a.pagamentos ?? {}) } };
  } catch (e) {
    console.error("[dados] ajustes", e);
  }
  return base;
}

export async function salvarAjustes(a: Ajustes) {
  await salvarConfig("ajustes", a);
}

export const cartaoConfigurado = () => !!process.env.STRIPE_SECRET_KEY;

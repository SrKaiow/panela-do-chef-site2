import { lerConfig, salvarConfig } from "./db";

/**
 * Cartão fidelidade: a cada `meta` pedidos o cliente ganha um brinde.
 * Só contam pedidos com subtotal a partir de `minimo` (libras). O cliente não vê esse valor.
 * `voucher` é o que vai na mensagem de WhatsApp quando o cartão completa.
 */
export type Fidelidade = { meta: number; brinde: string; minimo: number; voucher: string };
export const FIDELIDADE_PADRAO: Fidelidade = { meta: 10, brinde: "Um pastel ou açaí de brinde", minimo: 10, voucher: "" };

export async function lerFidelidade(): Promise<Fidelidade> {
  const f = await lerConfig<Partial<Fidelidade>>("fidelidade").catch(() => null);
  return { ...FIDELIDADE_PADRAO, ...(f ?? {}) };
}

export async function salvarFidelidade(f: unknown): Promise<Fidelidade> {
  const x = (f ?? {}) as Partial<Fidelidade>;
  const meta = Math.round(Number(x.meta));
  if (!(meta >= 2 && meta <= 20)) throw new Error("A meta precisa ser entre 2 e 20 pedidos.");
  const brinde = String(x.brinde ?? "").trim().slice(0, 80);
  if (!brinde) throw new Error("Escreva qual é o brinde.");
  const minimo = Math.round(Number(x.minimo ?? 0) * 100) / 100;
  if (!(minimo >= 0 && minimo <= 200)) throw new Error("O pedido mínimo precisa ser entre £0 e £200.");
  const voucher = String(x.voucher ?? "").trim().slice(0, 80);
  const novo = { meta, brinde, minimo, voucher };
  await salvarConfig("fidelidade", novo);
  return novo;
}

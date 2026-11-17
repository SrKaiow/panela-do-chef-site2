import { lerConfig, salvarConfig } from "./db";

/** Cartão fidelidade: a cada `meta` pedidos o cliente ganha `brinde`. */
export type Fidelidade = { meta: number; brinde: string };
export const FIDELIDADE_PADRAO: Fidelidade = { meta: 10, brinde: "Um pastel ou açaí de brinde" };

export async function lerFidelidade(): Promise<Fidelidade> {
  const f = await lerConfig<Partial<Fidelidade>>("fidelidade").catch(() => null);
  return { ...FIDELIDADE_PADRAO, ...(f ?? {}) };
}

export async function salvarFidelidade(f: unknown): Promise<Fidelidade> {
  const x = (f ?? {}) as Partial<Fidelidade>;
  const meta = Math.round(Number(x.meta));
  if (!(meta >= 2 && meta <= 50)) throw new Error("A meta precisa ser entre 2 e 50 pedidos.");
  const brinde = String(x.brinde ?? "").trim().slice(0, 80);
  if (!brinde) throw new Error("Escreva qual é o brinde.");
  const novo = { meta, brinde };
  await salvarConfig("fidelidade", novo);
  return novo;
}

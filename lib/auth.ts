import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/** Duas áreas com senha: o painel (você) e a tela do entregador (o driver). */
export type Area = "painel" | "entregador";

const CONFIG: Record<Area, { cookie: string; senha: () => string }> = {
  painel: { cookie: "painel_sessao", senha: () => process.env.ADMIN_PASSWORD || "" },
  entregador: { cookie: "entregador_sessao", senha: () => process.env.DRIVER_PASSWORD || "" },
};

export const nomeCookie = (area: Area) => CONFIG[area].cookie;
export const senhaDefinida = (area: Area) => !!CONFIG[area].senha();

const igual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function senhaCorreta(area: Area, senha: string) {
  const certa = CONFIG[area].senha();
  return !!certa && igual(senha, certa);
}

/** Valor do cookie: assinatura da senha. Trocar a senha desloga todo mundo daquela área. */
export function valorSessao(area: Area) {
  return createHmac("sha256", CONFIG[area].senha() || "sem-senha").update(`panela-do-chef-${area}`).digest("hex");
}

export function logado(area: Area = "painel") {
  if (!senhaDefinida(area)) return false;
  const v = cookies().get(CONFIG[area].cookie)?.value;
  return !!v && igual(v, valorSessao(area));
}

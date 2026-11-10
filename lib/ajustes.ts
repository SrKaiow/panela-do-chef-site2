/** Ajustes da loja editados no painel (horários, entrega, contato). Valores iniciais em data/loja.json. */

export type Faixa = { ateMilhas: number; taxa: number; gratisAcima: number | null };

export type Ajustes = {
  nome: string;
  slogan: string;
  falaDoChef: string;
  clientesSatisfeitos: string;
  telefone: string;
  email: string;
  instagram: string;
  grupoVip: string;
  /** Fecha a loja na hora, mesmo dentro do horário (ex.: acabou o estoque). */
  pausado: boolean;
  /** Um intervalo por dia, ["12:00","22:00"]; null = fechado. Índice 0 = domingo. */
  horarios: ([string, string] | null)[];
  /** Minutos médios de preparo de um pedido; usado na previsão e na fila. */
  preparoMin: number;
  pagamentos: { dinheiro: boolean; cartao: boolean };
  entrega: {
    regiao: string;
    cozinha: { postcode: string; lat: number; lng: number };
    raioMilhas: number;
    faixas: Faixa[];
    pedidoMinimo: number;
    avisoChegandoMetros: number;
    velocidadeMediaKmh: number;
  };
};

export const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** Converte um telefone do Reino Unido para o formato do wa.me (07511 505131 -> 447511505131). */
export function whatsappInternacional(tel: string) {
  let n = (tel || "").replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) n = "44" + n.slice(1);
  return n;
}

/** 07511505131 -> 07511 505131 */
export function telefoneBonito(tel: string) {
  const n = (tel || "").replace(/\D/g, "");
  return n.length === 11 && n.startsWith("07") ? `${n.slice(0, 5)} ${n.slice(5)}` : tel;
}

/** Dados que o navegador pode ver (sem nada sensível). */
export type AjustesPublicos = Pick<
  Ajustes,
  "nome" | "slogan" | "falaDoChef" | "clientesSatisfeitos" | "telefone" | "email" | "instagram" | "grupoVip" | "pagamentos" | "horarios" | "preparoMin"
> & { regiao: string; raioMilhas: number; faixas: Faixa[]; pedidoMinimo: number };

export function publicos(a: Ajustes, cartaoConfigurado: boolean): AjustesPublicos {
  return {
    nome: a.nome,
    slogan: a.slogan,
    falaDoChef: a.falaDoChef,
    clientesSatisfeitos: a.clientesSatisfeitos,
    telefone: a.telefone,
    email: a.email,
    instagram: a.instagram,
    grupoVip: a.grupoVip,
    pagamentos: { dinheiro: a.pagamentos.dinheiro, cartao: a.pagamentos.cartao && cartaoConfigurado },
    horarios: a.horarios,
    preparoMin: a.preparoMin,
    regiao: a.entrega.regiao,
    raioMilhas: a.entrega.raioMilhas,
    faixas: a.entrega.faixas,
    pedidoMinimo: a.entrega.pedidoMinimo,
  };
}

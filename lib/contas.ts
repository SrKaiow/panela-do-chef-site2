import type { Conta, Lancamento } from "./db";

/** Dados para transferência que saem na fatura do cliente. */
export const DADOS_BANCARIOS = {
  beneficiario: "PANELA DO CHEF LTD",
  conta: "86748158",
  sortCode: "23-01-20",
};

/** Compras ainda em aberto: as mais recentes até somar o saldo devido (mais antigas primeiro). */
export function emAberto(c: Conta): Lancamento[] {
  let falta = c.saldo;
  const lista: Lancamento[] = [];
  for (const l of c.lancamentos) {
    if (falta <= 0) break;
    if (l.tipo !== "compra") continue;
    lista.push(l);
    falta -= l.valor;
  }
  return lista.reverse();
}

/** Número da fatura: PDC-<cliente>-<data>, o mesmo no PDF e na referência da transferência. */
export function numeroFatura(c: Conta, dia: string) {
  return `PDC-${String(c.id).padStart(3, "0")}-${dia.replaceAll("-", "")}`;
}

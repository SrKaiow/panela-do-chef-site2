"use client";

import { useEffect, useState } from "react";
import type { DiaSquare } from "@/lib/db";

/**
 * Caixa Square: quanto TEM QUE TER na Square de cada dia, das vendas pagas no cartão pelo site,
 * já descontada a taxa da Square (1.4% + £0.25 por venda). É só abrir a Square e conferir se bate.
 */
const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const hojeLondres = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const somarDias = (d: string, n: number) => new Date(new Date(d + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const segunda = (d: string) => somarDias(d, -((new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7));
const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const nomeDia = (d: string) => NOMES[(new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7];
const dataBR = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
type Aviso = (a: { tipo: "ok" | "erro"; texto: string }) => void;
type Semana = { inicio: string; fim: string; dias: DiaSquare[]; bruto: number; taxas: number; liquido: number; vendas: number };

export default function CaixaSquare({ avisar }: { avisar: Aviso }) {
  const hoje = hojeLondres();
  const ontem = somarDias(hoje, -1);
  const [dia, setDia] = useState(ontem);
  const [sem, setSem] = useState<Semana | null>(null);
  const inicio = segunda(dia);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/painel/square-caixa?semana=${inicio}`, { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.erro); if (vivo) setSem(d); })
      .catch((e) => avisar({ tipo: "erro", texto: e.message || "Não consegui carregar o caixa da Square." }));
    return () => { vivo = false; };
  }, [inicio, avisar]);

  const d = sem?.inicio === inicio ? sem.dias.find((x) => x.data === dia) : undefined;
  const rotulo = dia === hoje ? "Hoje" : dia === ontem ? "Ontem" : nomeDia(dia);

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Caixa Square</h1>
          <p className="sq-sub">Vendas pagas no cartão pelo site, já sem a taxa da Square (1.4% + £0.25 por venda). Abra a Square e confira se bate.</p>
        </div>
      </div>

      <div className="sq-filtros cx-dias">
        <button className="sq-btn" onClick={() => setDia(somarDias(dia, -1))}>‹</button>
        <button className={"sq-btn" + (dia === ontem ? " sq-btn-primario" : "")} onClick={() => setDia(ontem)}>Ontem</button>
        <button className={"sq-btn" + (dia === hoje ? " sq-btn-primario" : "")} onClick={() => setDia(hoje)}>Hoje</button>
        <input type="date" value={dia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)} />
        <button className="sq-btn" disabled={dia >= hoje} onClick={() => setDia(somarDias(dia, 1))}>›</button>
      </div>

      {!d ? <p className="sq-carregando">Carregando...</p> : (
        <>
          <section className="cx-destaque">
            <span>{rotulo} · {nomeDia(dia)} {dataBR(dia)}{dia === hoje ? " (até agora)" : ""}</span>
            <strong>Tem que ter na Square: {gbp(d.liquido)}</strong>
            <div className="cx-conta">
              <span>{d.vendas.length} venda{d.vendas.length === 1 ? "" : "s"} no cartão: <b>{gbp(d.bruto)}</b></span>
              <span>Taxa da Square: <b>−{gbp(d.taxas)}</b></span>
            </div>
          </section>

          <section className="sq-cartao">
            <strong>Vendas de {rotulo.toLowerCase()}</strong>
            {d.vendas.length === 0 ? <p className="sq-sub">Nenhuma venda no cartão pelo site neste dia.</p> : (
              <div className="rel-tabela-wrap">
                <table className="rel-tabela cx-tabela">
                  <thead><tr><th>Pedido</th><th className="cx-hora">Hora</th><th>Venda</th><th>Taxa</th><th>Cai na Square</th></tr></thead>
                  <tbody>
                    {d.vendas.map((v) => (
                      <tr key={v.numero}><td><strong>#{v.numero}</strong> <span className="sq-sub">{v.nome}</span></td><td className="cx-hora">{v.hora}</td><td>{gbp(v.total)}</td><td>−{gbp(v.taxa)}</td><td><strong>{gbp(v.liquido)}</strong></td></tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Total</td><td className="cx-hora" /><td>{gbp(d.bruto)}</td><td>−{gbp(d.taxas)}</td><td>{gbp(d.liquido)}</td></tr></tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="sq-cartao">
            <strong>Semana ({dataBR(sem!.inicio)} a {dataBR(sem!.fim)})</strong>
            <div className="rel-tabela-wrap">
              <table className="rel-tabela cx-tabela">
                <thead><tr><th>Dia</th><th className="cx-hora">Vendas</th><th>Bruto</th><th>Taxa</th><th>Tem que ter</th></tr></thead>
                <tbody>
                  {sem!.dias.map((x) => (
                    <tr key={x.data} className={(x.data === dia ? "hoje " : "") + "cx-linha"} onClick={() => x.data <= hoje && setDia(x.data)}>
                      <td><strong>{nomeDia(x.data)}</strong> <span className="sq-sub">{dataBR(x.data)}</span></td>
                      <td className="cx-hora">{x.vendas.length}</td><td>{gbp(x.bruto)}</td><td>−{gbp(x.taxas)}</td><td><strong>{gbp(x.liquido)}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><td>Semana</td><td className="cx-hora">{sem!.vendas}</td><td>{gbp(sem!.bruto)}</td><td>−{gbp(sem!.taxas)}</td><td>{gbp(sem!.liquido)}</td></tr></tfoot>
              </table>
            </div>
            <p className="sq-sub">Conta só os pedidos do site pagos no cartão (Apple Pay / Google Pay / cartão). Vendas feitas na maquininha (Tap to Pay) não entram aqui. Pedido cancelado e reembolsado também não.</p>
          </section>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMeta } from "./MetaSemana";

/** Aba Metas: a semana atual dia a dia, mudar a meta e o histórico (batida ou não). */
const gbp = (p: number) => "£" + (p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
type Aviso = (a: { tipo: "ok" | "erro"; texto: string }) => void;

export default function Metas({ avisar }: { avisar: Aviso }) {
  const { info, setInfo } = useMeta();
  const [novaMeta, setNovaMeta] = useState("");
  if (!info) return <div className="sq-pagina"><p className="sq-carregando">Carregando...</p></div>;
  const { atual } = info;
  const idxHoje = Math.round((new Date(info.hoje + "T12:00:00Z").getTime() - new Date(atual.inicio + "T12:00:00Z").getTime()) / 86400000);
  const maxDia = Math.max(1, ...atual.porDia, ...info.ritmo.map((r) => r * info.meta));
  const batidas = info.historico.filter((s) => s.vendas > 0 && s.batida).length;
  const comVenda = info.historico.filter((s) => s.vendas > 0).length;

  async function salvar() {
    try {
      const r = await fetch("/api/painel/meta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ valor: novaMeta }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro);
      setInfo(d);
      setNovaMeta("");
      window.dispatchEvent(new Event("pdc-meta-atualizar"));
      avisar({ tipo: "ok", texto: `Meta da semana: £${(d.meta / 100).toFixed(0)}.` });
    } catch (e) {
      avisar({ tipo: "erro", texto: e instanceof Error ? e.message : "Não consegui salvar a meta." });
    }
  }

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Metas ✈️🇧🇷</h1>
          <p className="sq-sub">A semana vai de segunda a domingo e soma todas as vendas (cartão, dinheiro e na conta). Na segunda, o resultado da semana que fechou aparece no topo do painel.</p>
        </div>
      </div>

      <section className="sq-cartao">
        <strong>Esta semana ({dataBR(atual.inicio)} a {dataBR(atual.fim)}) · {gbp(atual.vendas)} de {gbp(info.meta)}</strong>
        <p className="sq-sub">A barra amarela é o que vendeu; a linha tracejada é o alvo de cada dia, pelo ritmo das últimas semanas (segunda a quarta mais fracas, quinta a domingo mais fortes).</p>
        <div className="metas-dias">
          {DIAS.map((d, i) => {
            const alvo = Math.round(info.ritmo[i] * info.meta);
            const v = atual.porDia[i];
            return (
              <div key={d} className={"metas-dia" + (i === idxHoje ? " hoje" : "") + (i > idxHoje ? " futuro" : "")}>
                <div className="metas-coluna">
                  <div className="metas-alvo" style={{ bottom: `${(alvo / maxDia) * 100}%` }} />
                  <div className={"metas-barra" + (v >= alvo ? " ok" : "")} style={{ height: `${(v / maxDia) * 100}%` }} />
                </div>
                <strong>{d}</strong>
                <span>{i > idxHoje ? "—" : gbp(v)}</span>
                <small>alvo £{Math.round(alvo / 100)}</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sq-cartao">
        <strong>Mudar a meta semanal</strong>
        <div className="metas-form">
          <label className="sq-campo">Meta (£)<input inputMode="decimal" placeholder={(info.meta / 100).toFixed(0)} value={novaMeta} onChange={(e) => setNovaMeta(e.target.value)} /></label>
          <button className="sq-btn sq-btn-primario" disabled={!novaMeta} onClick={salvar}>Salvar meta</button>
        </div>
        <p className="sq-sub">Vale para esta semana e as próximas. As semanas que já passaram guardam a meta que tinham.</p>
      </section>

      <section className="sq-cartao">
        <strong>Histórico {comVenda ? `· ${batidas} de ${comVenda} semanas batidas` : ""}</strong>
        {info.historico.filter((s) => s.vendas > 0).length === 0 ? <p className="sq-sub">Ainda não tem semana fechada.</p> : (
          <ul className="metas-hist">
            {info.historico.filter((s) => s.vendas > 0).map((s) => (
              <li key={s.inicio} className={s.batida ? "ok" : "nao"}>
                <span className="metas-selo">{s.batida ? "✅" : "❌"}</span>
                <span><strong>{dataBR(s.inicio)} a {dataBR(s.fim)}</strong><small>{s.pedidos} pedidos</small></span>
                <span className="metas-num"><strong>{gbp(s.vendas)}</strong><small>meta {gbp(s.meta)}</small></span>
                <span className="metas-pct">{Math.round((s.vendas / s.meta) * 100)}%</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

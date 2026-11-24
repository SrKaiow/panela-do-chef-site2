"use client";

import { useCallback, useEffect, useState } from "react";
import type { InfoMeta } from "@/lib/db";

/**
 * Meta da semana (só no painel): barra de £0 até a meta, com o chef correndo atrás das passagens
 * para o Brasil. Mostra também onde deveria estar hoje pelo ritmo da semana (começo fraco, fim forte).
 */
const gbp = (p: number) => "£" + Math.round(p / 100).toLocaleString("en-GB");
const gbp2 = (p: number) => "£" + (p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const lerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

export function useMeta() {
  const [info, setInfo] = useState<InfoMeta | null>(null);
  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/painel/meta", { cache: "no-store" });
      if (r.ok) setInfo(await r.json());
    } catch { /* tenta no próximo ciclo */ }
  }, []);
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    const ev = () => carregar();
    window.addEventListener("pdc-meta-atualizar", ev);
    return () => { clearInterval(t); window.removeEventListener("pdc-meta-atualizar", ev); };
  }, [carregar]);
  return { info, setInfo, carregar };
}

export default function MetaSemana({ ir }: { ir: (secao: string) => void }) {
  const { info } = useMeta();
  const [visto, setVisto] = useState<string | null>(null);
  useEffect(() => setVisto(lerLocal("pdc-meta-visto")), []);
  if (!info) return null;

  const { atual, meta } = info;
  const pct = Math.min(100, (atual.vendas / meta) * 100);
  const ritmoPct = Math.min(100, (info.esperadoAteHoje / meta) * 100);
  const batida = atual.vendas >= meta;
  const diferenca = atual.vendas - info.esperadoAteHoje;
  const idxHoje = Math.round((new Date(info.hoje + "T12:00:00Z").getTime() - new Date(atual.inicio + "T12:00:00Z").getTime()) / 86400000);
  const vendasHoje = atual.porDia[idxHoje] ?? 0;
  const passada = info.historico[0];
  const mostrarResultado = passada && passada.vendas > 0 && visto !== passada.inicio;

  return (
    <>
      {mostrarResultado && (
        <div className={"meta-resultado " + (passada.batida ? "ok" : "nao")} role="status">
          <span className="meta-resultado-emoji" aria-hidden="true">{passada.batida ? "🎉" : "💪"}</span>
          <div>
            <strong>
              {passada.batida ? "Meta batida na semana passada!" : "Semana passada a meta não veio, bora nessa!"}
            </strong>
            <span>
              {dataBR(passada.inicio)} a {dataBR(passada.fim)}: {gbp2(passada.vendas)} de {gbp(passada.meta)}
              {passada.batida ? " · o Brasil está mais perto ✈️🇧🇷" : ` · faltaram ${gbp2(passada.meta - passada.vendas)}`}
            </span>
          </div>
          <button onClick={() => { ir("metas"); }}>Ver metas</button>
          <button className="meta-fechar" aria-label="Fechar aviso" onClick={() => { gravarLocal("pdc-meta-visto", passada.inicio); setVisto(passada.inicio); }}>×</button>
        </div>
      )}

      <section className={"meta" + (batida ? " batida" : "")} aria-label="Meta da semana">
        <button className="meta-cab" onClick={() => ir("metas")} title="Ver metas e histórico">
          <span className="meta-titulo">Meta da semana <span className="meta-sub">· viagem pro Brasil 🇧🇷</span></span>
          <span className="meta-valor"><strong>{gbp(atual.vendas)}</strong> / {gbp(meta)}</span>
        </button>

        <div className="meta-pista">
          <div className="meta-trilho">
            <div className="meta-cheio" style={{ width: `${pct}%` }} />
            {!batida && <div className="meta-ritmo" style={{ left: `${ritmoPct}%` }} title={`Pelo ritmo, até hoje: ${gbp(info.esperadoAteHoje)}`} />}
          </div>
          <span className="meta-chef" style={{ left: `${Math.max(3, Math.min(pct, 91))}%` }} aria-hidden="true">👨‍🍳</span>
          <span className="meta-premio" aria-hidden="true"><span className="meta-bilhetes">🎫🎫</span><span className="meta-aviao">✈️</span></span>
          <span className="meta-zero">£0</span>
          <span className="meta-fim">{gbp(meta)}</span>
        </div>

        <div className="meta-rodape">
          {batida ? (
            <span className="meta-chip ok">🎉 Meta batida! {atual.vendas > meta ? `+${gbp(atual.vendas - meta)} acima` : ""}</span>
          ) : (
            <>
              <span>Faltam <strong>{gbp(meta - atual.vendas)}</strong></span>
              <span>Hoje: <strong>{gbp(vendasHoje)}</strong> de {gbp(info.alvoHoje)}</span>
              <span className={"meta-chip " + (diferenca >= 0 ? "ok" : "atras")}>
                {diferenca >= 0 ? `✅ No ritmo (+${gbp(diferenca)})` : `⏳ ${gbp(-diferenca)} atrás do ritmo`}
              </span>
            </>
          )}
        </div>
      </section>
    </>
  );
}

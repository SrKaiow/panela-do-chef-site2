"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cliente, EstatisticasVisitas } from "@/lib/db";
import type { Fidelidade } from "@/lib/fidelidade";

const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "Europe/London" });
const PERIODOS = [
  { dias: 1, nome: "Hoje" },
  { dias: 7, nome: "7 dias" },
  { dias: 30, nome: "30 dias" },
];

/** Visitas do site: quantas pessoas abriram, quantas voltaram e quantas pediram. */
export function Visitas() {
  const [dias, setDias] = useState(7);
  const [e, setE] = useState<EstatisticasVisitas | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      try {
        const r = await fetch(`/api/painel/estatisticas?dias=${dias}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro);
        if (vivo) { setE(d); setErro(""); }
      } catch (x: any) {
        if (vivo) setErro(x.message || "Não consegui carregar.");
      }
    };
    carregar();
    const t = setInterval(carregar, 60000);
    return () => { vivo = false; clearInterval(t); };
  }, [dias]);

  const max = Math.max(1, ...(e?.porDia.map((d) => d.visitantes) ?? [1]));
  const conversao = e && e.visitantes ? Math.round((e.pedidos / e.visitantes) * 100) : 0;

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Visitas do site</h1>
          <p className="sq-sub">Quantas pessoas abriram o paneladochef.co.uk, quantas voltaram e quantas fizeram pedido.</p>
        </div>
        <div className="sq-segmentos" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p.dias} className={"sq-btn" + (dias === p.dias ? " sq-btn-ativo" : "")} aria-pressed={dias === p.dias} onClick={() => setDias(p.dias)}>{p.nome}</button>
          ))}
        </div>
      </div>
      {erro && <p className="sq-erro">{erro}</p>}
      {!e ? <p className="sq-carregando">Carregando...</p> : (
        <>
          <section className="sq-metricas" aria-label="Resumo">
            <div className="sq-cartao"><span className="sq-rotulo">Pessoas que viram o site</span><strong className="num">{e.visitantes}</strong><span className="sq-sub">{e.acessos} acessos no total</span></div>
            <div className="sq-cartao"><span className="sq-rotulo">Voltaram mais de uma vez</span><strong className="num">{e.voltaram}</strong><span className="sq-sub">{e.visitantes ? Math.round((e.voltaram / e.visitantes) * 100) : 0}% das pessoas</span></div>
            <div className="sq-cartao"><span className="sq-rotulo">Pessoas novas</span><strong className="num">{e.novos}</strong><span className="sq-sub">primeira vez no site</span></div>
            <div className="sq-cartao"><span className="sq-rotulo">Pedidos</span><strong className="num">{e.pedidos}</strong><span className="sq-sub">{conversao}% de quem visitou pediu</span></div>
          </section>

          {e.dias > 1 && (
            <section className="sq-cartao">
              <h2>Dia a dia</h2>
              <div className="sq-grafico" role="img" aria-label="Pessoas que viram o site por dia">
                {e.porDia.map((d) => (
                  <div key={d.dia} className="sq-barra-col" title={`${dataCurta(d.dia + "T12:00:00Z")}: ${d.visitantes} pessoas, ${d.acessos} acessos, ${d.pedidos} pedidos`}>
                    <span className="sq-barra-num">{d.visitantes || ""}</span>
                    <span className="sq-barra" style={{ height: `${(d.visitantes / max) * 100}%` }}>
                      {d.pedidos > 0 && <span className="sq-barra-pedidos" style={{ height: `${Math.min(100, (d.pedidos / Math.max(1, d.visitantes)) * 100)}%` }} />}
                    </span>
                    {e.dias <= 14 && <span className="sq-barra-dia">{new Date(d.dia + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>}
                  </div>
                ))}
              </div>
              <p className="sq-sub"><span className="sq-legenda claro" /> pessoas que viram o site · <span className="sq-legenda escuro" /> pedidos feitos</p>
            </section>
          )}
          <p className="sq-sub">Cada aparelho conta como uma pessoa. A contagem começou quando esta tela foi ativada; robôs de busca não entram.</p>
        </>
      )}
    </div>
  );
}

/** Clientes pelo telefone, com o cartão fidelidade. */
export function Clientes({ avisar }: { avisar: (a: { tipo: "ok" | "erro"; texto: string }) => void }) {
  const [lista, setLista] = useState<Cliente[] | null>(null);
  const [fid, setFid] = useState<Fidelidade | null>(null);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"semana" | "total" | "recente" | "gasto">("semana");
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState({ meta: "10", brinde: "", minimo: "10", voucher: "" });

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/painel/clientes", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro);
      setLista(d.clientes);
      setFid(d.fidelidade);
    } catch (x: any) {
      avisar({ tipo: "erro", texto: x.message || "Não consegui carregar os clientes." });
    }
  }, [avisar]);
  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const l = (lista ?? []).filter((c) => !q || c.nome.toLowerCase().includes(q) || c.telefone.includes(q.replace(/\D/g, "") || "~") || c.postcode.toLowerCase().includes(q));
    const por = {
      semana: (a: Cliente, b: Cliente) => b.pedidosSemana - a.pedidosSemana || b.pedidos - a.pedidos,
      total: (a: Cliente, b: Cliente) => b.pedidos - a.pedidos,
      recente: (a: Cliente, b: Cliente) => b.ultimo.localeCompare(a.ultimo),
      gasto: (a: Cliente, b: Cliente) => b.gasto - a.gasto,
    }[ordem];
    return l.sort(por);
  }, [lista, busca, ordem]);

  async function resgatar(c: Cliente, acao: "resgatar" | "desfazer") {
    const r = await fetch("/api/painel/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telefone: c.telefone, acao }) });
    if (!r.ok) return avisar({ tipo: "erro", texto: "Não consegui salvar." });
    avisar({ tipo: "ok", texto: acao === "resgatar" ? `Brinde de ${c.nome.split(" ")[0]} marcado como entregue.` : "Desfeito." });
    carregar();
  }

  async function salvarRegra() {
    const r = await fetch("/api/painel/clientes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meta: Number(rascunho.meta), brinde: rascunho.brinde, minimo: Number(rascunho.minimo.replace(",", ".")), voucher: rascunho.voucher }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return avisar({ tipo: "erro", texto: d.erro || "Não consegui salvar." });
    setFid(d);
    setEditando(false);
    avisar({ tipo: "ok", texto: "Cartão fidelidade atualizado." });
  }

  const meta = fid?.meta ?? 10;
  const total = lista?.length ?? 0;
  const semana = (lista ?? []).filter((c) => c.pedidosSemana > 0).length;
  const voltaram = (lista ?? []).filter((c) => c.pedidos > 1).length;
  const prontos = (lista ?? []).filter((c) => c.carimbos - c.resgatados * meta >= meta).length;

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Clientes</h1>
          <p className="sq-sub">Todo mundo que já pediu pelo site, reconhecido pelo telefone.</p>
        </div>
      </div>

      <section className="sq-metricas">
        <div className="sq-cartao"><span className="sq-rotulo">Clientes</span><strong className="num">{total}</strong></div>
        <div className="sq-cartao"><span className="sq-rotulo">Pediram nesta semana</span><strong className="num">{semana}</strong></div>
        <div className="sq-cartao"><span className="sq-rotulo">Pediram mais de uma vez</span><strong className="num">{voltaram}</strong></div>
        <div className="sq-cartao"><span className="sq-rotulo">Brinde liberado</span><strong className="num">{prontos}</strong></div>
      </section>

      <section className="sq-cartao sq-fid">
        <div>
          <span className="sq-rotulo">Cartão fidelidade</span>
          {editando ? (
            <div className="sq-fid-form">
              <label className="sq-campo">A cada quantos pedidos?<input type="number" min={2} max={50} value={rascunho.meta} onChange={(e) => setRascunho((r) => ({ ...r, meta: e.target.value }))} /></label>
              <label className="sq-campo">Qual o brinde? (só você vê)<input maxLength={80} value={rascunho.brinde} onChange={(e) => setRascunho((r) => ({ ...r, brinde: e.target.value }))} /></label>
              <label className="sq-campo">Pedido mínimo para ganhar carimbo (£)<input inputMode="decimal" value={rascunho.minimo} onChange={(e) => setRascunho((r) => ({ ...r, minimo: e.target.value }))} /></label>
              <label className="sq-campo">Voucher na mensagem do WhatsApp<input maxLength={80} placeholder="Ex.: £10 de desconto no próximo pedido" value={rascunho.voucher} onChange={(e) => setRascunho((r) => ({ ...r, voucher: e.target.value }))} /></label>
            </div>
          ) : (
            <strong>A cada {meta} pedidos de £{(fid?.minimo ?? 0).toFixed(2)} ou mais: {fid?.brinde}</strong>
          )}
          <span className="sq-sub">
            Pedidos abaixo do mínimo não ganham carimbo (o cliente não vê essa regra). Quando completar, aparece &quot;Brinde liberado&quot;: toque em
            &quot;Enviar voucher&quot; para mandar a mensagem no WhatsApp e, depois de dar o brinde, em &quot;Entregar brinde&quot; para zerar o cartão.
            {!fid?.voucher && " Defina o valor do voucher em Mudar regra."}
          </span>
        </div>
        {editando ? (
          <div className="sq-acoes-cabeca">
            <button className="sq-btn" onClick={() => setEditando(false)}>Cancelar</button>
            <button className="sq-btn sq-btn-primario" onClick={salvarRegra}>Salvar</button>
          </div>
        ) : (
          <button className="sq-btn" onClick={() => { setRascunho({ meta: String(meta), brinde: fid?.brinde ?? "", minimo: String(fid?.minimo ?? 10), voucher: fid?.voucher ?? "" }); setEditando(true); }}>Mudar regra</button>
        )}
      </section>

      <div className="sq-filtros">
        <label className="sq-busca">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone ou postcode" aria-label="Buscar cliente" />
        </label>
        <select className="sq-select" value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} aria-label="Ordenar">
          <option value="semana">Mais pedidos na semana</option>
          <option value="total">Mais pedidos no total</option>
          <option value="gasto">Quem mais gastou</option>
          <option value="recente">Pedido mais recente</option>
        </select>
      </div>

      {!lista ? <p className="sq-carregando">Carregando...</p> : filtrados.length === 0 ? (
        <p className="sq-vazio">{busca ? "Nenhum cliente com essa busca." : "Ainda não tem clientes. Assim que alguém pedir pelo site, aparece aqui."}</p>
      ) : (
        <div className="sq-clientes">
          {filtrados.map((c) => {
            const carimbos = Math.max(0, c.carimbos - c.resgatados * meta);
            const liberado = carimbos >= meta;
            const primeiro = c.nome.trim().split(/\s+/)[0] ?? "";
            const nome = primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
            const msgVoucher =
              `Oi, ${nome}! Parabéns, você completou o nosso *cartão fidelidade* da *Panela do Chef*!\n\n` +
              `Aqui está o seu voucher: *${fid?.voucher || "um brinde da nossa cozinha"}*.\n\n` +
              `É só fazer o seu próximo pedido pelo site (paneladochef.co.uk) e responder esta mensagem que a gente aplica. Obrigado por pedir sempre com a gente!`;
            const zap = "https://wa.me/44" + c.telefone.replace(/^0/, "") + (liberado ? "?text=" + encodeURIComponent(msgVoucher) : "");
            return (
              <article key={c.telefone} className={"sq-cartao sq-cliente" + (liberado ? " liberado" : "")}>
                <header>
                  <div>
                    <strong>{c.nome}</strong>
                    <span className="sq-sub">{c.telefone} · {c.postcode}</span>
                  </div>
                  <a className="sq-btn btn-zap" href={zap} target="_blank" rel="noreferrer" aria-label={liberado ? `Enviar voucher para ${c.nome} no WhatsApp` : `WhatsApp de ${c.nome}`}>{liberado ? "Enviar voucher" : "WhatsApp"}</a>
                </header>
                <dl className="sq-cliente-nums">
                  <div><dt>Semana</dt><dd className="num">{c.pedidosSemana}</dd></div>
                  <div><dt>30 dias</dt><dd className="num">{c.pedidosMes}</dd></div>
                  <div><dt>Total</dt><dd className="num">{c.pedidos}</dd></div>
                  <div><dt>Gastou</dt><dd className="num">{gbp(c.gasto)}</dd></div>
                </dl>
                <div className="sq-carimbos" aria-label={`${Math.min(carimbos, meta)} de ${meta} pedidos no cartão`}>
                  {Array.from({ length: meta }, (_, i) => <span key={i} className={i < carimbos ? "cheio" : ""} />)}
                </div>
                <footer>
                  <span className="sq-sub">
                    {liberado ? <b className="sq-liberado">🎁 Brinde liberado!</b> : `Faltam ${meta - carimbos} carimbos para o brinde`}
                    {" · "}cliente desde {dataCurta(c.primeiro)} · último {dataCurta(c.ultimo)}
                    {c.resgatados > 0 && ` · ${c.resgatados} brinde${c.resgatados > 1 ? "s" : ""} entregue${c.resgatados > 1 ? "s" : ""}`}
                  </span>
                  <span className="sq-acoes-cabeca">
                    {c.resgatados > 0 && <button className="sq-link" onClick={() => resgatar(c, "desfazer")}>Desfazer</button>}
                    {liberado && <button className="sq-btn sq-btn-primario" onClick={() => resgatar(c, "resgatar")}>Entregar brinde</button>}
                  </span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

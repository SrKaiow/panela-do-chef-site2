"use client";

import { useCallback, useEffect, useState } from "react";
import type { Relatorio as Rel } from "@/lib/db";

/**
 * Relatório semanal (segunda a domingo): o que entrou dos pedidos, os gastos lançados e o resultado.
 * A semana vira sozinha na segunda-feira. Dá para ver semanas anteriores e imprimir / salvar em PDF.
 */
const gbp = (p: number) => (p < 0 ? "-£" : "£") + (Math.abs(p) / 100).toFixed(2);
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const NOMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const dataBR = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
const somarDias = (d: string, n: number) => new Date(new Date(d + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
export const CATEGORIAS_GASTO = ["Lidl", "Brazabrazil", "Combustível", "Sainsbury's", "Mercado", "Embalagens", "Entregador", "Gás / Luz", "Outros"];
type Aviso = (a: { tipo: "ok" | "erro"; texto: string }) => void;

export default function Relatorio({ avisar }: { avisar: Aviso }) {
  const [semana, setSemana] = useState<string | null>(null);
  const [rel, setRel] = useState<Rel | null>(null);
  const [form, setForm] = useState({ data: hoje(), categoria: "Lidl", descricao: "", valor: "" });
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async (s: string | null) => {
    try {
      const r = await fetch("/api/painel/relatorio" + (s ? `?semana=${s}` : ""), { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro);
      setRel(d);
    } catch (e: any) {
      avisar({ tipo: "erro", texto: e.message || "Não consegui carregar o relatório." });
    }
  }, [avisar]);
  useEffect(() => { carregar(semana); }, [semana, carregar]);

  async function enviar(dados: object, ok: string) {
    setEnviando(true);
    try {
      const r = await fetch("/api/painel/relatorio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...dados, semana: rel?.inicio }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || "Não consegui salvar.");
      setRel(d);
      avisar({ tipo: "ok", texto: ok });
      return true;
    } catch (e: any) {
      avisar({ tipo: "erro", texto: e.message });
      return false;
    } finally {
      setEnviando(false);
    }
  }

  if (!rel) return <div className="sq-pagina"><p className="sq-carregando">Carregando...</p></div>;
  const t = rel.totais;
  const atual = rel.inicio <= hoje() && hoje() <= rel.fim;
  // Agrupa por categoria (onde gastou), da maior para a menor.
  const porCategoria = [...new Set(rel.gastos.map((g) => g.categoria))]
    .map((c) => ({ c, itens: rel.gastos.filter((g) => g.categoria === c), v: rel.gastos.filter((g) => g.categoria === c).reduce((s, g) => s + g.valor, 0) }))
    .sort((a, b) => b.v - a.v);
  const sugestoes = [...new Set([...CATEGORIAS_GASTO, ...rel.gastos.map((g) => g.categoria)])];
  const maxDia = Math.max(1, ...rel.dias.map((d) => d.total));

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Relatório semanal</h1>
          <p className="sq-sub">De segunda a domingo. Na segunda-feira começa uma semana nova sozinha. Lance aqui os gastos (mercado, combustível...) para ver o resultado de verdade.</p>
        </div>
        <div className="sq-acoes-cabeca">
          <a className="sq-btn sq-btn-primario rel-link" href={`/painel/relatorio/${rel.inicio}`} target="_blank" rel="noreferrer">🖨 Imprimir / PDF</a>
        </div>
      </div>

      <div className="sq-filtros rel-semana">
        <button className="sq-btn" onClick={() => setSemana(somarDias(rel.inicio, -7))}>‹ Semana anterior</button>
        <strong>{dataBR(rel.inicio)} a {dataBR(rel.fim)}{atual ? " · semana atual" : ""}</strong>
        <button className="sq-btn" disabled={atual} onClick={() => setSemana(somarDias(rel.inicio, 7))}>Próxima ›</button>
      </div>

      <section className="sq-metricas rel-kpis">
        <div className="sq-cartao"><span className="sq-rotulo">Entrou</span><strong className="num rel-verde">{gbp(t.entrou)}</strong><span className="sq-sub">cartão + dinheiro{rel.recebidoContas ? " + contas recebidas" : ""}</span></div>
        <div className="sq-cartao"><span className="sq-rotulo">Gastos</span><strong className="num rel-vermelho">{gbp(t.gastos)}</strong><span className="sq-sub">{rel.gastos.length} lançamento{rel.gastos.length === 1 ? "" : "s"}</span></div>
        <div className={"sq-cartao rel-resultado " + (t.resultado >= 0 ? "pos" : "neg")}><span className="sq-rotulo">Resultado da semana</span><strong className="num">{gbp(t.resultado)}</strong><span className="sq-sub">entrou − gastos</span></div>
        <div className="sq-cartao"><span className="sq-rotulo">Pedidos</span><strong className="num">{t.pedidos}</strong><span className="sq-sub">ticket médio {gbp(t.ticketMedio)}</span></div>
      </section>

      <section className="sq-cartao">
        <strong>Entradas por dia</strong>
        <div className="rel-tabela-wrap">
          <table className="rel-tabela">
            <thead><tr><th>Dia</th><th>Pedidos</th><th>Cartão</th><th>Dinheiro</th><th>Na conta</th><th>Total</th></tr></thead>
            <tbody>
              {rel.dias.map((d, i) => (
                <tr key={d.data} className={d.data === hoje() ? "hoje" : ""}>
                  <td><strong>{NOMES[i]}</strong> <span className="sq-sub">{dataBR(d.data)}</span><div className="rel-barra"><span style={{ width: `${(d.total / maxDia) * 100}%` }} /></div></td>
                  <td>{d.pedidos}</td><td>{gbp(d.cartao)}</td><td>{gbp(d.dinheiro)}</td><td>{d.naConta ? gbp(d.naConta) : "—"}</td><td><strong>{gbp(d.total)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Semana</td><td>{t.pedidos}</td><td>{gbp(t.cartao)}</td><td>{gbp(t.dinheiro)}</td><td>{t.naConta ? gbp(t.naConta) : "—"}</td><td>{gbp(t.vendas)}</td></tr>
            </tfoot>
          </table>
        </div>
        <p className="sq-sub">
          {t.naConta ? `"Na conta" (${gbp(t.naConta)}) ainda não entrou: só conta quando o cliente pagar. ` : ""}
          {rel.recebidoContas ? `Recebido de clientes a pagar nesta semana: ${gbp(rel.recebidoContas)}. ` : ""}
          Taxas de entrega incluídas: {gbp(t.taxas)}.
        </p>
      </section>

      <section className="sq-cartao">
        <strong>Lançar gasto</strong>
        <div className="rel-form">
          <label className="sq-campo">Valor (£)<input inputMode="decimal" placeholder="0.00" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>
          <label className="sq-campo">Categoria
            <input list="rel-cats" maxLength={40} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex.: Lidl" />
            <datalist id="rel-cats">{sugestoes.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="sq-campo">Data<input type="date" value={form.data} min={rel.inicio} max={rel.fim} onChange={(e) => setForm({ ...form, data: e.target.value })} /></label>
          <label className="sq-campo rel-desc">Onde / o quê (opcional)<input maxLength={120} placeholder="Ex.: Lidl · Shell da Kingston Rd" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></label>
          <button className="sq-btn sq-btn-primario" disabled={enviando || !form.valor} onClick={async () => {
            const data = form.data < rel.inicio || form.data > rel.fim ? rel.inicio : form.data;
            if (await enviar({ ...form, data }, "Gasto lançado.")) setForm({ ...form, valor: "", descricao: "" });
          }}>+ Lançar gasto</button>
        </div>

        {rel.gastos.length === 0 ? <p className="sq-sub">Nenhum gasto nesta semana.</p> : (
          <>
            <div className="rel-categorias">
              {porCategoria.map((x) => <span key={x.c} className="sq-pilula">{x.c}: <strong>{gbp(x.v)}</strong></span>)}
            </div>
            {porCategoria.map((grupo) => (
              <details key={grupo.c} className="rel-grupo" open>
                <summary><strong>{grupo.c}</strong><span className="sq-sub">{grupo.itens.length} lançamento{grupo.itens.length === 1 ? "" : "s"}</span><strong className="rel-vermelho">−{gbp(grupo.v)}</strong></summary>
                <ul className="rel-gastos">
                  {grupo.itens.map((g) => (
                    <li key={g.id}>
                      <span className="sq-sub">{dataBR(g.data)}</span>
                      <span>{g.descricao || "—"}</span>
                      <strong className="rel-vermelho">−{gbp(g.valor)}</strong>
                      <span className="rel-acoes">
                        <select aria-label="Mudar categoria" value="" onChange={(e) => {
                          let c = e.target.value;
                          if (c === "__nova") c = (window.prompt("Nome da categoria (ex.: Lidl):") || "").trim();
                          if (c && c !== g.categoria) enviar({ acao: "categoria", id: g.id, categoria: c }, `Movido para ${c}.`);
                        }}>
                          <option value="">Mover</option>
                          {sugestoes.filter((c) => c !== g.categoria).map((c) => <option key={c} value={c}>{c}</option>)}
                          <option value="__nova">+ Nova categoria...</option>
                        </select>
                        <button className="conta-x" aria-label="Apagar gasto" onClick={() => { if (window.confirm("Apagar este gasto?")) enviar({ acao: "apagar", id: g.id }, "Gasto apagado."); }}>×</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

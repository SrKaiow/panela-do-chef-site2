"use client";

import { useEffect, useState } from "react";
import type { LinhaPedido } from "@/lib/cardapio";

/**
 * Aba Doces: só as sobremesas da ceia que saíram (feitas pela parceira).
 * Mostra o que foi vendido, quanto, e manda cada pedido direto no WhatsApp dela.
 */
type PedidoDoce = {
  numero: number; criadoEm: string; nome: string; status: string; pago: boolean; pagamento: string;
  agendadoPara: string | null; doces: LinhaPedido[]; valor: number;
};
type Dados = { pedidos: PedidoDoce[]; parceira: { nome: string; telefone: string }; enviados: Record<string, string> };
type Aviso = (a: { tipo: "ok" | "erro"; texto: string }) => void;

const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const diaEntrega = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/London" }) : "a combinar";

/** 07123 456789 -> 447123456789 (formato do wa.me) */
function wa(tel: string) {
  let n = tel.replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) n = "44" + n.slice(1);
  return n;
}
const linhaTexto = (l: LinhaPedido) => `${l.qtd}x ${l.nome}${l.detalhes.length ? ` (${l.detalhes.join(", ")})` : ""}`;

// Sem emoji: o WhatsApp no computador troca vários por "�" quando vêm pelo link.
function mensagem(p: PedidoDoce) {
  return [
    `*Novo pedido de doces · Panela do Chef*`,
    `Pedido #${p.numero}`,
    ``,
    ...p.doces.map(linhaTexto),
    ``,
    `Valor: *${gbp(p.valor)}* ${p.pago ? "- já pago no site" : "- pagamento pendente"}`,
    `Entrega: ${diaEntrega(p.agendadoPara)}`,
  ].join("\n");
}

/** Soma por produto + sabor/tamanho (o que a parceira tem que produzir). */
function somar(pedidos: PedidoDoce[]) {
  const m = new Map<string, { texto: string; qtd: number; valor: number }>();
  for (const p of pedidos) for (const l of p.doces) {
    const texto = l.nome + (l.detalhes.length ? ` (${l.detalhes.join(", ")})` : "");
    const a = m.get(texto) ?? { texto, qtd: 0, valor: 0 };
    a.qtd += l.qtd; a.valor += l.total;
    m.set(texto, a);
  }
  return [...m.values()].sort((a, b) => b.qtd - a.qtd);
}

export default function Doces({ avisar }: { avisar: Aviso }) {
  const [d, setD] = useState<Dados | null>(null);
  const [filtro, setFiltro] = useState<"enviar" | "todos">("enviar");
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [tel, setTel] = useState("");

  async function carregar() {
    try {
      const r = await fetch("/api/painel/doces", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro);
      setD(j);
    } catch (e) {
      avisar({ tipo: "erro", texto: e instanceof Error ? e.message : "Não consegui carregar os doces." });
    }
  }
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviarApi(corpo: unknown) {
    const r = await fetch("/api/painel/doces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro);
    setD(j);
  }

  async function salvarParceira() {
    try {
      await enviarApi({ parceira: { nome, telefone: tel } });
      setEditando(false);
      avisar({ tipo: "ok", texto: "WhatsApp da parceira salvo." });
    } catch (e) {
      avisar({ tipo: "erro", texto: e instanceof Error ? e.message : "Não consegui salvar." });
    }
  }

  function mandar(p: PedidoDoce) {
    if (!d?.parceira.telefone) { setEditando(true); avisar({ tipo: "erro", texto: "Coloque primeiro o WhatsApp da parceira." }); return; }
    window.open(`https://wa.me/${wa(d.parceira.telefone)}?text=${encodeURIComponent(mensagem(p))}`, "_blank", "noopener");
    enviarApi({ enviado: p.numero, sim: true }).catch(() => {});
  }
  function mandarLista() {
    if (!d?.parceira.telefone) { setEditando(true); return; }
    const t = [
      `*Lista de doces · Panela do Chef*`,
      `(todos os pedidos até ${quando(new Date().toISOString())})`,
      ``,
      ...somar(d.pedidos).map((s) => `${s.qtd}x ${s.texto}`),
      ``,
      `Total: *${gbp(d.pedidos.reduce((s, p) => s + p.valor, 0))}* em ${d.pedidos.length} pedido(s)`,
    ].join("\n");
    window.open(`https://wa.me/${wa(d.parceira.telefone)}?text=${encodeURIComponent(t)}`, "_blank", "noopener");
  }

  if (!d) return <div className="sq-pagina"><p className="sq-carregando">Carregando...</p></div>;

  const aEnviar = d.pedidos.filter((p) => !d.enviados[p.numero]);
  const lista = filtro === "enviar" ? aEnviar : d.pedidos;
  const total = d.pedidos.reduce((s, p) => s + p.valor, 0);
  const qtdDoces = d.pedidos.reduce((s, p) => s + p.doces.reduce((x, l) => x + l.qtd, 0), 0);
  const resumo = somar(d.pedidos);
  const semNumero = !d.parceira.telefone;

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Doces 🍰</h1>
          <p className="sq-sub">Só as sobremesas da Ceia de Natal que saíram (feitas pela parceira). Cada pedido pago aparece aqui sozinho; toque no botão para mandar direto no WhatsApp dela.</p>
        </div>
        {d.pedidos.length > 0 && <button className="sq-btn" onClick={mandarLista}>📋 Mandar lista total para ela</button>}
      </div>

      <section className="sq-cartao">
        {semNumero || editando ? (
          <>
            <h2>WhatsApp da parceira dos doces</h2>
            <div className="sq-linha2">
              <label className="sq-campo">Nome<input value={nome} placeholder={d.parceira.nome} onChange={(e) => setNome(e.target.value)} /></label>
              <label className="sq-campo">WhatsApp<input inputMode="tel" value={tel} placeholder="07xxx xxxxxx" onChange={(e) => setTel(e.target.value)} /></label>
            </div>
            <span style={{ display: "flex", gap: 8 }}>
              <button className="sq-btn sq-btn-primario" disabled={!tel} onClick={salvarParceira}>Salvar</button>
              {!semNumero && <button className="sq-btn" onClick={() => setEditando(false)}>Cancelar</button>}
            </span>
          </>
        ) : (
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span>Os pedidos vão para <strong>{d.parceira.nome}</strong> · {d.parceira.telefone}</span>
            <button className="sq-btn" onClick={() => { setNome(d.parceira.nome); setTel(d.parceira.telefone); setEditando(true); }}>Trocar número</button>
          </span>
        )}
      </section>

      <section className="sq-metricas" aria-label="Resumo">
        <div className="sq-cartao"><span className="sq-rotulo">Pedidos com doce</span><strong className="num">{d.pedidos.length}</strong><span className="sq-sub">{qtdDoces} doce(s) no total</span></div>
        <div className="sq-cartao"><span className="sq-rotulo">Vendido em doces</span><strong className="num">{gbp(total)}</strong><span className="sq-sub">valor de venda no site</span></div>
        <div className="sq-cartao"><span className="sq-rotulo">Falta mandar para ela</span><strong className={"num" + (aEnviar.length ? " doces-alerta" : "")}>{aEnviar.length}</strong><span className="sq-sub">{aEnviar.length ? "toque em \"Mandar no WhatsApp\"" : "tudo enviado"}</span></div>
      </section>

      {resumo.length > 0 && (
        <section className="sq-cartao">
          <h2>O que saiu (para produzir)</h2>
          <div className="sq-tabela-caixa">
            <table className="sq-tabela">
              <thead><tr><th>Doce</th><th className="direita">Qtd</th><th className="direita">Valor</th></tr></thead>
              <tbody>
                {resumo.map((s) => (
                  <tr key={s.texto}><td>{s.texto}</td><td className="direita num">{s.qtd}</td><td className="direita num">{gbp(s.valor)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="sq-segmentos" role="group" aria-label="Filtro">
        <button className={"sq-btn" + (filtro === "enviar" ? " sq-btn-ativo" : "")} aria-pressed={filtro === "enviar"} onClick={() => setFiltro("enviar")}>A mandar ({aEnviar.length})</button>
        <button className={"sq-btn" + (filtro === "todos" ? " sq-btn-ativo" : "")} aria-pressed={filtro === "todos"} onClick={() => setFiltro("todos")}>Todos ({d.pedidos.length})</button>
      </div>

      {lista.length === 0 && (
        <p className="sq-vazio">{d.pedidos.length ? "Tudo já foi mandado para a parceira." : "Ainda não saiu nenhum doce. Quando um cliente pedir sobremesa na Ceia, aparece aqui."}</p>
      )}

      <div className="doces-lista">
        {lista.map((p) => {
          const enviadoEm = d.enviados[p.numero];
          return (
            <article key={p.numero} className={"sq-cartao doces-pedido" + (enviadoEm ? " enviado" : "")}>
              <header>
                <div>
                  <h2>Pedido #{p.numero} · {p.nome}</h2>
                  <span className="sq-sub">Feito em {quando(p.criadoEm)} · entrega {diaEntrega(p.agendadoPara)}</span>
                </div>
                <span className={"doces-selo " + (p.pago ? "pago" : "pendente")}>{p.pago ? "Pago" : "Pagamento pendente"}</span>
              </header>
              <ul className="sq-lista">
                {p.doces.map((l, i) => (
                  <li key={i}><span>{linhaTexto(l)}</span><span className="num">{gbp(l.total)}</span></li>
                ))}
                <li><strong>Total dos doces</strong><strong className="num">{gbp(p.valor)}</strong></li>
              </ul>
              <footer>
                {enviadoEm ? (
                  <>
                    <span className="doces-ok">✓ Mandado para {d.parceira.nome.split(" ")[0]} em {quando(enviadoEm)}</span>
                    <button className="sq-btn" onClick={() => mandar(p)}>Mandar de novo</button>
                    <button className="sq-link" onClick={() => enviarApi({ enviado: p.numero, sim: false })}>Desmarcar</button>
                  </>
                ) : (
                  <button className="sq-btn doces-wa" onClick={() => mandar(p)}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 000-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.1 5.1 0 001.1 2.7 11.7 11.7 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.2-1.2c-.1-.1-.3-.2-.5-.3z" /></svg>
                    Mandar no WhatsApp para {d.parceira.nome.split(" ")[0]}
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

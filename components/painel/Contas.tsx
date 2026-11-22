"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Conta, Lancamento } from "@/lib/db";
import { linkWhatsapp } from "@/lib/whatsapp";

/**
 * Clientes a pagar: fiado e clientes semanais.
 * Anota cada pedido que ficou para pagar depois e cada pagamento recebido; o saldo é calculado sozinho.
 */
const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const hoje = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const dataBR = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
type Aviso = (a: { tipo: "ok" | "erro"; texto: string }) => void;
type Filtro = "devendo" | "semanais" | "todos";

/** Compras ainda em aberto: as mais recentes até somar o saldo devido. */
function emAberto(c: Conta): Lancamento[] {
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

function mensagemCobranca(c: Conta) {
  const nome = c.nome.trim().split(/\s+/)[0];
  const abertos = emAberto(c);
  const itens = abertos.map((l) => `• ${dataBR(l.data)} ${l.descricao || "Pedido"}: ${gbp(l.valor)}`);
  // Se já pagou uma parte desses pedidos, mostra o que já foi recebido para a conta fechar.
  const parte = abertos.reduce((s, l) => s + l.valor, 0) - c.saldo;
  if (parte > 0) itens.push(`• Já recebido: -${gbp(parte)}`);
  return `Oi, ${nome}! Aqui é da *Panela do Chef*.\n\nSegue o resumo da sua conta:\n${itens.join("\n")}\n\n*Total em aberto: ${gbp(c.saldo)}*\n\nPode acertar por transferência ou em dinheiro. Obrigado pela preferência!`;
}

export default function Contas({ avisar }: { avisar: Aviso }) {
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("devendo");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Partial<Conta> | null>(null);
  const [lancando, setLancando] = useState<{ contaId: number; tipo: "compra" | "pagamento"; valor: string; descricao: string; data: string } | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/painel/contas", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro);
      setContas(d.contas);
    } catch (e: any) {
      avisar({ tipo: "erro", texto: e.message || "Não consegui carregar." });
    }
  }, [avisar]);
  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(dados: object, ok: string) {
    setEnviando(true);
    try {
      const r = await fetch("/api/painel/contas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "Não consegui salvar.");
      setContas(d.contas);
      avisar({ tipo: "ok", texto: ok });
      return true;
    } catch (e: any) {
      avisar({ tipo: "erro", texto: e.message });
      return false;
    } finally {
      setEnviando(false);
    }
  }

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (contas ?? [])
      .filter((c) => (filtro === "devendo" ? c.saldo > 0 : filtro === "semanais" ? c.semanal : true))
      .filter((c) => !q || c.nome.toLowerCase().includes(q) || c.telefone.replace(/\s/g, "").includes(q.replace(/\s/g, "")))
      .sort((a, b) => b.saldo - a.saldo || a.nome.localeCompare(b.nome));
  }, [contas, filtro, busca]);

  const total = (contas ?? []).reduce((s, c) => s + Math.max(0, c.saldo), 0);
  const devendo = (contas ?? []).filter((c) => c.saldo > 0).length;
  const semanais = (contas ?? []).filter((c) => c.semanal).length;

  return (
    <div className="sq-pagina">
      <div className="sq-cabeca">
        <div>
          <h1>Clientes a pagar</h1>
          <p className="sq-sub">Fiado e clientes semanais: anote o que pediram para pagar depois e o que já pagaram. O saldo é calculado sozinho.</p>
        </div>
        <div className="sq-acoes-cabeca">
          <button className="sq-btn sq-btn-primario" onClick={() => setEditando({ nome: "", telefone: "", obs: "", semanal: true })}>+ Novo cliente</button>
        </div>
      </div>

      <section className="sq-metricas">
        <div className="sq-cartao"><span className="sq-rotulo">Total a receber</span><strong className="num conta-devendo">{gbp(total)}</strong></div>
        <div className="sq-cartao"><span className="sq-rotulo">Clientes devendo</span><strong className="num">{devendo}</strong></div>
        <div className="sq-cartao"><span className="sq-rotulo">Clientes semanais</span><strong className="num">{semanais}</strong></div>
      </section>

      {editando && (
        <section className="sq-cartao">
          <strong>{editando.id ? "Editar cliente" : "Novo cliente"}</strong>
          <div className="sq-linha2">
            <label className="sq-campo">Nome<input autoFocus maxLength={80} value={editando.nome ?? ""} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} /></label>
            <label className="sq-campo">WhatsApp / telefone<input inputMode="tel" maxLength={30} placeholder="07..." value={editando.telefone ?? ""} onChange={(e) => setEditando({ ...editando, telefone: e.target.value })} /></label>
          </div>
          <label className="sq-campo">Observação (só você vê)<input maxLength={200} placeholder="Ex.: paga toda sexta · marmita sem cebola" value={editando.obs ?? ""} onChange={(e) => setEditando({ ...editando, obs: e.target.value })} /></label>
          <label className="conta-check"><input type="checkbox" checked={!!editando.semanal} onChange={(e) => setEditando({ ...editando, semanal: e.target.checked })} /> Cliente semanal (acerta no fim da semana)</label>
          <div className="sq-filtros">
            <button className="sq-btn sq-btn-primario" disabled={enviando} onClick={async () => { if (await enviar({ acao: "salvar", ...editando }, "Cliente salvo.")) setEditando(null); }}>Salvar</button>
            <button className="sq-btn" onClick={() => setEditando(null)}>Cancelar</button>
            {editando.id && (
              <button className="sq-btn sq-btn-perigo" onClick={async () => {
                const c = contas?.find((x) => x.id === editando.id);
                if (c && c.saldo > 0 && !window.confirm(`${c.nome} ainda deve ${gbp(c.saldo)}. Remover mesmo assim?`)) return;
                if (await enviar({ acao: "arquivar", id: editando.id }, "Cliente removido da lista.")) setEditando(null);
              }}>Remover cliente</button>
            )}
          </div>
        </section>
      )}

      <div className="sq-filtros">
        <div className="sq-segmentos" role="group" aria-label="Filtro">
          {([["devendo", "Devendo"], ["semanais", "Semanais"], ["todos", "Todos"]] as [Filtro, string][]).map(([id, nome]) => (
            <button key={id} className={"sq-btn" + (filtro === id ? " sq-btn-ativo" : "")} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{nome}</button>
          ))}
        </div>
        <label className="sq-busca"><span aria-hidden="true">⌕</span><input placeholder="Buscar por nome ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
      </div>

      {!contas ? <p className="sq-carregando">Carregando...</p> : !lista.length ? (
        <p className="sq-vazio">{contas.length ? "Ninguém nesta lista." : "Nenhum cliente ainda. Toque em \"+ Novo cliente\" para começar."}</p>
      ) : (
        <div className="sq-clientes">
          {lista.map((c) => {
            const abertoAgora = lancando?.contaId === c.id;
            return (
              <article key={c.id} className={"sq-cartao conta" + (c.saldo > 0 ? " deve" : "")}>
                <div className="conta-topo">
                  <div>
                    <strong className="conta-nome">{c.nome}</strong> {c.semanal && <span className="sq-pilula conta-semanal">SEMANAL</span>}
                    <div className="sq-sub">{c.telefone || "sem telefone"}{c.ultimo ? ` · último lançamento ${dataBR(c.ultimo)}` : ""}</div>
                    {c.obs && <div className="sq-sub">{c.obs}</div>}
                  </div>
                  <div className="conta-saldo">
                    <span className="sq-rotulo">{c.saldo > 0 ? "Deve" : c.saldo < 0 ? "Crédito" : "Em dia"}</span>
                    <strong className={"num " + (c.saldo > 0 ? "conta-devendo" : "conta-ok")}>{gbp(Math.abs(c.saldo))}</strong>
                  </div>
                </div>

                {abertoAgora ? (
                  <div className="conta-form">
                    <strong>{lancando!.tipo === "compra" ? "Pedido para pagar depois" : "Pagamento recebido"}</strong>
                    <div className="sq-linha2">
                      <label className="sq-campo">Valor (£)<input autoFocus inputMode="decimal" placeholder="0.00" value={lancando!.valor} onChange={(e) => setLancando({ ...lancando!, valor: e.target.value })} /></label>
                      <label className="sq-campo">Data<input type="date" value={lancando!.data} onChange={(e) => setLancando({ ...lancando!, data: e.target.value })} /></label>
                    </div>
                    <label className="sq-campo">{lancando!.tipo === "compra" ? "O que pediu" : "Como pagou (opcional)"}
                      <input maxLength={160} placeholder={lancando!.tipo === "compra" ? "Ex.: 2 marmitas + 1 açaí 500ml" : "Ex.: transferência · dinheiro"} value={lancando!.descricao} onChange={(e) => setLancando({ ...lancando!, descricao: e.target.value })} />
                    </label>
                    {lancando!.tipo === "pagamento" && c.saldo > 0 && (
                      <button className="sq-btn" onClick={() => setLancando({ ...lancando!, valor: (c.saldo / 100).toFixed(2) })}>Pagou tudo ({gbp(c.saldo)})</button>
                    )}
                    <div className="sq-filtros">
                      <button className="sq-btn sq-btn-primario" disabled={enviando} onClick={async () => {
                        if (await enviar({ acao: "lancar", ...lancando }, lancando!.tipo === "compra" ? "Pedido anotado na conta." : "Pagamento registrado.")) setLancando(null);
                      }}>Salvar</button>
                      <button className="sq-btn" onClick={() => setLancando(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="sq-filtros">
                    <button className="sq-btn sq-btn-primario" onClick={() => setLancando({ contaId: c.id, tipo: "compra", valor: "", descricao: "", data: hoje() })}>+ Pedido</button>
                    <button className="sq-btn" onClick={() => setLancando({ contaId: c.id, tipo: "pagamento", valor: "", descricao: "", data: hoje() })}>Recebi pagamento</button>
                    {c.saldo > 0 && c.telefone && (
                      <a className="sq-btn btn-zap" href={linkWhatsapp(c.telefone, mensagemCobranca(c))} target="_blank" rel="noreferrer">Cobrar no WhatsApp</a>
                    )}
                  </div>
                )}

                <div className="sq-filtros">
                  <button className="sq-link" onClick={() => setAberta(aberta === c.id ? null : c.id)}>{aberta === c.id ? "Esconder histórico" : `Histórico (${c.lancamentos.length})`}</button>
                  <button className="sq-link" onClick={() => setEditando(c)}>Editar</button>
                </div>
                {aberta === c.id && (
                  <ul className="conta-historico">
                    {c.lancamentos.length === 0 && <li className="sq-sub">Nada lançado ainda.</li>}
                    {c.lancamentos.map((l) => (
                      <li key={l.id}>
                        <span className="sq-sub">{dataBR(l.data)}</span>
                        <span>{l.descricao || (l.tipo === "compra" ? "Pedido" : "Pagamento")}</span>
                        <strong className={l.tipo === "compra" ? "conta-devendo" : "conta-ok"}>{l.tipo === "compra" ? "+" : "−"}{gbp(l.valor)}</strong>
                        {l.tipo === "compra" && (
                          l.freteRemovido ? (
                            <button className="conta-frete feito" title="Desfazer" onClick={() => enviar({ acao: "devolver-frete", id: l.id }, "Frete voltou para a conta.")}>🚚 frete {gbp(l.freteRemovido)} tirado · desfazer</button>
                          ) : (
                            <button className="conta-frete" onClick={() => {
                              if (l.pedido && l.taxaPedido > 0) {
                                if (window.confirm(`Tirar o frete de ${gbp(l.taxaPedido)} deste pedido?`)) enviar({ acao: "tirar-frete", id: l.id }, `Frete de ${gbp(l.taxaPedido)} tirado.`);
                              } else {
                                const v = window.prompt("Quanto de frete tirar? (£)", "");
                                if (v && Number(v.replace(",", ".")) > 0) enviar({ acao: "tirar-frete", id: l.id, valor: v }, `Frete de £${Number(v.replace(",", ".")).toFixed(2)} tirado.`);
                              }
                            }}>🚚 Tirar frete{l.pedido && l.taxaPedido > 0 ? ` (${gbp(l.taxaPedido)})` : ""}</button>
                          )
                        )}
                        <button className="conta-x" aria-label="Apagar lançamento" onClick={() => { if (window.confirm("Apagar este lançamento?")) enviar({ acao: "apagar-lancamento", id: l.id }, "Lançamento apagado."); }}>×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Avaliacao, Pedido, Status } from "@/lib/db";

const NOMES: Record<Status, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  novo: "Novo",
  confirmado: "Confirmado",
  preparando: "Preparando",
  saiu: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const PROXIMO: Partial<Record<Status, { status: Status; rotulo: string }>> = {
  novo: { status: "confirmado", rotulo: "Confirmar pedido" },
  confirmado: { status: "preparando", rotulo: "Começar a preparar" },
  preparando: { status: "saiu", rotulo: "Saiu para entrega" },
  saiu: { status: "entregue", rotulo: "Marcar entregue" },
};
const ABAS = [
  { id: "ativos", nome: "Ativos", status: ["novo", "confirmado", "preparando", "saiu"] as Status[] },
  { id: "pagamento", nome: "Aguardando cartão", status: ["aguardando_pagamento"] as Status[] },
  { id: "finalizados", nome: "Finalizados", status: ["entregue", "cancelado"] as Status[] },
];

const gbp = (p: number) => "£" + (p / 100).toFixed(2);
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "Europe/London" });

/** 07123 456789 -> 447123456789 (formato do wa.me) */
function whatsapp(tel: string) {
  let n = tel.replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0")) n = "44" + n.slice(1);
  return n;
}

const linkRastreio = (p: Pedido) => `${window.location.origin}/pedido/${p.token}`;
const msgSaiu = (p: Pedido) => `Oi ${p.nome.split(" ")[0]}! Aqui é da Panela do Chef. Seu pedido saiu para entrega. Acompanhe o entregador ao vivo: ${linkRastreio(p)}`;

function bip() {
  try {
    const ctx = new AudioContext();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch {}
}

export default function Painel() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aba, setAba] = useState("ativos");
  const [erro, setErro] = useState("");
  const [som, setSom] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const vistos = useRef<Set<number> | null>(null);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);

  const carregarAvaliacoes = useCallback(async () => {
    try {
      const r = await fetch("/api/painel/avaliacoes", { cache: "no-store" });
      if (r.ok) setAvaliacoes((await r.json()).avaliacoes);
    } catch {}
  }, []);
  useEffect(() => { carregarAvaliacoes(); const t = setInterval(carregarAvaliacoes, 60000); return () => clearInterval(t); }, [carregarAvaliacoes]);

  async function moderar(id: number, status: Avaliacao["status"]) {
    setAvaliacoes((as) => as.map((a) => (a.id === id ? { ...a, status } : a)));
    const r = await fetch(`/api/painel/avaliacoes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!r.ok) setErro("Não consegui salvar a avaliação.");
  }
  const pendentes = avaliacoes.filter((a) => a.status === "pendente").length;

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/painel/pedidos", { cache: "no-store" });
      if (r.status === 401) { window.location.href = "/painel/entrar"; return; }
      const d = await r.json();
      const lista: Pedido[] = d.pedidos;
      const novos = lista.filter((p) => p.status === "novo").map((p) => p.numero);
      if (vistos.current && novos.some((n) => !vistos.current!.has(n)) && som) bip();
      vistos.current = new Set(novos);
      setPedidos(lista);
      setErro("");
    } catch {
      setErro("Sem conexão. Tentando de novo...");
    } finally {
      setCarregado(true);
    }
  }, [som]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 15000);
    return () => clearInterval(t);
  }, [carregar]);

  const qtdNovos = pedidos.filter((p) => p.status === "novo").length;
  useEffect(() => { document.title = qtdNovos ? `(${qtdNovos}) Pedidos novos` : "Pedidos | Painel"; }, [qtdNovos]);

  async function atualizar(numero: number, dados: { status?: Status; pago?: boolean; avisoManual?: "saiu" | "chegando" }) {
    setPedidos((ps) => ps.map((p) => (p.numero === numero ? { ...p, ...dados } : p)));
    const r = await fetch(`/api/painel/pedidos/${numero}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
    if (!r.ok) setErro("Não consegui salvar a mudança. Confira a conexão.");
    carregar();
  }

  const abaAtual = ABAS.find((a) => a.id === aba);
  const visiveis = abaAtual ? pedidos.filter((p) => abaAtual.status.includes(p.status)) : [];
  // Hoje (para o resumo)
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "Europe/London" });
  const deHoje = pedidos.filter((p) => new Date(p.criadoEm).toLocaleDateString("pt-BR", { timeZone: "Europe/London" }) === hoje && p.status !== "cancelado" && p.status !== "aguardando_pagamento");
  const totalHoje = deHoje.reduce((s, p) => s + p.total, 0);
  const dinheiroHoje = deHoje.filter((p) => p.pagamento === "dinheiro").reduce((s, p) => s + p.total, 0);

  return (
    <div className="painel">
      <header className="painel-topo">
        <div className="painel-miolo painel-linha">
          <strong className="painel-marca">Pedidos</strong>
          <div className="painel-acoes">
            <button className={"btn" + (som ? " ativo" : "")} onClick={() => { setSom(!som); if (!som) bip(); }}>
              {som ? "Som ligado" : "Ligar som de pedido novo"}
            </button>
            <form method="post" action="/api/sair"><input type="hidden" name="area" value="painel" /><button className="btn">Sair</button></form>
          </div>
        </div>
      </header>

      <main className="painel-miolo" style={{ display: "grid", gap: 16, paddingBlock: 18 }}>
        <section className="resumo" aria-label="Resumo de hoje">
          <div><span>Pedidos hoje</span><strong className="num">{deHoje.length}</strong></div>
          <div><span>Vendido hoje</span><strong className="num">{gbp(totalHoje)}</strong></div>
          <div><span>Em dinheiro</span><strong className="num">{gbp(dinheiroHoje)}</strong></div>
          <div><span>Novos agora</span><strong className={"num" + (qtdNovos ? " alerta" : "")}>{qtdNovos}</strong></div>
        </section>

        <nav className="painel-abas" aria-label="Filtro">
          {ABAS.map((a) => {
            const n = pedidos.filter((p) => a.status.includes(p.status)).length;
            return (
              <button key={a.id} aria-pressed={aba === a.id} onClick={() => setAba(a.id)}>
                {a.nome} <span className="num">{n}</span>
              </button>
            );
          })}
          <button aria-pressed={aba === "avaliacoes"} onClick={() => setAba("avaliacoes")}>
            Avaliações <span className="num">{pendentes ? `${pendentes} nova${pendentes > 1 ? "s" : ""}` : avaliacoes.length}</span>
          </button>
        </nav>

        {erro && <p className="erro" role="alert">{erro}</p>}
        {aba === "avaliacoes" && (
          <div className="cartoes">
            {avaliacoes.length === 0 && <p className="vazio">Ainda não chegou nenhuma avaliação pelo site.</p>}
            {[...avaliacoes].sort((a, b) => Number(b.status === "pendente") - Number(a.status === "pendente")).map((a) => (
              <article key={a.id} className={"pedido av-" + a.status}>
                <header>
                  <div>
                    <h2>{"★".repeat(a.nota)}<span style={{ opacity: 0.25 }}>{"★".repeat(5 - a.nota)}</span> · {a.nome}</h2>
                    <span className="sub">{a.local ? a.local + " · " : ""}{dia(a.criadoEm)} às {hora(a.criadoEm)}{a.pedidoNumero ? ` · pedido #${a.pedidoNumero}` : ""}</span>
                  </div>
                  <span className={"selo " + (a.status === "aprovada" ? "st-entregue" : a.status === "pendente" ? "st-novo" : "")}>
                    {a.status === "aprovada" ? "No site" : a.status === "pendente" ? "Esperando você" : "Escondida"}
                  </span>
                </header>
                <p style={{ margin: 0 }}>{a.texto}</p>
                <footer>
                  {a.status !== "aprovada" && <button className="btn principal-p" onClick={() => moderar(a.id, "aprovada")}>Aprovar e mostrar no site</button>}
                  {a.status !== "oculta" && <button className="btn" onClick={() => moderar(a.id, "oculta")}>{a.status === "aprovada" ? "Tirar do site" : "Não mostrar"}</button>}
                </footer>
              </article>
            ))}
          </div>
        )}

        {aba !== "avaliacoes" && carregado && visiveis.length === 0 && (
          <p className="vazio">{aba === "ativos" ? "Nenhum pedido em andamento. Quando chegar um, ele aparece aqui sozinho." : "Nada por aqui."}</p>
        )}

        <div className="cartoes">
          {visiveis.map((p) => (
            <article key={p.numero} className={`pedido st-${p.status}`}>
              <header>
                <div>
                  <h2>#{p.numero} · {p.nome}</h2>
                  <span className="sub">{dia(p.criadoEm)} às {hora(p.criadoEm)}</span>
                </div>
                <span className={`selo st-${p.status}`}>{NOMES[p.status]}</span>
              </header>

              <ul className="itens">
                {p.itens.map((l, i) => (
                  <li key={i}>
                    <strong>{l.qtd}×</strong> {l.nome}
                    {l.detalhes.map((d) => <div className="sub" key={d}>{d}</div>)}
                    {l.obs && <div className="obs">Obs.: {l.obs}</div>}
                  </li>
                ))}
              </ul>

              <div className={"pag " + p.pagamento}>
                {p.pagamento === "dinheiro" ? (
                  <>
                    <strong>DINHEIRO · cobrar {gbp(p.total)}</strong>
                    {p.trocoPara ? <span>Troco para {gbp(p.trocoPara)} → levar {gbp(p.trocoPara - p.total)}</span> : <span>Sem troco</span>}
                  </>
                ) : (
                  <>
                    <strong>CARTÃO · {gbp(p.total)}</strong>
                    <span>{p.pago ? "Pago online" : "Ainda não pago"}</span>
                  </>
                )}
              </div>

              <div className="entrega">
                <div>{p.endereco}, <strong>{p.postcode}</strong></div>
                {p.observacao && <div className="obs">{p.observacao}</div>}
                <div className="links">
                  <a href={`https://wa.me/${whatsapp(p.telefone)}`} target="_blank" rel="noreferrer">WhatsApp {p.telefone}</a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.endereco + ", " + p.postcode)}`} target="_blank" rel="noreferrer">Abrir no mapa</a>
                </div>
              </div>

              <footer>
                {PROXIMO[p.status] && (
                  <button className="btn principal-p" onClick={() => atualizar(p.numero, { status: PROXIMO[p.status]!.status })}>
                    {PROXIMO[p.status]!.rotulo}
                  </button>
                )}
                {p.status === "saiu" && !p.avisadoSaiu && (
                  <a className="btn" href={`https://wa.me/${whatsapp(p.telefone)}?text=${encodeURIComponent(msgSaiu(p))}`} target="_blank" rel="noreferrer" onClick={() => atualizar(p.numero, { avisoManual: "saiu" })}>
                    Mandar link do rastreio
                  </a>
                )}
                {p.status !== "aguardando_pagamento" && p.status !== "cancelado" && (
                  <a className="btn" href={`/pedido/${p.token}`} target="_blank" rel="noreferrer">Ver rastreio</a>
                )}
                {p.pagamento === "dinheiro" && p.status === "entregue" && (
                  <button className="btn" onClick={() => atualizar(p.numero, { pago: !p.pago })}>{p.pago ? "Dinheiro recebido ✓" : "Marcar dinheiro recebido"}</button>
                )}
                {p.status !== "cancelado" && p.status !== "entregue" && (
                  <CancelarBotao onConfirmar={() => atualizar(p.numero, { status: "cancelado" })} />
                )}
                {p.status === "cancelado" && <button className="btn" onClick={() => atualizar(p.numero, { status: "novo" })}>Reabrir</button>}
              </footer>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

function CancelarBotao({ onConfirmar }: { onConfirmar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) return <button className="btn perigo" onClick={() => setConfirmando(true)}>Cancelar</button>;
  return (
    <>
      <button className="btn perigo cheio" onClick={onConfirmar}>Confirmar cancelamento</button>
      <button className="btn" onClick={() => setConfirmando(false)}>Voltar</button>
    </>
  );
}

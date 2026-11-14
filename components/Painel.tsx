"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Avaliacao, Pedido, Status } from "@/lib/db";
import { rotuloAgendado } from "@/lib/horario";

const NOMES: Record<Status, string> = {
  aguardando_pagamento: "Aguardando pagamento",
  novo: "Novo",
  confirmado: "Pedido aceito",
  preparando: "Na cozinha",
  saiu: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
const PROXIMO: Partial<Record<Status, { status: Status; rotulo: string }>> = {
  novo: { status: "confirmado", rotulo: "Aceitar pedido" },
  confirmado: { status: "preparando", rotulo: "Começar na cozinha" },
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

/** Mensagem pronta de WhatsApp para cada etapa (o cliente também vê tudo ao vivo na página do pedido). */
function msgEtapa(p: Pedido): { rotulo: string; texto: string } | null {
  const nome = p.nome.split(" ")[0];
  const link = linkRastreio(p);
  switch (p.status) {
    case "confirmado":
      return { rotulo: "Avisar: pedido aceito", texto: `Oi ${nome}! Aqui é da Panela do Chef 🇧🇷 Recebemos e aceitamos o seu pedido #${p.numero} ✅ Acompanhe tudo ao vivo por aqui: ${link}` };
    case "preparando":
      return { rotulo: "Avisar: na cozinha", texto: `Oi ${nome}! A cozinha começou o seu pedido #${p.numero} agora 🍳🔥 Assim que sair para entrega te aviso. Acompanhe: ${link}` };
    case "saiu":
      return { rotulo: "Avisar: saiu para entrega", texto: msgSaiu(p) };
    case "entregue":
      return { rotulo: "Agradecer e pedir avaliação", texto: `Oi ${nome}! Seu pedido #${p.numero} foi entregue. Obrigado por pedir na Panela do Chef 💛 Se puder, conta pra gente como estava (pode mandar foto!): ${link}` };
    default:
      return null;
  }
}

/* ---------- Alarme de pedido novo ---------- */
let audio: AudioContext | null = null;
function contextoAudio() {
  try {
    if (!audio) audio = new AudioContext();
    if (audio.state === "suspended") audio.resume().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}
/** Toque forte de 3 notas subindo (parecido com tablet de delivery). */
function alarme() {
  const ctx = contextoAudio();
  if (!ctx) return;
  const notas = [880, 1175, 1568];
  for (let rep = 0; rep < 2; rep++) {
    notas.forEach((f, i) => {
      const t = ctx.currentTime + rep * 0.75 + i * 0.16;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = f;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.start(t);
      o.stop(t + 0.16);
    });
  }
}
const bip = alarme;

const CHAVE_IMPRESSOS = "panela-impressos";
function lerImpressos(): number[] {
  try { return JSON.parse(localStorage.getItem(CHAVE_IMPRESSOS) || "[]"); } catch { return []; }
}
function guardarImpressos(ns: number[]) {
  try { localStorage.setItem(CHAVE_IMPRESSOS, JSON.stringify([...new Set(ns)].slice(-300))); } catch {}
}
/** Abre o recibo num quadro escondido e manda imprimir (sai na impressora padrão do computador). */
function imprimir(numero: number) {
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:80mm;height:10px;border:0;opacity:0;pointer-events:none";
  f.src = `/painel/imprimir/${numero}?auto=1`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 120_000);
}

export default function Painel({ secao, onNovos }: { secao: "pedidos" | "avaliacoes"; onNovos?: (n: number, avaliacoes: number, somPronto: boolean) => void }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [abaPedidos, setAba] = useState("ativos");
  const aba = secao === "avaliacoes" ? "avaliacoes" : abaPedidos;
  const [erro, setErro] = useState("");
  // Som fica ligado por padrão e lembra a escolha neste aparelho.
  const [som, setSomEstado] = useState(true);
  const [somPronto, setSomPronto] = useState(false);
  const [silencioAte, setSilencioAte] = useState(0);
  const setSom = (v: boolean) => { setSomEstado(v); try { localStorage.setItem("panela-som", v ? "1" : "0"); } catch {} };
  useEffect(() => {
    try { if (localStorage.getItem("panela-som") === "0") setSomEstado(false); } catch {}
    // O navegador só libera o som depois de um toque na tela: o primeiro toque em qualquer lugar já libera.
    const liberar = () => {
      const ctx = contextoAudio();
      if (ctx) ctx.resume().then(() => setSomPronto(ctx.state === "running")).catch(() => {});
    };
    const ctx = contextoAudio();
    if (ctx?.state === "running") setSomPronto(true);
    document.addEventListener("pointerdown", liberar);
    document.addEventListener("keydown", liberar);
    return () => { document.removeEventListener("pointerdown", liberar); document.removeEventListener("keydown", liberar); };
  }, []);
  // Impressora da cozinha: imprime sozinho cada pedido novo (lembra neste aparelho quais já saíram).
  const [autoImprimir, setAutoEstado] = useState(false);
  const autoRef = useRef(false);
  const setAuto = (v: boolean) => { setAutoEstado(v); autoRef.current = v; try { localStorage.setItem("panela-imprimir", v ? "1" : "0"); } catch {} };
  // Ligado por padrão neste aparelho; só fica desligado se alguém desligar no botão.
  useEffect(() => { let v = true; try { v = localStorage.getItem("panela-imprimir") !== "0"; } catch {} setAutoEstado(v); autoRef.current = v; }, []);
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
      const chegou = vistos.current ? lista.filter((p) => p.status === "novo" && !vistos.current!.has(p.numero)) : [];
      if (chegou.length) {
        if (som) bip();
        try { navigator.vibrate?.([400, 150, 400]); } catch {}
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            const p = chegou[0];
            new Notification(`🔔 Pedido novo #${p.numero} · ${gbp(p.total)}`, { body: `${p.nome} · ${p.itens.map((l) => `${l.qtd}× ${l.nome}`).join(", ").slice(0, 120)}`, tag: `pedido-${p.numero}`, requireInteraction: true });
          }
        } catch {}
      }
      vistos.current = new Set(novos);
      // Primeira vez neste aparelho: os pedidos que já existem não saem na impressora, só os que chegarem depois.
      let primeiraVez = false;
      try { primeiraVez = localStorage.getItem(CHAVE_IMPRESSOS) === null; } catch {}
      if (primeiraVez) guardarImpressos(lista.map((p) => p.numero));
      else if (autoRef.current) {
        const feitos = lerImpressos();
        // Só pedidos de agora (últimas 3 h) e que ainda não saíram na impressora.
        const fila = lista.filter((p) => p.status === "novo" && !feitos.includes(p.numero) && Date.now() - new Date(p.criadoEm).getTime() < 3 * 3600_000);
        if (fila.length) { guardarImpressos([...feitos, ...fila.map((p) => p.numero)]); fila.forEach((p, i) => setTimeout(() => imprimir(p.numero), i * 4000)); }
      }
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
    const t = setInterval(carregar, 8000);
    return () => clearInterval(t);
  }, [carregar]);

  const qtdNovos = pedidos.filter((p) => p.status === "novo").length;
  // Enquanto tiver pedido esperando "Aceitar", o alarme toca de novo a cada 6 segundos (até aceitar ou silenciar).
  useEffect(() => {
    if (!som || !qtdNovos) return;
    const t = setInterval(() => { if (Date.now() > silencioAte) alarme(); }, 6000);
    return () => clearInterval(t);
  }, [som, qtdNovos, silencioAte]);
  // Título da aba piscando quando tem pedido novo.
  useEffect(() => {
    if (!qtdNovos) return;
    let alt = false;
    const t = setInterval(() => { alt = !alt; document.title = alt ? `🔔 ${qtdNovos} PEDIDO${qtdNovos > 1 ? "S" : ""} NOVO${qtdNovos > 1 ? "S" : ""}!` : "Painel | Panela do Chef"; }, 1000);
    return () => clearInterval(t);
  }, [qtdNovos]);
  useEffect(() => { document.title = qtdNovos ? `(${qtdNovos}) Pedidos novos` : "Painel | Panela do Chef"; }, [qtdNovos]);
  useEffect(() => { onNovos?.(qtdNovos, pendentes, somPronto || !som); }, [qtdNovos, pendentes, somPronto, som, onNovos]);

  async function atualizar(numero: number, dados: { status?: Status; pago?: boolean; avisoManual?: "saiu" | "chegando" }) {
    setPedidos((ps) => ps.map((p) => (p.numero === numero ? { ...p, ...dados } : p)));
    const r = await fetch(`/api/painel/pedidos/${numero}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
    if (!r.ok) setErro("Não consegui salvar a mudança. Confira a conexão.");
    carregar();
  }

  const abaAtual = ABAS.find((a) => a.id === aba);
  // Ativos: os agendados entram na ordem do horário marcado.
  const chave = (p: Pedido) => new Date(p.agendadoPara ?? p.criadoEm).getTime();
  const visiveis = abaAtual
    ? pedidos.filter((p) => abaAtual.status.includes(p.status)).sort((a, b) => (aba === "ativos" ? chave(a) - chave(b) : 0))
    : [];
  // Hoje (para o resumo)
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "Europe/London" });
  const deHoje = pedidos.filter((p) => new Date(p.criadoEm).toLocaleDateString("pt-BR", { timeZone: "Europe/London" }) === hoje && p.status !== "cancelado" && p.status !== "aguardando_pagamento");
  const totalHoje = deHoje.reduce((s, p) => s + p.total, 0);
  const dinheiroHoje = deHoje.filter((p) => p.pagamento === "dinheiro").reduce((s, p) => s + p.total, 0);

  return (
    <div className="painel">
      <div className="sq-cabeca">
        <h1>{secao === "avaliacoes" ? "Avaliações" : "Pedidos"}</h1>
        {secao === "pedidos" && (
          <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
            {qtdNovos > 0 && som && Date.now() < silencioAte ? (
              <button className="sq-btn" onClick={() => setSilencioAte(0)}>🔕 Silenciado · religar</button>
            ) : qtdNovos > 0 && som ? (
              <button className="sq-btn" onClick={() => setSilencioAte(Date.now() + 5 * 60 * 1000)}>Silenciar 5 min</button>
            ) : null}
            <button className={"sq-btn" + (autoImprimir ? " sq-btn-ativo" : "")} onClick={() => {
              const v = !autoImprimir;
              // Ao ligar, os pedidos que já estão na tela não saem de novo: só os que chegarem daqui pra frente.
              if (v) guardarImpressos([...lerImpressos(), ...pedidos.map((p) => p.numero)]);
              setAuto(v);
            }} title="Cada pedido novo sai sozinho na impressora da cozinha">
              {autoImprimir ? "🖨 Imprimir sozinho: ligado" : "🖨 Imprimir sozinho: desligado"}
            </button>
            <button className={"sq-btn" + (som ? " sq-btn-ativo" : "")} onClick={() => { const v = !som; setSom(v); if (v) { contextoAudio(); bip(); try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch {} } }}>
              {som ? "🔔 Alarme ligado" : "🔕 Alarme desligado"}
            </button>
          </span>
        )}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {secao === "pedidos" && <section className="resumo" aria-label="Resumo de hoje">
          <div><span>Pedidos hoje</span><strong className="num">{deHoje.length}</strong></div>
          <div><span>Vendido hoje</span><strong className="num">{gbp(totalHoje)}</strong></div>
          <div><span>Em dinheiro</span><strong className="num">{gbp(dinheiroHoje)}</strong></div>
          <div><span>Novos agora</span><strong className={"num" + (qtdNovos ? " alerta" : "")}>{qtdNovos}</strong></div>
        </section>}

        {secao === "pedidos" && <nav className="painel-abas" aria-label="Filtro">
          {ABAS.map((a) => {
            const n = pedidos.filter((p) => a.status.includes(p.status)).length;
            return (
              <button key={a.id} aria-pressed={aba === a.id} onClick={() => setAba(a.id)}>
                {a.nome} <span className="num">{n}</span>
              </button>
            );
          })}
        </nav>}

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
                {a.foto && <a href={a.foto} target="_blank" rel="noreferrer"><img className="av-foto" src={a.foto} alt={`Foto enviada por ${a.nome}`} /></a>}
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

        {aba !== "avaliacoes" && <div className="cartoes">
          {visiveis.map((p) => (
            <article key={p.numero} className={`pedido st-${p.status}`}>
              <header>
                <div>
                  <h2>#{p.numero} · {p.nome}</h2>
                  <span className="sub">{dia(p.criadoEm)} às {hora(p.criadoEm)}</span>
                </div>
                <span className={`selo st-${p.status}`}>{NOMES[p.status]}</span>
              </header>
              {p.agendadoPara && (
                <div className="agendado">Reservado para <strong>{rotuloAgendado(p.agendadoPara)}</strong></div>
              )}

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
                    <strong>PAGO NO SITE · {gbp(p.total)}</strong>
                    <span>{p.pago ? (p.squarePedido ? "Pago pela Square (cartão / Apple Pay / Google Pay)" : "Pago online (cartão)") : "Aguardando o pagamento"}</span>
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
                {msgEtapa(p) && (
                  <a
                    className="btn btn-zap"
                    href={`https://wa.me/${whatsapp(p.telefone)}?text=${encodeURIComponent(msgEtapa(p)!.texto)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => { if (p.status === "saiu" && !p.avisadoSaiu) atualizar(p.numero, { avisoManual: "saiu" }); }}
                  >
                    💬 {msgEtapa(p)!.rotulo}
                  </a>
                )}
                {p.status !== "cancelado" && (
                  <button className="btn" onClick={() => imprimir(p.numero)} title="Imprimir o recibo da cozinha">🖨 Imprimir</button>
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
        </div>}
      </div>
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

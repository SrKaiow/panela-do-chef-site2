"use client";

import { conferirVersao } from "@/lib/versao";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Avaliacao, Pedido, Status } from "@/lib/db";
import { rotuloAgendado } from "@/lib/horario";
import EditarFoto from "./painel/EditarFoto";

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
// Sem emoji nas mensagens: o WhatsApp no computador (Windows) troca vários deles por "�" quando vêm pelo link.
// *texto* sai em negrito no WhatsApp; \n vira quebra de linha.
const primeiroNome = (p: Pedido) => {
  const n = p.nome.trim().split(/\s+/)[0] || "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
};
const msgSaiu = (p: Pedido) =>
  `Oi, ${primeiroNome(p)}! Aqui é da *Panela do Chef*.\n\nSeu pedido *#${p.numero}* acabou de *sair para entrega*.\n\nAcompanhe o entregador ao vivo no mapa:\n${linkRastreio(p)}`;

function msgEtapa(p: Pedido): { rotulo: string; texto: string } | null {
  const nome = primeiroNome(p);
  const link = linkRastreio(p);
  switch (p.status) {
    case "confirmado":
      return { rotulo: "Avisar: pedido aceito", texto: `Oi, ${nome}! Aqui é da *Panela do Chef*.\n\nRecebemos e *aceitamos o seu pedido #${p.numero}*.\n\nAcompanhe cada etapa ao vivo:\n${link}` };
    case "preparando":
      return { rotulo: "Avisar: na cozinha", texto: `Oi, ${nome}! Seu pedido *#${p.numero}* já está *na cozinha*.\n\nAssim que sair para entrega, a gente te avisa. Acompanhe por aqui:\n${link}` };
    case "saiu":
      if (p.retirada) return { rotulo: "Avisar: pronto para coletar", texto: `Oi, ${nome}! Aqui é da *Panela do Chef*.\n\nSeu pedido *#${p.numero}* está *pronto para coletar*. Pode vir buscar na porta!\n\nLocal e detalhes:\n${link}` };
      return { rotulo: "Avisar: saiu para entrega", texto: msgSaiu(p) };
    case "entregue":
      return { rotulo: "Agradecer e pedir avaliação", texto: `Oi, ${nome}! Seu pedido *#${p.numero}* foi ${p.retirada ? "retirado" : "entregue"}.\n\nMuito obrigado por pedir na *Panela do Chef*! Bom apetite.\n\nSe puder, conta pra gente o que achou (dá até para mandar foto):\n${link}` };
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

  const [editandoFoto, setEditandoFoto] = useState<Avaliacao | null>(null);
  async function salvarFotoEditada(a: Avaliacao, blob: Blob) {
    const fd = new FormData();
    fd.append("foto", blob, "avaliacao.jpg");
    const up = await fetch("/api/painel/fotos", { method: "POST", body: fd });
    const d = await up.json();
    if (!up.ok) throw new Error(d.erro);
    const r = await fetch(`/api/painel/avaliacoes/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ foto: d.url }) });
    if (!r.ok) throw new Error("Não consegui salvar a foto.");
    setAvaliacoes((as) => as.map((x) => (x.id === a.id ? { ...x, foto: d.url } : x)));
    setEditandoFoto(null);
  }

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
      conferirVersao(r);
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
      // Impressão pedida pelo celular ou pelo Telegram: este computador imprime se o "Imprimir sozinho" estiver ligado.
      // (Só em computador: no celular a impressão abriria a janela de imprimir.)
      if (autoRef.current && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        let feitas: string[] = [];
        try { feitas = JSON.parse(localStorage.getItem("impressoes-remotas") || "[]"); } catch {}
        const remotas = lista.filter((p) => p.imprimirPedido && Date.now() - new Date(p.imprimirPedido).getTime() < 30 * 60000 && !feitas.includes(`${p.numero}@${p.imprimirPedido}`));
        if (remotas.length) {
          feitas = [...feitas, ...remotas.map((p) => `${p.numero}@${p.imprimirPedido}`)].slice(-200);
          try { localStorage.setItem("impressoes-remotas", JSON.stringify(feitas)); } catch {}
          remotas.forEach((p, i) => setTimeout(() => imprimir(p.numero), i * 4000));
        }
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

  /** Joga o pedido em "Clientes a pagar" (acha o cliente pelo telefone ou cria). */
  async function porNaConta(p: Pedido) {
    if (!window.confirm(`Pôr o pedido #${p.numero} (${gbp(p.total)}) na conta de ${p.nome}? O entregador não vai cobrar.`)) return;
    try {
      const r = await fetch("/api/painel/contas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "do-pedido", numero: p.numero }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro || "Não consegui lançar.");
      setPedidos((lista) => lista.map((x) => (x.numero === p.numero ? { ...x, naConta: true } : x)));
    } catch (e: any) {
      window.alert(e.message);
    }
  }

  async function mudarFrete(p: Pedido, tirar: boolean) {
    if (tirar && !window.confirm(`Tirar o frete de ${gbp(p.taxa)} do pedido #${p.numero}? O total fica ${gbp(p.total - p.taxa)}.`)) return;
    const r = await fetch(`/api/painel/pedidos/${p.numero}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ frete: tirar ? "tirar" : "devolver" }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErro(d.erro || "Não consegui mudar o frete.");
    carregar();
  }

  async function atualizar(numero: number, dados: { status?: Status; pago?: boolean; avisoManual?: "saiu" | "chegando"; imprimirNaLoja?: boolean }) {
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
                    {a.avatar && <img className="av-avatar" src={a.avatar} alt={`Foto de perfil de ${a.nome}`} />}
                    <h2>{"★".repeat(a.nota)}<span style={{ opacity: 0.25 }}>{"★".repeat(5 - a.nota)}</span> · {a.nome}</h2>
                    <span className="sub">{a.local ? a.local + " · " : ""}{dia(a.criadoEm)} às {hora(a.criadoEm)}{a.pedidoNumero ? ` · pedido #${a.pedidoNumero}` : ""}</span>
                  </div>
                  <span className={"selo " + (a.status === "aprovada" ? "st-entregue" : a.status === "pendente" ? "st-novo" : "")}>
                    {a.status === "aprovada" ? "No site" : a.status === "pendente" ? "Esperando você" : "Escondida"}
                  </span>
                </header>
                <p style={{ margin: 0 }}>{a.texto}</p>
                {a.foto && (
                  <div className="av-foto-bloco">
                    <a href={a.foto} target="_blank" rel="noreferrer"><img className="av-foto" src={a.foto} alt={`Foto enviada por ${a.nome}`} /></a>
                    <button className="btn av-editar" onClick={() => setEditandoFoto(a)}>✏️ Esconder endereço / dados da foto</button>
                  </div>
                )}
                <footer>
                  {a.status !== "aprovada" && <button className="btn principal-p" onClick={() => moderar(a.id, "aprovada")}>Aprovar e mostrar no site</button>}
                  {a.status !== "oculta" && <button className="btn" onClick={() => moderar(a.id, "oculta")}>{a.status === "aprovada" ? "Tirar do site" : "Não mostrar"}</button>}
                </footer>
              </article>
            ))}
          </div>
        )}
        {editandoFoto?.foto && (
          <EditarFoto src={editandoFoto.foto} fechar={() => setEditandoFoto(null)} salvar={(b) => salvarFotoEditada(editandoFoto, b)} />
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
                  <Cronometro p={p} />
                </div>
                {p.retirada && <span className="selo selo-coleta">COLETA</span>}
                <span className={`selo st-${p.status}`}>{p.retirada && p.status === "saiu" ? "Pronto p/ coletar" : p.retirada && p.status === "entregue" ? "Retirado" : NOMES[p.status]}</span>
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

              <div className={"pag " + p.pagamento + (p.naConta ? " na-conta" : "")}>
                {p.naConta ? (
                  <>
                    <strong>📒 NA CONTA · {gbp(p.total)}</strong>
                    <span>Cliente paga depois: não cobrar na entrega</span>
                  </>
                ) : p.pagamento === "dinheiro" ? (
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
                {p.retirada ? <div><strong>Cliente vem coletar na porta</strong> · sem taxa{p.distanciaM ? ` · estava a ${(p.distanciaM / 1609.344).toFixed(1)} mi ao pedir` : ""}</div> : <div>{p.endereco}, <strong>{p.postcode}</strong></div>}
                {p.observacao && <div className="obs">{p.observacao}</div>}
                <div className="links">
                  <a href={`https://wa.me/${whatsapp(p.telefone)}`} target="_blank" rel="noreferrer">WhatsApp {p.telefone}</a>
                  {!p.retirada && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.endereco + ", " + p.postcode)}`} target="_blank" rel="noreferrer">Abrir no mapa</a>}
                </div>
              </div>

              <footer>
                {PROXIMO[p.status] && (
                  <button className="btn principal-p" onClick={() => atualizar(p.numero, { status: PROXIMO[p.status]!.status })}>
                    {p.retirada && p.status === "preparando" ? "Pronto para coletar" : p.retirada && p.status === "saiu" ? "Cliente retirou" : PROXIMO[p.status]!.rotulo}
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
                  <button className="btn" onClick={() => imprimir(p.numero)} title="Imprimir neste aparelho">🖨 Imprimir</button>
                )}
                {p.status !== "cancelado" && (
                  <button className="btn" onClick={async () => { await atualizar(p.numero, { imprimirNaLoja: true }); window.alert("Pronto! O computador da loja vai imprimir em alguns segundos (precisa estar com o painel aberto e o \"Imprimir sozinho\" ligado)."); }} title="Manda imprimir na impressora da loja, de qualquer lugar">🖨 Imprimir na loja</button>
                )}
                {p.status !== "aguardando_pagamento" && p.status !== "cancelado" && (
                  <a className="btn" href={`/pedido/${p.token}`} target="_blank" rel="noreferrer">Ver rastreio</a>
                )}
                {!p.retirada && p.status !== "cancelado" && !(p.pagamento === "cartao" && p.pago) && (
                  p.freteRemovido > 0
                    ? <button className="btn btn-frete feito" onClick={() => mudarFrete(p, false)} title="Volta a cobrar o frete">🚚 Frete grátis (era {gbp(p.freteRemovido)}) · desfazer</button>
                    : p.taxa > 0 && <button className="btn btn-frete" onClick={() => mudarFrete(p, true)}>🚚 Tirar frete ({gbp(p.taxa)})</button>
                )}
                {p.pagamento === "dinheiro" && !p.naConta && p.status !== "cancelado" && (
                  <button className="btn btn-conta" onClick={() => porNaConta(p)} title="Lança este pedido em Clientes a pagar">📒 Pôr na conta (a pagar)</button>
                )}
                {p.naConta && <a className="btn" href="#contas">📒 Ver na conta</a>}
                {p.pagamento === "dinheiro" && !p.naConta && p.status === "entregue" && (
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

/**
 * Relógio do pedido (só no painel): quanto tempo desde que o cliente pediu, contando ao vivo.
 * Verde até 20 min, amarelo até 40, vermelho depois disso (pisca passando de 1 hora).
 * Reserva: conta a partir do horário reservado. Entregue: mostra quanto tempo levou no total.
 */
function Cronometro({ p }: { p: Pedido }) {
  const ativo = ["novo", "confirmado", "preparando", "saiu"].includes(p.status);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  const inicio = new Date(p.agendadoPara ?? p.criadoEm).getTime();
  const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
    const dd = (n: number) => String(n).padStart(2, "0");
    return h ? `${h}h ${dd(m)}min` : `${dd(m)}:${dd(seg)}`;
  };
  if (p.status === "entregue") {
    const fim = p.entregueEm ? new Date(p.entregueEm).getTime() : null;
    return fim && fim > inicio ? <span className="crono crono-fim">✓ levou {fmt(fim - inicio)}</span> : null;
  }
  if (!ativo) return null;
  if (p.agendadoPara && agora < inicio) return <span className="crono crono-espera">⏰ reserva em {fmt(inicio - agora)}</span>;
  const min = (agora - inicio) / 60000;
  const cor = min >= 40 ? "crono-vermelho" + (min >= 60 ? " crono-pisca" : "") : min >= 20 ? "crono-amarelo" : "crono-verde";
  return (
    <span className={"crono " + cor} title="Tempo desde que o cliente pediu" suppressHydrationWarning>
      ⏱ {fmt(agora - inicio)}
    </span>
  );
}

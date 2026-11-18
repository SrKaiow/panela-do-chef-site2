"use client";

import { useEffect, useRef, useState } from "react";
import Mapa from "./Mapa";
import Avaliar from "./Avaliar";
import type { AoVivo } from "@/lib/rastreio";
import { rotuloAgendado } from "@/lib/horario";

type Status = AoVivo["status"];

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "");
/** Distância em milhas (jardas quando está bem perto). */
const km = (m: number) => {
  const milhas = m / 1609.344;
  return milhas < 0.25 ? `${Math.round(m * 1.0936)} yd` : `${milhas.toFixed(1)} mi`;
};
const ORDEM: Status[] = ["novo", "confirmado", "preparando", "saiu", "entregue"];

/** Mensagem grande do topo: o que está acontecendo agora com o pedido. */
function manchete(ao: AoVivo): { titulo: string; texto: string } {
  if (ao.retirada) {
    const ag = ao.agendadoPara && new Date(ao.agendadoPara).getTime() > Date.now() + 30 * 60000;
    if (ao.status === "novo") return ag ? { titulo: "Pedido reservado!", texto: `A cozinha deixa pronto para você coletar ${rotuloAgendado(ao.agendadoPara!)}.` } : { titulo: "Pedido enviado para a cozinha", texto: "Aguardando o Chef aceitar. Leva só um instante." };
    if (ao.status === "confirmado") return { titulo: "Pedido aceito!", texto: ag ? `Fica pronto para coletar ${rotuloAgendado(ao.agendadoPara!)}.` : "O Chef aceitou o seu pedido. Já já a cozinha começa." };
    if (ao.status === "preparando") return { titulo: "A cozinha começou o seu pedido", texto: "Tá na panela! Assim que ficar pronto, você recebe o aviso para vir buscar." };
    if (ao.status === "saiu") return { titulo: "Pronto! Pode vir buscar", texto: "Seu pedido está pronto e esperando por você na porta." };
    if (ao.status === "entregue") return { titulo: "Pedido retirado", texto: "Bom apetite! Obrigado por pedir na Panela do Chef." };
  }
  const agendado = ao.agendadoPara && new Date(ao.agendadoPara).getTime() > Date.now() + 30 * 60000;
  switch (ao.status) {
    case "novo":
      return agendado
        ? { titulo: "Pedido reservado!", texto: `Ele fica guardado e a cozinha prepara para entregar ${rotuloAgendado(ao.agendadoPara!)}.` }
        : { titulo: "Pedido enviado para a cozinha", texto: "Aguardando o Chef aceitar. Leva só um instante." };
    case "confirmado":
      return agendado
        ? { titulo: "Pedido aceito!", texto: `Reserva confirmada para ${rotuloAgendado(ao.agendadoPara!)}.` }
        : { titulo: "Pedido aceito!", texto: "O Chef aceitou o seu pedido. Já já a cozinha começa." };
    case "preparando":
      return { titulo: "A cozinha começou o seu pedido agora", texto: "Tá na panela! Assim que ficar pronto, sai para entrega." };
    case "saiu":
      if (ao.naFila) return { titulo: "Seu pedido está no carro", texto: "O entregador está fazendo uma entrega antes da sua. Quando ele vier até você, o carro aparece no mapa com o tempo de chegada." };
      return { titulo: "Saiu para entrega", texto: ao.saiuEm ? `Saiu da cozinha às ${hora(ao.saiuEm)}. Acompanhe o carro no mapa.` : "O entregador está a caminho." };
    case "entregue":
      return { titulo: "Pedido entregue", texto: "Bom apetite! Obrigado por pedir na Panela do Chef." };
    default:
      return { titulo: "", texto: "" };
  }
}

const NOME_IMPREVISTO: Record<string, string> = { transito: "Muito trânsito no caminho", acidente: "Acidente no caminho", obras: "Obras / desvio no caminho" };
const ICONE_IMPREVISTO: Record<string, string> = { transito: "🚦", acidente: "💥", obras: "🚧" };

export default function Rastreio({ token, inicial, nome, jaAvaliado }: { token: string; inicial: AoVivo; nome: string; jaAvaliado: boolean }) {
  const [ao, setAo] = useState<AoVivo>(inicial);
  const [notificar, setNotificar] = useState(false);
  const [podeNotificar, setPodeNotificar] = useState(false);
  const [, tique] = useState(0);
  const avisou = useRef(inicial.chegando);
  // Alarme de "pronto para coletar" (só na coleta): toca, vibra e mostra aviso na tela.
  const [alarmeLigado, setAlarmeLigado] = useState(false);
  const [tocando, setTocando] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const statusAnterior = useRef(inicial.status);

  useEffect(() => {
    try { localStorage.removeItem("panela-carrinho-v1"); } catch {}
    setPodeNotificar("Notification" in window);
    const t = setInterval(() => tique((n) => n + 1), 30000); // atualiza "chega em X min"
    return () => clearInterval(t);
  }, []);

  const final = ao.status === "entregue" || ao.status === "cancelado" || ao.status === "aguardando_pagamento";

  useEffect(() => {
    if (final) return;
    let vivo = true;
    async function buscar() {
      try {
        const r = await fetch(`/api/pedido/${token}/status`, { cache: "no-store" });
        if (r.ok && vivo) setAo(await r.json());
      } catch {}
    }
    // A caminho: a cada 4 s, para o carro andar no mapa. Coleta: a cada 5 s, para o alarme tocar na hora. Antes disso: a cada 8 s.
    const t = setInterval(buscar, ao.status === "saiu" ? 4000 : ao.retirada ? 5000 : 8000);
    const voltou = () => { if (document.visibilityState === "visible") buscar(); };
    document.addEventListener("visibilitychange", voltou);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", voltou); };
  }, [token, ao.status, final]);

  // Mudou de etapa: vibra de leve e, se o cliente deixou, mostra notificação.
  useEffect(() => {
    if (statusAnterior.current === ao.status) return;
    statusAnterior.current = ao.status;
    if (ao.retirada && ao.status === "saiu") {
      setTocando(true);
      try {
        if (Notification.permission === "granted")
          new Notification("Pedido pronto para coletar!", { body: "O Chef já está indo até a porta com o seu pedido.", tag: "pronto-" + token, requireInteraction: true } as NotificationOptions);
      } catch {}
      return;
    }
    const m = manchete(ao);
    try { navigator.vibrate?.(200); } catch {}
    try {
      if (notificar && Notification.permission === "granted") new Notification(m.titulo, { body: m.texto });
    } catch {}
  }, [ao, notificar]);

  useEffect(() => {
    if (ao.chegando && !avisou.current && ao.status === "saiu") {
      avisou.current = true;
      try { navigator.vibrate?.([300, 120, 300]); } catch {}
      try {
        if (notificar && Notification.permission === "granted") {
          new Notification("Seu pedido está chegando!", { body: "Falta mais ou menos 1 minuto. Já pode ir até a porta." });
        }
      } catch {}
    }
  }, [ao.chegando, ao.status, notificar]);

  // Toca o alarme (bipes fortes) e vibra sem parar até o cliente tocar em "Ok" (no máximo 2 minutos).
  useEffect(() => {
    if (!tocando) return;
    const titulo = document.title;
    let n = 0;
    const tocar = () => {
      n++;
      try { navigator.vibrate?.([500, 200, 500, 200, 500]); } catch {}
      document.title = n % 2 ? "🔔 PEDIDO PRONTO!" : titulo;
      const ctx = audioRef.current ?? (() => { try { return (audioRef.current = new AudioContext()); } catch { return null; } })();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      [0, 0.28, 0.56].forEach((d, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = i === 2 ? 1320 : 990;
        const t0 = ctx.currentTime + d;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
        o.connect(g).connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + 0.24);
      });
    };
    tocar();
    const t = setInterval(tocar, 1500);
    const fim = setTimeout(() => setTocando(false), 120000);
    return () => { clearInterval(t); clearTimeout(fim); document.title = titulo; try { navigator.vibrate?.(0); } catch {} };
  }, [tocando]);

  /** Precisa de um toque do cliente: libera o som no celular (regra do iPhone/Android) e pede para mostrar notificação. */
  async function ligarAlarme() {
    try {
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      await ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.26);
    } catch {}
    try { navigator.vibrate?.(150); } catch {}
    setAlarmeLigado(true);
    try {
      if ("Notification" in window && Notification.permission === "default") {
        const p = await Notification.requestPermission();
        setNotificar(p === "granted");
      }
    } catch {}
  }

  async function pedirNotificacao() {
    try {
      const p = await Notification.requestPermission();
      setNotificar(p === "granted");
    } catch {}
  }

  if (ao.status === "cancelado" || ao.status === "aguardando_pagamento") return null;

  const atual = ORDEM.indexOf(ao.status);
  const m = manchete(ao);
  const minutosPrevisao = ao.previsao ? Math.max(1, Math.round((new Date(ao.previsao).getTime() - Date.now()) / 60000)) : null;
  const etapas: { id: Status; nome: string; em: string | null }[] = [
    { id: "novo", nome: "Pedido enviado", em: ao.criadoEm },
    { id: "confirmado", nome: "Pedido aceito", em: ao.aceitoEm },
    { id: "preparando", nome: "A cozinha começou", em: ao.preparoEm },
    { id: "saiu", nome: ao.retirada ? "Pronto para coletar" : "Saiu para entrega", em: ao.saiuEm },
    { id: "entregue", nome: ao.retirada ? "Retirado" : "Entregue", em: ao.entregueEm },
  ];

  return (
    <section className="rastreio" aria-label="Acompanhe seu pedido">
      {tocando && (
        <div className="alarme-pronto" role="alertdialog" aria-labelledby="alarme-titulo">
          <div className="alarme-caixa">
            <span className="alarme-sino" aria-hidden="true">🔔</span>
            <h2 id="alarme-titulo">Pedido pronto para coletar!</h2>
            <p>O Chef já está indo até a porta com o seu pedido. Pode encostar!</p>
            <button type="button" className="principal" onClick={() => setTocando(false)}><span>Ok, estou aqui</span></button>
          </div>
        </div>
      )}

      {ao.retirada && ["novo", "confirmado", "preparando"].includes(ao.status) && (
        <div className={"alarme-ligar" + (alarmeLigado ? " ligado" : "")}>
          {alarmeLigado ? (
            <>
              <strong>🔔 Alarme ligado</strong>
              <span>Deixe esta página aberta e o volume ligado: quando ficar pronto, o celular toca e vibra.</span>
            </>
          ) : (
            <>
              <strong>Vai esperar aqui fora?</strong>
              <span>Ligue o alarme: quando o pedido ficar pronto, o celular toca e vibra na hora.</span>
              <button type="button" className="principal" onClick={ligarAlarme}><span>🔔 Ligar alarme de pronto</span></button>
            </>
          )}
        </div>
      )}
      {ao.status === "saiu" && ao.chegando && (
        <div className="chegando" role="alert">
          <strong>Seu pedido está na porta em ~1 minuto!</strong>
          <span>Pode ir até a porta.</span>
        </div>
      )}

      {ao.status === "saiu" && ao.imprevisto && (
        <div className="imprevisto-cliente" role="status">
          <strong>
            {ICONE_IMPREVISTO[ao.imprevisto.motivo] ?? "⚠️"} Atrasou ~{ao.imprevisto.minutos} min · {NOME_IMPREVISTO[ao.imprevisto.motivo] ?? "Imprevisto no caminho"}
          </strong>
          <span>
            O entregador avisou às {hora(ao.imprevisto.em)}.{ao.imprevisto.lat != null ? " O ponto vermelho no mapa mostra onde está o problema." : ""} Desculpe a demora, já já chega!
          </span>
        </div>
      )}

      <div className={`manchete etapa-${ao.status}`} aria-live="polite">
        <div>
          <h2>{m.titulo}</h2>
          <p>{m.texto}</p>
        </div>
        {ao.status !== "entregue" && minutosPrevisao != null && (
          minutosPrevisao > 90 ? (
            <div className="previsao">
              <span>{ao.retirada ? "Coleta marcada" : "Entrega marcada"}</span>
              <strong className="num">{hora(ao.previsao)}</strong>
              <span>{rotuloAgendado(ao.previsao!).split(" às ")[0]}</span>
            </div>
          ) : (
            <div className="previsao">
              <span>{ao.retirada ? "Pronto em" : "Chega em"}</span>
              <strong className="num">~{minutosPrevisao} min</strong>
              <span>por volta das {hora(ao.previsao)}</span>
            </div>
          )
        )}
      </div>

      {ao.naFrente != null && ao.status !== "preparando" && (
        <div className="fila">
          <span className="fila-num num">{ao.naFrente}</span>
          <span>
            {ao.naFrente === 0
              ? "Nenhum pedido na sua frente. Você é o próximo!"
              : ao.naFrente === 1
                ? "pedido na sua frente na cozinha"
                : "pedidos na sua frente na cozinha"}
          </span>
        </div>
      )}

      <ol className="etapas">
        {etapas.map((e, i) => {
          const estado = i < atual ? "feito" : i === atual ? "agora" : "depois";
          return (
            <li key={e.id} className={estado}>
              <span className="bolinha" aria-hidden="true">{estado === "feito" ? "✓" : i + 1}</span>
              <div>
                <strong>{e.nome}</strong>
                {estado !== "depois" && e.em && <span>{hora(e.em)}</span>}
              </div>
            </li>
          );
        })}
      </ol>

      {ao.retirada && ao.status !== "entregue" && (
        <div className="coleta-local">
          <strong>Onde coletar</strong>
          <span>Na porta da Panela do Chef · {ao.postcodeCozinha}</span>
          <div className="coleta-botoes">
            <a className="secundario" href={`https://www.google.com/maps/dir/?api=1&destination=${ao.cozinha.lat},${ao.cozinha.lng}`} target="_blank" rel="noopener">Abrir no Google Maps</a>
            <a className="secundario" href={`https://waze.com/ul?ll=${ao.cozinha.lat},${ao.cozinha.lng}&navigate=yes`} target="_blank" rel="noopener">Abrir no Waze</a>
          </div>
          <span className="dica">Chegou? Manda um WhatsApp que a gente leva até a porta.</span>
        </div>
      )}

      {ao.status === "saiu" && !ao.retirada && (
        <div className="ao-vivo">
          <div className="ao-vivo-topo">
            <span className="pulso" aria-hidden="true" />
            <strong>
              {ao.entregador
                ? ao.distancia != null
                  ? `O entregador está a ${km(ao.distancia)}${ao.minutos != null ? ` · cerca de ${Math.max(1, Math.round(ao.minutos))} min` : ""}`
                  : "O entregador está a caminho"
                : ao.naFila
                  ? "O entregador está terminando outra entrega. Você é um dos próximos."
                  : "Aguardando a localização do entregador..."}
            </strong>
          </div>
          <Mapa entregador={ao.entregador} destino={ao.destino} cozinha={ao.cozinha} alerta={ao.imprevisto?.lat != null ? { lat: ao.imprevisto.lat, lng: ao.imprevisto.lng!, icone: ICONE_IMPREVISTO[ao.imprevisto.motivo] ?? "⚠️" } : null} />
          {podeNotificar && !notificar && (
            <button type="button" className="secundario" onClick={pedirNotificacao}>
              Me avise aqui também quando estiver chegando
            </button>
          )}
          <p className="dica">Você também recebe um aviso no WhatsApp quando faltar cerca de 1 minuto.</p>
        </div>
      )}

      {ao.status !== "saiu" && ao.status !== "entregue" && podeNotificar && !notificar && (
        <button type="button" className="secundario" onClick={pedirNotificacao}>
          Me avise quando o pedido mudar de etapa
        </button>
      )}

      {ao.status === "entregue" && !jaAvaliado && (
        <div className="avaliar-pedido">
          <h2>Como estava? Avalie seu pedido</h2>
          <Avaliar token={token} nomeInicial={nome.split(" ")[0]} />
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Mapa from "./Mapa";
import Avaliar from "./Avaliar";
import type { AoVivo } from "@/lib/rastreio";
import { rotuloAgendado } from "@/lib/horario";

type Status = AoVivo["status"];

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "");
const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);
const ORDEM: Status[] = ["novo", "confirmado", "preparando", "saiu", "entregue"];

/** Mensagem grande do topo: o que está acontecendo agora com o pedido. */
function manchete(ao: AoVivo): { titulo: string; texto: string } {
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
      return { titulo: "Saiu para entrega", texto: ao.saiuEm ? `Saiu da cozinha às ${hora(ao.saiuEm)}. Acompanhe a moto no mapa.` : "O entregador está a caminho." };
    case "entregue":
      return { titulo: "Pedido entregue", texto: "Bom apetite! Obrigado por pedir na Panela do Chef." };
    default:
      return { titulo: "", texto: "" };
  }
}

export default function Rastreio({ token, inicial, nome, jaAvaliado }: { token: string; inicial: AoVivo; nome: string; jaAvaliado: boolean }) {
  const [ao, setAo] = useState<AoVivo>(inicial);
  const [notificar, setNotificar] = useState(false);
  const [podeNotificar, setPodeNotificar] = useState(false);
  const [, tique] = useState(0);
  const avisou = useRef(inicial.chegando);
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
    // A caminho: a cada 4 s, para a moto andar no mapa. Antes disso: a cada 8 s.
    const t = setInterval(buscar, ao.status === "saiu" ? 4000 : 8000);
    const voltou = () => { if (document.visibilityState === "visible") buscar(); };
    document.addEventListener("visibilitychange", voltou);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", voltou); };
  }, [token, ao.status, final]);

  // Mudou de etapa: vibra de leve e, se o cliente deixou, mostra notificação.
  useEffect(() => {
    if (statusAnterior.current === ao.status) return;
    statusAnterior.current = ao.status;
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
    { id: "saiu", nome: "Saiu para entrega", em: ao.saiuEm },
    { id: "entregue", nome: "Entregue", em: ao.entregueEm },
  ];

  return (
    <section className="rastreio" aria-label="Acompanhe seu pedido">
      {ao.status === "saiu" && ao.chegando && (
        <div className="chegando" role="alert">
          <strong>Seu pedido está na porta em ~1 minuto!</strong>
          <span>Pode ir até a porta.</span>
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
              <span>Entrega marcada</span>
              <strong className="num">{hora(ao.previsao)}</strong>
              <span>{rotuloAgendado(ao.previsao!).split(" às ")[0]}</span>
            </div>
          ) : (
            <div className="previsao">
              <span>Chega em</span>
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

      {ao.status === "saiu" && (
        <div className="ao-vivo">
          <div className="ao-vivo-topo">
            <span className="pulso" aria-hidden="true" />
            <strong>
              {ao.entregador
                ? ao.distancia != null
                  ? `A moto está a ${km(ao.distancia)}${ao.minutos != null ? ` · cerca de ${Math.max(1, Math.round(ao.minutos))} min` : ""}`
                  : "A moto está a caminho"
                : "Aguardando a localização do entregador..."}
            </strong>
          </div>
          <Mapa entregador={ao.entregador} destino={ao.destino} cozinha={ao.cozinha} />
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

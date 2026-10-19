"use client";

import { useEffect, useRef, useState } from "react";
import Mapa from "./Mapa";
import Avaliar from "./Avaliar";

type Status = "aguardando_pagamento" | "novo" | "confirmado" | "preparando" | "saiu" | "entregue" | "cancelado";
type Ao = {
  status: Status;
  statusEm: string | null;
  destino: { lat: number; lng: number } | null;
  entregador: { lat: number; lng: number; atualizadoEm: string } | null;
  distancia: number | null;
  minutos: number | null;
  chegando: boolean;
};

const ETAPAS: { id: Status; nome: string; texto: string }[] = [
  { id: "novo", nome: "Pedido recebido", texto: "Recebemos seu pedido." },
  { id: "confirmado", nome: "Confirmado", texto: "O Chef confirmou e já vai começar." },
  { id: "preparando", nome: "Preparando", texto: "Seu pedido está na panela." },
  { id: "saiu", nome: "Saiu para entrega", texto: "O entregador está a caminho." },
  { id: "entregue", nome: "Entregue", texto: "Bom apetite!" },
];

const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "");
const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

export default function Rastreio({ token, inicial, nome, jaAvaliado }: { token: string; inicial: Ao; nome: string; jaAvaliado: boolean }) {
  const [ao, setAo] = useState<Ao>(inicial);
  const [notificar, setNotificar] = useState(false);
  const avisou = useRef(inicial.chegando);

  // Pedido confirmado: limpa o carrinho guardado no navegador.
  useEffect(() => { try { localStorage.removeItem("panela-carrinho-v1"); } catch {} }, []);

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
    // Mais rápido quando está a caminho, para o mapa andar suave.
    const t = setInterval(buscar, ao.status === "saiu" ? 5000 : 15000);
    return () => { vivo = false; clearInterval(t); };
  }, [token, ao.status, final]);

  // Aviso de chegada também na tela (vibra e mostra notificação se o cliente permitiu).
  useEffect(() => {
    if (ao.chegando && !avisou.current && ao.status === "saiu") {
      avisou.current = true;
      try { navigator.vibrate?.([300, 120, 300]); } catch {}
      try {
        if (notificar && "Notification" in window && Notification.permission === "granted") {
          new Notification("Seu pedido está chegando!", { body: "Falta mais ou menos 1 minuto. Já pode ir até a porta." });
        }
      } catch {}
    }
  }, [ao.chegando, ao.status, notificar]);

  async function pedirNotificacao() {
    try {
      if (!("Notification" in window)) return;
      const p = await Notification.requestPermission();
      setNotificar(p === "granted");
    } catch {}
  }

  if (ao.status === "cancelado" || ao.status === "aguardando_pagamento") return null;

  const atual = ETAPAS.findIndex((e) => e.id === ao.status);

  return (
    <section className="rastreio" aria-label="Acompanhe seu pedido">
      {ao.status === "saiu" && ao.chegando && (
        <div className="chegando" role="alert">
          <strong>Seu pedido está na porta em ~1 minuto!</strong>
          <span>Pode ir até a porta.</span>
        </div>
      )}

      <ol className="etapas">
        {ETAPAS.map((e, i) => {
          const estado = i < atual ? "feito" : i === atual ? "agora" : "depois";
          return (
            <li key={e.id} className={estado}>
              <span className="bolinha" aria-hidden="true">{estado === "feito" ? "✓" : i + 1}</span>
              <div>
                <strong>{e.nome}</strong>
                {estado === "agora" && (
                  <span>{e.texto}{ao.statusEm ? ` · ${hora(ao.statusEm)}` : ""}</span>
                )}
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
                  ? `O entregador está a ${km(ao.distancia)}${ao.minutos != null ? ` · cerca de ${Math.max(1, Math.round(ao.minutos))} min` : ""}`
                  : "O entregador está a caminho"
                : "Aguardando a localização do entregador..."}
            </strong>
          </div>
          {(ao.entregador || ao.destino) && <Mapa entregador={ao.entregador} destino={ao.destino} />}
          {!notificar && typeof window !== "undefined" && "Notification" in window && (
            <button type="button" className="secundario" onClick={pedirNotificacao}>
              Me avise aqui também quando estiver chegando
            </button>
          )}
          <p className="dica">Você também recebe um aviso no WhatsApp quando faltar cerca de 1 minuto.</p>
        </div>
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

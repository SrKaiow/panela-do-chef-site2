"use client";

import { useEffect, useState } from "react";

/**
 * "👀 N vendo agora": número real de quem está com o site aberto neste momento.
 * Cada aba manda um sinal a cada 25s (só enquanto está visível) com o id anônimo do navegador.
 * Só aparece com 2 ou mais pessoas, para não mostrar "1" (que seria a própria pessoa).
 */
const INTERVALO = 25_000;

function idVisitante() {
  try {
    let id = localStorage.getItem("panela-visitante");
    if (!id || !/^[a-z0-9]{16,40}$/.test(id)) {
      const b = new Uint8Array(12);
      crypto.getRandomValues(b);
      id = Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 24);
      localStorage.setItem("panela-visitante", id);
    }
    return { id, contar: localStorage.getItem("panela-sem-contagem") !== "1" };
  } catch {
    return { id: undefined, contar: false };
  }
}

export default function PessoasOnline() {
  const [n, setN] = useState<number | null>(null);

  useEffect(() => {
    const { id, contar } = idVisitante();
    let parado = false;
    async function sinal() {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/online", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ v: id, contar }), cache: "no-store" });
        const j = await r.json();
        if (!parado && typeof j.agora === "number") setN(j.agora);
      } catch {}
    }
    sinal();
    const t = setInterval(sinal, INTERVALO);
    const aoVoltar = () => document.visibilityState === "visible" && sinal();
    // Fechou a aba ou saiu do site: sai da contagem na hora (em vez de esperar o sinal vencer).
    const aoSair = () => {
      if (!id || !contar) return;
      try { navigator.sendBeacon("/api/online", new Blob([JSON.stringify({ v: id, sair: true })], { type: "application/json" })); } catch {}
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pagehide", aoSair);
    return () => { parado = true; clearInterval(t); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("pagehide", aoSair); };
  }, []);

  if (n == null || n < 2) return null;
  return (
    <div className="pessoas-online" role="status" aria-live="polite">
      <span className="po-ponto" aria-hidden="true" />
      <span aria-hidden="true">👀</span>
      <span><b className="num">{n}</b> vendo agora</span>
    </div>
  );
}

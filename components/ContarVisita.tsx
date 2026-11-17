"use client";

import { useEffect } from "react";

/**
 * Conta a visita ao site (para o painel "Visitas do site").
 * Usa um número aleatório guardado neste navegador, sem nome, telefone nem cookie.
 * Abrir de novo dentro de 30 min conta como a mesma visita. Quem quiser pode desligar na política de privacidade.
 */
export default function ContarVisita() {
  useEffect(() => {
    try {
      if (localStorage.getItem("panela-sem-contagem") === "1") return;
      let id = localStorage.getItem("panela-visitante");
      if (!id || !/^[a-z0-9]{16,40}$/.test(id)) {
        const b = new Uint8Array(12);
        crypto.getRandomValues(b);
        id = Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 24);
        localStorage.setItem("panela-visitante", id);
      }
      const ultima = Number(localStorage.getItem("panela-visita-em") || 0);
      if (Date.now() - ultima < 30 * 60_000) return;
      localStorage.setItem("panela-visita-em", String(Date.now()));
      fetch("/api/visita", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ v: id }), keepalive: true }).catch(() => {});
    } catch {}
  }, []);
  return null;
}

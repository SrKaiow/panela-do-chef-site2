"use client";

import { useEffect } from "react";

/**
 * Define o papel com exatamente a altura do recibo: sai tudo numa nota só, por maior que seja o pedido.
 * Vale para o botão Imprimir, para a impressão automática e também para Ctrl+P nesta página.
 * Com auto=true, abre a impressão sozinho quando a logo termina de carregar.
 */
export default function ImprimirAuto({ auto }: { auto: boolean }) {
  useEffect(() => {
    const estilo = document.createElement("style");
    document.head.appendChild(estilo);
    const medir = () => {
      const r = document.querySelector<HTMLElement>(".recibo");
      if (!r) return;
      const mm = Math.ceil((r.scrollHeight * 25.4) / 96) + 6;
      estilo.textContent = `@page { size: 63mm ${mm}mm !important; margin: 0 !important; } @media print { html, body { height: auto !important; overflow: visible !important; } .recibo { break-inside: avoid; } }`;
    };
    medir();
    window.addEventListener("beforeprint", medir);
    const logo = document.querySelector<HTMLImageElement>(".r-logo");
    const pronto = () => {
      medir();
      if (auto) setTimeout(() => { medir(); window.print(); }, 300);
    };
    if (logo && !logo.complete) logo.addEventListener("load", pronto, { once: true });
    else pronto();
    return () => window.removeEventListener("beforeprint", medir);
  }, [auto]);
  return null;
}

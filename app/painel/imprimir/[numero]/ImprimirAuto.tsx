"use client";

import { useEffect } from "react";

/**
 * Abre a impressão sozinho quando o recibo termina de carregar (logo incluída).
 * Antes, mede o recibo e define o papel com exatamente essa altura: sai tudo numa nota só,
 * por maior que seja o pedido (sem quebrar em duas folhas).
 */
export default function ImprimirAuto() {
  useEffect(() => {
    const imprimir = () =>
      setTimeout(() => {
        const r = document.querySelector<HTMLElement>(".recibo");
        if (r) {
          const mm = Math.ceil((r.scrollHeight * 25.4) / 96) + 4;
          const s = document.createElement("style");
          s.textContent = `@page { size: 63mm ${mm}mm; margin: 0; } @media print { html, body { height: auto; overflow: visible; } }`;
          document.head.appendChild(s);
        }
        window.print();
      }, 300);
    const logo = document.querySelector<HTMLImageElement>(".r-logo");
    if (logo && !logo.complete) logo.addEventListener("load", imprimir, { once: true });
    else imprimir();
  }, []);
  return null;
}

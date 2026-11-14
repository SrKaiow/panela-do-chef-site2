"use client";

import { useEffect } from "react";

/** Abre a impressão sozinho quando o recibo termina de carregar (logo incluída). */
export default function ImprimirAuto() {
  useEffect(() => {
    const imprimir = () => setTimeout(() => window.print(), 300);
    const logo = document.querySelector<HTMLImageElement>(".r-logo");
    if (logo && !logo.complete) logo.addEventListener("load", imprimir, { once: true });
    else imprimir();
  }, []);
  return null;
}
